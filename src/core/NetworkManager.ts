import Peer, { type DataConnection } from 'peerjs';
import { eventBus } from '../events/EventBus';
import { BinarySerializer, PacketType, type NetEntityState } from '../utils/BinarySerializer';

/** Client 向 Host 提出的商店操作 */
export type ShopRequest =
    | { action: 'buy'; itemId: string }
    | { action: 'sell'; slot: number };

/** Host 廣播的玩家金幣與物品欄（物品以 ID 表示，空格為 null） */
export interface InventoryUpdate {
    playerId: string;
    gold: number;
    items: (string | null)[];
}

/** 房間中一位玩家的狀態（Host 的 room_state 與各自的 player_profile 共用） */
export interface RoomPlayerState {
    id: string;
    isReady: boolean;
    characterId?: string;
    team?: 'red' | 'blue' | 'neutral';
    name?: string;
}

/** 玩家自己的資料，連上每個 Peer 時直接傳給對方，變更時廣播 */
export interface PlayerProfile {
    name: string;
    characterId?: string;
    isReady: boolean;
}

/** 加入房間的連線逾時 */
const JOIN_TIMEOUT_MS = 12000;

/** 加入房間失敗的原因：房間不存在，或在時限內連不上 Host */
export class JoinRoomError extends Error {
    reason: 'not-found' | 'timeout';
    constructor(reason: 'not-found' | 'timeout') {
        super(reason === 'not-found' ? '找不到這個房間' : '連線逾時');
        this.reason = reason;
    }
}

export interface PlayerInput {
    frame: number;
    playerId: string;
    moveX: number;
    moveY: number;

    // 技能系統
    skillUsed?: string;        // 使用的技能 ID
    skillDirection?: {         // 技能方向
        x: number;
        z: number;
    };
}

export interface PlayerState {
    id: string;
    pos: { x: number; y: number; z: number };
    rot: { x: number; y: number; z: number; w: number };
    /** status：狀態效果位元旗標（STATUS_FLAG） */
    stats: { hp: number; energy: number; status: number };
}

export interface GameState {
    frame: number;
    timestamp: number;
    players: PlayerState[];
    isGameStarted: boolean;
}

/**
 * 防禦塔光彈的網路訊息：兩端的 ECS Entity ID 不同，
 * 建築與小兵用 EntitySyncManager 的網路 ID，玩家用 Peer ID
 */
export interface TowerAttackMessage {
    from: number;
    target: { netId: number } | { playerId: string };
    flightTime: number;
    damage: number;
}

export class NetworkManager {
    peer!: Peer;  // 會在 initPeer 中初始化
    peerId: string = '';
    connections: Map<string, DataConnection> = new Map();
    isHost: boolean = false;
    hostId: string = '';

    // Callbacks
    onConnected?: () => void;
    onPeerJoined?: (peerId: string) => void;
    onPeerLeft?: (peerId: string) => void;
    onInputReceived?: (input: PlayerInput) => void;
    onHostChanged?: (newHostId: string) => void;
    onPlayerReady?: (peerId: string, isReady: boolean) => void;
    onCharacterSelected?: (peerId: string, characterId: string) => void;
    onGameStartCountdown?: (seconds: number) => void;
    onGameStarted?: () => void;
    onGameState?: (state: GameState) => void;
    onEntityState?: (frame: number, entities: NetEntityState[]) => void;
    onShopRequest?: (fromPeerId: string, request: ShopRequest) => void;
    onInventory?: (update: InventoryUpdate) => void;
    onGameOver?: (winnerTeam: 'red' | 'blue', reason: 'base_destroyed' | 'surrender' | 'timeout') => void;
    /** Host 轉播的防禦塔光彈（只做畫面表現，傷害由 Host 結算後隨 ENTITY_STATE／GAME_STATE 同步） */
    onTowerAttack?: (attack: TowerAttackMessage) => void;
    onRoomCode?: (code: string, hostId: string) => void;
    onGetRoomState?: () => { players: RoomPlayerState[] };
    onRoomState?: (players: RoomPlayerState[]) => void;
    onPlayerProfile?: (peerId: string, profile: PlayerProfile) => void;
    /** Host：Client 要求換隊 */
    onTeamRequest?: (fromPeerId: string, team: 'red' | 'blue') => void;

    // Ping tracking
    private pingInterval: number | null = null;
    public pings: Map<string, number> = new Map();

    constructor() {
        // Peer 會在 createRoom 或 joinRoom 時初始化
        // 不在這裡自動創建，以便使用自定義 ID
    }

    private startPingLoop() {
        if (this.pingInterval !== null) {
            window.clearInterval(this.pingInterval);
        }
        this.pingInterval = window.setInterval(() => {
            this.connections.forEach(conn => {
                const now = Date.now();
                conn.send({ type: 'ping', timestamp: now });
            });
        }, 2000);
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
                this.peerId = id.toUpperCase(); // 強制大寫
                console.log(`[Network] My Peer ID: ${this.peerId}`);
                this.startPingLoop();
                if (this.onConnected) this.onConnected();
                resolve(this.peerId);
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
    connectToPeer(remotePeerId: string): DataConnection | null {
        if (this.connections.has(remotePeerId)) {
            console.warn(`[Network] Already connected to ${remotePeerId}`);
            return null;
        }

        const conn = this.peer.connect(remotePeerId, { reliable: true });
        this.handleIncomingConnection(conn);
        return conn;
    }

    /**
     * 處理新連線 (無論是主動連或被動連)
     */
    private handleIncomingConnection(conn: DataConnection) {
        conn.on('open', () => {
            const normalizedPeerId = conn.peer.toUpperCase(); // 強制大寫
            console.log(`[Network] Connected to ${normalizedPeerId}`);
            this.connections.set(normalizedPeerId, conn);

            // 通知上層有新玩家加入
            if (this.onPeerJoined) this.onPeerJoined(normalizedPeerId);

            // 如果是 Host，發送當前所有連線的 Peer 列表給新玩家
            if (this.isHost) {
                this.sendPeerList(conn);
            }
        });

        conn.on('data', (data: any) => {
            this.handleMessage(conn.peer.toUpperCase(), data);
        });

        conn.on('close', () => {
            const normalizedPeerId = conn.peer.toUpperCase();
            console.log(`[Network] ${normalizedPeerId} disconnected`);
            this.connections.delete(normalizedPeerId);
            if (this.onPeerLeft) this.onPeerLeft(normalizedPeerId);

            // 如果斷線的是 Host，觸發 Host Migration
            if (normalizedPeerId === this.hostId) {
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
        // PeerJS ID 區分大小寫：connections 的 key 是大寫正規化後的 ID，連線要用原始的 conn.peer
        const peerList = Array.from(this.connections.values())
            .map(c => c.peer)
            .filter(id => id !== conn.peer);
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
    private handleMessage(fromPeerId: string, data: any) {
        // 處理二進位數據 (ArrayBuffer)
        if (data instanceof ArrayBuffer) {
            const view = new DataView(data);
            const type = view.getUint8(0);

            if (type === PacketType.INPUT) {
                const input = BinarySerializer.deserializeInput(data, fromPeerId);
                if (this.onInputReceived) this.onInputReceived(input);
            } else if (type === PacketType.GAME_STATE) {
                const state = BinarySerializer.deserializeGameState(data);
                if (this.onGameState) this.onGameState(state);
            } else if (type === PacketType.ENTITY_STATE) {
                const { frame, entities } = BinarySerializer.deserializeEntityState(data);
                if (this.onEntityState) this.onEntityState(frame, entities);
            }
            return;
        }

        switch (data.type) {
            case 'peer_list':
                // 收到 Host 發來的 Peer 列表，連線到所有其他玩家
                data.peers.forEach((peerId: string) => {
                    const normalized = peerId.toUpperCase();
                    if (normalized !== this.peerId && !this.connections.has(normalized)) {
                        this.connectToPeer(peerId);
                    }
                });
                this.hostId = data.hostId;
                break;


            case 'host_migration':
                // Host 遷移通知
                this.hostId = data.newHostId;
                this.isHost = (this.hostId === this.peerId);
                console.log(`[Network] Host migrated to ${this.hostId}`);
                if (this.onHostChanged) this.onHostChanged(this.hostId);
                break;

            case 'player_ready':
                if (this.onPlayerReady) this.onPlayerReady(data.peerId, data.isReady);
                break;

            case 'character_selected':
                if (this.onCharacterSelected) this.onCharacterSelected(data.peerId, data.characterId);
                break;

            case 'game_start_countdown':
                if (this.onGameStartCountdown) this.onGameStartCountdown(data.seconds);
                break;

            case 'game_started':
                if (this.onGameStarted) this.onGameStarted();
                break;

            case 'shop':
                if (this.isHost && this.onShopRequest) this.onShopRequest(fromPeerId, data.request);
                break;

            case 'inventory':
                if (fromPeerId === this.hostId && this.onInventory) this.onInventory(data.update);
                break;

            case 'game_over':
                if (this.onGameOver) this.onGameOver(data.winnerTeam, data.reason);
                break;

            case 'tower_attack':
                if (fromPeerId === this.hostId && this.onTowerAttack) this.onTowerAttack(data.attack);
                break;

            case 'room_code':
                if (this.onRoomCode) this.onRoomCode(data.code, data.hostId);
                break;

            case 'room_state':
                if (fromPeerId === this.hostId && this.onRoomState) this.onRoomState(data.players);
                break;

            case 'player_profile':
                // 只接受對方描述自己，避免冒用別人的 ID
                if (this.onPlayerProfile) this.onPlayerProfile(fromPeerId, data.profile);
                break;

            case 'team_request':
                if (this.isHost && (data.team === 'red' || data.team === 'blue') && this.onTeamRequest) {
                    this.onTeamRequest(fromPeerId, data.team);
                }
                break;

            case 'ping':
                const connPing = this.connections.get(fromPeerId);
                if (connPing) {
                    connPing.send({ type: 'pong', timestamp: data.timestamp });
                }
                break;

            case 'pong':
                const rtt = Date.now() - data.timestamp;
                this.pings.set(fromPeerId, rtt);
                // 只廣播重要的 Ping (Host到Client, Client到Host)
                if (this.isHost || fromPeerId === this.hostId) {
                    eventBus.emit({ type: 'PING_UPDATED', peerId: fromPeerId, ping: rtt });
                }
                break;

            default:
                console.warn('[Network] Unknown message type:', data.type);
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
     * 移動輸入每幀都送，只需要給 Host；帶技能的輸入廣播給所有人，讓其他 Client 也能播放技能表現
     */
    sendInput(input: PlayerInput) {
        const binaryData = BinarySerializer.serializeInput(input);
        if (input.skillUsed) {
            this.connections.forEach(conn => conn.send(binaryData));
        } else {
            this.connections.get(this.hostId)?.send(binaryData);
        }
    }

    /**
     * 廣播遊戲狀態 (Host Only)
     */
    broadcastGameState(state: GameState) {
        const binaryData = BinarySerializer.serializeGameState(state);
        this.connections.forEach(conn => conn.send(binaryData));
    }

    /**
     * 廣播建築與小兵狀態 (Host Only)
     */
    broadcastEntityState(frame: number, entities: NetEntityState[]) {
        const binaryData = BinarySerializer.serializeEntityState(frame, entities);
        this.connections.forEach(conn => conn.send(binaryData));
    }

    /**
     * 送出商店操作給 Host
     */
    sendShopRequest(request: ShopRequest) {
        this.connections.get(this.hostId)?.send({ type: 'shop', request });
    }

    /**
     * 廣播玩家物品欄 (Host Only)
     */
    broadcastInventory(update: InventoryUpdate) {
        this.connections.forEach(conn => conn.send({ type: 'inventory', update }));
    }

    /**
     * 廣播遊戲結束 (Host Only)
     */
    broadcastTowerAttack(attack: TowerAttackMessage) {
        this.connections.forEach(conn => conn.send({ type: 'tower_attack', attack }));
    }

    broadcastGameOver(winnerTeam: 'red' | 'blue', reason: 'base_destroyed' | 'surrender' | 'timeout') {
        this.connections.forEach(conn => conn.send({ type: 'game_over', winnerTeam, reason }));
    }

    /**
     * 廣播房間狀態 (Host Only)
     */
    broadcastRoomState(players: RoomPlayerState[]) {
        const message = {
            type: 'room_state',
            players
        };
        this.connections.forEach(conn => conn.send(message));
    }

    /**
     * 傳送自己的資料；指定 peerId 時只傳給那位玩家，否則廣播
     */
    sendProfile(profile: PlayerProfile, peerId?: string) {
        const message = { type: 'player_profile', profile };
        if (peerId) {
            this.connections.get(peerId.toUpperCase())?.send(message);
        } else {
            this.connections.forEach(conn => conn.send(message));
        }
    }

    /** Client 要求 Host 把自己換到指定隊伍 */
    sendTeamRequest(team: 'red' | 'blue') {
        this.connections.get(this.hostId.toUpperCase())?.send({ type: 'team_request', team });
    }

    /**
     * 清理網路資源
     */
    cleanup() {
        console.log('[Network] Cleaning up network resources...');

        if (this.pingInterval !== null) {
            window.clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // 關閉所有連線
        this.connections.forEach(conn => conn.close());
        this.connections.clear();
        this.pings.clear();

        // 銷毀 Peer
        if (this.peer) {
            this.peer.destroy();
        }

        this.peerId = '';
        this.isHost = false;
        this.hostId = '';
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

        // 使用房間碼作為 Host ID 連線 (強制大寫)
        this.hostId = roomCode.toUpperCase();
        const conn = this.connectToPeer(this.hostId);
        if (!conn) return;

        // 等到和 Host 的連線真正打開；房間不存在時 PeerJS 會送 peer-unavailable
        await new Promise<void>((resolve, reject) => {
            const done = (error?: JoinRoomError) => {
                window.clearTimeout(timer);
                this.peer.off('error', onError);
                if (error) {
                    conn.close();
                    reject(error);
                } else {
                    resolve();
                }
            };
            const onError = (err: { type?: string }) => {
                if (err?.type === 'peer-unavailable') done(new JoinRoomError('not-found'));
            };
            const timer = window.setTimeout(() => done(new JoinRoomError('timeout')), JOIN_TIMEOUT_MS);
            this.peer.on('error', onError);
            conn.once('open', () => done());
        });
    }
}
