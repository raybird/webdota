<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '../../stores/roomStore'
import { RoomService } from '../../services/RoomService'
import { GameService } from '../../services/GameService'
import PlayerList from './PlayerList.vue'
import CharacterSelector from './CharacterSelector.vue'

const props = defineProps<{
  roomService: RoomService
  gameService: GameService
}>()

const roomStore = useRoomStore()

const isHost = computed(() => roomStore.isHost)
const amIReady = computed(() => roomStore.amIReady)
const allPlayersReady = computed(() => roomStore.allPlayersReady)
const countdown = computed(() => roomStore.countdown)
const roomId = computed(() => roomStore.myPeerId) // Host ID is usually myPeerId if I'm host, but let's use roomStore logic

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

const copyRoomId = () => {
  navigator.clipboard.writeText(roomId.value)
  alert('房間 ID 已複製！')
}
</script>

<template>
  <div class="waiting-room">
    <div class="room-header">
      <h2>等待室</h2>
      <div class="room-info">
        <span>房間 ID: {{ roomId }}</span>
        <button @click="copyRoomId" class="copy-btn">📋</button>
      </div>
    </div>

    <div class="room-content">
      <!-- 左側：角色選擇 -->
      <div class="left-panel">
        <CharacterSelector />
      </div>

      <!-- 右側：玩家列表與控制 -->
      <div class="right-panel">
        <PlayerList />
        
        <div class="room-controls">
          <div v-if="countdown > 0" class="countdown-overlay">
            <div class="countdown-number">{{ countdown }}</div>
            <div class="countdown-text">遊戲即將開始...</div>
          </div>

          <div class="action-buttons">
            <button class="btn btn-danger" @click="leaveRoom">離開房間</button>
            
            <button 
              class="btn" 
              :class="amIReady ? 'btn-warning' : 'btn-success'"
              @click="toggleReady"
            >
              {{ amIReady ? '取消準備' : '準備' }}
            </button>

            <button 
              v-if="isHost"
              class="btn btn-primary"
              :disabled="!allPlayersReady"
              @click="startGame"
            >
              開始遊戲
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.waiting-room {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 30, 0.95);
  color: white;
  padding: 2rem;
  box-sizing: border-box;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.room-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
}

.room-content {
  display: flex;
  gap: 2rem;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  overflow-y: auto;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.room-controls {
  margin-top: auto;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  position: relative;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn {
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #42b883;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3aa876;
  transform: translateY(-2px);
}

.btn-success {
  background: #42b883;
  color: white;
}

.btn-warning {
  background: #ffd700;
  color: black;
}

.btn-danger {
  background: #ff4444;
  color: white;
}

.countdown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 10;
}

.countdown-number {
  font-size: 4rem;
  font-weight: bold;
  color: #ffd700;
  animation: pulse 1s infinite;
}

.countdown-text {
  font-size: 1.2rem;
  color: #fff;
  margin-top: 0.5rem;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
</style>
