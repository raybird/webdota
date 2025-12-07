import Peer, { type DataConnection } from 'peerjs';

export interface PlayerInput {
    frame: number;
    playerId: string;
    moveX: number;
    moveY: number;
    action?: 'test_damage'; // 'attack' | 'skill1' | 'skill2' etc.

    // 技能系統
    skillUsed?: string;        // 使用的技能 ID
    skillDirection?: {         // 技能方向
        x: number;
        z: number;
    };
}

export interface GameState {
    frame: number;
    timestamp: number;
    checksum?: string;
}

export class NetworkManager {
    peer!: Peer;  // 會在 initPeer 中初始化
    peerId: string = '';
    connections: Map<string, DataConnection> = new Map();
    isHost: boolean = false;
    hostId: string = '';

    // Frame sync
    currentFrame: number = 0;
    inputBuffer: Map<number, Map<string, PlayerInput>> = new Map(); // frame -> playerId -> input

    // Callbacks
    onConnected?: () => void;
    onPeerJoined?: (peerId: string) => void;
    onPeerLeft?: (peerId: string) => void;
    onInputReceived?: (input: PlayerInput) => void;
    onHostChanged?: (newHostId: string) => void;
    onFrameSync?: (frame: number) => void;
    onPlayerReady?: (peerId: string, isReady: boolean) => void;
    onCharacterSelected?: (peerId: string, characterId: string) => void;
    onGameStartCountdown?: (seconds: number) => void;
    onGameStarted?: () => void;
    onGameState?: (state: any) => void;
    onRoomCode?: (code: string, hostId: string) => void;
    onGetRoomState?: () => { players: Array<{ id: string; isReady: boolean; characterId?: string }> };
    onRoomState?: (players: Array<{ id: string; isReady: boolean; characterId?: string }>) => void;

    constructor() {
        // Peer 會在 createRoom 或 joinRoom 時初始化
        // 不在這裡自動創建，以便使用自定義 ID
    }

    /**
     * 初始化 Peer 連線 (內部使用)
     */
    private initPeer(customId?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // 如果已經有 Peer，先清理
            if (this.peer) {
                this.peer.destroy();
            }

            // 創建 Peer，可指定自定義 ID
            if (customId) {
                this.peer = new Peer(customId, {
                    // 使用公共 PeerJS Server (開發用)
                });
            } else {
                this.peer = new Peer({
                    // 使用公共 PeerJS Server (開發用)
                });
            }

            this.peer.on('open', (id) => {
                this.peerId = id;
                console.log(`[Network] My Peer ID: ${id}`);
                if (this.onConnected) this.onConnected();
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[Network] Peer error:', err);
                reject(err);
            });
        });
    }

    /**
     * 連線到指定的 Peer (用於加入房間)
     */
    connectToPeer(remotePeerId: string) {
        if (this.connections.has(remotePeerId)) {
            console.warn(`[Network] Already connected to ${remotePeerId}`);
            return;
        }

        const conn = this.peer.connect(remotePeerId, { reliable: true });
        this.handleIncomingConnection(conn);
    }

    /**
     * 處理新連線 (無論是主動連或被動連)
     */
    private handleIncomingConnection(conn: DataConnection) {
        conn.on('open', () => {
            console.log(`[Network] Connected to ${conn.peer}`);
            this.connections.set(conn.peer, conn);

            // 通知上層有新玩家加入
            if (this.onPeerJoined) this.onPeerJoined(conn.peer);

            // 如果是 Host，發送當前所有連線的 Peer 列表給新玩家
            if (this.isHost) {
                this.sendPeerList(conn);
            }
        });

        conn.on('data', (data: any) => {
            this.handleMessage(conn.peer, data);
        });

        conn.on('close', () => {
            console.log(`[Network] ${conn.peer} disconnected`);
            this.connections.delete(conn.peer);
            if (this.onPeerLeft) this.onPeerLeft(conn.peer);

            // 如果斷線的是 Host，觸發 Host Migration
            if (conn.peer === this.hostId) {
                this.electNewHost();
            }
        });

        conn.on('error', (err) => {
            console.error(`[Network] Connection error with ${conn.peer}:`, err);
        });
    }

    /**
     * Host 發送 Peer 列表給新加入的玩家，讓他們互相連線 (Mesh)
     * 同時發送完整的玩家資訊 (characterId, isReady)
     */
    private sendPeerList(conn: DataConnection) {
        const peerList = Array.from(this.connections.keys()).filter(id => id !== conn.peer);
        conn.send({
            type: 'peer_list',
            peers: peerList,
            hostId: this.hostId
        });

        // 發送完整的玩家狀態給新加入的玩家
        if (this.onGetRoomState) {
            const roomState = this.onGetRoomState();
            conn.send({
                type: 'room_state',
                players: roomState.players
            });
        }
    }

    /**
     * 處理收到的訊息
     */
    private handleMessage(_fromPeerId: string, data: any) {
        switch (data.type) {
            case 'peer_list':
                // 收到 Host 發來的 Peer 列表，連線到所有其他玩家
                data.peers.forEach((peerId: string) => {
                    if (peerId !== this.peerId && !this.connections.has(peerId)) {
                        this.connectToPeer(peerId);
                    }
                });
                this.hostId = data.hostId;
                break;

            case 'input':
                // 收到其他玩家的輸入
                const input: PlayerInput = data.input;

                // Debug: 每 60 frame 輸出一次
                if (input.frame % 60 === 0 && (input.moveX !== 0 || input.moveY !== 0)) {
                    console.log(`[Network] Received input from ${input.playerId.substring(0, 8)}: Frame ${input.frame}, Move (${input.moveX}, ${input.moveY})`);
                }

                this.storeInput(input);
                if (this.onInputReceived) this.onInputReceived(input);
                break;

            case 'host_migration':
                // Host 遷移通知
                this.hostId = data.newHostId;
                this.isHost = (this.hostId === this.peerId);
                console.log(`[Network] Host migrated to ${this.hostId}`);
                if (this.onHostChanged) this.onHostChanged(this.hostId);
                break;

            case 'sync_frame':
                if (this.onFrameSync) this.onFrameSync(data.frame);
                break;

            case 'player_ready':
                if (this.onPlayerReady) this.onPlayerReady(data.peerId, data.isReady);
                break;

            case 'character_selected':
                console.log('[NetworkManager] Received character selection:', data);
                if (this.onCharacterSelected) {
                    console.log('[NetworkManager] Calling onCharacterSelected callback');
                    this.onCharacterSelected(data.peerId, data.characterId);
                } else {
                    console.warn('[NetworkManager] onCharacterSelected callback not set!');
                }
                break;

            case 'game_start_countdown':
                if (this.onGameStartCountdown) this.onGameStartCountdown(data.seconds);
                break;

            case 'game_started':
                if (this.onGameStarted) this.onGameStarted();
                break;

            case 'game_state':
                if (this.onGameState) this.onGameState(data.state);
                break;

            case 'room_code':
                if (this.onRoomCode) this.onRoomCode(data.code, data.hostId);
                break;

            case 'room_state':
                console.log('[NetworkManager] Received room_state:', data.players);
                if (this.onRoomState) this.onRoomState(data.players);
                break;

            default:
                console.warn('[Network] Unknown message type:', data.type);
        }
    }

    /**
     * 發送遊戲狀態給指定玩家 (用於初始同步)
     */
    sendGameState(state: any, targetPeerId: string) {
        const conn = this.connections.get(targetPeerId);
        if (conn) {
            conn.send({
                type: 'game_state',
                state
            });
        }
    }

    /**
     * 發送準備狀態
     */
    sendPlayerReady(isReady: boolean) {
        const message = {
            type: 'player_ready',
            peerId: this.peerId,
            isReady
        };

        // 廣播給所有人 (包括 Host)
        this.connections.forEach(conn => conn.send(message));

        // 如果自己是 Host，也要觸發 callback
        if (this.onPlayerReady) this.onPlayerReady(this.peerId, isReady);
    }

    /**
     * 發送角色選擇
     */
    sendCharacterSelected(characterId: string) {
        const message = {
            type: 'character_selected',
            peerId: this.peerId,
            characterId
        };

        console.log('[NetworkManager] Sending character selection:', message, 'to', this.connections.size, 'peers');

        // 廣播給所有人
        this.connections.forEach(conn => conn.send(message));

        // 如果自己是 Host，也要觸發 callback
        if (this.onCharacterSelected) this.onCharacterSelected(this.peerId, characterId);
    }

    /**
     * 發送房間碼給指定玩家
     */
    sendRoomCode(targetPeerId: string, code: string) {
        const conn = this.connections.get(targetPeerId);
        if (conn) {
            conn.send({
                type: 'room_code',
                code,
                hostId: this.hostId
            });
        }
    }

    /**
     * 廣播遊戲開始倒數 (Host Only)
     */
    broadcastGameStartCountdown(seconds: number) {
        const message = {
            type: 'game_start_countdown',
            seconds
        };
        this.connections.forEach(conn => conn.send(message));
        if (this.onGameStartCountdown) this.onGameStartCountdown(seconds);
    }

    /**
     * 廣播遊戲正式開始 (Host Only)
     */
    broadcastGameStarted() {
        const message = {
            type: 'game_started'
        };
        this.connections.forEach(conn => conn.send(message));
        if (this.onGameStarted) this.onGameStarted();
    }

    /**
     * 發送輸入
     */
    sendInput(input: PlayerInput) {
        const message = {
            type: 'input',
            input
        };
        this.connections.forEach(conn => conn.send(message));
    }

    /**
     * 廣播遊戲狀態 (Host Only)
     */
    broadcastGameState(state: any) {
        const message = {
            type: 'game_state',
            state
        };
        this.connections.forEach(conn => conn.send(message));
    }

    /**
     * 清理網路資源
     */
    cleanup() {
        console.log('[Network] Cleaning up network resources...');

        // 關閉所有連線
        this.connections.forEach(conn => conn.close());
        this.connections.clear();

        // 銷毀 Peer
        if (this.peer) {
            this.peer.destroy();
        }

        this.peerId = '';
        this.isHost = false;
        this.hostId = '';
        this.inputBuffer.clear();
    }

    /**
     * 發送 Frame 同步訊息給指定玩家
     */
    sendFrameSync(frame: number, targetPeerId: string) {
        const conn = this.connections.get(targetPeerId);
        if (conn) {
            conn.send({
                type: 'sync_frame',
                frame
            });
            // console.log(`[Network] Sent frame sync ${frame} to ${targetPeerId}`); // 減少 log
        }
    }

    /**
     * 廣播 Frame 同步訊息給所有玩家
     */
    broadcastFrameSync(frame: number) {
        const message = {
            type: 'sync_frame',
            frame
        };
        this.connections.forEach(conn => conn.send(message));
    }

    /**
     * 廣播玩家輸入給所有其他玩家
     */
    broadcastInput(input: PlayerInput) {
        const message = {
            type: 'input',
            input
        };

        this.connections.forEach((conn) => {
            conn.send(message);
        });

        // 也存到自己的 buffer
        this.storeInput(input);
    }

    /**
     * 儲存輸入到 buffer
     */
    private storeInput(input: PlayerInput) {
        if (!this.inputBuffer.has(input.frame)) {
            this.inputBuffer.set(input.frame, new Map());
        }
        this.inputBuffer.get(input.frame)!.set(input.playerId, input);
    }

    /**
     * 檢查某個 Frame 是否收到所有玩家的輸入
     */
    hasAllInputsForFrame(frame: number): boolean {
        const expectedPlayerCount = this.connections.size + 1; // +1 for self
        const inputs = this.inputBuffer.get(frame);
        return inputs ? inputs.size >= expectedPlayerCount : false;
    }

    /**
     * 取得某個 Frame 的所有輸入
     */
    getInputsForFrame(frame: number): PlayerInput[] {
        const inputs = this.inputBuffer.get(frame);
        return inputs ? Array.from(inputs.values()) : [];
    }

    /**
     * 選舉新 Host (當前 Host 斷線時)
     */
    private electNewHost() {
        // 簡單策略: 選 Peer ID 字典序最小的
        const allPeerIds = [this.peerId, ...Array.from(this.connections.keys())];
        allPeerIds.sort();
        const newHostId = allPeerIds[0];

        if (!newHostId) {
            console.error('[Network] Cannot elect new host: no peers available');
            return;
        }

        this.hostId = newHostId;
        this.isHost = (newHostId === this.peerId);

        console.log(`[Network] New host elected: ${newHostId}`);

        // 廣播 Host 變更
        if (this.isHost) {
            this.broadcastHostMigration();
        }

        if (this.onHostChanged) this.onHostChanged(newHostId);
    }

    /**
     * 廣播 Host 遷移訊息
     */
    private broadcastHostMigration() {
        const message = {
            type: 'host_migration',
            newHostId: this.hostId
        };

        this.connections.forEach((conn) => {
            conn.send(message);
        });
    }

    /**
     * 建立房間 (成為 Host) - 使用短碼作為 Peer ID
     */
    async createRoom(roomCode: string): Promise<string> {
        // 使用房間碼作為 Peer ID
        await this.initPeer(roomCode);

        this.isHost = true;
        this.hostId = this.peerId;
        console.log(`[Network] Room created. Room Code: ${roomCode}, Host ID: ${this.peerId}`);
        return this.peerId;
    }

    /**
     * 加入房間 (連線到 Host) - 使用房間碼
     */
    async joinRoom(roomCode: string): Promise<void> {
        // 先初始化自己的 Peer (自動生成 ID)
        await this.initPeer();

        // 使用房間碼作為 Host ID 連線
        this.hostId = roomCode;
        this.connectToPeer(roomCode);
    }
}
