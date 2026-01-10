import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Item } from '../types/Item'

/**
 * 遊戲狀態管理
 */
export const useGameStore = defineStore('game', () => {
    // 狀態
    const isGameStarted = ref(false)
    const currentFrame = ref(0)
    const health = ref(100)
    const maxHealth = ref(100)
    const mana = ref(100)
    const maxMana = ref(100)

    // 裝備系統狀態
    const gold = ref(0)
    const inventory = ref<(Item | null)[]>([null, null, null, null, null, null])
    const isShopOpen = ref(false)

    // Actions
    function startGame() {
        isGameStarted.value = true
        currentFrame.value = 0
    }

    function stopGame() {
        isGameStarted.value = false
    }

    function setFrame(frame: number) {
        currentFrame.value = frame
    }

    function setHealth(value: number) {
        health.value = Math.max(0, Math.min(value, maxHealth.value))
    }

    function setMaxHealth(value: number) {
        maxHealth.value = value
    }

    function setMana(value: number) {
        mana.value = Math.max(0, Math.min(value, maxMana.value))
    }

    function setMaxMana(value: number) {
        maxMana.value = value
    }

    // Equipment System Actions
    function setGold(value: number) {
        gold.value = value
    }

    function setInventory(items: (Item | null)[]) {
        inventory.value = items
    }

    function toggleShop() {
        isShopOpen.value = !isShopOpen.value
    }

    function openShop() {
        isShopOpen.value = true
    }

    function closeShop() {
        isShopOpen.value = false
    }

    function reset() {
        isGameStarted.value = false
        currentFrame.value = 0
        health.value = 100
        maxHealth.value = 100
        mana.value = 100
        maxMana.value = 100
        gold.value = 0
        inventory.value = [null, null, null, null, null, null]
        isShopOpen.value = false
    }

    return {
        // State
        isGameStarted,
        currentFrame,
        health,
        maxHealth,
        mana,
        maxMana,
        gold,
        inventory,
        isShopOpen,

        // Actions
        startGame,
        stopGame,
        setFrame,
        setHealth,
        setMaxHealth,
        setMana,
        setMaxMana,
        setGold,
        setInventory,
        toggleShop,
        openShop,
        closeShop,
        reset
    }
})

