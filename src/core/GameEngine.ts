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
    // skillExecutor 已被 ecsSkillExecutor 取代
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

    // Game Loop

    // Game Loop
    readonly FIXED_TIMESTEP = 1 / 60;

    // State
    private gameStore = useGameStore();
    private roomStore = useRoomStore();
    // Frame sync
    private currentFrame = 0;
    private accumulator = 0;
    private isGameStarted = false;

    // 待處理的技能使用
    private pendingSkillUse: { skillId: string; direction: { x: number; z: number } } | null = null;

    // 待處理的遠端玩家輸入（不依賴 frame 對齊）
    private pendingRemoteInputs: PlayerInput[] = [];

    constructor(networkManager: NetworkManager) {
        // 使用外部傳入的 NetworkManager，避免覆蓋
        this.networkManager = networkManager;
    }

    async init(canvas: HTMLCanvasElement) {
        // 1. Initialize Physics
        await RAPIER.init();
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.physicsWorld = new RAPIER.World(gravity);
        console.log("[GameEngine] Physics Initialized");

        // 2. Initialize PlayCanvas
        this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            keyboard: new pc.Keyboard(window),
            touch: new pc.TouchDevice(canvas),
            elementInput: new pc.ElementInput(canvas)
        });
        this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // 3. Initialize MapManager first (before createScene which needs it)
        this.mapManager = new MapManager(this.app, this.physicsWorld);

        // 4. Create Scene (camera, light)
        this.createScene();

        // 5. Load map
        this.mapManager.loadMap(demoArenaMap as unknown as MapConfig);

        // 6. Initialize Managers
        this.uiManager = new UIManager(this.app);
        // 注意：ECSPlayerManager 需要在 ECS World 初始化後才能創建，移至下方
        this.inputManager = new InputManager();
        this.renderManager = new RenderManager(this.app);
        this.effectManager = new EffectManager(this.app);
        // this.skillExecutor = new SkillExecutor(); // Removed
        this.projectileManager = new ProjectileManager(this.app);

        // 7. Initialize ECS World and Systems (MUST be before Entity Managers)
        this.ecsWorld = new World();
        this.collisionSystem = new CollisionSystem(this.physicsWorld);
        this.entityFactory = new EntityFactory(this.app, this.physicsWorld, this.ecsWorld);
        this.entityFactory.setCollisionSystem(this.collisionSystem);

        // 註冊 ECS Systems
        this.ecsWorld.addSystem(new PlayerInputSystem());
        this.ecsWorld.addSystem(new SkillSystem());
        this.ecsWorld.addSystem(new MovementSystem());
        this.ecsWorld.addSystem(new ECSCombatSystem());
        this.ecsWorld.addSystem(this.collisionSystem);
        this.ecsWorld.addSystem(new SpatialSystem());
        this.ecsWorld.addSystem(new AISystem());
        this.ecsWorld.addSystem(new HealthSystem());
        this.ecsWorld.addSystem(new ECSRenderSystem());

        // 監聽實體死亡事件，處理池化回收
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

        // Initialize ECS SkillExecutor
        this.ecsSkillExecutor = new ECSSkillExecutor(this.collisionSystem);

        console.log('[GameEngine] ECS World initialized');

        // 8. Initialize Entity Managers (now ECS is ready)
        this.towerManager = new ECSTowerManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.creepManager = new ECSCreepManager(this.mapManager, this.uiManager, this.ecsWorld, this.entityFactory);
        this.playerManager = new ECSPlayerManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.baseManager = new ECSBaseManager(this.ecsWorld, this.entityFactory, this.uiManager);

        // 9. Spawn Towers and Bases from Map
        this.spawnTowersFromMap();
        this.spawnBasesFromMap();

        // 10. Initialize SoundManager
        this.soundManager = new SoundManager(this.app);

        // 11. Setup event listeners for sound
        eventBus.on('GAME_OVER', () => {
            this.soundManager.playGameOverSound();
        });

        // Find and set camera for RenderManager
        const camera = this.app.root.findByName('Camera');
        if (camera) {
            this.renderManager.setCamera(camera as pc.Entity);
        }

        // 12. Initialize Host Manager (使用已有的 NetworkManager)
        this.hostManager = new HostManager(this.app, this.physicsWorld);

        // 13. Setup Event Listeners
        this.setupEventListeners();

        // 14. Start Loop
        this.app.start();
        this.app.on('update', (dt) => this.gameLoop(dt));
        window.addEventListener('resize', () => this.app.resizeCanvas());

        console.log("[GameEngine] Initialized");
    }

    private createScene() {
        // Camera
        const camera = new pc.Entity('Camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.05, 0.05, 0.15)  // 深藍色背景
        });
        camera.setPosition(0, 25, 30);
        camera.lookAt(0, 0, 0);
        this.app.root.addChild(camera);

        // Light
        const light = new pc.Entity('Light');
        light.addComponent('light', {
            type: 'directional',
            color: new pc.Color(1, 1, 1),
            castShadows: true,
            intensity: 1
        });
        light.setEulerAngles(45, 0, 0);
        this.app.root.addChild(light);
    }

    private setupEventListeners() {
        // Network Events - 設置 playerId
        this.inputManager.setPlayerId(this.networkManager.peerId);

        // 設置輸入接收 callback (Host 需要接收 Client 的輸入)
        this.networkManager.onInputReceived = (input) => {
            // 直接加入待處理佇列（不依賴 frame 對齊）
            this.pendingRemoteInputs.push(input);

            // Debug log
            if (input.moveX !== 0 || input.moveY !== 0 || input.skillUsed) {
                console.log(`[GameEngine] Received remote input from ${input.playerId.substring(0, 8)}: move(${input.moveX.toFixed(2)}, ${input.moveY.toFixed(2)}) skill: ${input.skillUsed || 'none'}`);
            }
        };

        this.networkManager.onPeerLeft = (peerId) => {
            this.playerManager.removePlayer(peerId);
        };

        this.networkManager.onGameState = (state: GameState) => {
            this.handleGameState(state);
        };

        // EventBus Events
        eventBus.on('GAME_STARTED', () => {
            console.log('[GameEngine] GAME_STARTED event received');
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
    }

    /**
     * 開始遊戲 - 生成所有玩家
     */
    startGame() {
        console.log('[GameEngine] Starting game...');
        console.log('[GameEngine] My peerId:', this.networkManager.peerId);
        console.log('[GameEngine] Am I Host?:', this.roomStore.isHost);

        // 確保 InputManager 使用正確的 playerId (此時 peerId 已確定設定完成)
        this.inputManager.setPlayerId(this.networkManager.peerId);
        console.log('[GameEngine] InputManager playerId set to:', this.networkManager.peerId);

        this.isGameStarted = true;

        // 如果是 Host，廣播遊戲開始 (再次確保，雖然 RoomService 已經廣播過訊號，但 Engine 需要同步狀態)
        if (this.roomStore.isHost) {
            console.log('[GameEngine] Host broadcasting initial game state...');
        }

        this.currentFrame = 0;

        // 清空現有實體
        this.playerManager.clearAll();
        this.towerManager.clearAll();
        this.creepManager.clearAll();
        this.baseManager.clearAll();
        this.creepManager.resetWaveTimer();

        // 重新生成塔與主堡
        this.spawnTowersFromMap();
        this.spawnBasesFromMap();

        // 從 roomStore 獲取所有連線玩家並生成 (強制依 ID 排序以確保所有客戶端一致)
        const players = [...this.roomStore.connectedPlayers].sort((a, b) => a.id.localeCompare(b.id));
        console.log(`[GameEngine] Connected players (${players.length}), sorted by ID:`, JSON.stringify(players.map(p => p.id)));

        if (players.length === 0) {
            console.error('[GameEngine] ERROR: No players in roomStore!');
            return;
        }

        // 計算玩家生成位置 (圓形排列)
        const radius = 5;
        players.forEach((player, index) => {
            const angle = (index / players.length) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            console.log(`[GameEngine] Spawning player ${player.id} with character ${player.characterId} at (${x}, 1, ${z})`);
            this.playerManager.spawnPlayer(player.id, { x, y: 1, z });
        });

        // 設置 Host 狀態
        this.hostManager.setHost(this.roomStore.isHost);

        // 設置本地玩家的技能鍵位映射
        const peerId = this.networkManager.peerId;
        if (this.playerManager.getPlayer(peerId)) {
            const skills = this.playerManager.getPlayerSkills(peerId);
            const normalSkills = skills.filter(s => s.type === 'normal');
            const ultimateSkill = skills.find(s => s.type === 'ultimate');
            const basicSkill = skills.find(s => s.type === 'basic');

            // 映射順序: [Q/1, W/2, E/3, R/4, Basic/0]
            const skillSlotIds = [
                normalSkills[0]?.id || '',  // Q / 1
                normalSkills[1]?.id || '',  // W / 2
                normalSkills[2]?.id || '',  // E / 3
                ultimateSkill?.id || '',     // R / 4
                basicSkill?.id || ''         // Space / 0
            ];
            this.inputManager.setSkillSlots(skillSlotIds);
        }

        console.log('[GameEngine] Game started with', players.length, 'players');
    }

    private handleGameState(state: GameState) {
        // 同步 Host 的幀數
        if (state.frame !== undefined) {
            this.currentFrame = state.frame;
            this.gameStore.setFrame(this.currentFrame);
        }

        state.players.forEach((pData: any) => {
            // 如果玩家不存在，生成它
            if (!this.playerManager.getPlayer(pData.id)) {
                this.playerManager.spawnPlayer(pData.id, pData.pos);
            }

            const playerId = pData.id;
            const playerEntityId = this.playerManager.getPlayer(playerId);
            if (playerEntityId) {
                // 只同步其他玩家的位置（自己的位置由本地預測）
                if (playerId !== this.networkManager.peerId) {
                    if (pData.pos && pData.rot) {
                        const rb = this.playerManager.getPlayerRigidBody(playerId);
                        if (rb) {
                            rb.setNextKinematicTranslation(pData.pos);
                            rb.setNextKinematicRotation(pData.rot);
                        }
                    }
                }

                // 同步所有玩家的狀態（HP/能量）
                if (pData.stats) {
                    this.playerManager.setPlayerHp(playerId, pData.stats.hp);
                    this.playerManager.setPlayerEnergy(playerId, pData.stats.energy || 0);
                    // HP bar 由 ECS RenderSystem 處理
                }
            }
        });

        if (state.isGameStarted) {
            this.isGameStarted = true;
            // 實作本地檢查點：持久化戰局因果地板
            this.saveCheckpoint(state);
        }
    }

    /**
     * 持久化戰局狀態至本地空間 (Checkpointing)
     * 為 P2P 斷線重連提供因果召回地板
     */
    private saveCheckpoint(state: GameState) {
        try {
            const checkpoint = {
                timestamp: Date.now(),
                frame: this.currentFrame,
                players: state.players.length,
                data: state
            };
            localStorage.setItem('webdota_causal_floor', JSON.stringify(checkpoint));
        } catch (e) {
            // 靜默失效，不規訓正常戰局
        }
    }

    /**
     * 主遊戲循環
     */
    gameLoop(dt: number) {
        this.accumulator += dt;

        // Physics & Logic Update (Fixed Timestep)
        while (this.accumulator >= this.FIXED_TIMESTEP) {
            this.fixedUpdate(this.FIXED_TIMESTEP);
            this.accumulator -= this.FIXED_TIMESTEP;
        }

        // Visual Update
        // 注意：ECS RenderSystem 現在負責實體視覺同步
        this.renderManager.updateCamera(dt, this.networkManager.peerId, this.playerManager);
    }

    /**
     * 固定時間步長更新
     */
    fixedUpdate(dt: number) {
        if (!this.isGameStarted) return;

        // 1. Collect Local Input
        const localInput = this.inputManager.collectInput(this.currentFrame);

        // 收集技能輸入
        if (this.pendingSkillUse) {
            localInput.skillUsed = this.pendingSkillUse.skillId;
            localInput.skillDirection = this.pendingSkillUse.direction;
            this.pendingSkillUse = null; // 清除待處理
        }

        // 2. Send Input to Host (or process if Host)
        if (this.hostManager.isHost) {
            this.networkManager.inputBuffer.get(this.currentFrame)?.set(this.networkManager.peerId, localInput);
        } else {
            // Client: 發送輸入給 Host
            this.networkManager.sendInput(localInput);
        }

        // 3. 本地處理輸入 (Client-side prediction)
        // 無論是 Host 還是 Client，都先本地處理自己的輸入以獲得即時回饋
        this.processInputs([localInput], dt);

        // 4. Host 額外處理遠端玩家輸入
        if (this.hostManager.isHost) {
            // 處理所有待處理的遠端輸入（不依賴 frame 對齊）
            if (this.pendingRemoteInputs.length > 0) {
                this.processInputs(this.pendingRemoteInputs, dt);
                this.pendingRemoteInputs = []; // 清空佇列
            }

            // 3. Physics Step
            this.physicsWorld.step();

            // 4. Update Game Logic - 現在由 ECS Systems 處理
            // (SkillSystem, PlayerInputSystem 等已在 ecsWorld.update() 中執行)

            // 5. Update Entity Managers (Towers, Creeps, Bases)
            this.towerManager.update(dt);
            this.creepManager.update(dt);
            this.baseManager.update(dt);

            // 6. Update ECS World (handles player logic now)
            this.ecsWorld.update(dt);

            // 7. Broadcast State
            if (this.currentFrame % 3 === 0) { // 每 3 幀同步一次
                const playersData: { id: string; pos: any; rot: any; stats: { hp: number; energy: number } }[] = [];
                for (const [playerId] of this.playerManager.getAllPlayers()) {
                    const rb = this.playerManager.getPlayerRigidBody(playerId);
                    const hp = this.playerManager.getPlayerHp(playerId);
                    const energy = this.playerManager.getPlayerEnergy(playerId);
                    if (rb && hp && energy) {
                        playersData.push({
                            id: playerId,
                            pos: rb.translation(),
                            rot: rb.rotation(),
                            stats: {
                                hp: hp.current,
                                energy: energy.current
                            }
                        });
                    }
                }
                const gameState = {
                    frame: this.currentFrame,
                    timestamp: Date.now(),
                    players: playersData,
                    isGameStarted: this.isGameStarted
                };
                this.networkManager.broadcastGameState(gameState);
            }
        } else {
            // Client: 也執行物理模擬
            this.physicsWorld.step();
            // Client 的玩家邏輯由 ECS 處理
            this.ecsWorld.update(dt);
        }

        // Update UI for all players - 由 ECS RenderSystem 處理
        // this.uiManager.updateAll(this.playerManager.getAllPlayers());

        // Update UI for all entities (creeps, towers, bases)
        const allEntities = this.getAllCombatEntities().filter(e =>
            !this.playerManager.getPlayer(e.entityId) // Exclude players (already updated above)
        );
        this.uiManager.updateEntities(allEntities);

        this.currentFrame++;
        this.gameStore.setFrame(this.currentFrame);
    }
    processInputs(inputs: PlayerInput[], dt: number) {
        inputs.forEach((input) => {
            const playerId = input.playerId;
            // 嚴格 ID 驗證
            if (!this.playerManager.getPlayer(playerId)) {
                console.warn(`[GameEngine] processInputs: Player ${playerId.substring(0, 8)} not found! Skipping.`);
                return;
            }

            // Movement - 使用 ECS helpers
            const speed = this.playerManager.getPlayerMoveSpeed(playerId);
            const rb = this.playerManager.getPlayerRigidBody(playerId);
            if (!rb) return;

            // 防作弊校驗: 確保移動向量長度不超過 1 (或稍微寬容的 1.05)
            let safeMoveX = input.moveX;
            let safeMoveY = input.moveY;
            const mag = Math.sqrt(safeMoveX * safeMoveX + safeMoveY * safeMoveY);
            if (mag > 1.05) {
                safeMoveX /= mag;
                safeMoveY /= mag;
                // console.warn(`[Anti-Cheat] Player ${playerId.substring(0, 8)} velocity > 1, clamped.`);
            }

            // moveY 需要取反，因為在俯視角下 W(前進) 應該往 Z 負方向移動
            const moveDir = { x: safeMoveX, y: 0, z: -safeMoveY };

            if (moveDir.x !== 0 || moveDir.z !== 0) {
                const currentPos = rb.translation();
                const newPos = {
                    x: currentPos.x + moveDir.x * speed * dt,
                    y: currentPos.y,
                    z: currentPos.z + moveDir.z * speed * dt
                };
                rb.setNextKinematicTranslation(newPos);

                // Rotation
                const angle = Math.atan2(moveDir.x, moveDir.z);
                const q = new pc.Quat().setFromEulerAngles(0, angle * pc.math.RAD_TO_DEG, 0);
                rb.setNextKinematicRotation(q);
            }

            // Skills - 使用 ECSPlayerManager.useSkill
            if (input.skillUsed && input.skillDirection) {
                const skill = this.playerManager.useSkill(playerId, input.skillUsed);
                if (skill) {
                    const direction = new pc.Vec3(input.skillDirection.x, 0, input.skillDirection.z);

                    // 使用 ECSSkillExecutor 執行複雜技能邏輯
                    this.ecsSkillExecutor.executeSkill(
                        skill,
                        playerId,
                        direction,
                        this.ecsWorld,
                        this.effectManager,
                        this.projectileManager,
                        this.soundManager
                    );

                    console.log(`[GameEngine] ${playerId.substring(0, 8)} used skill ${input.skillUsed}`);
                }
            }
        });

        // ECS 的判定邏輯已交由 CollisionSystem 與 Rapier Sensor 處理。

        // Update Projectiles (投射物移動與碰撞)
        // 在 ProjectileManager 內，投射物依然需要手動移動與判定。
        // 我們將 ECSWorld 內的 collisionSystem 傳入供其產生傷害打擊。
        const collisionSystem = this.ecsWorld.getSystem<CollisionSystem>('CollisionSystem');
        if (collisionSystem) {
            this.projectileManager.update(dt, collisionSystem, this.getAllCombatEntities());
        }
    }

    /**
     * 取得所有戰鬥實體 (Player + Tower + Creep)
     * 返回的陣列包含所有可攻擊的實體，用於 HitboxManager 和 ProjectileManager
     */
    private getAllCombatEntities(): any[] {
        const combatEntityIds = this.ecsWorld.query(ComponentType.TRANSFORM, ComponentType.HEALTH);
        const entities: any[] = [];
        for (const id of combatEntityIds) {
            // @ts-ignore - Temporary hack to access private components if needed, or use getComponent properly
            const transform = this.ecsWorld.getComponent(id, ComponentType.TRANSFORM) as any;
            const health = this.ecsWorld.getComponent(id, ComponentType.HEALTH) as any;
            if (!transform || !health) continue;

            entities.push({
                entityId: id,
                playerId: id, // 相容舊版參數
                getPosition: () => transform.position,
                isDead: () => health.isDead(),
                combatStats: {
                    currentHp: health.current,
                    maxHp: health.max,
                }
            });
        }
        return entities;
    }

    /**
     * 從地圖配置生成防禦塔
     */
    private spawnTowersFromMap(): void {
        const towerEntities = this.mapManager.getEntitiesByType('tower');
        towerEntities.forEach((entity, index) => {
            const id = `tower_${entity.team}_${index}`;
            const position = {
                x: entity.position[0],
                y: entity.position[1],
                z: entity.position[2]
            };
            const config = entity.config || {};
            this.towerManager.spawnTower(
                id,
                entity.team || 'neutral',
                position,
                config
            );
        });
        console.log(`[GameEngine] Spawned ${towerEntities.length} towers from map config`);
    }

    /**
     * 從地圖配置生成主堡
     */
    private spawnBasesFromMap(): void {
        const baseEntities = this.mapManager.getEntitiesByType('base');
        baseEntities.forEach((entity, index) => {
            const id = `base_${entity.team}_${index}`;
            const position = {
                x: entity.position[0],
                y: entity.position[1],
                z: entity.position[2]
            };
            const config = entity.config || {};
            this.baseManager.spawnBase(
                id,
                entity.team || 'neutral',
                position,
                config
            );
        });
        console.log(`[GameEngine] Spawned ${baseEntities.length} bases from map config`);
    }

    useSkill(skillId: string) {
        const peerId = this.networkManager.peerId;
        if (!this.playerManager.getPlayer(peerId)) return;

        // 檢查技能是否可用（通過 ECSPlayerManager）
        const cooldowns = this.playerManager.getPlayerSkillCooldowns(peerId);
        const skillCd = cooldowns.get(skillId);
        const energy = this.playerManager.getPlayerEnergy(peerId);

        if (!skillCd || skillCd.current > 0) {
            console.log(`[GameEngine] Skill ${skillId} on cooldown`);
            return;
        }

        // 檢查能量
        const skill = this.playerManager.getPlayerSkills(peerId).find(s => s.id === skillId);
        if (skill && energy && (skill.energyCost ?? 0) > energy.current) {
            console.log(`[GameEngine] Not enough energy for ${skillId}`);
            return;
        }

        // 使用玩家當前的朝向方向
        const direction = this.playerManager.getPlayerFacingDirection(peerId);
        if (!direction) return;

        // 設定待處理的技能（會在下一個 frame 的 collectInput 中收集）
        this.pendingSkillUse = {
            skillId,
            direction: { x: direction.x, z: direction.z }
        };

        console.log(`[GameEngine] Queued skill: ${skillId}`);
    }

    /**
     * 獲取本地玩家的技能列表
     */
    getLocalPlayerSkills() {
        return this.playerManager.getPlayerSkills(this.networkManager.peerId);
    }

    /**
     * 獲取本地玩家的技能冷卻狀態
     */
    getLocalPlayerCooldowns(): Map<string, number> {
        const cooldowns = this.playerManager.getPlayerSkillCooldowns(this.networkManager.peerId);
        const result = new Map<string, number>();
        for (const [id, cd] of cooldowns) {
            result.set(id, cd.current);
        }
        return result;
    }
}
