import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager, type PlayerInput } from './NetworkManager';
import { HostManager } from './HostManager';
import { HitboxManager } from './combat/HitboxManager';
import { UIManager } from './UIManager';
import { PlayerManager } from './managers/PlayerManager';
import { InputManager } from './managers/InputManager';
import { RenderManager } from './managers/RenderManager';
import { useGameStore } from '../stores/gameStore';
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

    // Game Loop
    readonly FIXED_TIMESTEP = 1 / 60;
    currentFrame: number = 0;
    accumulator: number = 0;

    // State
    private gameStore = useGameStore();
    private isGameStarted: boolean = false;

    constructor() {
        // Init in init()
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

        // Find and set camera for RenderManager
        const camera = this.app.root.findByName('Camera');
        if (camera) {
            this.renderManager.setCamera(camera as pc.Entity);
        }

        // 5. Initialize Network & Host
        this.networkManager = new NetworkManager();
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
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        camera.setPosition(0, 20, 20);
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

        // Ground (Visual)
        const ground = new pc.Entity('Ground');
        ground.addComponent('render', { type: 'box' });
        ground.setLocalScale(20, 0.1, 20);
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(0.3, 0.5, 0.3);
        material.update();
        if (ground.render) ground.render.material = material;
        this.app.root.addChild(ground);

        // Ground (Physics)
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.05, 10.0);
        this.physicsWorld.createCollider(groundColliderDesc);
    }

    private setupEventListeners() {
        // Network Events
        this.networkManager.onConnected = () => {
            this.inputManager.setPlayerId(this.networkManager.peerId);
            // 本地玩家生成由 RoomService 處理，這裡只負責遊戲邏輯
        };

        this.networkManager.onPeerJoined = (peerId) => {
            // 如果是 Host，發送遊戲狀態
            if (this.hostManager.isHost) {
                this.sendFullGameState(peerId);
            }
        };

        this.networkManager.onPeerLeft = (peerId) => {
            this.playerManager.removePlayer(peerId);
        };

        this.networkManager.onGameStarted = () => {
            this.isGameStarted = true;
            this.currentFrame = 0;
            // 重新生成所有玩家以確保位置正確
            this.playerManager.clearAll();
            // 這裡應該從 RoomStore 獲取所有玩家並生成
            // 暫時略過，由外部服務控制
        };

        this.networkManager.onGameState = (state: any) => {
            this.handleGameState(state);
        };

        // EventBus Events
        eventBus.on('GAME_STARTED', () => {
            this.isGameStarted = true;
            this.currentFrame = 0;
        });

        eventBus.on('SKILL_USED', (event) => {
            this.useSkill(event.skillId);
        });
    }

    private sendFullGameState(targetPeerId: string) {
        const playersData = Array.from(this.playerManager.getAllPlayers().entries()).map(([id, p]) => ({
            id,
            pos: p.rigidBody.translation(),
            stats: {
                hp: p.combatStats.currentHp,
                maxHp: p.combatStats.maxHp,
                energy: p.combatStats.currentEnergy
            }
        }));

        const gameState = {
            isGameStarted: this.isGameStarted,
            currentFrame: this.currentFrame,
            players: playersData
        };

        this.networkManager.sendGameState(gameState, targetPeerId);
    }

    private handleGameState(state: any) {
        state.players.forEach((pData: any) => {
            if (!this.playerManager.getPlayer(pData.id)) {
                this.playerManager.spawnPlayer(pData.id, pData.pos);
            }

            const player = this.playerManager.getPlayer(pData.id);
            if (player) {
                if (pData.position && pData.rotation) {
                    const rb = player.rigidBody;
                    rb.setNextKinematicTranslation(pData.position);
                    rb.setNextKinematicRotation(pData.rotation);
                }
                if (pData.stats) {
                    player.combatStats.currentHp = pData.stats.hp;
                    player.combatStats.currentEnergy = pData.stats.energy || 0;
                    player.updateHpBar();
                }
            }
        });

        if (state.isGameStarted) {
            this.isGameStarted = true;
            this.currentFrame = state.currentFrame;
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

        // 2. Send Input to Host (or process if Host)
        if (this.hostManager.isHost) {
            this.networkManager.inputBuffer.get(this.currentFrame)?.set(this.networkManager.peerId, localInput);
            // Host 也需要廣播自己的輸入給其他人 (如果是 P2P Mesh)
            // 但在目前的架構，Host 收集所有輸入後計算權威狀態並廣播
        } else {
            this.networkManager.sendInput(localInput);
        }

        // 3. Process Inputs (Host Only or Lockstep)
        // 這裡簡化：假設 Host 權威
        if (this.hostManager.isHost) {
            // 處理所有玩家輸入
            const inputs = this.networkManager.getInputsForFrame(this.currentFrame);
            // 添加本地輸入
            inputs.push(localInput);

            this.processInputs(inputs, dt);

            // Step Physics
            this.physicsWorld.step();

            // Broadcast State
            if (this.currentFrame % 3 === 0) { // 每 3 幀同步一次
                this.networkManager.broadcastGameState({
                    frame: this.currentFrame,
                    timestamp: Date.now()
                    // ... 完整狀態
                });
            }
        }

        this.currentFrame++;
        this.gameStore.setFrame(this.currentFrame);
    }

    processInputs(inputs: PlayerInput[], dt: number) {
        inputs.forEach(input => {
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
                if (input.skillUsed) {
                    // 處理技能邏輯
                    console.log(`Player ${input.playerId} used skill ${input.skillUsed}`);
                }
            }
        });
    }

    useSkill(skillId: string) {
        // 這裡應該將技能使用加入到輸入中
        // 暫時直接處理
        console.log(`[GameEngine] Local player used skill: ${skillId}`);
    }
}
