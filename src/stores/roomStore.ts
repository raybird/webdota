import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 房間與大廳狀態管理
 */
export const useRoomStore = defineStore('room', () => {
    // 狀態
    const isInRoom = ref(false)
    const isHost = ref(false)
    const myPeerId = ref('')
    const connectedPlayers = ref<{
        id: string
        isReady: boolean
        characterId?: string
    }[]>([])
    const countdown = ref(0)

    // Getters
    const playerCount = computed(() => connectedPlayers.value.length)
    const allPlayersReady = computed(() =>
        connectedPlayers.value.length > 0 &&
        connectedPlayers.value.every(p => p.isReady)
    )
    const myPlayer = computed(() =>
        connectedPlayers.value.find(p => p.id === myPeerId.value)
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
        myPeerId.value = peerId
    }

    function addPlayer(player: { id: string; isReady: boolean; characterId?: string }) {
        const existingIndex = connectedPlayers.value.findIndex(p => p.id === player.id)
        if (existingIndex === -1) {
            connectedPlayers.value.push(player)
        }
    }

    function removePlayer(playerId: string) {
        const index = connectedPlayers.value.findIndex(p => p.id === playerId)
        if (index !== -1) {
            connectedPlayers.value.splice(index, 1)
        }
    }

    function updatePlayerReady(playerId: string, isReady: boolean) {
        const playerIndex = connectedPlayers.value.findIndex(p => p.id === playerId)
        if (playerIndex !== -1) {
            const player = connectedPlayers.value[playerIndex]!
            connectedPlayers.value[playerIndex] = {
                id: player.id,
                isReady,
                characterId: player.characterId
            }
        } else {
            // 玩家不存在，新增
            connectedPlayers.value.push({ id: playerId, isReady })
        }
    }

    function updatePlayerCharacter(playerId: string, characterId: string) {
        const playerIndex = connectedPlayers.value.findIndex(p => p.id === playerId)
        if (playerIndex !== -1) {
            const player = connectedPlayers.value[playerIndex]!
            connectedPlayers.value[playerIndex] = {
                id: player.id,
                isReady: player.isReady,
                characterId
            }
        } else {
            // 玩家不存在，新增
            connectedPlayers.value.push({ id: playerId, isReady: false, characterId })
        }
    }

    function setCountdown(value: number) {
        countdown.value = value
    }

    function clearRoom() {
        isInRoom.value = false
        isHost.value = false
        connectedPlayers.value = []
        countdown.value = 0
    }

    return {
        // State
        isInRoom,
        isHost,
        myPeerId,
        connectedPlayers,
        countdown,

        // Getters
        playerCount,
        allPlayersReady,
        myPlayer,
        amIReady,

        // Actions
        setInRoom,
        setHost,
        setMyPeerId,
        addPlayer,
        removePlayer,
        updatePlayerReady,
        updatePlayerCharacter,
        setCountdown,
        clearRoom
    }
})
