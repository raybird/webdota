<script setup lang="ts">
import { ref, computed } from 'vue'

// Props
interface Props {
  size?: number
  maxDistance?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 120,
  maxDistance: 50
})

// Emits
const emit = defineEmits<{
  move: [moveX: number, moveY: number]
  start: []
  end: []
}>()

// State
const isActive = ref(false)
const baseX = ref(0)
const baseY = ref(0)
const knobX = ref(0)
const knobY = ref(0)

// 偵測是否為觸控裝置（用於決定顯示模式）
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

// 固定位置（桌面模式的預設位置）
const defaultBaseX = 100 // 左邊距
const defaultBaseY = window.innerHeight - 250 // 往上調整（原本 150，現在 250）

// 當前是否已經設定過位置（用於判斷是否為第一次觸碰）
const hasSetPosition = ref(false)

// Computed styles
const joystickStyle = computed(() => {
  // 桌面模式：使用當前位置（第一次觸碰後）或預設位置
  if (!isTouchDevice) {
    return {
      left: `${baseX.value || defaultBaseX}px`,
      bottom: `${window.innerHeight - (baseY.value || defaultBaseY)}px`,
      width: `${props.size}px`,
      height: `${props.size}px`,
      transform: 'translate(-50%, 50%)'
    }
  }
  
  // 觸控模式：跟隨觸控點
  return {
    left: `${baseX.value}px`,
    top: `${baseY.value}px`,
    width: `${props.size}px`,
    height: `${props.size}px`,
    transform: 'translate(-50%, -50%)'
  }
})

const knobStyle = computed(() => ({
  transform: `translate(calc(-50% + ${knobX.value}px), calc(-50% + ${knobY.value}px))`,
  width: `${props.size / 2}px`,
  height: `${props.size / 2}px`
}))

// 統一的指標事件處理（支援 touch 和 mouse）
const handlePointerStart = (clientX: number, clientY: number) => {
  // 第一次觸碰：將搖桿中心設定為觸碰點
  baseX.value = clientX
  baseY.value = clientY
  hasSetPosition.value = true
  
  isActive.value = true
  emit('start')
}

const handlePointerMove = (clientX: number, clientY: number) => {
  if (!isActive.value) return
  
  const dx = clientX - baseX.value
  const dy = clientY - baseY.value
  
  // 計算距離
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // 限制在最大距離內
  if (distance > props.maxDistance) {
    const angle = Math.atan2(dy, dx)
    knobX.value = Math.cos(angle) * props.maxDistance
    knobY.value = Math.sin(angle) * props.maxDistance
  } else {
    knobX.value = dx
    knobY.value = dy
  }
  
  // 標準化為 -1 到 1 的範圍
  const moveX = knobX.value / props.maxDistance
  const moveY = knobY.value / props.maxDistance // Y 軸不反轉
  
  emit('move', moveX, moveY)
}

const handlePointerEnd = () => {
  isActive.value = false
  knobX.value = 0
  knobY.value = 0
  hasSetPosition.value = false
  
  // 桌面模式：重置到預設位置
  if (!isTouchDevice) {
    baseX.value = defaultBaseX
    baseY.value = defaultBaseY
  }
  
  emit('end')
}

// Touch event handlers
const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  const touch = e.touches[0]
  if (!touch) return
  handlePointerStart(touch.clientX, touch.clientY)
}

const handleTouchMove = (e: TouchEvent) => {
  e.preventDefault()
  const touch = e.touches[0]
  if (!touch) return
  handlePointerMove(touch.clientX, touch.clientY)
}

const handleTouchEnd = (e: TouchEvent) => {
  e.preventDefault()
  handlePointerEnd()
}

// Mouse event handlers
const handleMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  handlePointerStart(e.clientX, e.clientY)
}

const handleMouseMove = (e: MouseEvent) => {
  e.preventDefault()
  handlePointerMove(e.clientX, e.clientY)
}

const handleMouseUp = (e: MouseEvent) => {
  e.preventDefault()
  handlePointerEnd()
}
</script>

<template>
  <div 
    class="virtual-joystick-container"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- 觸控區域 -->
    <div class="touch-area"></div>
    
    <!-- 搖桿（桌面模式一直顯示，觸控模式僅使用時顯示） -->
    <div 
      v-if="!isTouchDevice || isActive"
      class="joystick-base"
      :style="joystickStyle"
    >
      <div 
        class="joystick-knob"
        :style="knobStyle"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.virtual-joystick-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 50;
}

.touch-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}

.joystick-base {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  border: 3px solid rgba(255, 255, 255, 0.5);
  pointer-events: none;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.joystick-knob {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.7));
  border: 2px solid rgba(255, 255, 255, 0.6);
  pointer-events: none;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  transition: transform 0.05s ease-out;
}
</style>
