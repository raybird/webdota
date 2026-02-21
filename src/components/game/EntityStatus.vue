<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as pc from 'playcanvas'

const props = defineProps<{
  app: pc.Application
  entity: any // CombatEntity
  type: 'player' | 'tower' | 'creep' | 'base'
}>()

const screenPos = ref({ x: 0, y: 0 })
const isVisible = ref(false)

const hpPercent = computed(() => {
  if (!props.entity || !props.entity.combatStats) return 0
  return (props.entity.combatStats.currentHp / props.entity.combatStats.maxHp) * 100
})

const barColor = computed(() => {
  if (props.type === 'base') return '#FBBF24' // Yellow
  if (props.entity.team === 'red') return 'var(--c-cta, #F43F5E)' // Neon Rose/Red
  if (props.entity.team === 'blue') return '#38BDF8' // Sky Blue
  return '#ffffff'
})

const updatePosition = () => {
  if (!props.entity || !props.entity.entity) return

  const camera = props.app.root.findByName('Camera') as pc.Entity
  if (!camera || !camera.camera) return

  // 取得實體世界位置並添加高度偏移
  const worldPos = props.entity.getPosition().clone()
  
  // 根據類型設定高度偏移
  const heightOffset = props.type === 'base' ? 7 : (props.type === 'tower' ? 4 : 1.5)
  worldPos.y += heightOffset

  // 投影到螢幕空間
  const screenCoord = camera.camera.worldToScreen(worldPos)
  
  // 檢查是否在相機前方且在畫面內
  const device = props.app.graphicsDevice
  isVisible.value = screenCoord.z > 0 && 
                    screenCoord.x >= 0 && screenCoord.x <= device.width &&
                    screenCoord.y >= 0 && screenCoord.y <= device.height

  if (isVisible.value) {
    screenPos.value = {
      x: screenCoord.x,
      y: screenCoord.y
    }
  }
}

let timer: number
onMounted(() => {
  timer = window.setInterval(updatePosition, 16) // 約 60fps 更新
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div 
    v-if="isVisible && !entity.isDead()" 
    class="entity-status"
    :style="{
      left: `${screenPos.x}px`,
      top: `${screenPos.y}px`
    }"
  >
    <!-- 血量條 -->
    <div class="hp-container">
      <div 
        class="hp-fill" 
        :style="{ 
          width: `${hpPercent}%`,
          backgroundColor: barColor
        }"
      ></div>
    </div>
    
    <!-- 實體名稱/標籤 (主堡與塔顯示) -->
    <div v-if="type === 'base' || type === 'tower'" class="entity-label">
      {{ type === 'base' ? 'ANCIENT' : 'TOWER' }}
    </div>
  </div>
</template>

<style scoped>
.entity-status {
  position: absolute;
  transform: translate(-50%, -100%);
  z-index: 10;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hp-container {
  width: 60px;
  height: 6px;
  background: rgba(15, 15, 35, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

/* 主堡和塔的血條更寬 */
.entity-status:has(.entity-label) .hp-container {
  width: 100px;
  height: 8px;
}

.hp-fill {
  height: 100%;
  transition: width 0.2s ease-out;
  box-shadow: 0 0 5px currentColor; /* 讓血條本體發光，依賴 background-color 需要稍微修改，但 CSS 變數不好直接用，可用 drop-shadow 或忽略 */
}

.entity-label {
  font-family: var(--font-heading);
  font-size: 10px;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px black;
  letter-spacing: 1px;
  text-transform: uppercase;
}
</style>
