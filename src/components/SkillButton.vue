<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { AudioManager } from '../core/AudioManager'

const audioManager = inject<AudioManager>('audioManager')

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
    audioManager?.playCooldown()
    return // 冷卻中，不可使用
  }
  
  audioManager?.playSkillUse()
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
    <!-- 技能背景裝飾 -->
    <div class="skill-bg"></div>
    
    <!-- 技能圖示 -->
    <div class="skill-icon">{{ displayIcon }}</div>
    
    <!-- 技能名稱 -->
    <div class="skill-name">{{ name }}</div>
    
    <!-- 冷卻遮罩 -->
    <div v-if="currentCooldown > 0" class="cooldown-overlay">
      <svg class="cooldown-circle" :width="size" :height="size">
        <circle
          class="cooldown-track"
          :cx="size / 2"
          :cy="size / 2"
          :r="(size - 4) / 2"
        />
        <circle
          class="cooldown-progress"
          :cx="size / 2"
          :cy="size / 2"
          :r="(size - 4) / 2"
          :stroke-dasharray="Math.PI * (size - 4)"
          :stroke-dashoffset="Math.PI * (size - 4) * (1 - cooldownPercent / 100)"
        />
      </svg>
      <div class="cooldown-text">{{ currentCooldown.toFixed(1) }}</div>
    </div>
    
    <!-- 符文邊框裝飾 (Ready 狀態) -->
    <div v-if="isReady" class="rune-border"></div>
    
    <!-- 接招模式發光效果 -->
    <div v-if="isComboMode" class="combo-glow"></div>
  </div>
</template>

<style scoped>
.skill-button {
  position: relative;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #4a0e4e, #240046);
  border: 2px solid var(--c-primary-dim);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible; /* 允許光暈溢出 */
}

.skill-button.ready {
  border-color: var(--c-primary);
  box-shadow: 0 0 15px var(--c-secondary), inset 0 0 10px rgba(157, 78, 221, 0.3);
}

.skill-button.ready:hover {
  transform: scale(1.05);
  box-shadow: 0 0 25px var(--c-primary), inset 0 0 15px rgba(255, 215, 0, 0.3);
}

.skill-button.cooldown {
  opacity: 0.8;
  filter: grayscale(80%);
  cursor: not-allowed;
  border-color: #555;
  background: #222;
}

.skill-button.pressed {
  transform: scale(0.95);
  box-shadow: 0 0 5px var(--c-primary);
}

.skill-icon {
  font-size: 28px;
  margin-bottom: 2px;
  z-index: 2;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}

.skill-name {
  font-size: 10px;
  color: var(--c-primary);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  font-family: var(--font-heading);
  letter-spacing: 1px;
  z-index: 2;
  position: absolute;
  bottom: 8px;
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
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 5;
}

.cooldown-circle {
  position: absolute;
  top: 0;
  left: 0;
  transform: rotate(-90deg);
}

.cooldown-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 4;
}

.cooldown-progress {
  fill: none;
  stroke: var(--c-primary);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.1s linear;
  filter: drop-shadow(0 0 2px var(--c-primary));
}

.cooldown-text {
  font-size: 20px;
  font-weight: bold;
  font-family: var(--font-heading);
  color: var(--c-text-main);
  text-shadow: 0 0 5px black, 0 0 10px black;
  z-index: 6;
}

.rune-border {
  position: absolute;
  top: -4px; left: -4px; right: -4px; bottom: -4px;
  border: 2px dashed rgba(157, 78, 221, 0.5);
  border-radius: 50%;
  animation: spin 10s linear infinite;
  pointer-events: none;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.combo-glow {
  position: absolute;
  top: -8px; left: -8px; right: -8px; bottom: -8px;
  border-radius: 50%;
  box-shadow: 0 0 20px 5px rgba(255, 68, 68, 0.8);
  border: 2px solid #ff4444;
  pointer-events: none;
  animation: glow-pulse 0.8s ease-in-out infinite;
  z-index: 0;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
</style>
