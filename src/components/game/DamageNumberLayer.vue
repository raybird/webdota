<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as pc from 'playcanvas'
import { eventBus } from '../../events/EventBus'
import { GameService } from '../../services/GameService'

// Props
const props = defineProps<{
  app: pc.Application | null
  gameService: GameService | null
}>()

interface DamageNumber {
  id: number
  targetId: string
  amount: number
  isCrit: boolean
  x: number
  y: number
  opacity: number
  scale: number
  offsetY: number
}

const damageNumbers = ref<DamageNumber[]>([])
let nextId = 0
let animationFrameId = 0

// Random scatter offset generator
const randOffset = (max: number) => (Math.random() - 0.5) * max * 2

const onEntityTookDamage = (event: any) => {
  if (event.type !== 'ENTITY_TOOK_DAMAGE') return
  const { targetId, damage, isCrit } = event

  if (!props.app || !props.gameService || !props.gameService.gameEngine) return

  // Find entity roughly among managers
  const engine = props.gameService.gameEngine
  let entityObj: any = null
  
  if (engine.playerManager) entityObj = engine.playerManager.getPlayer(targetId)
  if (!entityObj && engine.creepManager) entityObj = engine.creepManager.getAllCreepsAsEntities().find((c:any) => c.entityId === targetId)
  if (!entityObj && engine.towerManager) entityObj = engine.towerManager.getAllTowersAsEntities().find((t:any) => t.entityId === targetId)
  if (!entityObj && engine.baseManager) entityObj = engine.baseManager.getAllBasesAsEntities().find((b:any) => b.entityId === targetId)

  if (!entityObj || typeof entityObj.getPosition !== 'function') return

  const camera = props.app.root.findByName('Camera') as pc.Entity
  if (!camera || !camera.camera) return

  const worldPos = entityObj.getPosition().clone()
  worldPos.y += 2 // Offset slightly above entity

  const screenCoord = camera.camera.worldToScreen(worldPos)
  const device = props.app.graphicsDevice

  if (screenCoord.z > 0 && screenCoord.x >= 0 && screenCoord.x <= device.width && screenCoord.y >= 0 && screenCoord.y <= device.height) {
    damageNumbers.value.push({
      id: nextId++,
      targetId,
      amount: damage,
      isCrit,
      x: screenCoord.x + randOffset(20), // Slight scatter so they don't perfectly stack
      y: screenCoord.y + randOffset(10),
      opacity: 1,
      scale: isCrit ? 1.5 : 1,
      offsetY: 0
    })
  }
}

const updateLoop = () => {
  const speed = 1.5
  for (let i = damageNumbers.value.length - 1; i >= 0; i--) {
    const dn = damageNumbers.value[i]
    if (!dn) continue
    dn.offsetY -= speed // Float upwards
    if (dn.offsetY < -30) {
        dn.opacity -= 0.04 // Fade out
    }
    if (dn.opacity <= 0) {
      damageNumbers.value.splice(i, 1)
    }
  }

  animationFrameId = requestAnimationFrame(updateLoop)
}

onMounted(() => {
  eventBus.on('ENTITY_TOOK_DAMAGE', onEntityTookDamage)
  updateLoop()
})

onUnmounted(() => {
  eventBus.off('ENTITY_TOOK_DAMAGE', onEntityTookDamage)
  cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <div class="damage-layer">
    <div 
      v-for="dn in damageNumbers" 
      :key="dn.id"
      class="damage-number"
      :class="{ crit: dn.isCrit }"
      :style="{
        left: `${dn.x}px`,
        top: `${dn.y + dn.offsetY}px`,
        opacity: dn.opacity,
        transform: `translate(-50%, -50%) scale(${dn.scale})`
      }"
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
  will-change: transform, opacity, top;
}

.damage-number.crit {
  color: #FCD34D; /* Amber 300 */
  text-shadow: 0 0 5px var(--c-cta), 0 0 15px orange;
  font-style: italic;
  font-size: 32px;
}
</style>
