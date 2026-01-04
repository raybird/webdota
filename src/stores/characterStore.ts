import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { DEFAULT_CHARACTER_ID } from '../types/Character'

/**
 * 角色選擇狀態管理
 */
export const useCharacterStore = defineStore('character', () => {
    // 狀態
    const selectedCharacterId = ref<string>(DEFAULT_CHARACTER_ID)
    const playerCharacters = ref<Map<string, string>>(new Map())

    // Getters
    const myCharacter = computed(() => selectedCharacterId.value)

    function getPlayerCharacter(playerId: string): string | undefined {
        return playerCharacters.value.get(playerId.toUpperCase())
    }

    // Actions
    function selectCharacter(characterId: string) {
        selectedCharacterId.value = characterId
    }

    function setPlayerCharacter(playerId: string, characterId: string) {
        playerCharacters.value.set(playerId.toUpperCase(), characterId)
    }

    function removePlayerCharacter(playerId: string) {
        playerCharacters.value.delete(playerId.toUpperCase())
    }

    function clearAll() {
        selectedCharacterId.value = DEFAULT_CHARACTER_ID
        playerCharacters.value.clear()
    }

    return {
        // State
        selectedCharacterId,
        playerCharacters,

        // Getters
        myCharacter,
        getPlayerCharacter,

        // Actions
        selectCharacter,
        setPlayerCharacter,
        removePlayerCharacter,
        clearAll
    }
})
