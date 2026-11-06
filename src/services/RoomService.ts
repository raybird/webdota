import { useRoomStore } from '../stores/roomStore'
import { useCharacterStore } from '../stores/characterStore'
import { eventBus } from '../events/EventBus'
import { NetworkManager } from '../core/NetworkManager'
import { RoomCodeManager } from '../utils/RoomCodeManager'
import type { GameService } from './GameService'
import type { PlayerProfile, RoomPlayerState } from '../core/NetworkManager'
import { loadNickname, normalizeNickname, saveNickname } from '../utils/nickname'

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
    private nickname = loadNickname()

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
        this.networkManager.onPeerJoined = (peerId) => {
            this.roomStore.addPlayer({ id: peerId, isReady: false })
            // Host 分配隊伍：放到人少的一邊
            if (this.roomStore.isHost) {
                this.roomStore.updatePlayerTeam(peerId, this.teamWithFewerPlayers(peerId))
            }
            // 直接把自己的資料傳給新連上的玩家（Mesh 中每條連線兩端都會觸發）
            this.networkManager.sendProfile(this.myProfile(), peerId)
            eventBus.emit({ type: 'PLAYER_JOINED', playerId: peerId })
            if (this.roomStore.isHost) this.broadcastRoomState()
        }

        this.networkManager.onPeerLeft = (peerId) => {
            this.roomStore.removePlayer(peerId)
            eventBus.emit({ type: 'PLAYER_LEFT', playerId: peerId })
            if (this.roomStore.isHost) this.broadcastRoomState()
        }

        // Host 遷移：房主斷線後由新 Host 接手房間狀態（GameEngine 在遊戲中另外接手模擬）
        this.networkManager.onHostChanged = () => {
            this.roomStore.setHost(this.networkManager.isHost)
            if (this.roomStore.isHost) this.broadcastRoomState()
        }

        this.networkManager.onPlayerReady = (peerId, isReady) => {
            this.roomStore.updatePlayerReady(peerId, isReady)
            eventBus.emit({ type: 'PLAYER_READY', playerId: peerId, isReady })
        }

        this.networkManager.onPlayerProfile = (peerId, profile) => {
            this.roomStore.patchPlayer(peerId, {
                name: normalizeNickname(profile.name ?? '') || undefined,
                characterId: profile.characterId,
                isReady: profile.isReady
            })
            if (profile.characterId) this.characterStore.setPlayerCharacter(peerId, profile.characterId)
            if (this.roomStore.isHost) this.broadcastRoomState()
        }

        this.networkManager.onTeamRequest = (peerId, team) => {
            this.setPlayerTeam(peerId, team)
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
        this.networkManager.onGetRoomState = () => ({ players: this.roomPlayers() })

        // Client: 以 Host 的房間狀態為準（隊伍由 Host 決定）
        this.networkManager.onRoomState = (players) => {
            // 用 Peer ID 判斷自己：這份狀態可能在 joinRoom 回傳、store 設好 myPeerId 之前就送到
            const myId = this.networkManager.peerId.toUpperCase()
            for (const p of players) {
                // 自己的暱稱、角色與準備狀態以本地為準，Host 那份可能還沒收到最新的
                const isMe = p.id.toUpperCase() === myId
                this.roomStore.patchPlayer(p.id, isMe
                    ? { team: p.team }
                    : { isReady: p.isReady, characterId: p.characterId, team: p.team, name: p.name })
                if (!isMe && p.characterId) this.characterStore.setPlayerCharacter(p.id, p.characterId)
            }
            // Host 名單裡沒有的玩家已經離開
            const ids = new Set(players.map(p => p.id.toUpperCase()))
            for (const p of [...this.roomStore.connectedPlayers]) {
                if (!ids.has(p.id) && p.id !== myId) this.roomStore.removePlayer(p.id)
            }
        }
    }

    private roomPlayers(): RoomPlayerState[] {
        return this.roomStore.connectedPlayers.map(p => ({
            id: p.id,
            isReady: p.isReady,
            characterId: p.characterId,
            team: p.team,
            name: p.name
        }))
    }

    private broadcastRoomState() {
        this.networkManager.broadcastRoomState(this.roomPlayers())
    }

    private teamWithFewerPlayers(excludeId: string): 'red' | 'blue' {
        const others = this.roomStore.connectedPlayers.filter(p => p.id !== excludeId.toUpperCase())
        const red = others.filter(p => p.team === 'red').length
        const blue = others.filter(p => p.team === 'blue').length
        return red <= blue ? 'red' : 'blue'
    }

    /** Host：設定玩家隊伍並廣播；倒數中不能換隊 */
    private setPlayerTeam(peerId: string, team: 'red' | 'blue') {
        if (!this.roomStore.isHost || this.roomStore.countdown > 0) return
        this.roomStore.updatePlayerTeam(peerId, team)
        this.broadcastRoomState()
    }

    private myProfile(): PlayerProfile {
        const me = this.roomStore.myPlayer
        return {
            name: this.nickname,
            characterId: me?.characterId ?? this.characterStore.selectedCharacterId,
            isReady: me?.isReady ?? false
        }
    }

    /** 目前使用的暱稱 */
    getNickname(): string {
        return this.nickname
    }

    /**
     * 設定暱稱；在房間內時同步給其他玩家
     */
    setNickname(name: string) {
        const normalized = normalizeNickname(name)
        if (!normalized) return
        this.nickname = normalized
        saveNickname(normalized)
        if (!this.roomStore.isInRoom) return
        this.roomStore.patchPlayer(this.roomStore.myPeerId, { name: normalized })
        this.networkManager.sendProfile(this.myProfile())
    }

    /** 換到指定隊伍：Host 直接套用，Client 向 Host 提出 */
    requestTeam(team: 'red' | 'blue') {
        if (this.roomStore.myPlayer?.team === team) return
        if (this.roomStore.isHost) {
            this.setPlayerTeam(this.roomStore.myPeerId, team)
        } else {
            this.networkManager.sendTeamRequest(team)
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
        this.roomStore.addPlayer({
            id: roomCode, isReady: false, team: 'red',
            name: this.nickname, characterId: this.characterStore.selectedCharacterId
        })

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
        this.roomStore.addPlayer({
            id: this.networkManager.peerId, isReady: false,
            name: this.nickname, characterId: this.characterStore.selectedCharacterId
        })

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

                // 廣播遊戲開始（broadcastGameStarted 也會觸發本地的 onGameStarted 開始遊戲）
                this.networkManager.broadcastGameStarted()
            }
        }, 1000)
    }
}
