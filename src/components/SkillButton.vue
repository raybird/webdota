<script setup lang="ts">
import { ref, computed } from 'vue'

// Props
interface Props {
  skillId: string
  name: string
  icon?: string
  size?: number
  cooldown: number
  currentCooldown: number
  isReady: boolean
  isComboMode?: boolean
  comboIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: '⚔️',
  size: 60,
  isComboMode: false,
  comboIcon: '💥'
})

// Emits
const emit = defineEmits<{
  press: []
}>()

// State
const isPressed = ref(false)

// Computed
const cooldownPercent = computed(() => {
  if (props.currentCooldown <= 0) return 0
  return (props.currentCooldown / props.cooldown) * 100
})

const buttonStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  transform: isPressed.value ? 'scale(0.9)' : 'scale(1)'
}))

const displayIcon = computed(() => {
  return props.isComboMode ? props.comboIcon : props.icon
})

// Methods
const handlePress = () => {
  if (!props.isReady && props.currentCooldown > 0) {
    return // 冷卻中，不可使用
  }
  
  isPressed.value = true
  emit('press')
  
  setTimeout(() => {
    isPressed.value = false
  }, 100)
}

const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  handlePress()
}

const handleMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  handlePress()
}
</script>

<template>
  <div 
    class="skill-button"
    :class="{ 
      ready: isReady, 
      cooldown: currentCooldown > 0,
      'combo-mode': isComboMode,
      pressed: isPressed
    }"
    :style="buttonStyle"
    @touchstart="handleTouchStart"
    @mousedown="handleMouseDown"
  >
    <!-- 技能圖示 -->
    <div class="skill-icon">{{ displayIcon }}</div>
    
    <!-- 技能名稱 -->
    <div class="skill-name">{{ name }}</div>
    
    <!-- 冷卻進度條 -->
    <div v-if="currentCooldown > 0" class="cooldown-overlay">
      <svg class="cooldown-circle" :width="size" :height="size">
        <circle
          class="cooldown-progress"
          :cx="size / 2"
          :cy="size / 2"
          :r="(size - 6) / 2"
          :stroke-dasharray="Math.PI * (size - 6)"
          :stroke-dashoffset="Math.PI * (size - 6) * (1 - cooldownPercent / 100)"
        />
      </svg>
      <div class="cooldown-text">{{ currentCooldown.toFixed(1) }}</div>
    </div>
    
    <!-- 接招模式發光效果 -->
    <div v-if="isComboMode" class="combo-glow"></div>
  </div>
</template>

<style scoped>
.skill-button {
  position: relative;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(100, 100, 255, 0.8), rgba(50, 50, 150, 0.6));
  border: 3px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.skill-button.ready {
  opacity: 1;
}

.skill-button.cooldown {
  opacity: 0.6;
  filter: grayscale(100%);
  cursor: not-allowed;
}

.skill-button.combo-mode {
  background: radial-gradient(circle at 30% 30%, rgba(255, 100, 100, 0.9), rgba(200, 50, 50, 0.7));
  border-color: rgba(255, 200, 100, 0.8);
  animation: combo-pulse 0.5s ease-in-out infinite;
}

.skill-button.pressed {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
}

.skill-icon {
  font-size: 28px;
  margin-bottom: 2px;
}

.skill-name {
  font-size: 10px;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.cooldown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.cooldown-circle {
  position: absolute;
  top: 0;
  left: 0;
  transform: rotate(-90deg);
}

.cooldown-progress {
  fill: none;
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 3;
  transition: stroke-dashoffset 0.1s linear;
}

.cooldown-text {
  font-size: 18px;
  font-weight: bold;
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
  z-index: 1;
}

.combo-glow {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: 50%;
  box-shadow: 0 0 20px 5px rgba(255, 200, 100, 0.8);
  pointer-events: none;
  animation: glow-pulse 0.8s ease-in-out infinite;
}

@keyframes combo-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes glow-pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}
</style>
