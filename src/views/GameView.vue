<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { GameService } from '../services/GameService'
import { eventBus } from '../events/EventBus'
import { useGameStore } from '../stores/gameStore'
import { useRoomStore } from '../stores/roomStore'
import SkillPanel from '../components/SkillPanel.vue'
import VirtualJoystick from '../components/VirtualJoystick.vue'

const gameStore = useGameStore()
const roomStore = useRoomStore()

const props = defineProps<{
  gameService: GameService
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const skillPanelRef = ref<InstanceType<typeof SkillPanel> | null>(null)
const currentCooldowns = ref<Map<string, number>>(new Map())

// 技能配置
const skills = ref<any[]>([])

const refreshSkills = () => {
  const playerSkills = props.gameService.getPlayerSkills()
  if (playerSkills.length > 0) {
    skills.value = playerSkills.map((s: any) => ({
      id: s.id,
      name: s.name,
      icon: s.icon || '❓',
      cooldown: s.cooldown,
      type: s.type
    })).filter((s: any) => s.type !== 'combo') // 過濾掉接招技能，它們由 SkillPanel 內部處理
    
    console.log('[GameView] Skills loaded:', skills.value)
  }
}

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
  // 監聽遊戲開始事件以更新技能
  eventBus.on('GAME_STARTED', refreshSkills)
  
  // 監聽角色選擇事件 (如果有的話，或者重試機制)
  // 簡單起見，設定一個定時器檢查技能是否已載入
  const checkInterval = setInterval(() => {
    if (skills.value.length === 0) {
      refreshSkills()
    } else {
      clearInterval(checkInterval)
    }
  }, 500)

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
        <div class="debug-info">
          <div class="frame-counter">Frame: {{ gameStore.currentFrame }}</div>
          <div class="player-count">玩家: {{ roomStore.connectedPlayers.length }}</div>
          <div class="peer-id">ID: {{ roomStore.myPeerId?.substring(0, 8) || 'N/A' }}</div>
          <div class="role-indicator" :class="{ host: roomStore.isHost }">
            {{ roomStore.isHost ? '🟢 HOST' : '🔵 CLIENT' }}
          </div>
        </div>
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

.status-panel {
  position: absolute;
  top: 10px;
  left: 10px;
}

.debug-info {
  background: rgba(0, 0, 0, 0.7);
  padding: 10px 15px;
  border-radius: 8px;
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.frame-counter {
  margin-bottom: 5px;
}

.role-indicator {
  font-weight: bold;
  color: #4a9eff;
}

.role-indicator.host {
  color: #4aff6e;
}
</style>
