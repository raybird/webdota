import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager, type PlayerInput } from './NetworkManager';
import { HostManager } from './HostManager';
import { PlayerEntity } from './PlayerEntity';

export class GameApp {
    app!: pc.Application;
    physicsWorld!: RAPIER.World;
    networkManager!: NetworkManager;
    hostManager!: HostManager;

    // Player entities
    players: Map<string, PlayerEntity> = new Map();

    // Deterministic Lockstep
    readonly FIXED_TIMESTEP = 1 / 60; // 60 FPS
    currentFrame: number = 0;
    accumulator: number = 0;

    // RNG Seed (所有玩家共享)
    rngSeed: number = 12345;

    // 本地玩家輸入
    localInput: PlayerInput = {
        frame: 0,
        playerId: '',
        moveX: 0,
        moveY: 0
    };

    // Game State
    isGameStarted: boolean = false;
    playerReadyStatus: Map<string, boolean> = new Map();

    constructor() {
        // Placeholder for app, initialized in init
    }

    async init(canvas: HTMLCanvasElement) {
        // 1. Initialize Physics (Rapier WASM)
        await RAPIER.init();
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.physicsWorld = new RAPIER.World(gravity);
        console.log("Rapier Physics Initialized");

        // 2. Initialize PlayCanvas
        this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            keyboard: new pc.Keyboard(window),
            touch: new pc.TouchDevice(canvas),
            elementInput: new pc.ElementInput(canvas)
        });

        this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // 3. Create Basic Scene
        this.createScene();

        // 4. Initialize Network
        this.networkManager = new NetworkManager();
        this.networkManager.onConnected = () => {
            console.log('[GameApp] Network connected');
            this.localInput.playerId = this.networkManager.peerId;

            // 生成本地玩家
            this.spawnPlayer(this.networkManager.peerId);
        };
        this.networkManager.onPeerJoined = (peerId) => {
            console.log(`[GameApp] Peer joined: ${peerId}`);
            this.spawnPlayer(peerId);

            // 如果我是 Host，發送完整遊戲狀態給新玩家
            if (this.hostManager.isHost) {
                const playersData = Array.from(this.players.entries()).map(([id, p]) => ({
                    id,
                    pos: p.rigidBody.translation(),
                    stats: p.stats
                }));

                const gameState = {
                    isGameStarted: this.isGameStarted,
                    currentFrame: this.currentFrame,
                    players: playersData
                };

                this.networkManager.sendGameState(gameState, peerId);
            }

            // 廣播自己的準備狀態，讓新加入的玩家知道
            const myReady = this.playerReadyStatus.get(this.networkManager.peerId) || false;
            this.networkManager.sendPlayerReady(myReady);
        };
        this.networkManager.onPeerLeft = (peerId) => {
            console.log(`[GameApp] Peer left: ${peerId}`);
            this.removePlayer(peerId);
        };
        this.networkManager.onHostChanged = (newHostId) => {
            this.hostManager.setHost(newHostId === this.networkManager.peerId);
        };
        this.networkManager.onFrameSync = (remoteFrame) => {
            console.log(`[GameApp] Syncing frame from ${this.currentFrame} to ${remoteFrame}`);
            this.currentFrame = remoteFrame;
        };

        this.networkManager.onPlayerReady = (peerId, isReady) => {
            console.log(`[GameApp] Player ${peerId} is ${isReady ? 'Ready' : 'Not Ready'}`);
            this.playerReadyStatus.set(peerId, isReady);
        };

        this.networkManager.onGameStarted = () => {
            console.log('[GameApp] Game Started!');
            this.isGameStarted = true;
            this.currentFrame = 0; // 重置 Frame
        };

        this.networkManager.onGameState = (state: any) => {
            console.log('[GameApp] Received Game State:', state);

            // 同步所有玩家位置
            state.players.forEach((pData: any) => {
                // 如果玩家不存在，生成之
                if (!this.players.has(pData.id)) {
                    this.spawnPlayer(pData.id, pData.pos); // 修改 spawnPlayer 支援指定位置
                }

                // 強制更新位置
                const player = this.players.get(pData.id);
                if (player) {
                    player.rigidBody.setTranslation(pData.pos, true);
                    player.syncVisuals();
                    // 同步屬性
                    if (pData.stats) player.stats = pData.stats;
                }
            });

            // 如果遊戲已經開始，同步狀態
            if (state.isGameStarted) {
                this.isGameStarted = true;
                this.currentFrame = state.currentFrame;
            }
        };

        // 5. Initialize Host Manager
        this.hostManager = new HostManager(this.app, this.physicsWorld);

        // 6. Start Loop (使用 Deterministic Lockstep)
        this.app.start();

        // 使用固定時間步長的遊戲循環
        this.app.on('update', (dt) => this.gameLoop(dt));

        window.addEventListener('resize', () => this.app.resizeCanvas());
    }

    createScene() {
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
        ground.addComponent('render', {
            type: 'box'
        });
        ground.setLocalScale(20, 0.1, 20);
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(0.3, 0.5, 0.3);
        material.update();
        if (ground.render) {
            ground.render.material = material;
        }
        this.app.root.addChild(ground);

        // Ground (Physics)
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.05, 10.0);
        this.physicsWorld.createCollider(groundColliderDesc);
    }

    /**
     * 生成玩家實體
     */
    spawnPlayer(playerId: string, initialPos?: { x: number, y: number, z: number }) {
        if (this.players.has(playerId)) {
            // 如果已經存在，可能需要更新位置?
            return;
        }

        let x, z;

        if (initialPos) {
            x = initialPos.x;
            z = initialPos.z;
        } else {
            // Deterministic Spawn Position based on PeerID
            // 使用簡單的 hash 算法確保所有客戶端算出一樣的位置
            let hash = 0;
            for (let i = 0; i < playerId.length; i++) {
                hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
            }

            // Map hash to a position (e.g., circle around center)
            const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
            const radius = 3 + (Math.abs(hash) % 5); // 3 to 8 radius

            x = Math.cos(angle) * radius;
            z = Math.sin(angle) * radius;
        }

        const color = new pc.Color(
            Math.random(), // 顏色暫時隨機沒關係，或是也可以用 hash
            Math.random(),
            Math.random()
        );

        const player = new PlayerEntity(
            playerId,
            this.app,
            this.physicsWorld,
            { x, y: 1, z },
            color
        );

        this.players.set(playerId, player);
        console.log(`[GameApp] Spawned player ${playerId} at (${x.toFixed(2)}, 1, ${z.toFixed(2)})`);
    }

    /**
     * 移除玩家實體
     */
    removePlayer(playerId: string) {
        const player = this.players.get(playerId);
        if (player) {
            player.destroy(this.app, this.physicsWorld);
            this.players.delete(playerId);
            console.log(`[GameApp] Removed player ${playerId}`);
        }
    }

    /**
     * 主遊戲循環 (Deterministic Lockstep)
     */
    gameLoop(dt: number) {
        // 累積時間
        this.accumulator += dt;

        // 使用固定時間步長更新
        while (this.accumulator >= this.FIXED_TIMESTEP) {
            this.fixedUpdate(this.FIXED_TIMESTEP);
            this.accumulator -= this.FIXED_TIMESTEP;
            this.currentFrame++;
        }

        // 同步視覺 (每 frame 都執行，不受固定時間步長限制)
        this.syncVisuals();
    }

    /**
     * 固定時間步長更新 (Deterministic)
     */
    fixedUpdate(dt: number) {
        if (!this.isGameStarted) return;

        // 1. 收集本地輸入
        this.collectInput();

        // 2. 廣播輸入 (即使沒有按鍵也要廣播，確保同步)
        this.localInput.frame = this.currentFrame;
        this.networkManager.broadcastInput(this.localInput);

        // Host 定期廣播 Frame Sync (每 60 frames / 1秒) 以校正所有 Client
        if (this.hostManager.isHost && this.currentFrame % 60 === 0) {
            this.networkManager.broadcastFrameSync(this.currentFrame);
        }

        // 3. 收集所有玩家的最新輸入 (不要求 Frame 完全一致)
        const allInputs: PlayerInput[] = [];

        // 加入本地玩家的輸入
        allInputs.push(this.localInput);

        // 加入所有遠端玩家的最新輸入
        this.players.forEach((player, playerId) => {
            if (playerId === this.networkManager.peerId) return; // 跳過自己

            // 尋找這個玩家最近的輸入 (在當前 Frame 附近)
            let latestInput: PlayerInput | null = null;
            for (let frameOffset = 0; frameOffset <= 10; frameOffset++) {
                const checkFrame = this.currentFrame - frameOffset;
                const frameInputs = this.networkManager.inputBuffer.get(checkFrame);
                if (frameInputs && frameInputs.has(playerId)) {
                    latestInput = frameInputs.get(playerId)!;
                    break;
                }
            }

            if (latestInput) {
                allInputs.push(latestInput);
            } else {
                // 如果找不到輸入，使用空輸入
                allInputs.push({
                    frame: this.currentFrame,
                    playerId: playerId,
                    moveX: 0,
                    moveY: 0
                });
            }
        });

        // 排序確保順序一致
        allInputs.sort((a, b) => a.playerId.localeCompare(b.playerId));

        // 4. 執行遊戲邏輯
        this.processInputs(allInputs, dt);
        this.physicsWorld.step();
        this.hostManager.update(dt);

        // 5. 清理舊的 input buffer
        this.networkManager.inputBuffer.delete(this.currentFrame - 60); // 保留 1 秒
    }

    /**
     * 收集本地玩家輸入
     */
    collectInput() {
        // 簡化版: 使用鍵盤 WASD
        const keyboard = this.app.keyboard;
        this.localInput.moveX = 0;
        this.localInput.moveY = 0;
        this.localInput.action = undefined;

        if (keyboard) {
            if (keyboard.isPressed(pc.KEY_W)) this.localInput.moveY = -1;
            if (keyboard.isPressed(pc.KEY_S)) this.localInput.moveY = 1;
            if (keyboard.isPressed(pc.KEY_A)) this.localInput.moveX = -1;
            if (keyboard.isPressed(pc.KEY_D)) this.localInput.moveX = 1;

            // 測試用: 空白鍵扣血
            if (keyboard.wasPressed(pc.KEY_SPACE)) {
                this.localInput.action = 'test_damage';
            }
        }
    }

    /**
     * 處理所有玩家的輸入
     */
    processInputs(inputs: PlayerInput[], dt: number) {
        // Temporary debug: log every 60 frames
        if (this.currentFrame % 60 === 0 && inputs.length > 0) {
            const inputDetails = inputs.map(i => {
                const frameOffset = this.currentFrame - i.frame;
                return `${i.playerId.substring(0, 8)}(${i.moveX},${i.moveY},F-${frameOffset})`;
            });
            console.log(`[Frame ${this.currentFrame}] Processing ${inputs.length} inputs:`, inputDetails);
        }

        inputs.forEach((input) => {
            const player = this.players.get(input.playerId);
            if (player) {
                player.move(input.moveX, input.moveY, dt);

                // 處理動作
                if (input.action === 'test_damage') {
                    // 測試：讓自己受傷
                    player.takeDamage(10);
                }
            } else if (input.moveX !== 0 || input.moveY !== 0) {
                console.warn(`[GameApp] Player ${input.playerId.substring(0, 8)} not found! Available:`,
                    Array.from(this.players.keys()).map(id => id.substring(0, 8)));
            }
        });
    }

    /**
     * 同步視覺與物理
     */
    syncVisuals() {
        this.players.forEach((player) => {
            player.syncVisuals();
        });
    }
}
