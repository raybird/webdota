<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  // 地圖尺寸
  mapSize: { w: number; h: number }
  // 實體列表 (玩家、塔、小兵、主堡)
  entities: Array<{
    id: string
    type: 'player' | 'tower' | 'creep' | 'base'
    team: 'red' | 'blue' | 'neutral'
    position: { x: number; z: number }
  }>
  // 本地玩家 ID
  localPlayerId?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const minimapSize = 150 // 小地圖像素尺寸

// 將世界座標轉換為畫布座標
const worldToMinimap = (worldX: number, worldZ: number): { x: number; y: number } => {
  // 假設地圖中心在 (0, 0)
  const halfW = props.mapSize.w / 2
  const halfH = props.mapSize.h / 2

  const normX = (worldX + halfW) / props.mapSize.w
  const normY = (worldZ + halfH) / props.mapSize.h

  return {
    x: normX * minimapSize,
    y: normY * minimapSize
  }
}

const draw = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 清空畫布
  ctx.clearRect(0, 0, minimapSize, minimapSize)

  // 繪製背景 (深綠色地圖)
  ctx.fillStyle = '#1a2f1a'
  ctx.fillRect(0, 0, minimapSize, minimapSize)

  // 繪製邊界
  ctx.strokeStyle = '#444444'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, minimapSize - 2, minimapSize - 2)

  // 繪製中線
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.moveTo(0, minimapSize / 2)
  ctx.lineTo(minimapSize, minimapSize / 2)
  ctx.moveTo(minimapSize / 2, 0)
  ctx.lineTo(minimapSize / 2, minimapSize)
  ctx.stroke()

  // 繪製實體
  for (const entity of props.entities) {
    const pos = worldToMinimap(entity.position.x, entity.position.z)

    // 選擇顏色
    let color = '#ffffff'
    let size = 3

    if (entity.team === 'red') color = '#ff4d4d'
    else if (entity.team === 'blue') color = '#4d94ff'

    // 根據類型調整大小
    switch (entity.type) {
      case 'base':
        size = 8
        break
      case 'tower':
        size = 5
        break
      case 'player':
        size = 4
        // 本地玩家高亮
        if (entity.id === props.localPlayerId) {
          color = '#00ff00'
          size = 5
        }
        break
      case 'creep':
        size = 2
        break
    }

    ctx.fillStyle = color
    ctx.beginPath()

    if (entity.type === 'tower' || entity.type === 'base') {
      // 方形表示建築
      ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size)
    } else {
      // 圓形表示單位
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

let animationId: number | null = null

const loop = () => {
  draw()
  animationId = requestAnimationFrame(loop)
}

onMounted(() => {
  loop()
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<template>
  <div class="minimap-container">
    <canvas 
      ref="canvasRef" 
      :width="minimapSize" 
      :height="minimapSize" 
      class="minimap-canvas"
    />
  </div>
</template>

<style scoped>
.minimap-container {
  position: relative;
  width: 150px;
  height: 150px;
  border: 2px solid rgba(255, 215, 0, 0.4);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.5);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

.minimap-canvas {
  display: block;
}
</style>
