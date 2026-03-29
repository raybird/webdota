import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager, type PlayerInput, type GameState } from './NetworkManager';
import { HostManager } from './HostManager';
import { UIManager } from './UIManager';
import { ECSPlayerManager } from './managers/ECSPlayerManager';
import { InputManager } from './managers/InputManager';
import { RenderManager } from './managers/RenderManager';
import { EffectManager } from './EffectManager';
import { ECSTowerManager } from './managers/ECSTowerManager';
import { ECSBaseManager } from './managers/ECSBaseManager';
import { ECSCreepManager } from './managers/ECSCreepManager';
import { SoundManager } from './SoundManager';
import { useGameStore } from '../stores/gameStore';
import { useRoomStore } from '../stores/roomStore';
import { eventBus } from '../events/EventBus';
import { ProjectileManager } from './combat/ProjectileManager';
import { MapManager, type MapConfig } from './map';
import { RefereeManager } from './managers/RefereeManager';
import demoArenaMap from '../data/maps/demo_arena.json';

// ECS Imports
import {
    World,
    EntityFactory,
    MovementSystem,
    RenderSystem as ECSRenderSystem,
    HealthSystem,
    CombatSystem as ECSCombatSystem,
    CollisionSystem,
    AISystem,
    SpatialSystem,
    PlayerInputSystem,
    SkillSystem,
    ComponentType,
    PoolableComponent,
    RenderComponent,
    TeamComponent,
} from './ecs';
import { ECSSkillExecutor } from './combat/ECSSkillExecutor';

/**
 * 遊戲引擎核心
 * 負責協調各個子系統與驅動遊戲循環
 */
export class GameEngine {
    app!: pc.Application;
    physicsWorld!: RAPIER.World;

    // Managers
    networkManager!: NetworkManager;
    hostManager!: HostManager;
    uiManager!: UIManager;
    playerManager!: ECSPlayerManager;
    inputManager!: InputManager;
    renderManager!: RenderManager;
    effectManager!: EffectManager;
    projectileManager!: ProjectileManager;
    mapManager!: MapManager;
    towerManager!: ECSTowerManager;
    creepManager!: ECSCreepManager;
    baseManager!: ECSBaseManager;
    soundManager!: SoundManager;

    // ECS
    ecsWorld!: World;
    entityFactory!: EntityFactory;
    collisionSystem!: CollisionSystem;
    ecsSkillExecutor!: ECSSkillExecutor;

    readonly FIXED_TIMESTEP = 1 / 60;

    // State
    private gameStore = useGameStore();
    private roomStore = useRoomStore();
    private currentFrame = 0;
    private accumulator = 0;
    private isGameStarted = false;

    // Power Economy
    private fpsMonitor: number[] = [];
    private currentTargetHz = 60;
    private powerSavingMode = false;

    private pendingSkillUse: { skillId: string; direction: { x: number; z: number } } | null = null;
    private pendingRemoteInputs: PlayerInput[] = [];

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager;
    }

    async init(canvas: HTMLCanvasElement) {
        await RAPIER.init();
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.physicsWorld = new RAPIER.World(gravity);
        console.log("[GameEngine] Physics Initialized");

        this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            keyboard: new pc.Keyboard(window),
            touch: new pc.TouchDevice(canvas),
            elementInput: new pc.ElementInput(canvas)
        });
        this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        this.mapManager = new MapManager(this.app, this.physicsWorld);
        this.createScene();
        this.mapManager.loadMap(demoArenaMap as unknown as MapConfig);

        this.uiManager = new UIManager(this.app);
        this.inputManager = new InputManager();
        this.renderManager = new RenderManager(this.app);
        this.effectManager = new EffectManager(this.app);
        this.projectileManager = new ProjectileManager(this.app);

        this.ecsWorld = new World();
        this.collisionSystem = new CollisionSystem(this.physicsWorld);
        this.entityFactory = new EntityFactory(this.app, this.physicsWorld, this.ecsWorld);
        this.entityFactory.setCollisionSystem(this.collisionSystem);

        this.ecsWorld.addSystem(new PlayerInputSystem());
        this.ecsWorld.addSystem(new SkillSystem());
        this.ecsWorld.addSystem(new MovementSystem());
        this.ecsWorld.addSystem(new ECSCombatSystem());
        this.ecsWorld.addSystem(this.collisionSystem);
        this.ecsWorld.addSystem(new SpatialSystem());
        this.ecsWorld.addSystem(new AISystem());
        this.ecsWorld.addSystem(new HealthSystem());
        this.ecsWorld.addSystem(new ECSRenderSystem());

        eventBus.on('ENTITY_DIED', (event) => {
            const entityId = event.entityId;
            const poolable = this.ecsWorld.getComponent<PoolableComponent>(entityId, ComponentType.POOLABLE);
            if (poolable && poolable.templateName === 'creep') {
                const render = this.ecsWorld.getComponent<RenderComponent>(entityId, ComponentType.RENDER);
                const team = this.ecsWorld.getComponent<TeamComponent>(entityId, ComponentType.TEAM);
                if (render && team) {
                    this.entityFactory.releaseCreepVisual(team.team, render.pcEntity);
                }
            }
        });

        this.ecsSkillExecutor = new ECSSkillExecutor(this.collisionSystem);
        this.towerManager = new ECSTowerManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.creepManager = new ECSCreepManager(this.mapManager, this.uiManager, this.ecsWorld, this.entityFactory);
        this.playerManager = new ECSPlayerManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.baseManager = new ECSBaseManager(this.ecsWorld, this.entityFactory, this.uiManager);

        this.spawnTowersFromMap();
        this.spawnBasesFromMap();
        this.soundManager = new SoundManager(this.app);

        eventBus.on('GAME_OVER', () => {
            this.soundManager.playGameOverSound();
        });

        const camera = this.app.root.findByName('Camera');
        if (camera) {
            this.renderManager.setCamera(camera as pc.Entity);
        }

        this.hostManager = new HostManager(this.app, this.physicsWorld);
        this.setupEventListeners();

        this.app.start();
        this.app.on('update', (dt) => this.gameLoop(dt));
        window.addEventListener('resize', () => this.app.resizeCanvas());

        console.log("[GameEngine] Initialized");
    }

    private createScene() {
        const camera = new pc.Entity('Camera');
        camera.addComponent('camera', { clearColor: new pc.Color(0.05, 0.05, 0.15) });
        camera.setPosition(0, 25, 30);
        camera.lookAt(0, 0, 0);
        this.app.root.addChild(camera);

        const light = new pc.Entity('Light');
        light.addComponent('light', { type: 'directional', color: new pc.Color(1, 1, 1), castShadows: true, intensity: 1 });
        light.setEulerAngles(45, 0, 0);
        this.app.root.addChild(light);
    }

    private setupEventListeners() {
        this.inputManager.setPlayerId(this.networkManager.peerId);
        this.networkManager.onInputReceived = (input) => {
            this.pendingRemoteInputs.push(input);
        };
        this.networkManager.onPeerLeft = (peerId) => {
            this.playerManager.removePlayer(peerId);
        };
        this.networkManager.onGameState = (state: GameState) => {
            this.handleGameState(state);
        };

        eventBus.on('GAME_STARTED', () => {
            this.startGame();
        });

        eventBus.on('SKILL_USED', (event) => {
            this.useSkill(event.skillId);
        });

        eventBus.on('SKILL_EFFECT', (event) => {
            const position = new pc.Vec3(event.position.x, event.position.y, event.position.z);
            const direction = new pc.Vec3(event.direction.x, event.direction.y, event.direction.z);
            this.effectManager.playSkillEffect(event.skillId, position, direction);
        });

        // 監聽來自 RefereeManager 的自癒請求
        window.addEventListener('WEBDOTA_RESYNC_REQUEST', (e: any) => {
            const frame = e.detail.frame;
            console.log(`[GameEngine] 收到自癒請求 @ Frame ${frame}. 執行因果回溯...`);
            this.restoreFromCheckpoint(frame);
        });
    }

    startGame() {
        this.inputManager.setPlayerId(this.networkManager.peerId);
        this.isGameStarted = true;
        this.currentFrame = 0;

        this.playerManager.clearAll();
        this.towerManager.clearAll();
        this.creepManager.clearAll();
        this.baseManager.clearAll();
        this.creepManager.resetWaveTimer();

        this.spawnTowersFromMap();
        this.spawnBasesFromMap();

        const players = [...this.roomStore.connectedPlayers].sort((a, b) => a.id.localeCompare(b.id));
        const radius = 5;
        players.forEach((player, index) => {
            const angle = (index / players.length) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.playerManager.spawnPlayer(player.id, { x, y: 1, z });
        });

        this.hostManager.setHost(this.roomStore.isHost);

        const peerId = this.networkManager.peerId;
        if (this.playerManager.getPlayer(peerId)) {
            const skills = this.playerManager.getPlayerSkills(peerId);
            const normalSkills = skills.filter(s => s.type === 'normal');
            const ultimateSkill = skills.find(s => s.type === 'ultimate');
            const basicSkill = skills.find(s => s.type === 'basic');
            const skillSlotIds = [
                normalSkills[0]?.id || '', normalSkills[1]?.id || '', normalSkills[2]?.id || '',
                ultimateSkill?.id || '', basicSkill?.id || ''
            ];
            this.inputManager.setSkillSlots(skillSlotIds);
        }
    }

    private handleGameState(state: GameState) {
        const referee = RefereeManager.getInstance();
        const stateHash = referee.calculateHash(state);
        
        if (state.frame !== undefined) {
            if (!referee.validate(state.frame, stateHash)) {
                console.warn(`[GameEngine] Causal Divergence at frame ${state.frame}!`);
            }
            referee.submitState(state.frame, stateHash);
            this.currentFrame = state.frame;
            this.gameStore.setFrame(this.currentFrame);
        }

        state.players.forEach((pData: any) => {
            if (!this.playerManager.getPlayer(pData.id)) {
                this.playerManager.spawnPlayer(pData.id, pData.pos);
            }
            const playerId = pData.id;
            if (playerId !== this.networkManager.peerId) {
                const rb = this.playerManager.getPlayerRigidBody(playerId);
                if (rb) {
                    rb.setNextKinematicTranslation(pData.pos);
                    rb.setNextKinematicRotation(pData.rot);
                }
            }
            this.playerManager.setPlayerHp(playerId, pData.stats.hp);
            this.playerManager.setPlayerEnergy(playerId, pData.stats.energy || 0);
        });

        if (state.isGameStarted) {
            this.isGameStarted = true;
            // 每 60 幀儲存一次硬核檢查點
            if (this.currentFrame % 60 === 0) {
                this.saveCheckpoint(state);
            }
        }
    }

    /**
     * 儲存檢查點：包含物理與邏輯的完整快照
     */
    private saveCheckpoint(state: GameState) {
        try {
            const checkpoint = {
                frame: this.currentFrame,
                timestamp: Date.now(),
                physics: this.physicsWorld.takeSnapshot(),
                logic: state
            };
            // 只保留最近 5 個檢查點以節省空間
            const history = JSON.parse(localStorage.getItem('webdota_checkpoints') || '[]');
            history.push(checkpoint);
            if (history.length > 5) history.shift();
            localStorage.setItem('webdota_checkpoints', JSON.stringify(history));
        } catch (e) {
            console.error("[Checkpoint] 儲存失敗:", e);
        }
    }

    /**
     * 從檢查點恢復狀態 (因果自癒)
     */
    private restoreFromCheckpoint(targetFrame: number) {
        try {
            const history = JSON.parse(localStorage.getItem('webdota_checkpoints') || '[]');
            // 尋找最接近目標幀的檢查點
            const bestFit = history.reverse().find((cp: any) => cp.frame <= targetFrame);
            
            if (bestFit) {
                console.log(`[Checkpoint] 正在恢復至 Frame ${bestFit.frame}...`);
                this.physicsWorld.free(); // 釋放舊物理世界
                this.physicsWorld = RAPIER.World.restoreSnapshot(bestFit.physics);
                this.currentFrame = bestFit.frame;
                this.handleGameState(bestFit.logic); // 恢復邏輯狀態
            }
        } catch (e) {
            console.error("[Checkpoint] 恢復失敗:", e);
        }
    }

    gameLoop(dt: number) {
        this.updatePowerEconomy(dt);
        const step = 1 / this.currentTargetHz;
        
        this.accumulator += dt;
        while (this.accumulator >= step) {
            this.fixedUpdate(step);
            this.accumulator -= step;
        }
        this.renderManager.updateCamera(dt, this.networkManager.peerId, this.playerManager);
    }

    private updatePowerEconomy(dt: number) {
        const fps = 1 / dt;
        this.fpsMonitor.push(fps);
        if (this.fpsMonitor.length > 180) this.fpsMonitor.shift(); // 監測最近 3 秒

        const avgFps = this.fpsMonitor.reduce((a, b) => a + b, 0) / this.fpsMonitor.length;
        
        if (avgFps < 30 && !this.powerSavingMode && this.fpsMonitor.length >= 180) {
            console.warn("[PowerEconomy] 偵測到極低幀率，啟動能耗規訓模式 (30Hz)");
            this.currentTargetHz = 30;
            this.powerSavingMode = true;
            eventBus.emit({ type: 'POWER_ECONOMY_TRIGGERED', data: { hz: 30 } });
        } else if (avgFps > 55 && this.powerSavingMode) {
            console.log("[PowerEconomy] 效能恢復，回到主權模式 (60Hz)");
            this.currentTargetHz = 60;
            this.powerSavingMode = false;
        }
    }

    fixedUpdate(dt: number) {
        if (!this.isGameStarted) return;
        const localInput = this.inputManager.collectInput(this.currentFrame);
        if (this.pendingSkillUse) {
            localInput.skillUsed = this.pendingSkillUse.skillId;
            localInput.skillDirection = this.pendingSkillUse.direction;
            this.pendingSkillUse = null;
        }

        if (this.hostManager.isHost) {
            this.networkManager.inputBuffer.get(this.currentFrame)?.set(this.networkManager.peerId, localInput);
        } else {
            this.networkManager.sendInput(localInput);
        }

        this.processInputs([localInput], dt);

        if (this.hostManager.isHost) {
            if (this.pendingRemoteInputs.length > 0) {
                this.processInputs(this.pendingRemoteInputs, dt);
                this.pendingRemoteInputs = [];
            }
            this.physicsWorld.step();
            this.towerManager.update(dt);
            this.creepManager.update(dt);
            this.baseManager.update(dt);
            this.ecsWorld.update(dt);

            if (this.currentFrame % 3 === 0) {
                const playersData: any[] = [];
                for (const [playerId] of this.playerManager.getAllPlayers()) {
                    const rb = this.playerManager.getPlayerRigidBody(playerId);
                    const hp = this.playerManager.getPlayerHp(playerId);
                    const energy = this.playerManager.getPlayerEnergy(playerId);
                    if (rb && hp && energy) {
                        playersData.push({
                            id: playerId, pos: rb.translation(), rot: rb.rotation(),
                            stats: { hp: hp.current, energy: energy.current }
                        });
                    }
                }
                this.networkManager.broadcastGameState({
                    frame: this.currentFrame, timestamp: Date.now(),
                    players: playersData, isGameStarted: this.isGameStarted
                });
            }
        } else {
            this.physicsWorld.step();
            this.ecsWorld.update(dt);
        }

        const allEntities = this.getAllCombatEntities().filter(e => !this.playerManager.getPlayer(e.entityId));
        this.uiManager.updateEntities(allEntities);
        this.currentFrame++;
        this.gameStore.setFrame(this.currentFrame);
    }

    processInputs(inputs: PlayerInput[], dt: number) {
        inputs.forEach((input) => {
            const playerId = input.playerId;
            if (!this.playerManager.getPlayer(playerId)) return;
            const speed = this.playerManager.getPlayerMoveSpeed(playerId);
            const rb = this.playerManager.getPlayerRigidBody(playerId);
            if (!rb) return;

            let safeMoveX = input.moveX;
            let safeMoveY = input.moveY;
            const mag = Math.sqrt(safeMoveX * safeMoveX + safeMoveY * safeMoveY);
            if (mag > 1.05) { safeMoveX /= mag; safeMoveY /= mag; }

            const moveDir = { x: safeMoveX, y: 0, z: -safeMoveY };
            if (moveDir.x !== 0 || moveDir.z !== 0) {
                const currentPos = rb.translation();
                rb.setNextKinematicTranslation({
                    x: currentPos.x + moveDir.x * speed * dt,
                    y: currentPos.y,
                    z: currentPos.z + moveDir.z * speed * dt
                });
                const angle = Math.atan2(moveDir.x, moveDir.z);
                rb.setNextKinematicRotation(new pc.Quat().setFromEulerAngles(0, angle * pc.math.RAD_TO_DEG, 0));
            }

            if (input.skillUsed && input.skillDirection) {
                const skill = this.playerManager.useSkill(playerId, input.skillUsed);
                if (skill) {
                    this.ecsSkillExecutor.executeSkill(
                        skill, playerId, new pc.Vec3(input.skillDirection.x, 0, input.skillDirection.z),
                        this.ecsWorld, this.effectManager, this.projectileManager, this.soundManager
                    );
                }
            }
        });
        const collisionSystem = this.ecsWorld.getSystem<CollisionSystem>('CollisionSystem');
        if (collisionSystem) {
            this.projectileManager.update(dt, collisionSystem, this.getAllCombatEntities());
        }
    }

    private getAllCombatEntities(): any[] {
        const combatEntityIds = this.ecsWorld.query(ComponentType.TRANSFORM, ComponentType.HEALTH);
        const entities: any[] = [];
        for (const id of combatEntityIds) {
            const transform = this.ecsWorld.getComponent(id, ComponentType.TRANSFORM) as any;
            const health = this.ecsWorld.getComponent(id, ComponentType.HEALTH) as any;
            if (!transform || !health) continue;
            entities.push({
                entityId: id, playerId: id, getPosition: () => transform.position,
                isDead: () => health.isDead(),
                combatStats: { currentHp: health.current, maxHp: health.max }
            });
        }
        return entities;
    }

    private spawnTowersFromMap() {
        this.mapManager.getEntitiesByType('tower').forEach((entity, index) => {
            this.towerManager.spawnTower(`tower_${entity.team}_${index}`, entity.team || 'neutral', 
                { x: entity.position[0], y: entity.position[1], z: entity.position[2] }, entity.config || {});
        });
    }

    private spawnBasesFromMap() {
        this.mapManager.getEntitiesByType('base').forEach((entity, index) => {
            this.baseManager.spawnBase(`base_${entity.team}_${index}`, entity.team || 'neutral', 
                { x: entity.position[0], y: entity.position[1], z: entity.position[2] }, entity.config || {});
        });
    }

    useSkill(skillId: string) {
        const peerId = this.networkManager.peerId;
        if (!this.playerManager.getPlayer(peerId)) return;
        const cooldowns = this.playerManager.getPlayerSkillCooldowns(peerId);
        const skillCd = cooldowns.get(skillId);
        const energy = this.playerManager.getPlayerEnergy(peerId);
        if (!skillCd || skillCd.current > 0) return;
        const skill = this.playerManager.getPlayerSkills(peerId).find(s => s.id === skillId);
        if (skill && energy && (skill.energyCost ?? 0) > energy.current) return;
        const direction = this.playerManager.getPlayerFacingDirection(peerId);
        if (!direction) return;
        this.pendingSkillUse = { skillId, direction: { x: direction.x, z: direction.z } };
    }

    getLocalPlayerSkills() { return this.playerManager.getPlayerSkills(this.networkManager.peerId); }
    getLocalPlayerCooldowns(): Map<string, number> {
        const cooldowns = this.playerManager.getPlayerSkillCooldowns(this.networkManager.peerId);
        const result = new Map<string, number>();
        for (const [id, cd] of cooldowns) { result.set(id, cd.current); }
        return result;
    }
}
