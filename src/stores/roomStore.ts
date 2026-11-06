import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type RoomTeam = 'red' | 'blue' | 'neutral'

/** 房間中的玩家（id 一律大寫） */
export interface RoomPlayer {
    id: string
    isReady: boolean
    characterId?: string
    team?: RoomTeam
    /** 暱稱；還沒收到對方資料時為空，畫面改顯示 ID 前幾碼 */
    name?: string
}

/**
 * 房間與大廳狀態管理
 */
export const useRoomStore = defineStore('room', () => {
    // 狀態
    const isInRoom = ref(false)
    const isHost = ref(false)
    const myPeerId = ref('')
    const roomCode = ref('')  // 短房間碼 (6位)
    const connectedPlayers = ref<RoomPlayer[]>([])
    const countdown = ref(0)

    // Getters
    const playerCount = computed(() => connectedPlayers.value.length)
    const allPlayersReady = computed(() =>
        connectedPlayers.value.length > 0 &&
        connectedPlayers.value.every(p => p.isReady)
    )
    const readyCount = computed(() => connectedPlayers.value.filter(p => p.isReady).length)
    const myPlayer = computed(() =>
        connectedPlayers.value.find(p => p.id === myPeerId.value.toUpperCase())
    )
    const amIReady = computed(() => myPlayer.value?.isReady ?? false)

    // Actions
    function setInRoom(value: boolean) {
        isInRoom.value = value
    }

    function setHost(value: boolean) {
        isHost.value = value
    }

    function setMyPeerId(peerId: string) {
        myPeerId.value = peerId.toUpperCase()
    }

    function setRoomCode(code: string) {
        roomCode.value = code
    }

    /**
     * 更新玩家欄位，玩家不存在時新增；值為 undefined 的欄位不覆寫既有資料
     */
    function patchPlayer(playerId: string, patch: Partial<Omit<RoomPlayer, 'id'>>) {
        const id = playerId.toUpperCase()
        const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
        const index = connectedPlayers.value.findIndex(p => p.id === id)
        if (index === -1) {
            connectedPlayers.value.push({ id, isReady: false, ...defined })
        } else {
            connectedPlayers.value[index] = { ...connectedPlayers.value[index]!, ...defined }
        }
    }

    /** 新增玩家；已存在時不變動 */
    function addPlayer(player: RoomPlayer) {
        if (connectedPlayers.value.some(p => p.id === player.id.toUpperCase())) return
        patchPlayer(player.id, player)
    }

    function removePlayer(playerId: string) {
        const id = playerId.toUpperCase()
        connectedPlayers.value = connectedPlayers.value.filter(p => p.id !== id)
    }

    function updatePlayerReady(playerId: string, isReady: boolean) {
        patchPlayer(playerId, { isReady })
    }

    function updatePlayerCharacter(playerId: string, characterId: string) {
        patchPlayer(playerId, { characterId })
    }

    function updatePlayerTeam(playerId: string, team: RoomTeam) {
        if (connectedPlayers.value.some(p => p.id === playerId.toUpperCase())) patchPlayer(playerId, { team })
    }

    function setCountdown(value: number) {
        countdown.value = value
    }

    function clearRoom() {
        isInRoom.value = false
        isHost.value = false
        connectedPlayers.value = []
        countdown.value = 0
        roomCode.value = ''
    }

    return {
        // State
        isInRoom,
        isHost,
        myPeerId,
        roomCode,
        connectedPlayers,
        countdown,
        // Getters
        playerCount,
        allPlayersReady,
        readyCount,
        myPlayer,
        amIReady,
        // Actions
        setInRoom,
        setHost,
        setMyPeerId,
        setRoomCode,
        patchPlayer,
        addPlayer,
        removePlayer,
        updatePlayerReady,
        updatePlayerCharacter,
        updatePlayerTeam,
        setCountdown,
        clearRoom
    }
})
