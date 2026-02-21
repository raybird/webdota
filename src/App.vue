<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoomStore } from './stores/roomStore'
import { useGameStore } from './stores/gameStore'
import { RoomService } from './services/RoomService'
import { CharacterService } from './services/CharacterService'
import { GameService } from './services/GameService'
import { NetworkManager } from './core/NetworkManager'
import { eventBus } from './events/EventBus'
import { audioManager } from './core/AudioManager'

import { defineAsyncComponent } from 'vue'

// Lazy loaded Views
const LobbyView = defineAsyncComponent(() => import('./views/LobbyView.vue'))
const RoomView = defineAsyncComponent(() => import('./views/RoomView.vue'))
const GameView = defineAsyncComponent(() => import('./views/GameView.vue'))

// Stores
const roomStore = useRoomStore()
const gameStore = useGameStore()

// Services
// 這裡我們手動依賴注入，或者可以使用 Vue 的 provide/inject
const networkManager = new NetworkManager()
const roomService = new RoomService(networkManager)
const characterService = new CharacterService(networkManager)
const gameService = new GameService(networkManager)

// 連結 RoomService 與 GameService
roomService.setGameService(gameService)

// Provide services to children (optional, but good for deep components)
import { provide } from 'vue'
provide('roomService', roomService)
provide('characterService', characterService)
provide('gameService', gameService)
provide('audioManager', audioManager)

// 初始化音效 (需要使用者互動)
const initAudio = () => {
  audioManager.init()
  audioManager.startBGM()
  // 移除監聽，避免重複執行
  window.removeEventListener('click', initAudio)
  window.removeEventListener('keydown', initAudio)
}

// View State
const currentView = computed(() => {
  if (gameStore.isGameStarted) return 'game'
  if (roomStore.isInRoom) return 'room'
  return 'lobby'
})

// Debug Panel
const showDebug = ref(true)
const networkEvents = ref<string[]>([])

const addNetworkEvent = (event: string) => {
  networkEvents.value.unshift(event)
  if (networkEvents.value.length > 10) networkEvents.value.pop()
}

onMounted(() => {
  // Global Event Listeners for Debugging
  eventBus.on('ROOM_CREATED', (e) => addNetworkEvent(`🏠 房間建立: ${e.roomId}`))
  eventBus.on('PLAYER_JOINED', (e) => addNetworkEvent(`👤 玩家加入: ${e.playerId}`))
  eventBus.on('GAME_STARTED', () => addNetworkEvent(`🚀 遊戲開始`))
  
  // Expose services for debugging
  const win = window as any
  win.services = {
    room: roomService,
    character: characterService,
    game: gameService,
    network: networkManager
  }
  
  // 首次互動初始化音效
  window.addEventListener('click', initAudio)
  window.addEventListener('keydown', initAudio)
})
</script>

<template>
  <div class="app-container">
    <!-- View Switcher -->
    <Transition name="fade" mode="out-in">
      <LobbyView 
        v-if="currentView === 'lobby'" 
        :room-service="roomService"
      />
      
      <RoomView 
        v-else-if="currentView === 'room'"
        :room-service="roomService"
        :game-service="gameService"
      />
      
      <GameView 
        v-else-if="currentView === 'game'"
        :game-service="gameService"
      />
    </Transition>

    <!-- Debug Panel -->
    <div v-if="showDebug" class="debug-panel">
      <div class="debug-header" @click="showDebug = !showDebug">
        Debug Info (Click to toggle)
      </div>
      <div class="debug-content">
        <div v-for="(event, index) in networkEvents" :key="index" class="debug-line">
          {{ event }}
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Global Styles */
body {
  margin: 0;
  overflow: hidden;
  background-color: #1a1a2e;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Debug Panel */
.debug-panel {
  position: fixed;
  top: 10px;
  right: 10px;
  width: 300px;
  background: rgba(0, 0, 0, 0.7);
  color: #0f0;
  font-family: monospace;
  font-size: 12px;
  border-radius: 4px;
  z-index: 9999;
  pointer-events: none;
}

.debug-header {
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.8);
  border-bottom: 1px solid #333;
  pointer-events: auto;
  cursor: pointer;
}

.debug-content {
  padding: 10px;
  max-height: 200px;
  overflow-y: auto;
}

.debug-line {
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
