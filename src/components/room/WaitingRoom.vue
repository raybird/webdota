<script setup lang="ts">
import { computed, ref } from 'vue'
import PlayerList from './PlayerList.vue'
import CharacterSelector from './CharacterSelector.vue'
import { useRoomStore } from '../../stores/roomStore'
import { RoomService } from '../../services/RoomService'
import { GameService } from '../../services/GameService'

const props = defineProps<{
  roomService: RoomService
  gameService: GameService
}>()

const roomStore = useRoomStore()
// CharacterService 已移至 CharacterSelector 使用

const showCopied = ref(false)

// characters 已移至 CharacterSelector
const isHost = computed(() => roomStore.isHost)
const amIReady = computed(() => roomStore.amIReady)
const allPlayersReady = computed(() => roomStore.allPlayersReady)
const countdown = computed(() => roomStore.countdown)
const roomCode = computed(() => roomStore.roomCode)
const players = computed(() => roomStore.connectedPlayers)
const redPlayers = computed(() => players.value.filter(p => p.team === 'red'))
const bluePlayers = computed(() => players.value.filter(p => p.team === 'blue'))

// 相關邏輯已移至 CharacterSelector 或不再需要
// const characters = getAllCharacters()
// const selectedCharacterId = computed(() => characterStore.selectedCharacterId)
// const selectedCharacter = computed(() => getCharacter(selectedCharacterId.value))
// const myPeerId = computed(() => roomStore.myPeerId)
// ... functions ...

const toggleReady = () => {
  props.roomService.setReady(!amIReady.value)
}

const startGame = () => {
  if (isHost.value && allPlayersReady.value) {
    props.roomService.startGameCountdown()
  }
}

const leaveRoom = () => {
  props.roomService.leaveRoom()
}

const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(roomCode.value)
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}
</script>

<template>
  <div class="kof-screen">
    <!-- 頂部標題列 -->
    <header class="header">
      <h1 class="title">SELECT</h1>
      
      <!-- 房間碼 - 大而明顯 -->
      <div class="room-code-box" @click="copyRoomCode">
        <span class="code-label">ROOM</span>
        <span class="code-value">{{ roomCode }}</span>
        <span class="code-hint">{{ showCopied ? '✓複製' : '點擊' }}</span>
      </div>
    </header>

    <!-- 主區域 -->
    <main class="main">
      <!-- 左側：紅隊 -->
      <aside class="team-panel red-team">
        <PlayerList 
          :players="redPlayers" 
          team-color="red" 
          title="🔴 RED TEAM" 
        />
      </aside>

      <!-- 中央：角色選擇 -->
      <section class="center-panel">
        <div class="selector-container">
          <CharacterSelector />
        </div>

        <!-- 倒數 -->
        <div v-if="countdown > 0" class="countdown-overlay">
          <div class="cd-num">{{ countdown }}</div>
        </div>

        <!-- 按鈕 -->
        <div class="control-bar">
          <button class="btn btn-leave" @click="leaveRoom">離開</button>
          
          <div class="status-indicator">
            <div class="status-dot" :class="{ ready: amIReady }"></div>
            {{ amIReady ? '已準備' : '準備中' }}
          </div>

          <button class="btn btn-ready" :class="{ on: amIReady }" @click="toggleReady">
            {{ amIReady ? '取消' : '準備' }}
          </button>
          
          <button v-if="isHost" class="btn btn-start" :disabled="!allPlayersReady" @click="startGame">
            開始遊戲
          </button>
        </div>
      </section>

      <!-- 右側：藍隊 -->
      <aside class="team-panel blue-team">
        <PlayerList 
          :players="bluePlayers" 
          team-color="blue" 
          title="🔵 BLUE TEAM" 
        />
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* 根容器 - 確保填滿視口且不超出 */
.kof-screen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at center, #1a0b2e 0%, #0a0a12 100%);
  color: var(--c-primary);
  display: flex;
  flex-direction: column;
  font-family: var(--font-heading);
  overflow: hidden;
}

/* 頂部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1.5rem;
  background: linear-gradient(90deg, #240046 0%, #3c096c 50%, #240046 100%);
  border-bottom: 2px solid var(--c-primary-dim);
  box-shadow: 0 0 15px rgba(0,0,0,0.8);
  flex-shrink: 0;
  z-index: 10;
}

.title {
  font-size: 2rem;
  margin: 0;
  text-shadow: 0 0 10px var(--c-primary);
  letter-spacing: 2px;
}

.room-code-box {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.5rem 1.2rem;
  border: 1px solid var(--c-primary-dim);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.room-code-box:hover {
  border-color: var(--c-primary);
  box-shadow: 0 0 15px var(--c-secondary);
}

.code-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--c-primary);
  letter-spacing: 4px;
  text-shadow: 0 0 5px var(--c-primary);
}

/* 佈局調整 - 強制水平三欄 */
.main {
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: 0.5rem;
  gap: 0.5rem;
  overflow: hidden;
  min-height: 0;
}

.team-panel {
  width: 180px;
  min-width: 150px;
  max-width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  min-width: 300px;
}

.selector-container {
  flex: 1;
  padding: 0.5rem;
  overflow: auto;
}

.control-bar {
  display: flex;
  gap: 0.8rem;
  padding: 0.8rem;
  background: rgba(0, 0, 0, 0.4);
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.btn {
  padding: 0.5rem 1.2rem;
  font-size: 0.9rem;
  font-weight: bold;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  text-transform: uppercase;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-leave {
  background: transparent;
  border-color: #666;
  color: #ccc;
}

.btn-leave:hover {
  border-color: #fff;
  color: #fff;
}

.btn-ready {
  background: var(--c-secondary-dark, #3a0a4a);
  border-color: var(--c-secondary, #9d4edd);
  color: var(--c-secondary, #9d4edd);
}

.btn-ready:hover, .btn-ready.on {
  background: var(--c-secondary, #9d4edd);
  color: #fff;
}

.btn-start {
  background: linear-gradient(135deg, #ffd700, #b8860b);
  color: #000;
  border-color: #fff;
}

.btn-start:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  color: #aaa;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #666;
}

.status-dot.ready {
  background: #0f0;
  box-shadow: 0 0 8px #0f0;
}

.countdown-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.cd-num {
  font-size: 5rem;
  color: #ff0;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  50% { transform: scale(1.1); }
}

/* 響應式 - 只在極窄螢幕才堆疊 */
@media (max-width: 600px) {
  .main {
    flex-direction: column;
    overflow-y: auto;
  }
  
  .team-panel {
    width: 100%;
    max-width: none;
    height: 120px;
  }
}
</style>
