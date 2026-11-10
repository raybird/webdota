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
  /** 回血：綠色 +N，比傷害數字小 */
  heal?: boolean
  label?: string
  x: number
  y: number
}

/** 與 CSS 動畫時間一致 */
const LIFETIME_MS = 900

const damageNumbers = ref<DamageNumber[]>([])
let nextId = 0
const screenPos = new pc.Vec3()
const worldPos = new pc.Vec3()
const toTarget = new pc.Vec3()

// 隨機散開，避免數字完全重疊
const randOffset = (max: number) => (Math.random() - 0.5) * max * 2

/** 實體頭上的螢幕座標；在鏡頭後方時回傳 null */
const headScreenPos = (targetId: string, height: number): pc.Vec3 | null => {
  const engine = props.gameService?.gameEngine
  const camera = engine?.getCamera()?.camera
  const position = engine?.getEntityPosition(targetId)
  if (!camera || !position) return null

  worldPos.set(position.x, position.y + height, position.z)
  // 在攝影機後方不顯示；正交鏡頭的 worldToScreen 的 z 不是與鏡頭的距離（會是負值），改用鏡頭前方向判斷
  const cameraEntity = camera.entity
  toTarget.sub2(worldPos, cameraEntity.getPosition())
  if (toTarget.dot(cameraEntity.forward) <= 0) return null
  camera.worldToScreen(worldPos, screenPos)
  return screenPos
}

const show = (entry: Omit<DamageNumber, 'id'>) => {
  const id = nextId++
  damageNumbers.value.push({ id, ...entry })
  window.setTimeout(() => {
    damageNumbers.value = damageNumbers.value.filter(dn => dn.id !== id)
  }, LIFETIME_MS)
}

const onEntityTookDamage = (event: { targetId: string; damage: number; isCrit: boolean }) => {
  const pos = headScreenPos(event.targetId, 2)
  if (!pos) return
  show({ amount: event.damage, isCrit: event.isCrit, x: pos.x + randOffset(20), y: pos.y + randOffset(10) })
}

// 回血固定在名字上方、不散開，與傷害數字分開
const onEntityHealed = (event: { targetId: string; amount: number; label?: string }) => {
  const pos = headScreenPos(event.targetId, 3.8)
  if (!pos) return
  show({ amount: event.amount, isCrit: false, heal: true, label: event.label, x: pos.x, y: pos.y })
}

const unsubscribers: Array<() => void> = []

onMounted(() => {
  unsubscribers.push(eventBus.on('ENTITY_TOOK_DAMAGE', onEntityTookDamage))
  unsubscribers.push(eventBus.on('ENTITY_HEALED', onEntityHealed))
})

onUnmounted(() => {
  unsubscribers.forEach(off => off())
})
</script>

<template>
  <div class="damage-layer">
    <div
      v-for="dn in damageNumbers"
      :key="dn.id"
      class="damage-number"
      :class="{ crit: dn.isCrit, heal: dn.heal }"
      :style="{ left: `${dn.x}px`, top: `${dn.y}px` }"
    >
      <template v-if="dn.heal"><span v-if="dn.label" class="heal-label">{{ dn.label }}</span>+{{ Math.round(dn.amount) }}</template>
      <template v-else>-{{ Math.round(dn.amount) }}</template>
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

.damage-number.heal {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 15px;
  color: #86EFAC; /* Green 300 */
  text-shadow: 0 0 3px #000, 0 0 6px #15803D;
  animation-name: heal-float;
  animation-timing-function: linear;
}

.heal-label {
  font-size: 12px;
  color: #DCFCE7;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

@keyframes heal-float {
  0% { transform: translate(-50%, -50%); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(-50%, calc(-50% - 28px)); opacity: 0; }
}

@keyframes damage-float-crit {
  0% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(-50%, calc(-50% - 60px)) scale(1.5); opacity: 0; }
}
</style>
