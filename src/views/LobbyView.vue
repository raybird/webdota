<script setup lang="ts">
import { ref, inject } from 'vue'
import { RoomService } from '../services/RoomService'
import type { AudioManager } from '../core/AudioManager'

const props = defineProps<{
  roomService: RoomService
}>()

const audioManager = inject<AudioManager>('audioManager')

const roomIdInput = ref('')
const isConnecting = ref(false)

// Sound Helpers
const playClick = () => audioManager?.playClick()
const playHover = () => audioManager?.playHover()

const createRoom = async () => {
  playClick()
  isConnecting.value = true
  try {
    await props.roomService.createRoom()
  } catch (error) {
    console.error('Failed to create room:', error)
    alert('建立房間失敗')
  } finally {
    isConnecting.value = false
  }
}

const joinRoom = async () => {
  playClick()
  if (!roomIdInput.value) return
  
  isConnecting.value = true
  try {
    await props.roomService.joinRoom(roomIdInput.value)
  } catch (error) {
    console.error('Failed to join room:', error)
    alert('加入房間失敗，請檢查 ID 是否正確')
  } finally {
    isConnecting.value = false
  }
}
</script>

<template>
  <div class="lobby-view">
    <!-- 背景魔法特效 -->
    <div class="magic-bg">
      <div class="rune-circle"></div>
      <div class="particles"></div>
    </div>

    <div class="lobby-container">
      <h1 class="game-title">Mythic Legends</h1>
      <p class="subtitle">多人連線競技遊戲</p>
      
      <div class="lobby-actions">
        <div class="action-card card-fantasy">
          <h3>建立新遊戲</h3>
          <p>創建一個新房間並邀請朋友加入</p>
          <button 
            class="btn-fantasy main-btn" 
            @click="createRoom"
            @mouseenter="playHover"
            :disabled="isConnecting"
          >
            {{ isConnecting ? '連線中...' : '建立房間' }}
          </button>
        </div>

        <div class="divider">OR</div>

        <div class="action-card card-fantasy">
          <h3>加入遊戲</h3>
          <p>輸入房間 ID 加入現有遊戲</p>
          <div class="join-form">
            <input 
              v-model="roomIdInput" 
              type="text" 
              placeholder="輸入房間 ID"
              class="input-fantasy"
              :disabled="isConnecting"
              @keyup.enter="joinRoom"
            >
            <button 
              class="btn-fantasy secondary-btn" 
              @click="joinRoom"
              @mouseenter="playHover"
              :disabled="!roomIdInput || isConnecting"
            >
              加入
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #1a0b2e 0%, #000000 100%);
  position: relative;
  overflow: hidden;
}

.magic-bg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0;
  opacity: 0.3;
  pointer-events: none;
}

.rune-circle {
  position: absolute;
  top: 50%; left: 50%;
  width: 800px; height: 800px;
  transform: translate(-50%, -50%);
  border: 2px dashed var(--c-primary-dim);
  border-radius: 50%;
  animation: spin 60s linear infinite;
}

.lobby-container {
  text-align: center;
  max-width: 900px;
  width: 90%;
  z-index: 10;
  animation: fantasy-float 6s ease-in-out infinite;
}

.game-title {
  font-size: 5rem;
  margin-bottom: 0.5rem;
  color: var(--c-primary);
  text-shadow: 0 0 20px var(--c-secondary), 0 0 40px var(--c-secondary-dark);
  font-family: var(--font-heading);
  letter-spacing: 4px;
}

.subtitle {
  font-size: 1.5rem;
  color: var(--c-text-muted);
  margin-bottom: 3rem;
  font-family: var(--font-body);
  letter-spacing: 2px;
}

.lobby-actions {
  display: flex;
  gap: 3rem;
  justify-content: center;
  align-items: stretch;
}

.action-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.3s;
  background: rgba(20, 10, 30, 0.6);
}

.action-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0,0,0,0.6);
  border-color: var(--c-primary);
}

.action-card h3 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: var(--c-primary);
}

.action-card p {
  color: var(--c-text-muted);
  margin-bottom: 2rem;
  flex: 1;
}

.divider {
  display: flex;
  align-items: center;
  font-weight: bold;
  color: var(--c-primary-dim);
  font-family: var(--font-heading);
  font-size: 1.2rem;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.input-fantasy {
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid var(--c-primary-dim);
  background: rgba(0, 0, 0, 0.5);
  color: var(--c-primary);
  font-size: 1.2rem;
  text-align: center;
  font-family: var(--font-heading);
  outline: none;
  transition: all 0.3s;
}

.input-fantasy:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
}

.main-btn {
  width: 100%;
}

.secondary-btn {
  width: 100%;
  background: linear-gradient(180deg, #2c3e50 0%, #000 100%);
  border-color: #666;
  color: #ccc;
}

.secondary-btn:hover:not(:disabled) {
  border-color: #fff;
  color: #fff;
  box-shadow: 0 0 10px rgba(255,255,255,0.3);
}

@keyframes spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@media (max-width: 768px) {
  .lobby-actions {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .divider {
    display: none;
  }
  
  .game-title {
    font-size: 3rem;
  }
  
  .rune-circle {
    width: 400px;
    height: 400px;
  }
}
</style>
