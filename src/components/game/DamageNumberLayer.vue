<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as pc from 'playcanvas'
import { eventBus } from '../../events/EventBus'
import { GameService } from '../../services/GameService'

const props = defineProps<{
  app: pc.Application | null
  gameService: GameService | null
}>()

interface DamageNumber {
  id: number
  amount: number
  isCrit: boolean
  x: number
  y: number
}

/** 與 CSS 動畫時間一致 */
const LIFETIME_MS = 900

const damageNumbers = ref<DamageNumber[]>([])
let nextId = 0
let unsubscribe: (() => void) | null = null
const screenPos = new pc.Vec3()
const worldPos = new pc.Vec3()
const toTarget = new pc.Vec3()

// 隨機散開，避免數字完全重疊
const randOffset = (max: number) => (Math.random() - 0.5) * max * 2

const onEntityTookDamage = (event: { targetId: string; damage: number; isCrit: boolean }) => {
  const engine = props.gameService?.gameEngine
  const camera = engine?.getCamera()?.camera
  const position = engine?.getEntityPosition(event.targetId)
  if (!camera || !position) return

  worldPos.set(position.x, position.y + 2, position.z)
  // 在攝影機後方不顯示；正交鏡頭的 worldToScreen 的 z 不是與鏡頭的距離（會是負值），改用鏡頭前方向判斷
  const cameraEntity = camera.entity
  toTarget.sub2(worldPos, cameraEntity.getPosition())
  if (toTarget.dot(cameraEntity.forward) <= 0) return
  camera.worldToScreen(worldPos, screenPos)

  const id = nextId++
  damageNumbers.value.push({
    id,
    amount: event.damage,
    isCrit: event.isCrit,
    x: screenPos.x + randOffset(20),
    y: screenPos.y + randOffset(10)
  })
  window.setTimeout(() => {
    damageNumbers.value = damageNumbers.value.filter(dn => dn.id !== id)
  }, LIFETIME_MS)
}

onMounted(() => {
  unsubscribe = eventBus.on('ENTITY_TOOK_DAMAGE', onEntityTookDamage)
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="damage-layer">
    <div
      v-for="dn in damageNumbers"
      :key="dn.id"
      class="damage-number"
      :class="{ crit: dn.isCrit }"
      :style="{ left: `${dn.x}px`, top: `${dn.y}px` }"
    >
      -{{ Math.round(dn.amount) }}
    </div>
  </div>
</template>

<style scoped>
.damage-layer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 60;
  overflow: hidden;
}

.damage-number {
  position: absolute;
  font-family: var(--font-heading, "Chakra Petch", sans-serif);
  font-weight: 800;
  font-size: 24px;
  color: white;
  text-shadow: 0 0 4px #000, 0 0 8px var(--c-cta, #F43F5E), 0 0 12px var(--c-cta, #F43F5E);
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: damage-float 0.9s ease-out forwards;
}

@keyframes damage-float {
  0% { transform: translate(-50%, -50%); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(-50%, calc(-50% - 60px)); opacity: 0; }
}

.damage-number.crit {
  color: #FCD34D; /* Amber 300 */
  text-shadow: 0 0 5px var(--c-cta), 0 0 15px orange;
  font-style: italic;
  font-size: 32px;
  animation-name: damage-float-crit;
}

@keyframes damage-float-crit {
  0% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(-50%, calc(-50% - 60px)) scale(1.5); opacity: 0; }
}
</style>
