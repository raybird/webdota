<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from '../../events/EventBus'

interface Notification {
  id: number
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
}

const notifications = ref<Notification[]>([])
let nextId = 0

const addNotification = (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', duration = 3000) => {
  const id = nextId++
  notifications.value.push({ id, message, type })
  setTimeout(() => {
    removeNotification(id)
  }, duration)
}

const removeNotification = (id: number) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

let onPeerLeft: any
let onPeerJoined: any
let onLatency: any

onMounted(() => {
  onPeerLeft = (e: any) => {
    if (e.type === 'PLAYER_LEFT') {
      addNotification(`Player ${e.playerId.substring(0, 8)} disconnected.`, 'error')
    }
  }
  
  onPeerJoined = (e: any) => {
    if (e.type === 'PLAYER_JOINED') {
      addNotification(`Player ${e.playerId.substring(0, 8)} joined.`, 'success')
    }
  }

  // Ping warning tracking
  let lastWarningTime = 0
  onLatency = (e: any) => {
    if (e.type === 'PING_UPDATED' && e.ping > 150) {
      const now = Date.now()
      if (now - lastWarningTime > 5000) { // Limit warnings to every 5s
        addNotification(`High Latency: ${e.ping}ms`, 'warning')
        lastWarningTime = now
      }
    }
  }

  eventBus.on('PLAYER_LEFT', onPeerLeft)
  eventBus.on('PLAYER_JOINED', onPeerJoined)
  eventBus.on('PING_UPDATED', onLatency)
})

onUnmounted(() => {
  eventBus.off('PLAYER_LEFT', onPeerLeft)
  eventBus.off('PLAYER_JOINED', onPeerJoined)
  eventBus.off('PING_UPDATED', onLatency)
})
</script>

<template>
  <div class="notification-layer">
    <transition-group name="notif" tag="div" class="notif-container">
      <div 
        v-for="notif in notifications" 
        :key="notif.id" 
        class="notification-item" 
        :class="'notif-' + notif.type"
      >
        {{ notif.message }}
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.notification-layer {
  position: absolute;
  top: 80px;
  right: 20px;
  z-index: 50;
  pointer-events: none;
}

.notif-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}

.notification-item {
  padding: 8px 16px;
  border-radius: 4px;
  backdrop-filter: blur(8px);
  font-family: var(--font-primary);
  font-weight: 600;
  font-size: 0.9rem;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  border-left: 4px solid white;
}

.notif-info {
  background: rgba(30, 40, 60, 0.8);
  border-color: var(--color-primary);
}

.notif-warning {
  background: rgba(80, 60, 20, 0.8);
  border-color: var(--color-warning);
}

.notif-error {
  background: rgba(80, 20, 20, 0.8);
  border-color: var(--color-danger);
}

.notif-success {
  background: rgba(20, 80, 40, 0.8);
  border-color: var(--color-success);
}

/* Transitions */
.notif-enter-active,
.notif-leave-active {
  transition: all 0.3s ease;
}
.notif-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.notif-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
