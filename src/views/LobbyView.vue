<script setup lang="ts">
import { ref } from 'vue'
import { RoomService } from '../services/RoomService'

const props = defineProps<{
  roomService: RoomService
}>()

const roomIdInput = ref('')
const isConnecting = ref(false)

const createRoom = async () => {
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
    <div class="lobby-container">
      <h1 class="game-title">WebDota</h1>
      <p class="subtitle">多人連線競技遊戲</p>
      
      <div class="lobby-actions">
        <div class="action-card">
          <h3>建立新遊戲</h3>
          <p>創建一個新房間並邀請朋友加入</p>
          <button 
            class="btn btn-primary" 
            @click="createRoom"
            :disabled="isConnecting"
          >
            {{ isConnecting ? '連線中...' : '建立房間' }}
          </button>
        </div>

        <div class="divider">OR</div>

        <div class="action-card">
          <h3>加入遊戲</h3>
          <p>輸入房間 ID 加入現有遊戲</p>
          <div class="join-form">
            <input 
              v-model="roomIdInput" 
              type="text" 
              placeholder="輸入房間 ID"
              :disabled="isConnecting"
              @keyup.enter="joinRoom"
            >
            <button 
              class="btn btn-secondary" 
              @click="joinRoom"
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
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

.lobby-container {
  text-align: center;
  max-width: 800px;
  width: 90%;
}

.game-title {
  font-size: 4rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(to right, #42b883, #35495e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 20px rgba(66, 184, 131, 0.3);
}

.subtitle {
  font-size: 1.5rem;
  color: #aaa;
  margin-bottom: 3rem;
}

.lobby-actions {
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: stretch;
}

.action-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.3s;
}

.action-card:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.08);
}

.action-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.action-card p {
  color: #aaa;
  margin-bottom: 2rem;
  flex: 1;
}

.divider {
  display: flex;
  align-items: center;
  font-weight: bold;
  color: #666;
}

.join-form {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

input {
  flex: 1;
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #42b883;
}

.btn {
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
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
}

.btn-secondary {
  background: #35495e;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #2c3e50;
}

@media (max-width: 768px) {
  .lobby-actions {
    flex-direction: column;
  }
  
  .divider {
    display: none;
  }
}
</style>
