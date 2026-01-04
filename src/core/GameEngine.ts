import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager, type PlayerInput } from './NetworkManager';
import { HostManager } from './HostManager';
import { HitboxManager } from './combat/HitboxManager';
import { UIManager } from './UIManager';
import { PlayerManager } from './managers/PlayerManager';
import { InputManager } from './managers/InputManager';
import { RenderManager } from './managers/RenderManager';
import { EffectManager } from './EffectManager';
import { useGameStore } from '../stores/gameStore';
import { useRoomStore } from '../stores/roomStore';
import { eventBus } from '../events/EventBus';

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
    hitboxManager!: HitboxManager;
    uiManager!: UIManager;
    playerManager!: PlayerManager;
    inputManager!: InputManager;
    renderManager!: RenderManager;
    effectManager!: EffectManager;

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

        // 3. Create Scene
        this.createScene();

        // 4. Initialize Managers
        this.uiManager = new UIManager(this.app);
        this.hitboxManager = new HitboxManager(this.app);
        this.playerManager = new PlayerManager(this.app, this.physicsWorld, this.uiManager);
        this.inputManager = new InputManager();
        this.renderManager = new RenderManager(this.app);
        this.effectManager = new EffectManager(this.app);

        // Find and set camera for RenderManager
        const camera = this.app.root.findByName('Camera');
        if (camera) {
            this.renderManager.setCamera(camera as pc.Entity);
        }

        // 5. Initialize Host Manager (使用已有的 NetworkManager)
        this.hostManager = new HostManager(this.app, this.physicsWorld);

        // 6. Setup Event Listeners
        this.setupEventListeners();

        // 7. Start Loop
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

        // Ground (Visual) - 擴大地板尺寸以滿版
        const ground = new pc.Entity('Ground');
        ground.addComponent('render', { type: 'box' });
        ground.setLocalScale(100, 0.1, 100);  // 100x100 滿版地板
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(0.15, 0.25, 0.15);  // 深綠色
        material.update();
        if (ground.render) ground.render.material = material;
        this.app.root.addChild(ground);

        // Ground (Physics) - 對應擴大
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.05, 50.0);
        this.physicsWorld.createCollider(groundColliderDesc);
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

        this.networkManager.onGameState = (state: any) => {
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

        // 清空現有玩家
        this.playerManager.clearAll();

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
        const localPlayer = this.playerManager.getPlayer(this.networkManager.peerId);
        if (localPlayer) {
            const skills = Array.from(localPlayer.skillManager.skills.values());
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

    private handleGameState(state: any) {
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

            const player = this.playerManager.getPlayer(pData.id);
            if (player) {
                // 只同步其他玩家的位置（自己的位置由本地預測）
                if (pData.id !== this.networkManager.peerId) {
                    if (pData.pos && pData.rot) {
                        const rb = player.rigidBody;
                        rb.setNextKinematicTranslation(pData.pos);
                        rb.setNextKinematicRotation(pData.rot);
                    }
                }

                // 同步所有玩家的狀態（HP/能量）
                if (pData.stats) {
                    player.combatStats.currentHp = pData.stats.hp;
                    player.combatStats.currentEnergy = pData.stats.energy || 0;
                    player.updateHpBar();
                }
            }
        });

        if (state.isGameStarted) {
            this.isGameStarted = true;
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
        this.renderManager.syncVisuals(this.playerManager.getAllPlayers());
        this.renderManager.updateCamera(this.networkManager.peerId, this.playerManager.getAllPlayers());
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

            // Step Physics
            this.physicsWorld.step();

            // Broadcast State
            if (this.currentFrame % 3 === 0) { // 每 3 幀同步一次
                const gameState = {
                    frame: this.currentFrame,
                    timestamp: Date.now(),
                    players: Array.from(this.playerManager.getAllPlayers().entries()).map(([id, p]) => ({
                        id,
                        pos: p.rigidBody.translation(),
                        rot: p.rigidBody.rotation(),
                        stats: {
                            hp: p.combatStats.currentHp,
                            energy: p.combatStats.currentEnergy
                        }
                    }))
                };
                this.networkManager.broadcastGameState(gameState);
            }
        } else {
            // Client: 也執行物理模擬
            this.physicsWorld.step();
        }

        this.currentFrame++;
        this.gameStore.setFrame(this.currentFrame);
    }

    processInputs(inputs: PlayerInput[], dt: number) {
        inputs.forEach((input) => {
            // 厳格 ID 驗證：在處理前確認 ID 存在於 PlayerManager
            if (!this.playerManager.getPlayer(input.playerId)) {
                console.warn(`[GameEngine] processInputs: Player ${input.playerId.substring(0, 8)} not found in PlayerManager! Skipping input.`);
                return; // skip this input
            }
            const player = this.playerManager.getPlayer(input.playerId);
            if (player) {
                // Movement
                const speed = player.combatStats.moveSpeed;
                const moveDir = { x: input.moveX, y: 0, z: input.moveY };

                if (moveDir.x !== 0 || moveDir.z !== 0) {
                    const currentPos = player.rigidBody.translation();
                    const newPos = {
                        x: currentPos.x + moveDir.x * speed * dt,
                        y: currentPos.y,
                        z: currentPos.z + moveDir.z * speed * dt
                    };
                    player.rigidBody.setNextKinematicTranslation(newPos);

                    // Rotation
                    const angle = Math.atan2(moveDir.x, moveDir.z);
                    const q = new pc.Quat().setFromEulerAngles(0, angle * pc.math.RAD_TO_DEG, 0);
                    player.rigidBody.setNextKinematicRotation(q);
                }

                // Skills
                if (input.skillUsed && input.skillDirection) {
                    const result = player.useSkill(input.skillUsed);
                    if (result) {
                        const { skill } = result;
                        const direction = new pc.Vec3(input.skillDirection.x, 0, input.skillDirection.z);

                        // 生成攻擊判定框
                        const position = player.getPosition();
                        // 根據技能範圍調整 Hitbox 位置 (稍微前方)
                        position.add(direction.clone().mulScalar(1.0));

                        this.hitboxManager.createHitbox(
                            position,
                            skill.aoe || skill.range * 0.5, // 如果有 AOE 使用 AOE，否則使用範圍的一半
                            skill.damage,
                            direction.clone().mulScalar(skill.knockback || 0),
                            input.playerId,
                            0.2 // 持續時間
                        );

                        // 廣播技能使用事件 (用於播放特效)
                        // 廣播技能使用事件 (用於播放特效)
                        eventBus.emit({
                            type: 'SKILL_EFFECT',
                            playerId: input.playerId,
                            skillId: input.skillUsed,
                            position: { x: position.x, y: position.y, z: position.z },
                            direction: { x: direction.x, y: direction.y, z: direction.z }
                        });

                        console.log(`[GameEngine] ${input.playerId.substring(0, 8)} used ${skill.name}`);
                    }
                }
            }
        });

        // Update Hitboxes
        const hits = this.hitboxManager.update(dt, this.playerManager.getAllPlayers());
        hits.forEach(hit => {
            const target = this.playerManager.getPlayer(hit.targetId);
            if (target) {
                target.takeDamage(hit.damage);
                if (hit.knockback) {
                    target.applyKnockback(hit.knockback);
                }
            }
        });
    }

    useSkill(skillId: string) {
        const localPlayer = this.playerManager.getPlayer(this.networkManager.peerId);
        if (!localPlayer) return;

        // 檢查技能是否可用（冷卻、能量）
        if (!localPlayer.skillManager.canUseSkill(skillId, localPlayer.combatStats.currentEnergy)) {
            console.log(`[GameEngine] Skill ${skillId} not ready`);
            return;
        }

        // 使用玩家當前的朝向方向
        const direction = localPlayer.getFacingDirection();

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
        const localPlayer = this.playerManager.getPlayer(this.networkManager.peerId);
        if (!localPlayer) return [];

        return Array.from(localPlayer.skillManager.skills.values());
    }
}
