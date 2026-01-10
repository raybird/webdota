import { useRoomStore } from '../stores/roomStore'
import { useCharacterStore } from '../stores/characterStore'
import { eventBus } from '../events/EventBus'
import { NetworkManager } from '../core/NetworkManager'
import { RoomCodeManager } from '../utils/RoomCodeManager'
import type { GameService } from './GameService'

/**
 * 房間服務
 * 負責處理房間建立、加入、離開等邏輯
 */
export class RoomService {
    private roomStore = useRoomStore()
    private characterStore = useCharacterStore()
    private networkManager: NetworkManager
    private gameService: GameService | null = null
    private countdownTimer: number | null = null

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager
        this.initListeners()
    }

    /**
     * 設置 GameService 引用 (用於開始遊戲)
     */
    setGameService(gameService: GameService) {
        this.gameService = gameService
    }

    private initListeners() {
        // 監聽網路事件
        // 監聽網路事件
        this.networkManager.onPeerJoined = (peerId) => {
            let team: 'red' | 'blue' | 'neutral' = 'neutral';

            // Host 負責分配隊伍
            if (this.roomStore.isHost) {
                const redCount = this.roomStore.connectedPlayers.filter(p => p.team === 'red').length;
                const blueCount = this.roomStore.connectedPlayers.filter(p => p.team === 'blue').length;
                team = redCount <= blueCount ? 'red' : 'blue';
            }

            this.roomStore.addPlayer({ id: peerId, isReady: false, characterId: undefined, team })
            eventBus.emit({ type: 'PLAYER_JOINED', playerId: peerId })

            // Host 廣播更新後的房間狀態
            if (this.roomStore.isHost) {
                const players = this.roomStore.connectedPlayers.map(p => ({
                    id: p.id,
                    isReady: p.isReady,
                    characterId: p.characterId,
                    team: p.team
                }));
                this.networkManager.broadcastRoomState(players);
            }
        }

        this.networkManager.onPeerLeft = (peerId) => {
            this.roomStore.removePlayer(peerId)
            eventBus.emit({ type: 'PLAYER_LEFT', playerId: peerId })
        }

        this.networkManager.onPlayerReady = (peerId, isReady) => {
            this.roomStore.updatePlayerReady(peerId, isReady)
            eventBus.emit({ type: 'PLAYER_READY', playerId: peerId, isReady })
        }

        // 監聽角色選擇事件，同步到 RoomStore 和 CharacterStore
        this.networkManager.onCharacterSelected = (peerId, characterId) => {
            console.log(`[RoomService] Player ${peerId} selected character ${characterId}`)
            this.roomStore.updatePlayerCharacter(peerId, characterId)
            // 同時同步到 characterStore
            this.characterStore.setPlayerCharacter(peerId, characterId)
        }

        this.networkManager.onGameStartCountdown = (seconds) => {
            this.roomStore.setCountdown(seconds)
            eventBus.emit({ type: 'COUNTDOWN_STARTED', seconds })

            // 非 Host 接收到倒數時，開始本地倒數
            if (!this.roomStore.isHost && seconds > 0) {
                this.startLocalCountdown(seconds)
            }
        }

        this.networkManager.onGameStarted = () => {
            console.log('[RoomService] Game started signal received')
            this.roomStore.setCountdown(0)
            if (this.gameService) {
                this.gameService.startGame()
            }
        }

        // Host: 提供房間狀態給新加入的玩家
        this.networkManager.onGetRoomState = () => {
            return {
                players: this.roomStore.connectedPlayers.map(p => ({
                    id: p.id,
                    isReady: p.isReady,
                    characterId: p.characterId,
                    team: p.team
                }))
            }
        }

        // Client: 接收房間狀態並同步
        this.networkManager.onRoomState = (players) => {
            console.log('[RoomService] Received room state, syncing players:', players)
            players.forEach(p => {
                // 添加所有玩家到本地 store
                if (!this.roomStore.connectedPlayers.find(cp => cp.id === p.id)) {
                    this.roomStore.addPlayer({
                        id: p.id,
                        isReady: p.isReady,
                        characterId: p.characterId,
                        team: p.team
                    })
                } else {
                    // 更新已存在玩家的狀態
                    this.roomStore.updatePlayerReady(p.id, p.isReady)
                    if (p.characterId) {
                        this.roomStore.updatePlayerCharacter(p.id, p.characterId)
                    }
                    if (p.team) {
                        this.roomStore.updatePlayerTeam(p.id, p.team)
                    }
                }
                // 同時同步到 characterStore
                if (p.characterId) {
                    this.characterStore.setPlayerCharacter(p.id, p.characterId)
                }
            })
        }
    }

    /**
     * 開始本地倒數 (用於非 Host 玩家)
     */
    private startLocalCountdown(seconds: number) {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer)
        }

        let remaining = seconds
        this.countdownTimer = window.setInterval(() => {
            remaining--
            this.roomStore.setCountdown(remaining)

            if (remaining <= 0) {
                if (this.countdownTimer) {
                    clearInterval(this.countdownTimer)
                    this.countdownTimer = null
                }
            }
        }, 1000)
    }

    /**
     * 建立房間
     */
    async createRoom(): Promise<string> {
        // 先生成短房間碼
        const roomCode = RoomCodeManager.generateCode()

        // 使用房間碼作為 Peer ID 創建房間
        await this.networkManager.createRoom(roomCode)

        this.roomStore.setInRoom(true)
        this.roomStore.setHost(true)
        this.roomStore.setMyPeerId(roomCode)  // roomCode 就是 peerId
        this.roomStore.setRoomCode(roomCode)
        // Host 預設為紅隊
        this.roomStore.addPlayer({ id: roomCode, isReady: false, characterId: undefined, team: 'red' })

        eventBus.emit({ type: 'ROOM_CREATED', roomId: roomCode, roomCode })
        return roomCode
    }

    /**
     * 加入房間 (直接使用房間碼)
     */
    async joinRoom(roomCode: string): Promise<void> {
        // 房間碼就是 Host 的 Peer ID，直接連線
        const normalizedCode = roomCode.toUpperCase().trim()

        await this.networkManager.joinRoom(normalizedCode)

        this.roomStore.setInRoom(true)
        this.roomStore.setHost(false)
        this.roomStore.setMyPeerId(this.networkManager.peerId)
        this.roomStore.setRoomCode(normalizedCode)

        eventBus.emit({ type: 'ROOM_JOINED', roomId: normalizedCode })
    }

    /**
     * 離開房間
     */
    leaveRoom() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer)
            this.countdownTimer = null
        }
        RoomCodeManager.clear()
        this.networkManager.cleanup()
        this.roomStore.clearRoom()
        eventBus.emit({ type: 'ROOM_LEFT' })
    }

    /**
     * 設定準備狀態
     */
    setReady(isReady: boolean) {
        const myPeerId = this.networkManager.peerId;

        // 確保 characterId 有值（若未選擇則使用預設 warrior）
        const myPlayer = this.roomStore.connectedPlayers.find(p => p.id === myPeerId.toUpperCase());
        if (!myPlayer?.characterId) {
            console.log(`[RoomService] Player ${myPeerId} has no characterId, setting default warrior`);
            this.roomStore.updatePlayerCharacter(myPeerId, 'warrior');
            this.characterStore.setPlayerCharacter(myPeerId, 'warrior');
        }

        this.networkManager.sendPlayerReady(isReady);
        // 本地狀態也需要立即更新
        this.roomStore.updatePlayerReady(myPeerId, isReady);
    }

    /**
     * 開始遊戲倒數 (Host Only)
     */
    startGameCountdown() {
        if (!this.roomStore.isHost) return

        // 清除之前的倒數
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer)
        }

        let countdown = 3

        // 廣播初始倒數
        this.networkManager.broadcastGameStartCountdown(countdown)
        this.roomStore.setCountdown(countdown)
        eventBus.emit({ type: 'COUNTDOWN_STARTED', seconds: countdown })

        // 開始倒數
        this.countdownTimer = window.setInterval(() => {
            countdown--

            if (countdown > 0) {
                // 廣播更新的倒數
                this.networkManager.broadcastGameStartCountdown(countdown)
                this.roomStore.setCountdown(countdown)
            } else {
                // 倒數結束
                if (this.countdownTimer) {
                    clearInterval(this.countdownTimer)
                    this.countdownTimer = null
                }

                this.roomStore.setCountdown(0)

                // 廣播遊戲開始
                this.networkManager.broadcastGameStarted()

                // 開始遊戲
                if (this.gameService) {
                    this.gameService.startGame()
                }
            }
        }, 1000)
    }
}
