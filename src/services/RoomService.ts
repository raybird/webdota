import { useRoomStore } from '../stores/roomStore'
import { eventBus } from '../events/EventBus'
import { NetworkManager } from '../core/NetworkManager'


/**
 * 房間服務
 * 負責處理房間建立、加入、離開等邏輯
 */
export class RoomService {
    private roomStore = useRoomStore()
    private networkManager: NetworkManager

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager
        this.initListeners()
    }

    private initListeners() {
        // 監聽網路事件
        this.networkManager.onPeerJoined = (peerId) => {
            this.roomStore.addPlayer({ id: peerId, isReady: false, characterId: undefined })
            eventBus.emit({ type: 'PLAYER_JOINED', playerId: peerId })
        }

        this.networkManager.onPeerLeft = (peerId) => {
            this.roomStore.removePlayer(peerId)
            eventBus.emit({ type: 'PLAYER_LEFT', playerId: peerId })
        }

        this.networkManager.onPlayerReady = (peerId, isReady) => {
            this.roomStore.updatePlayerReady(peerId, isReady)
            eventBus.emit({ type: 'PLAYER_READY', playerId: peerId, isReady })
        }

        this.networkManager.onGameStartCountdown = (seconds) => {
            this.roomStore.setCountdown(seconds)
            eventBus.emit({ type: 'COUNTDOWN_STARTED', seconds })
        }
    }

    /**
     * 建立房間
     */
    async createRoom(): Promise<string> {
        // createRoom 現在是同步返回 string
        const peerId = this.networkManager.createRoom()

        this.roomStore.setInRoom(true)
        this.roomStore.setHost(true)
        this.roomStore.setMyPeerId(peerId)
        this.roomStore.addPlayer({ id: peerId, isReady: false, characterId: undefined })

        eventBus.emit({ type: 'ROOM_CREATED', roomId: peerId })
        return peerId
    }

    /**
     * 加入房間
     */
    async joinRoom(hostId: string): Promise<void> {
        await this.networkManager.joinRoom(hostId)

        this.roomStore.setInRoom(true)
        this.roomStore.setHost(false)
        this.roomStore.setMyPeerId(this.networkManager.peerId)

        eventBus.emit({ type: 'ROOM_JOINED', roomId: hostId })
    }

    /**
     * 離開房間
     */
    leaveRoom() {
        this.networkManager.cleanup()
        this.roomStore.clearRoom()
        eventBus.emit({ type: 'ROOM_LEFT' })
    }

    /**
     * 設定準備狀態
     */
    setReady(isReady: boolean) {
        this.networkManager.sendPlayerReady(isReady)
        // 本地狀態更新由 onPlayerReady 回調處理
    }

    /**
     * 開始遊戲倒數 (Host Only)
     */
    startGameCountdown() {
        if (!this.roomStore.isHost) return
        this.networkManager.broadcastGameStartCountdown(3)
    }
}
