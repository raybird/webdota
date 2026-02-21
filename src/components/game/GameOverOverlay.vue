<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isVisible: boolean
  winnerTeam: 'red' | 'blue' | null
  reason: string
}>()

const emit = defineEmits(['back-to-lobby'])

const isVictory = computed(() => {
  // 假設本地玩家是藍隊（此處邏輯需與 RoomStore 連動，MVP 先簡單處理）
  return props.winnerTeam === 'blue'
})
</script>

<template>
  <Transition name="fade">
    <div v-if="isVisible" class="game-over-overlay">
      <div class="result-card card-glass animate-pop">
        <h1 :class="['result-title', isVictory ? 'victory' : 'defeat']">
          {{ isVictory ? 'VICTORY' : 'DEFEAT' }}
        </h1>
        
        <div class="result-details">
          <p class="winner-text">
            <span :class="winnerTeam">{{ winnerTeam?.toUpperCase() }} TEAM</span> WINS
          </p>
          <p class="reason-text">{{ reason === 'base_destroyed' ? 'Base Destroyed' : 'Game Over' }}</p>
        </div>

        <button class="btn-cyber primary lobby-btn" @click="emit('back-to-lobby')">
          RETURN TO LOBBY
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.result-card {
  width: 450px;
  padding: 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.result-title {
  font-family: var(--font-heading);
  font-size: 4rem;
  letter-spacing: 5px;
  margin: 0;
  text-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.result-title.victory {
  color: #ffcc00;
  filter: drop-shadow(0 0 15px rgba(255, 204, 0, 0.6));
}

.result-title.defeat {
  color: #ff4d4d;
  filter: drop-shadow(0 0 15px rgba(255, 77, 77, 0.6));
}

.result-details {
  font-family: var(--font-body);
}

.winner-text {
  font-size: 1.5rem;
  margin-bottom: 5px;
}

.red { color: #ff4d4d; }
.blue { color: #4d94ff; }

.reason-text {
  font-size: 1.1rem;
  color: var(--c-text-muted);
  font-style: italic;
}

.lobby-btn {
  width: 250px;
  padding: 15px;
  font-size: 1.2rem;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@keyframes pop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.animate-pop {
  animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>
