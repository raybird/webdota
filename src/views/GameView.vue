<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { GameService } from '../services/GameService'
import SkillPanel from '../components/SkillPanel.vue'
import VirtualJoystick from '../components/VirtualJoystick.vue'

const props = defineProps<{
  gameService: GameService
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const skillPanelRef = ref<InstanceType<typeof SkillPanel> | null>(null)
const currentCooldowns = ref<Map<string, number>>(new Map())

// 技能配置 (暫時硬編碼，未來可從 CharacterService 獲取)
const skills = ref([
  { id: 'basic', name: '普攻', icon: '⚔️', cooldown: 0, type: 'basic' as const },
  { id: 'skill1', name: '技能1', icon: '⚡', cooldown: 3, type: 'normal' as const },
  { id: 'skill2', name: '技能2', icon: '🛡️', cooldown: 5, type: 'normal' as const },
  { id: 'skill3', name: '技能3', icon: '💨', cooldown: 8, type: 'normal' as const },
  { id: 'ultimate', name: '大招', icon: '🔥', cooldown: 30, type: 'ultimate' as const }
])

const handleSkillPress = (skillId: string) => {
  props.gameService.useSkill(skillId)
}

const handleJoystickMove = (x: number, y: number) => {
  props.gameService.setMobileInput(x, y)
}

const handleJoystickEnd = () => {
  props.gameService.setMobileInput(0, 0)
}

onMounted(async () => {
  if (canvasRef.value) {
    await props.gameService.init(canvasRef.value)
    props.gameService.startGame()
  }
})

onUnmounted(() => {
  // 清理資源
  props.gameService.destroy()
})
</script>

<template>
  <div class="game-view">
    <canvas ref="canvasRef" class="game-canvas"></canvas>
    
    <!-- HUD -->
    <div class="hud-layer">
      <!-- 左上角：狀態資訊 -->
      <div class="status-panel">
        <!-- 這裡可以放 FPS, Ping 等資訊 -->
      </div>

      <!-- 左下角：虛擬搖桿 (僅在觸控裝置顯示) -->
      <div class="joystick-area">
        <VirtualJoystick 
          @move="handleJoystickMove"
          @end="handleJoystickEnd"
        />
      </div>

      <!-- 右下角：技能面板 -->
      <div class="skills-area">
        <SkillPanel 
          ref="skillPanelRef"
          :skills="skills"
          :current-cooldowns="currentCooldowns"
          @skill-press="handleSkillPress"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-view {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.hud-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 讓點擊穿透到 Canvas */
}

.hud-layer > * {
  pointer-events: auto; /* 恢復 UI 元素的點擊 */
}

.joystick-area {
  position: absolute;
  bottom: 50px;
  left: 50px;
}

.skills-area {
  position: absolute;
  bottom: 30px;
  right: 30px;
}
</style>
