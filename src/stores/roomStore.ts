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
    const roomCode = ref('')  // 短房間碼 (6位)
    const connectedPlayers = ref<{
        id: string
        isReady: boolean
        characterId?: string
        team?: 'red' | 'blue' | 'neutral'
    }[]>([])
    const countdown = ref(0)

    // Getters
    const playerCount = computed(() => connectedPlayers.value.length)
    const allPlayersReady = computed(() =>
        connectedPlayers.value.length > 0 &&
        connectedPlayers.value.every(p => p.isReady)
    )
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

    function addPlayer(player: { id: string; isReady: boolean; characterId?: string; team?: 'red' | 'blue' | 'neutral' }) {
        const normalizedId = player.id.toUpperCase()
        const existingIndex = connectedPlayers.value.findIndex(p => p.id === normalizedId)
        if (existingIndex === -1) {
            connectedPlayers.value.push({ ...player, id: normalizedId })
        }
    }

    function removePlayer(playerId: string) {
        const normalizedId = playerId.toUpperCase()
        const index = connectedPlayers.value.findIndex(p => p.id === normalizedId)
        if (index !== -1) {
            connectedPlayers.value.splice(index, 1)
        }
    }

    function updatePlayerReady(playerId: string, isReady: boolean) {
        const normalizedId = playerId.toUpperCase()
        const playerIndex = connectedPlayers.value.findIndex(p => p.id === normalizedId)
        if (playerIndex !== -1) {
            const player = connectedPlayers.value[playerIndex]!
            connectedPlayers.value[playerIndex] = {
                id: player.id,
                isReady,
                characterId: player.characterId,
                team: player.team
            }
        } else {
            // 玩家不存在，新增
            connectedPlayers.value.push({ id: normalizedId, isReady })
        }
    }

    function updatePlayerCharacter(playerId: string, characterId: string) {
        const normalizedId = playerId.toUpperCase()
        const playerIndex = connectedPlayers.value.findIndex(p => p.id === normalizedId)
        if (playerIndex !== -1) {
            const player = connectedPlayers.value[playerIndex]!
            connectedPlayers.value[playerIndex] = {
                id: player.id,
                isReady: player.isReady,
                characterId,
                team: player.team
            }
        } else {
            // 玩家不存在，新增
            connectedPlayers.value.push({ id: normalizedId, isReady: false, characterId })
        }
    }

    function updatePlayerTeam(playerId: string, team: 'red' | 'blue' | 'neutral') {
        const normalizedId = playerId.toUpperCase()
        const playerIndex = connectedPlayers.value.findIndex(p => p.id === normalizedId)
        if (playerIndex !== -1) {
            const player = connectedPlayers.value[playerIndex]!
            connectedPlayers.value[playerIndex] = {
                ...player,
                team
            }
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
        myPlayer,
        amIReady,

        // Actions
        setInRoom,
        setHost,
        setMyPeerId,
        setRoomCode,
        addPlayer,
        removePlayer,
        updatePlayerReady,
        updatePlayerCharacter,
        updatePlayerTeam,
        setCountdown,
        clearRoom
    }
})
