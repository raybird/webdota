import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager, type PlayerInput, type GameState, type PlayerState, type ShopRequest, type InventoryUpdate } from './NetworkManager';
import { getItem } from '../data/items';
import { UIManager } from './UIManager';
import { ECSPlayerManager } from './managers/ECSPlayerManager';
import { InputManager } from './managers/InputManager';
import { RenderManager } from './managers/RenderManager';
import { EffectManager } from './EffectManager';
import { SpriteFxManager, type SpriteFxName } from './SpriteFxManager';
import { PixelActorManager, type ActorAction } from './PixelActorManager';
import { screenToWorld, setViewTeam } from './view';
import type { Skill } from '../types/Skill';
import { ECSStructureManager, type StructureKind } from './managers/ECSStructureManager';
import { ECSCreepManager } from './managers/ECSCreepManager';
import { EntitySyncManager } from './managers/EntitySyncManager';
import { TowerFeedback } from './TowerFeedback';
import { FacingIndicator } from './FacingIndicator';
import { HitboxDebugView } from './HitboxDebugView';
import { RegenFeedback } from './RegenFeedback';
import { RemoteBoltLog } from './RemoteBoltLog';
import type { TowerAttackMessage } from './NetworkManager';
import { SoundManager } from './SoundManager';
import { BackgroundTicker } from './BackgroundTicker';
import { useGameStore } from '../stores/gameStore';
import { useRoomStore } from '../stores/roomStore';
import { eventBus } from '../events/EventBus';
import { ProjectileManager } from './combat/ProjectileManager';
import { ECSSkillExecutor } from './combat/ECSSkillExecutor';
import { MapManager, type MapConfig } from './map';
import { selectMap } from '../data/maps';
import { mapCollisionFor, setActiveMapCollision, type MapCollision, type Obstacle } from './map/MapCollision';
import { FOOTPRINT } from '../data/balance';
import { ExperienceAwards } from './progression/ExperienceAwards';
import { isUltimateUnlocked } from './progression/leveling';
import {
    World,
    EntityFactory,
    MovementSystem,
    RenderSystem,
    HealthSystem,
    CombatSystem,
    CollisionSystem,
    AISystem,
    StatusSystem,
    StatusVisualSystem,
    SpatialSystem,
    SkillSystem,
    ComponentType,
    TeamComponent,
    TransformComponent,
    PhysicsComponent,
    colliderRegistry,
    type EntityId,
    type Team,
    RenderComponent,
    StatusComponent,
} from './ecs';

/**
 * 技能對應的角色動作：法師的技能與沒有傷害的增益技能是施法，其餘（含法師普攻）是近戰揮擊
 */
function characterActionOf(skill: Skill): ActorAction {
    if (skill.type === 'basic') return 'attack';
    return skill.damage <= 0 || skill.id.startsWith('mage_') ? 'cast' : 'attack';
}

/** 每個畫面幀最多補跑的 fixedUpdate 次數，避免分頁切回來時一次追太多幀 */
const MAX_STEPS_PER_FRAME = 5;
/** Worker 檢查模擬是否停滯的間隔（毫秒） */
const BACKGROUND_TICK_MS = 33;
/** 畫面更新超過這個時間沒來，就由 Worker 補跑模擬（分頁在背景或被節流） */
const FRAME_STALL_MS = 50;
/** Host 每幾個 fixedUpdate 廣播一次玩家狀態 */
const STATE_BROADCAST_INTERVAL = 3;
/** Host 每幾個 fixedUpdate 廣播一次建築與小兵狀態 */
const ENTITY_BROADCAST_INTERVAL = 6;
/** Host 遷移時，沒有剩餘時間的狀態（原 Host 未同步）在幾秒後到期 */
const TAKEOVER_STATUS_SECONDS = 1;
/** 同隊玩家開局位置的間距 */
const SPAWN_SPACING = 1.5;
/** 擊殺獎勵金幣（最後一擊的玩家獲得） */
const KILL_GOLD: Record<'player' | 'creep' | 'tower' | 'base', number> = {
    player: 200,
    creep: 40,
    tower: 150,
    base: 0
};
/** 建築擋路的範圍：與 EntityFactory 的碰撞體相同（塔半徑 1、主堡半邊 2.5） */
const STRUCTURE_FOOTPRINT = { tower: 1, base: 2.5 };
/** 本地玩家預測位置與 Host 差距超過這個距離就拉回（擊退、被拒絕的位移等） */
const RECONCILE_DISTANCE = 2;

export interface MinimapLayout {
    size: { w: number; h: number };
    walls: Obstacle[];
    deadZones: Obstacle[];
}

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
    private mapCollision!: MapCollision;
    private experience!: ExperienceAwards;
    structureManager!: ECSStructureManager;
    creepManager!: ECSCreepManager;
    entitySync!: EntitySyncManager;
    soundManager!: SoundManager;
    spriteFx!: SpriteFxManager;
    private pixelActors!: PixelActorManager;
    private towerFeedback!: TowerFeedback;
    private facingIndicator!: FacingIndicator;
    private hitboxDebugView!: HitboxDebugView;
    private regenFeedback!: RegenFeedback;
    /** Client：Host 轉播的光彈，Host 遷移時由新 Host 接手結算 */
    private boltLog = new RemoteBoltLog();

    // ECS
    ecsWorld!: World;
    entityFactory!: EntityFactory;
    collisionSystem!: CollisionSystem;
    aiSystem!: AISystem;
    /** 狀態倒數只在 Host 進行 */
    private statusSystem!: StatusSystem;
    private statusVisualSystem = new StatusVisualSystem();
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
    /** Client：上次 GAME_STATE 裡本地英雄的擊退次數 */
    private lastKnockbackCount: number | null = null;
    /** 尚未處理的其他玩家技能輸入（Host 權威執行；Client 只播放表現） */
    private remoteSkills: PlayerInput[] = [];

    /** destroy 時要執行的清理（事件監聽等） */
    private disposers: Array<() => void> = [];
    /** 上次推進模擬與上次畫面更新的時間（performance.now） */
    private lastSimTime = 0;
    private lastFrameTime = 0;
    private backgroundTicker = new BackgroundTicker(() => {
        if (performance.now() - this.lastFrameTime > FRAME_STALL_MS) this.simulate();
    }, BACKGROUND_TICK_MS);

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
        const mapConfig: MapConfig = selectMap();
        await this.mapManager.loadMap(mapConfig);
        this.mapCollision = mapCollisionFor(mapConfig);
        setActiveMapCollision(this.mapCollision);

        this.uiManager = new UIManager(this.app);
        this.inputManager = new InputManager();
        this.renderManager = new RenderManager(this.app);
        this.renderManager.setCamera(camera);
        this.spriteFx = new SpriteFxManager(this.app);
        this.spriteFx.setCamera(camera);
        this.spriteFx.preload();
        this.pixelActors = new PixelActorManager(this.app);
        this.pixelActors.setCamera(camera);
        await this.pixelActors.preload();
        this.effectManager = new EffectManager(this.spriteFx);
        this.projectileManager = new ProjectileManager(this.spriteFx);
        this.soundManager = new SoundManager(this.app);

        this.ecsWorld = new World();
        this.collisionSystem = new CollisionSystem(this.physicsWorld);
        this.entityFactory = new EntityFactory(this.app, this.physicsWorld, this.ecsWorld);
        this.entityFactory.setCollisionSystem(this.collisionSystem);
        this.entityFactory.setPixelActors(this.pixelActors);

        const renderSystem = new RenderSystem();
        renderSystem.camera = camera;

        this.ecsWorld.addSystem(new SkillSystem());
        this.ecsWorld.addSystem(new MovementSystem());
        this.ecsWorld.addSystem(new CombatSystem());
        this.ecsWorld.addSystem(this.collisionSystem);
        this.ecsWorld.addSystem(new SpatialSystem());
        this.statusSystem = new StatusSystem();
        this.ecsWorld.addSystem(this.statusSystem);
        this.aiSystem = new AISystem();
        this.ecsWorld.addSystem(this.aiSystem);
        this.ecsWorld.addSystem(new HealthSystem());
        this.ecsWorld.addSystem(this.statusVisualSystem);
        this.ecsWorld.addSystem(renderSystem);

        this.ecsSkillExecutor = new ECSSkillExecutor(this.collisionSystem);
        this.structureManager = new ECSStructureManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.creepManager = new ECSCreepManager(this.mapManager, this.uiManager, this.ecsWorld, this.entityFactory);
        this.playerManager = new ECSPlayerManager(this.ecsWorld, this.entityFactory, this.uiManager);
        this.experience = new ExperienceAwards(this.ecsWorld, this.playerManager, this.creepManager, this.structureManager);
        this.entitySync = new EntitySyncManager(this.ecsWorld, this.structureManager, this.creepManager, this.mapManager);
        this.towerFeedback = new TowerFeedback(this.app, this.ecsWorld, this.spriteFx, this.structureManager);
        this.facingIndicator = new FacingIndicator(this.app);
        this.hitboxDebugView = new HitboxDebugView(this.app, this.collisionSystem);
        this.regenFeedback = new RegenFeedback(this.ecsWorld);

        this.setupEventListeners();

        const onUpdate = (dt: number) => this.gameLoop(dt);
        this.app.on('update', onUpdate);
        this.app.start();
        this.backgroundTicker.start();

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
        this.networkManager.onGameState = (state) => {
            if (!this.isHost) this.boltLog.markState('player', performance.now());
            this.handleGameState(state);
        };
        this.networkManager.onEntityState = (_frame, entities) => {
            if (this.isHost || !this.isGameStarted) return;
            this.entitySync.apply(entities);
            this.boltLog.markState('entity', performance.now());
        };
        // onHostChanged 也可能被房間流程使用，這裡接在後面並在 destroy 時還原
        const roomOnHostChanged = this.networkManager.onHostChanged;
        this.networkManager.onHostChanged = (newHostId) => {
            roomOnHostChanged?.(newHostId);
            if (this.isHost && this.isGameStarted && !this.aiSystem.enabled) this.takeOverAsHost();
        };
        this.disposers.push(() => { this.networkManager.onHostChanged = roomOnHostChanged; });
        this.networkManager.onTowerAttack = (attack) => this.playRemoteTowerAttack(attack);
        this.networkManager.onShopRequest = (fromPeerId, request) => this.handleShopRequest(fromPeerId, request);
        this.networkManager.onInventory = (update) => this.applyInventoryUpdate(update);
        this.networkManager.onGameOver = (winnerTeam, reason) => {
            if (!this.isHost) eventBus.emit({ type: 'GAME_OVER', winnerTeam, reason });
        };

        this.disposers.push(
            eventBus.on('GAME_STARTED', () => this.startGame()),
            eventBus.on('SKILL_USED', (event) => this.useSkill(event.skillId)),
            eventBus.on('ENTITY_DIED', (event) => {
                if (this.isHost) {
                    this.awardKillGold(event.entityId, event.killerId);
                    this.experience.onDeath(event.entityId, event.killerId);
                }
                this.playSpriteFxAt('death-poof', event.entityId, 0);
            }),
            eventBus.on('ENTITY_TOOK_DAMAGE', (event) => this.playSpriteFxAt('hit-spark', event.targetId, 1)),
            eventBus.on('TOWER_ATTACK', (event) => {
                // 只有 Host 的 AISystem 會發出：本地播放並轉播給 Client
                this.towerFeedback.playBolt(event.attackerId, event.targetId, event.flightTime);
                this.broadcastTowerAttack(event.attackerId, event.targetId, event.flightTime, event.damage);
            }),
            eventBus.on('PLAYER_RESPAWNED', (event) => this.playSpriteFxAt('respawn-beam', event.entityId, 0)),
            // 升級光環跟著英雄移動
            eventBus.on('PLAYER_LEVEL_UP', (event) => {
                const physics = this.ecsWorld.getComponent<PhysicsComponent>(event.entityId, ComponentType.PHYSICS);
                const start = physics?.getPosition();
                if (!physics || !start) return;
                this.spriteFx.play('level-up', { x: start.x, y: 0, z: start.z }, {
                    follow: () => {
                        const p = physics.getPosition() ?? start;
                        return { x: p.x, y: 0, z: p.z };
                    }
                });
            }),
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
        this.lastKnockbackCount = null;
        this.remoteSkills = [];

        this.playerManager.clearAll();
        this.structureManager.clearAll();
        this.creepManager.clearAll();
        this.creepManager.resetWaveTimer();
        this.projectileManager.clearAll();
        this.entitySync.reset();

        // Client 的 AI 與傷害判定交給 Host；建築與小兵由 Host 同步生成
        this.aiSystem.enabled = this.isHost;
        this.statusSystem.enabled = this.isHost;
        this.collisionSystem.authoritative = this.isHost;
        if (this.isHost) {
            this.spawnStructuresFromMap();
            // 開局就出第一波小兵，之後每 30 秒一波（M4 實測：等 30 秒才出，1v1 到 4 級要約 2 分 20 秒）
            this.creepManager.spawnWave();
        }

        // 開局在己方基地（與重生位置相同），同隊玩家沿基地兩側錯開；各端依相同排序算出相同位置
        const players = [...this.roomStore.connectedPlayers].sort((a, b) => a.id.localeCompare(b.id));
        const teamSlots = new Map<Team, number>();
        for (const player of players) {
            const team = (player.team || 'neutral') as Team;
            const slot = teamSlots.get(team) ?? 0;
            teamSlots.set(team, slot + 1);

            const base = this.getRespawnPosition(team);
            const len = Math.hypot(base.x, base.z) || 1;
            // 垂直於基地到地圖中央的方向：0、+1.5、-1.5、+3、-3…
            const side = (slot % 2 === 1 ? 1 : -1) * Math.ceil(slot / 2) * SPAWN_SPACING;
            this.playerManager.spawnPlayer(player.id, {
                x: base.x + (-base.z / len) * side,
                y: 1,
                z: base.z + (base.x / len) * side
            });
        }

        const peerId = this.networkManager.peerId;
        this.statusVisualSystem.localTeam = (this.roomStore.myPlayer?.team as Team | undefined) ?? null;
        setViewTeam(this.statusVisualSystem.localTeam);
        this.mapManager.applyView();
        this.towerFeedback.reset();
        this.facingIndicator.reset();
        this.regenFeedback.reset();
        this.boltLog.clear();
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
                // 本地英雄被 Host 擊退時，不論距離都拉到 Host 的位置（本地不會預測擊退）
                const knockedBack = isLocal && pData.kb !== undefined && this.lastKnockbackCount !== null && pData.kb !== this.lastKnockbackCount;
                if (isLocal && pData.kb !== undefined) this.lastKnockbackCount = pData.kb;
                if (!isLocal && !this.playerManager.isDead(pData.id)) {
                    rb.setNextKinematicTranslation(pData.pos);
                    rb.setNextKinematicRotation(pData.rot);
                } else if (!isLocal || knockedBack || drift > RECONCILE_DISTANCE) {
                    // 直接瞬移（擊退、陣亡中的玩家重生），不經過插值
                    rb.setTranslation(pData.pos, true);
                    rb.setNextKinematicTranslation(pData.pos);
                }
            }
            // 等級由經驗推得；先套用經驗（會改最大生命），再套用血量
            if (pData.xp !== undefined) this.playerManager.setXp(pData.id, pData.xp);
            this.playerManager.setPlayerHp(pData.id, pData.stats.hp);
            this.playerManager.setPlayerEnergy(pData.id, pData.stats.energy);
            this.playerManager.setPlayerStatusFlags(pData.id, pData.stats.status);
        }

        if (state.isGameStarted) this.isGameStarted = true;
    }

    gameLoop(dt: number) {
        this.lastFrameTime = performance.now();
        this.simulate();
        this.renderManager.updateCamera(dt, this.networkManager.peerId, this.playerManager);
        this.spriteFx.update(dt);
        this.pixelActors.update(dt);
        if (this.isGameStarted) {
            const me = this.networkManager.peerId;
            const localPlayer = this.playerManager.isDead(me) ? null : this.playerManager.getPlayer(me) ?? null;
            this.towerFeedback.update(dt, this.statusVisualSystem.localTeam, localPlayer);
            this.facingIndicator.update(
                localPlayer ? this.playerManager.getPlayerPosition(me) : null,
                localPlayer ? this.playerManager.getPlayerFacingDirection(me) : null
            );
            this.hitboxDebugView.update();
            const localTeam = this.statusVisualSystem.localTeam;
            const localPosition = localPlayer ? this.playerManager.getPlayerPosition(me) : null;
            this.structureManager.updateShieldHints(dt, localTeam, localPosition);
            this.regenFeedback.update(dt, {
                players: this.playerManager.getAllPlayers(),
                localPlayerId: me,
                localPosition,
                fountain: localTeam ? this.structureManager.basePosition(localTeam) : null
            });
        }
    }

    /** Host：把防禦塔光彈轉成兩端共通的 ID 後轉播 */
    private broadcastTowerAttack(attackerId: EntityId, targetId: EntityId, flightTime: number, damage: number): void {
        const from = this.entitySync.netIdOf(attackerId);
        if (from === undefined) return;
        const playerId = this.playerManager.getPlayerIdOf(targetId);
        const netId = playerId ? undefined : this.entitySync.netIdOf(targetId);
        const target = playerId ? { playerId } : netId !== undefined ? { netId } : null;
        if (!target) return;
        this.networkManager.broadcastTowerAttack({ from, target, flightTime, damage });
    }

    /** Client：播放 Host 轉播的防禦塔光彈 */
    private playRemoteTowerAttack(attack: TowerAttackMessage): void {
        if (this.isHost) return;
        const attackerId = this.entitySync.entityOf(attack.from);
        const isPlayer = 'playerId' in attack.target;
        const targetId = 'playerId' in attack.target
            ? this.playerManager.getPlayer(attack.target.playerId)
            : this.entitySync.entityOf(attack.target.netId);
        if (!attackerId || !targetId) return;
        this.towerFeedback.playBolt(attackerId, targetId, attack.flightTime);
        this.boltLog.record(attackerId, targetId, isPlayer ? 'player' : 'entity', attack.damage, attack.flightTime, performance.now());
    }

    /**
     * Host 遷移：原 Host 在遊戲中斷線、由本端接手時，打開只在 Host 執行的系統並接手原 Host 的狀態。
     * 小兵、建築、玩家的位置與血量本來就在本端（鏡像），沿用原 Host 的網路 ID 讓其他 Client 對得上；
     * 原 Host 的倒數（狀態剩餘時間、小兵波次）沒有同步，從接手時重新起算。
     */
    private takeOverAsHost(): void {
        const bolts = this.boltLog.takeOver(performance.now());
        console.log(`[GameEngine] Taking over as host (${bolts.length} tower bolts adopted)`);
        this.aiSystem.enabled = true;
        this.statusSystem.enabled = true;
        this.collisionSystem.authoritative = true;
        this.entitySync.adoptMirrors();
        for (const entityId of this.ecsWorld.query(ComponentType.STATUS)) {
            this.ecsWorld.getComponent<StatusComponent>(entityId, ComponentType.STATUS)?.adoptAsHost(TAKEOVER_STATUS_SECONDS);
        }
        this.aiSystem.adoptBolts(bolts);
    }

    /**
     * 依實際經過時間以固定步長推進模擬
     * 前景由 PlayCanvas update 呼叫；畫面更新停滯時由 BackgroundTicker 補跑，兩者共用時間基準不會重複推進
     */
    private simulate() {
        const now = performance.now();
        const elapsed = this.lastSimTime === 0 ? 0 : (now - this.lastSimTime) / 1000;
        this.lastSimTime = now;

        // 超過 MAX_STEPS_PER_FRAME 的部分在迴圈後丟棄
        this.accumulator += elapsed;
        let steps = 0;
        while (this.accumulator >= this.FIXED_TIMESTEP && steps < MAX_STEPS_PER_FRAME) {
            this.fixedUpdate(this.FIXED_TIMESTEP);
            this.accumulator -= this.FIXED_TIMESTEP;
            steps++;
        }
        // 追不上時丟掉剩餘時間，而不是越積越多
        if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    fixedUpdate(dt: number) {
        if (!this.isGameStarted) return;

        const localInput = this.inputManager.collectInput(this.currentFrame);
        // 輸入是畫面方向，轉成世界方向後再送出與套用（applyMovement 的 z = -moveY）
        const world = screenToWorld(localInput.moveX, localInput.moveY);
        localInput.moveX = world.x;
        localInput.moveY = -world.z;
        if (this.pendingSkillUse) {
            localInput.skillUsed = this.pendingSkillUse.skillId;
            localInput.skillDirection = this.pendingSkillUse.direction;
            this.pendingSkillUse = null;
        }

        // Client 每幀送輸入給 Host；Host 只在放技能時送，讓 Client 播放表現
        if (!this.isHost || localInput.skillUsed) this.networkManager.sendInput(localInput);

        this.syncStructureObstacles();
        this.structureManager.updateShields();
        this.applyMovement(localInput, dt);
        this.applySkill(localInput);

        for (const input of this.remoteSkills) this.applySkill(input);
        this.remoteSkills = [];

        if (this.isHost) {
            for (const input of this.remoteMoves.values()) this.applyMovement(input, dt);

            this.creepManager.update(dt);
            this.structureManager.update();
            this.experience.tick(dt);
        }
        this.playerManager.update(
            dt,
            this.isHost,
            (team) => this.getRespawnPosition(team),
            (team) => this.structureManager.basePosition(team)
        );

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

    /**
     * 商店操作：Host 直接驗證並執行，Client 送給 Host，結果由 Host 廣播的物品欄回來
     */
    requestShop(request: ShopRequest): void {
        if (this.isHost) {
            this.handleShopRequest(this.networkManager.peerId, request);
        } else {
            this.networkManager.sendShopRequest(request);
        }
    }

    private handleShopRequest(playerId: string, request: ShopRequest): void {
        const inventory = this.playerManager.getInventory(playerId);
        if (!inventory) return;

        let changed = false;
        if (request.action === 'buy') {
            const item = getItem(request.itemId);
            changed = !!item && inventory.buyItem(item);
        } else {
            changed = inventory.sellItem(request.slot);
        }
        if (changed) this.commitInventory(playerId);
    }

    /**
     * Host：重算裝備屬性並廣播物品欄
     */
    private commitInventory(playerId: string): void {
        const inventory = this.playerManager.getInventory(playerId);
        if (!inventory) return;

        this.playerManager.applyItemStats(playerId);
        this.networkManager.broadcastInventory({
            playerId,
            gold: inventory.gold,
            items: inventory.slots.map(item => item?.id ?? null)
        });
    }

    /**
     * Client：套用 Host 廣播的物品欄
     */
    private applyInventoryUpdate(update: InventoryUpdate): void {
        const inventory = this.playerManager.getInventory(update.playerId);
        if (!inventory) return;

        inventory.gold = update.gold;
        inventory.slots = inventory.slots.map((_, i) => {
            const itemId = update.items[i];
            return itemId ? getItem(itemId) ?? null : null;
        });
        this.playerManager.applyItemStats(update.playerId);
    }

    /**
     * Host：最後一擊的玩家獲得擊殺金幣
     */
    private awardKillGold(victimId: EntityId, killerId: string | null): void {
        if (!killerId) return;
        const killerPlayerId = this.playerManager.findPlayerIdByEntity(killerId);
        const inventory = killerPlayerId ? this.playerManager.getInventory(killerPlayerId) : undefined;
        if (!killerPlayerId || !inventory) return;

        const kind = this.playerManager.findPlayerIdByEntity(victimId) ? 'player'
            : this.creepManager.getAllCreepIds().has(victimId) ? 'creep'
            : this.structureManager.getAll().get(victimId)?.kind;
        const reward = kind ? KILL_GOLD[kind] : 0;
        if (reward <= 0) return;

        inventory.earnGold(reward);
        this.commitInventory(killerPlayerId);
    }

    /**
     * 在實體位置播放像素特效；y 為離地高度（0 為地面）
     */
    private playSpriteFxAt(name: SpriteFxName, entityId: EntityId, y: number): void {
        // 剛體位置比 Transform 新（重生瞬移後 Transform 要等下一次 ECS 更新才同步）
        const pos = this.ecsWorld.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS)?.getPosition()
            ?? this.ecsWorld.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)?.position;
        if (!pos) return;
        this.spriteFx.play(name, { x: pos.x, y, z: pos.z });
    }

    /**
     * 重生位置：己方出生點沿 z 往地圖中央移 7 單位；沒有出生點時回到中央。
     * 兩隊鏡頭都沿 x 軸看（見 view.ts），z 方向是畫面左右，所以玩家出現在主堡右側，
     * 不會在主堡像素圖（寬約 6.7 單位）後方被整個擋住
     */
    private getRespawnPosition(team: Team): { x: number; y: number; z: number } {
        const spawnPoints = team === 'neutral' ? [] : this.mapManager.getSpawnPoints(team);
        const sp = spawnPoints[spawnPoints.length - 1]?.position;
        if (!sp) return { x: 0, y: 1, z: 0 };

        return { x: sp.x, y: 1, z: sp.z - Math.sign(sp.z) * 7 };
    }

    private applyMovement(input: PlayerInput, dt: number) {
        if (this.playerManager.isDead(input.playerId)) return;
        const rb = this.playerManager.getPlayerRigidBody(input.playerId);
        if (!rb) return;

        let { moveX, moveY } = input;
        const mag = Math.sqrt(moveX * moveX + moveY * moveY);
        if (mag > 1.05) { moveX /= mag; moveY /= mag; }
        if (moveX === 0 && moveY === 0) return;

        const speed = this.playerManager.getPlayerMoveSpeed(input.playerId);
        const moveZ = -moveY;
        const currentPos = rb.translation();
        // Host 與 Client 用同一份地圖碰撞，Client 的預測才會與 Host 一致
        const next = this.mapCollision.move(
            currentPos,
            { x: currentPos.x + moveX * speed * dt, z: currentPos.z + moveZ * speed * dt },
            FOOTPRINT.hero
        );
        rb.setNextKinematicTranslation({ x: next.x, y: currentPos.y, z: next.z });
        const halfAngle = Math.atan2(moveX, moveZ) / 2;
        rb.setNextKinematicRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) });
    }

    private applySkill(input: PlayerInput) {
        if (!input.skillUsed || !input.skillDirection) return;
        if (this.playerManager.isDead(input.playerId)) return;

        // 大招未解鎖時不放（各端用同步來的等級判斷，Host 據此拒絕）
        if (!this.canUseSkill(input.playerId, input.skillUsed)) return;

        // 技能執行器以 ECS Entity ID 查詢施放者的物理與隊伍，不是玩家（Peer）ID
        const casterEntityId = this.playerManager.getPlayer(input.playerId);
        const skill = this.playerManager.useSkill(input.playerId, input.skillUsed);
        if (!casterEntityId || !skill) return;

        this.ecsSkillExecutor.executeSkill(
            skill, casterEntityId, new pc.Vec3(input.skillDirection.x, 0, input.skillDirection.z),
            this.ecsWorld, this.effectManager, this.projectileManager, this.soundManager
        );

        const visual = this.ecsWorld.getComponent<RenderComponent>(casterEntityId, ComponentType.RENDER)?.pcEntity;
        if (visual) this.pixelActors.playAction(visual, characterActionOf(skill), input.skillDirection);
    }

    private playerPhysics(playerId: string): PhysicsComponent | undefined {
        const entityId = this.playerManager.getPlayer(playerId);
        return entityId ? this.ecsWorld.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS) : undefined;
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
                stats: { hp: hp.current, energy: energy.current, status: this.playerManager.getPlayerStatusFlags(playerId) },
                kb: (this.playerPhysics(playerId)?.forcedMoves ?? 0) & 0xff,
                xp: Math.floor(this.playerManager.getXp(playerId))
            });
        }
        this.networkManager.broadcastGameState({
            frame: this.currentFrame,
            timestamp: Date.now(),
            players,
            isGameStarted: this.isGameStarted
        });
    }

    /** 建築會被摧毀，每幀把還在的塔與主堡交給地圖碰撞（Host 與 Client 各自從自己的 ECS 世界讀） */
    private syncStructureObstacles() {
        const obstacles: Obstacle[] = [];
        for (const [entityId, { kind }] of this.structureManager.getAll()) {
            const transform = this.ecsWorld.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            if (!transform) continue;
            const { x, z } = transform.position;
            obstacles.push(kind === 'tower'
                ? { kind: 'circle', x, z, r: STRUCTURE_FOOTPRINT.tower }
                : { kind: 'rect', x, z, hw: STRUCTURE_FOOTPRINT.base, hd: STRUCTURE_FOOTPRINT.base });
        }
        this.mapCollision.setStructures(obstacles);
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
        for (const [playerId, entityId] of this.playerManager.getAllPlayers()) {
            if (this.playerManager.isDead(playerId)) continue;
            // 敵方隱身中的玩家不出現在小地圖
            if (this.ecsWorld.getComponent<RenderComponent>(entityId, ComponentType.RENDER)?.hiddenByStealth) continue;
            push(entityId, playerId, 'player');
        }

        return result;
    }

    /**
     * 取得實體目前的世界座標（給螢幕空間 UI 投影用）
     */
    getEntityPosition(entityId: EntityId): pc.Vec3 | null {
        return this.ecsWorld.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)?.position ?? null;
    }

    /** 小地圖的地形：地圖大小、牆與柱子、封閉區 */
    getMinimapLayout(): MinimapLayout | null {
        const config = this.mapManager?.getCurrentMapConfig();
        if (!config || !this.mapCollision) return null;
        const deadZones = config.deadZones ?? [];
        const isDead = (o: Obstacle) => o.kind === 'rect' && deadZones.some(z => z.x === o.x && z.z === o.z && z.w === o.hw * 2 && z.d === o.hd * 2);
        const obstacles = this.mapCollision.staticObstacles();
        return {
            size: config.size,
            walls: obstacles.filter(o => !isDead(o)),
            deadZones: obstacles.filter(isDead)
        };
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
        if (!this.canUseSkill(peerId, skillId)) return;
        const energy = this.playerManager.getPlayerEnergy(peerId);
        if (skill && energy && (skill.energyCost ?? 0) > energy.current) return;
        const direction = this.playerManager.getPlayerFacingDirection(peerId);
        if (!direction) return;
        this.pendingSkillUse = { skillId, direction: { x: direction.x, z: direction.z } };
    }

    /** 大招要到解鎖等級才能放，其他技能不限 */
    private canUseSkill(playerId: string, skillId: string): boolean {
        const skill = this.playerManager.getPlayerSkills(playerId).find(s => s.id === skillId);
        return skill?.type !== 'ultimate' || isUltimateUnlocked(this.playerManager.getLevel(playerId));
    }

    /** 本地玩家的等級與經驗（HUD 用） */
    getLocalProgress(): { xp: number; level: number } {
        const peerId = this.networkManager.peerId;
        return { xp: this.playerManager.getXp(peerId), level: this.playerManager.getLevel(peerId) };
    }

    getLocalPlayerSkills() { return this.playerManager.getPlayerSkills(this.networkManager.peerId); }

    /**
     * 本地玩家的剩餘重生秒數；存活時為 null
     */
    getLocalRespawnRemaining(): number | null {
        return this.playerManager.getRespawnRemaining(this.networkManager.peerId);
    }

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
        setActiveMapCollision(null);
        this.disposers.forEach(dispose => dispose());
        this.disposers = [];
        this.backgroundTicker.destroy();

        this.networkManager.onInputReceived = undefined;
        this.networkManager.onGameState = undefined;
        this.networkManager.onEntityState = undefined;
        this.networkManager.onShopRequest = undefined;
        this.networkManager.onInventory = undefined;
        this.networkManager.onGameOver = undefined;
        this.networkManager.onTowerAttack = undefined;

        this.isGameStarted = false;
        this.inputManager.destroy();
        this.renderManager.destroy();
        this.soundManager.destroy();
        this.towerFeedback.destroy();
        this.facingIndicator.destroy();
        this.spriteFx.destroy();
        this.pixelActors.clear();
        this.projectileManager.clearAll();
        this.ecsWorld.clear();
        colliderRegistry.clear();

        this.app.destroy();
        this.physicsWorld.free();
    }
}
