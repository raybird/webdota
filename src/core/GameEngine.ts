import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager, type PlayerInput, type GameState, type PlayerState } from './NetworkManager';
import { UIManager } from './UIManager';
import { ECSPlayerManager } from './managers/ECSPlayerManager';
import { InputManager } from './managers/InputManager';
import { RenderManager } from './managers/RenderManager';
import { EffectManager } from './EffectManager';
import { ECSStructureManager, type StructureKind } from './managers/ECSStructureManager';
import { ECSCreepManager } from './managers/ECSCreepManager';
import { EntitySyncManager } from './managers/EntitySyncManager';
import { SoundManager } from './SoundManager';
import { useGameStore } from '../stores/gameStore';
import { useRoomStore } from '../stores/roomStore';
import { eventBus } from '../events/EventBus';
import { ProjectileManager } from './combat/ProjectileManager';
import { ECSSkillExecutor } from './combat/ECSSkillExecutor';
import { MapManager, type MapConfig } from './map';
import demoArenaMap from '../data/maps/demo_arena.json';
import {
    World,
    EntityFactory,
    MovementSystem,
    RenderSystem,
    HealthSystem,
    CombatSystem,
    CollisionSystem,
    AISystem,
    SpatialSystem,
    SkillSystem,
    ComponentType,
    TeamComponent,
    TransformComponent,
    colliderRegistry,
    type EntityId,
} from './ecs';

/** 每個畫面幀最多補跑的 fixedUpdate 次數，避免分頁切回來時一次追太多幀 */
const MAX_STEPS_PER_FRAME = 5;
/** Host 每幾個 fixedUpdate 廣播一次玩家狀態 */
const STATE_BROADCAST_INTERVAL = 3;
/** Host 每幾個 fixedUpdate 廣播一次建築與小兵狀態 */
const ENTITY_BROADCAST_INTERVAL = 6;
/** 本地玩家預測位置與 Host 差距超過這個距離就拉回（擊退、被拒絕的位移等） */
const RECONCILE_DISTANCE = 2;

export interface MinimapEntity {
    id: string;
    type: 'player' | StructureKind | 'creep';
    team: 'red' | 'blue' | 'neutral';
    position: { x: number; z: number };
}

/**
 * 遊戲引擎核心
 * 負責協調各個子系統與驅動遊戲循環
 *
 * 網路模型為 Host 權威：Host 處理所有玩家的輸入並模擬小兵、防禦塔，廣播玩家與建築、小兵狀態；
 * Client 送出自己的輸入並在本地先行預測移動，建築與小兵是 Host 狀態的鏡像，不跑 AI 也不判定傷害。
 */
export class GameEngine {
    app!: pc.Application;
    physicsWorld!: RAPIER.World;

    // Managers
    networkManager: NetworkManager;
    uiManager!: UIManager;
    playerManager!: ECSPlayerManager;
    inputManager!: InputManager;
    renderManager!: RenderManager;
    effectManager!: EffectManager;
    projectileManager!: ProjectileManager;
    mapManager!: MapManager;
    structureManager!: ECSStructureManager;
    creepManager!: ECSCreepManager;
    entitySync!: EntitySyncManager;
    soundManager!: SoundManager;

    // ECS
    ecsWorld!: World;
    entityFactory!: EntityFactory;
    collisionSystem!: CollisionSystem;
    aiSystem!: AISystem;
    ecsSkillExecutor!: ECSSkillExecutor;

    readonly FIXED_TIMESTEP = 1 / 60;

    // State
    private gameStore = useGameStore();
    private roomStore = useRoomStore();
    private currentFrame = 0;
    private accumulator = 0;
    private isGameStarted = false;

    private pendingSkillUse: { skillId: string; direction: { x: number; z: number } } | null = null;
    /** Host：各 Client 最新的移動輸入（封包沒到的幀沿用上一筆，避免抖動） */
    private remoteMoves: Map<string, PlayerInput> = new Map();
    /** 尚未處理的其他玩家技能輸入（Host 權威執行；Client 只播放表現） */
    private remoteSkills: PlayerInput[] = [];

    /** destroy 時要執行的清理（事件監聽等） */
    private disposers: Array<() => void> = [];

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager;
    }

    private get isHost(): boolean {
        return this.networkManager.isHost;
    }

    async init(canvas: HTMLCanvasElement) {
        await RAPIER.init();
        this.physicsWorld = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

        this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            keyboard: new pc.Keyboard(window),
            touch: new pc.TouchDevice(canvas),
            elementInput: new pc.ElementInput(canvas)
        });
        this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const camera = this.createScene();
        this.mapManager = new MapManager(this.app, this.physicsWorld);
        await this.mapManager.loadMap(demoArenaMap as unknown as MapConfig);

        this.uiManager = new UIManager(this.app);
        this.inputManager = new InputManager();
        this.renderManager = new RenderManager(this.app);
        this.renderManager.setCamera(camera);
        this.effectManager = new EffectManager(this.app);
        this.projectileManager = new ProjectileManager(this.app);
        this.soundManager = new SoundManager(this.app);

        this.ecsWorld = new World();
        this.collisionSystem = new CollisionSystem(this.physicsWorld);
        this.entityFactory = new EntityFactory(this.app, this.physicsWorld, this.ecsWorld);
        this.entityFactory.setCollisionSystem(this.collisionSystem);

        const renderSystem = new RenderSystem();
        renderSystem.camera = camera;

        this.ecsWorld.addSystem(new SkillSystem());
        this.ecsWorld.addSystem(new MovementSystem());
        this.ecsWorld.addSystem(new CombatSystem());
        this.ecsWorld.addSystem(this.collisionSystem);
        this.ecsWorld.addSystem(new SpatialSystem());
        this.aiSystem = new AISystem();
        this.ecsWorld.addSystem(this.aiSystem);
        this.ecsWorld.addSystem(new HealthSystem());
        this.ecsWorld.addSystem(renderSystem);

        this.ecsSkillExecutor = new ECSSkillExecutor(this.collisionSystem);
        this.structureManager = new ECSStructureManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.creepManager = new ECSCreepManager(this.mapManager, this.uiManager, this.ecsWorld, this.entityFactory);
        this.playerManager = new ECSPlayerManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.entitySync = new EntitySyncManager(this.ecsWorld, this.structureManager, this.creepManager);

        this.setupEventListeners();

        const onUpdate = (dt: number) => this.gameLoop(dt);
        this.app.on('update', onUpdate);
        this.app.start();

        console.log("[GameEngine] Initialized");
    }

    private createScene(): pc.Entity {
        const camera = new pc.Entity('Camera');
        camera.addComponent('camera', { clearColor: new pc.Color(0.05, 0.05, 0.15) });
        camera.setPosition(0, 25, 30);
        camera.lookAt(0, 0, 0);
        this.app.root.addChild(camera);

        const light = new pc.Entity('Light');
        light.addComponent('light', { type: 'directional', color: new pc.Color(1, 1, 1), castShadows: true, intensity: 1 });
        light.setEulerAngles(45, 0, 0);
        this.app.root.addChild(light);

        return camera;
    }

    private setupEventListeners() {
        this.inputManager.setPlayerId(this.networkManager.peerId);

        this.networkManager.onInputReceived = (input) => {
            // 移動以 Host 為準；Client 收到其他玩家的技能輸入只用來播放表現
            if (this.isHost) this.remoteMoves.set(input.playerId, input);
            if (input.skillUsed) this.remoteSkills.push(input);
        };
        // onPeerLeft 同時被 RoomService 用來更新房間名單，這裡接在後面並在 destroy 時還原
        const roomOnPeerLeft = this.networkManager.onPeerLeft;
        this.networkManager.onPeerLeft = (peerId) => {
            roomOnPeerLeft?.(peerId);
            this.remoteMoves.delete(peerId);
            this.playerManager.removePlayer(peerId);
        };
        this.disposers.push(() => { this.networkManager.onPeerLeft = roomOnPeerLeft; });
        this.networkManager.onGameState = (state) => this.handleGameState(state);
        this.networkManager.onEntityState = (_frame, entities) => {
            if (!this.isHost && this.isGameStarted) this.entitySync.apply(entities);
        };
        this.networkManager.onGameOver = (winnerTeam, reason) => {
            if (!this.isHost) eventBus.emit({ type: 'GAME_OVER', winnerTeam, reason });
        };

        this.disposers.push(
            eventBus.on('GAME_STARTED', () => this.startGame()),
            eventBus.on('SKILL_USED', (event) => this.useSkill(event.skillId)),
            eventBus.on('GAME_OVER', (event) => {
                this.soundManager.playGameOverSound();
                // 主堡死亡只在 Host 判定，再通知 Client
                if (this.isHost) this.networkManager.broadcastGameOver(event.winnerTeam, event.reason);
            }),
        );

        const onResize = () => this.app.resizeCanvas();
        window.addEventListener('resize', onResize);
        this.disposers.push(() => window.removeEventListener('resize', onResize));
    }

    startGame() {
        this.inputManager.setPlayerId(this.networkManager.peerId);
        this.isGameStarted = true;
        this.currentFrame = 0;
        this.accumulator = 0;
        this.remoteMoves.clear();
        this.remoteSkills = [];

        this.playerManager.clearAll();
        this.structureManager.clearAll();
        this.creepManager.clearAll();
        this.creepManager.resetWaveTimer();
        this.projectileManager.clearAll();
        this.entitySync.reset();

        // Client 的 AI 與傷害判定交給 Host；建築與小兵由 Host 同步生成
        this.aiSystem.enabled = this.isHost;
        this.collisionSystem.authoritative = this.isHost;
        if (this.isHost) this.spawnStructuresFromMap();

        const players = [...this.roomStore.connectedPlayers].sort((a, b) => a.id.localeCompare(b.id));
        const radius = 5;
        players.forEach((player, index) => {
            const angle = (index / players.length) * Math.PI * 2;
            this.playerManager.spawnPlayer(player.id, { x: Math.cos(angle) * radius, y: 1, z: Math.sin(angle) * radius });
        });

        const peerId = this.networkManager.peerId;
        if (this.playerManager.getPlayer(peerId)) {
            const skills = this.playerManager.getPlayerSkills(peerId);
            const normalSkills = skills.filter(s => s.type === 'normal');
            const ultimateSkill = skills.find(s => s.type === 'ultimate');
            const basicSkill = skills.find(s => s.type === 'basic');
            this.inputManager.setSkillSlots([
                normalSkills[0]?.id || '', normalSkills[1]?.id || '', normalSkills[2]?.id || '',
                ultimateSkill?.id || '', basicSkill?.id || ''
            ]);
        }
    }

    /**
     * Client：套用 Host 廣播的權威狀態
     * 本地玩家保留本地預測的位置，偏離 Host 太多時才拉回
     */
    private handleGameState(state: GameState) {
        this.currentFrame = state.frame;

        for (const pData of state.players) {
            if (!this.playerManager.getPlayer(pData.id)) {
                this.playerManager.spawnPlayer(pData.id, pData.pos);
            }
            const rb = this.playerManager.getPlayerRigidBody(pData.id);
            if (rb) {
                const isLocal = pData.id === this.networkManager.peerId;
                const pos = rb.translation();
                const drift = Math.hypot(pos.x - pData.pos.x, pos.z - pData.pos.z);
                if (!isLocal || drift > RECONCILE_DISTANCE) {
                    rb.setNextKinematicTranslation(pData.pos);
                    if (!isLocal) rb.setNextKinematicRotation(pData.rot);
                }
            }
            this.playerManager.setPlayerHp(pData.id, pData.stats.hp);
            this.playerManager.setPlayerEnergy(pData.id, pData.stats.energy);
        }

        if (state.isGameStarted) this.isGameStarted = true;
    }

    gameLoop(dt: number) {
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= this.FIXED_TIMESTEP && steps < MAX_STEPS_PER_FRAME) {
            this.fixedUpdate(this.FIXED_TIMESTEP);
            this.accumulator -= this.FIXED_TIMESTEP;
            steps++;
        }
        // 追不上時丟掉剩餘時間，而不是越積越多
        if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

        this.renderManager.updateCamera(dt, this.networkManager.peerId, this.playerManager);
    }

    fixedUpdate(dt: number) {
        if (!this.isGameStarted) return;

        const localInput = this.inputManager.collectInput(this.currentFrame);
        if (this.pendingSkillUse) {
            localInput.skillUsed = this.pendingSkillUse.skillId;
            localInput.skillDirection = this.pendingSkillUse.direction;
            this.pendingSkillUse = null;
        }

        // Client 每幀送輸入給 Host；Host 只在放技能時送，讓 Client 播放表現
        if (!this.isHost || localInput.skillUsed) this.networkManager.sendInput(localInput);

        this.applyMovement(localInput, dt);
        this.applySkill(localInput);

        for (const input of this.remoteSkills) this.applySkill(input);
        this.remoteSkills = [];

        if (this.isHost) {
            for (const input of this.remoteMoves.values()) this.applyMovement(input, dt);

            this.creepManager.update(dt);
            this.structureManager.update();
        }

        this.projectileManager.update(dt, this.ecsWorld, this.collisionSystem);
        this.physicsWorld.step();
        this.ecsWorld.update(dt);

        if (this.isHost) {
            if (this.currentFrame % STATE_BROADCAST_INTERVAL === 0) this.broadcastState();
            if (this.currentFrame % ENTITY_BROADCAST_INTERVAL === 0) {
                this.networkManager.broadcastEntityState(this.currentFrame, this.entitySync.collect());
            }
        }

        this.currentFrame++;
        this.gameStore.setFrame(this.currentFrame);
    }

    private applyMovement(input: PlayerInput, dt: number) {
        const rb = this.playerManager.getPlayerRigidBody(input.playerId);
        if (!rb) return;

        let { moveX, moveY } = input;
        const mag = Math.sqrt(moveX * moveX + moveY * moveY);
        if (mag > 1.05) { moveX /= mag; moveY /= mag; }
        if (moveX === 0 && moveY === 0) return;

        const speed = this.playerManager.getPlayerMoveSpeed(input.playerId);
        const moveZ = -moveY;
        const currentPos = rb.translation();
        rb.setNextKinematicTranslation({
            x: currentPos.x + moveX * speed * dt,
            y: currentPos.y,
            z: currentPos.z + moveZ * speed * dt
        });
        const halfAngle = Math.atan2(moveX, moveZ) / 2;
        rb.setNextKinematicRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) });
    }

    private applySkill(input: PlayerInput) {
        if (!input.skillUsed || !input.skillDirection) return;

        // 技能執行器以 ECS Entity ID 查詢施放者的物理與隊伍，不是玩家（Peer）ID
        const casterEntityId = this.playerManager.getPlayer(input.playerId);
        const skill = this.playerManager.useSkill(input.playerId, input.skillUsed);
        if (!casterEntityId || !skill) return;

        this.ecsSkillExecutor.executeSkill(
            skill, casterEntityId, new pc.Vec3(input.skillDirection.x, 0, input.skillDirection.z),
            this.ecsWorld, this.effectManager, this.projectileManager, this.soundManager
        );
    }

    private broadcastState() {
        const players: PlayerState[] = [];
        for (const playerId of this.playerManager.getAllPlayers().keys()) {
            const rb = this.playerManager.getPlayerRigidBody(playerId);
            const hp = this.playerManager.getPlayerHp(playerId);
            const energy = this.playerManager.getPlayerEnergy(playerId);
            if (!rb || !hp || !energy) continue;
            players.push({
                id: playerId,
                pos: rb.translation(),
                rot: rb.rotation(),
                stats: { hp: hp.current, energy: energy.current }
            });
        }
        this.networkManager.broadcastGameState({
            frame: this.currentFrame,
            timestamp: Date.now(),
            players,
            isGameStarted: this.isGameStarted
        });
    }

    private spawnStructuresFromMap() {
        for (const kind of ['tower', 'base'] as const) {
            for (const entity of this.mapManager.getEntitiesByType(kind)) {
                const [x = 0, y = 0, z = 0] = entity.position;
                this.structureManager.spawn(kind, entity.team || 'neutral', { x, y, z }, entity.config || {});
            }
        }
    }

    /**
     * 小地圖資料
     */
    getMinimapEntities(): MinimapEntity[] {
        const result: MinimapEntity[] = [];
        const push = (entityId: EntityId, id: string, type: MinimapEntity['type']) => {
            const transform = this.ecsWorld.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            const team = this.ecsWorld.getComponent<TeamComponent>(entityId, ComponentType.TEAM);
            if (!transform || !team) return;
            result.push({ id, type, team: team.team, position: { x: transform.position.x, z: transform.position.z } });
        };

        for (const [entityId, { kind }] of this.structureManager.getAll()) push(entityId, entityId, kind);
        for (const entityId of this.creepManager.getAllCreepIds()) push(entityId, entityId, 'creep');
        // 玩家用 Peer ID，讓小地圖能標出本地玩家
        for (const [playerId, entityId] of this.playerManager.getAllPlayers()) push(entityId, playerId, 'player');

        return result;
    }

    /**
     * 取得實體目前的世界座標（給螢幕空間 UI 投影用）
     */
    getEntityPosition(entityId: EntityId): pc.Vec3 | null {
        return this.ecsWorld.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)?.position ?? null;
    }

    getCamera(): pc.Entity | null {
        return this.renderManager.camera;
    }

    useSkill(skillId: string) {
        const peerId = this.networkManager.peerId;
        if (!this.playerManager.getPlayer(peerId)) return;
        const skillCd = this.playerManager.getPlayerSkillCooldowns(peerId).get(skillId);
        if (!skillCd || skillCd.current > 0) return;
        const skill = this.playerManager.getPlayerSkills(peerId).find(s => s.id === skillId);
        const energy = this.playerManager.getPlayerEnergy(peerId);
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

    /**
     * 離開遊戲時釋放所有資源，避免舊引擎繼續跑或殘留事件監聽
     */
    destroy() {
        this.disposers.forEach(dispose => dispose());
        this.disposers = [];

        this.networkManager.onInputReceived = undefined;
        this.networkManager.onGameState = undefined;
        this.networkManager.onEntityState = undefined;
        this.networkManager.onGameOver = undefined;

        this.isGameStarted = false;
        this.inputManager.destroy();
        this.renderManager.destroy();
        this.soundManager.destroy();
        this.projectileManager.clearAll();
        this.ecsWorld.clear();
        colliderRegistry.clear();

        this.app.destroy();
        this.physicsWorld.free();
    }
}
