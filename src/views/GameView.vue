<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { GameService } from '../services/GameService'
import type { RoomService } from '../services/RoomService'
import type { MinimapEntity } from '../core/GameEngine'
import { eventBus } from '../events/EventBus'
import { useGameStore } from '../stores/gameStore'
import SkillPanel from '../components/SkillPanel.vue'
import VirtualJoystick from '../components/VirtualJoystick.vue'
import GameOverOverlay from '../components/game/GameOverOverlay.vue'
import Minimap from '../components/game/Minimap.vue'
import Shop from '../components/game/Shop.vue'
import DamageNumberLayer from '../components/game/DamageNumberLayer.vue'
import NotificationLayer from '../components/game/NotificationLayer.vue'
import { useRoomStore } from '../stores/roomStore'

const gameStore = useGameStore()
const roomStore = useRoomStore()

// 遊戲結束狀態
const isGameOver = ref(false)
const winnerTeam = ref<'red' | 'blue' | null>(null)
const gameOverReason = ref('')

const props = defineProps<{
  gameService: GameService
}>()

const roomService = inject<RoomService>('roomService')

const canvasRef = ref<HTMLCanvasElement | null>(null)
// gameService 不是響應式物件，用這個旗標讓模板在引擎就緒後重新渲染
const engineReady = ref(false)
const currentCooldowns = ref<Map<string, number>>(new Map())
const currentPing = ref<number>(0)

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

// Shop keyboard shortcut
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'b' || e.key === 'B') {
    gameStore.toggleShop()
  }
}

const toggleShop = () => {
  gameStore.toggleShop()
}

// 小地圖專用資料
const minimapEntities = ref<MinimapEntity[]>([])

/** HUD（冷卻、小地圖、金幣）更新間隔；不需要跟著畫面每幀更新 */
const HUD_UPDATE_INTERVAL_MS = 100
let hudTimer: number | undefined
let skillRetryTimer: number | undefined
const unsubscribers: Array<() => void> = []

const updateHud = () => {
  const engine = props.gameService.gameEngine
  if (!engine) return
  currentCooldowns.value = props.gameService.getCooldowns()
  minimapEntities.value = engine.getMinimapEntities()
  props.gameService.syncInventory()
}

const leaveToLobby = () => {
  props.gameService.leaveGame()
  roomService?.leaveRoom()
}

onMounted(async () => {
  unsubscribers.push(
    // 監聽遊戲開始事件以更新技能
    eventBus.on('GAME_STARTED', refreshSkills),
    eventBus.on('GAME_OVER', (event) => {
      isGameOver.value = true
      winnerTeam.value = event.winnerTeam
      gameOverReason.value = event.reason
    }),
    eventBus.on('PING_UPDATED', (event) => {
      currentPing.value = event.ping
    }),
  )

  // 技能要等本地玩家生成後才拿得到，未載入前定時重試
  skillRetryTimer = window.setInterval(() => {
    if (skills.value.length === 0) {
      refreshSkills()
    } else {
      window.clearInterval(skillRetryTimer)
    }
  }, 500)

  if (canvasRef.value) {
    await props.gameService.init(canvasRef.value)
    engineReady.value = true
    props.gameService.startGame()

    // 強制 PlayCanvas 重新計算尺寸以解決 Viewport 衝突
    props.gameService.gameEngine?.app.resizeCanvas()

    hudTimer = window.setInterval(updateHud, HUD_UPDATE_INTERVAL_MS)
  }

  // 監聽 Shop 快捷鍵
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.clearInterval(hudTimer)
  window.clearInterval(skillRetryTimer)
  window.removeEventListener('keydown', handleKeyDown)
  unsubscribers.forEach(unsubscribe => unsubscribe())
  props.gameService.destroy()
})
</script>

<template>
  <div class="game-view">
    <canvas ref="canvasRef" class="game-canvas"></canvas>
    
    <!-- HUD -->
    <div class="hud-layer">
      <!-- 左上角：狀態資訊 -->
      <div class="status-panel card-glass">
        <div class="hud-header">
          <div class="frame-counter">Frame: {{ gameStore.currentFrame }}</div>
          <div class="role-indicator" :class="{ host: roomStore.isHost }">
            {{ roomStore.isHost ? '♔ HOST' : '♙ CLIENT' }}
          </div>
        </div>
        
        <!-- Team Indicator -->
        <div class="team-banner" 
             :class="{ 
               'team-red': roomStore.myPlayer?.team === 'red',
               'team-blue': roomStore.myPlayer?.team === 'blue'
             }">
           {{ roomStore.myPlayer?.team === 'red' ? '🔴 RED TEAM' : roomStore.myPlayer?.team === 'blue' ? '🔵 BLUE TEAM' : '⚪ SPECTATOR' }}
        </div>

        <div class="hud-content">
          <div class="info-row">
            <span class="label">PLAYERS:</span>
            <span class="value">{{ roomStore.connectedPlayers.length }}</span>
          </div>
          <div class="info-row">
            <span class="label">ID:</span>
            <span class="value">{{ roomStore.myPeerId?.substring(0, 8) || 'N/A' }}</span>
          </div>
          <div class="info-row">
            <span class="label">PING:</span>
            <span class="value" :class="{'high-ping': currentPing > 150}">{{ currentPing }} ms</span>
          </div>
          <div class="cooldown-debug">
            CDs: {{ Array.from(currentCooldowns.entries()).map(([k, v]) => `${k}:${v.toFixed(1)}`).join(', ') }}
          </div>
          <div class="gold-display">
            <span class="gold-icon">💰</span>
            <span class="gold-value">{{ gameStore.gold }}</span>
          </div>
        </div>
        <button class="shop-btn" @click="toggleShop">🏪 商店 (B)</button>
      </div>

      <!-- 右上角：小地圖 -->
      <div class="minimap-area">
        <Minimap
          :map-size="{ w: 60, h: 60 }"
          :entities="minimapEntities"
          :local-player-id="roomStore.myPeerId"
        />
      </div>

      <!-- 浮動商店按鈕 (手機用) -->
      <button class="floating-shop-btn" @click="toggleShop">
        🏪
      </button>

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


      <!-- 螢幕空間 UI 層：傷害跳字 -->
      <DamageNumberLayer
        v-if="engineReady && gameService.gameEngine"
        :app="gameService.gameEngine.app"
        :game-service="gameService"
      />

      <!-- 螢幕空間 UI 層：網路狀態通知 -->
      <NotificationLayer />

      <!-- 遊戲結束覆蓋層 -->
      <GameOverOverlay
        :is-visible="isGameOver"
        :winner-team="winnerTeam"
        :reason="gameOverReason"
        @back-to-lobby="leaveToLobby"
      />

      <!-- 商店 -->
      <Shop />
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
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 0;
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
  top: 20px;
  left: 20px;
  width: 250px;
  pointer-events: auto;
}

.hud-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
  padding-bottom: 8px;
  margin-bottom: 8px;
  font-family: var(--font-heading);
  color: var(--c-primary);
}

.hud-content {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--c-text-muted);
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.label {
  color: var(--c-primary-dim);
}

.value {
  color: var(--c-text-main);
  font-weight: bold;
}

.cooldown-debug {
  margin-top: 10px;
  font-size: 0.75rem;
  color: var(--c-text-muted);
  opacity: 0.7;
}

.frame-counter {
  margin-bottom: 5px;
}

.role-indicator {
  font-weight: bold;
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: #4a9eff;
}

.role-indicator.host {
  color: var(--c-primary);
  border: 1px solid var(--c-primary-dim);
  text-shadow: 0 0 5px var(--c-primary);
}

.team-banner {
  text-align: center;
  font-family: var(--font-heading);
  font-weight: bold;
  font-size: 1.1rem;
  margin: 12px 0;
  padding: 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.4);
  color: #aaa;
  border: 1px solid #555;
  text-shadow: 0 2px 2px rgba(0,0,0,0.8);
  letter-spacing: 1px;
}

.team-banner.team-red {
  color: var(--c-cta);
  border-color: var(--c-cta);
  background: linear-gradient(90deg, rgba(244,63,94,0.15) 0%, transparent 50%, rgba(244,63,94,0.15) 100%);
  box-shadow: 0 0 10px rgba(244, 63, 94, 0.2);
}

.team-banner.team-blue {
  color: #38BDF8;
  border-color: #38BDF8;
  background: linear-gradient(90deg, rgba(56,189,248,0.15) 0%, transparent 50%, rgba(56,189,248,0.15) 100%);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
}


.minimap-area {
  position: absolute;
  top: 20px;
  right: 20px;
}

.floating-shop-btn {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-bg-panel) 0%, var(--c-secondary-dark) 100%);
  border: 2px solid var(--c-primary);
  font-size: 1.8rem;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), 0 0 10px rgba(124, 58, 237, 0.3);
  transition: all 0.2s;
  z-index: 100;
}

.floating-shop-btn:hover {
  transform: translateX(-50%) scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 15px var(--c-primary);
}

.floating-shop-btn:active {
  transform: translateX(-50%) scale(0.95);
}

.gold-display {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.gold-icon {
  font-size: 1rem;
}

.gold-value {
  font-weight: bold;
  color: #ffd700;
  font-size: 1rem;
}

.shop-btn {
  margin-top: 10px;
  width: 100%;
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--c-secondary-dark) 0%, var(--c-bg-dark) 100%);
  border: 1px solid var(--c-primary-dim);
  border-radius: 4px;
  color: var(--c-text-main);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  font-family: var(--font-heading);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.shop-btn:hover {
  background: linear-gradient(135deg, var(--c-bg-dark) 0%, var(--c-primary-dim) 100%);
  border-color: var(--c-secondary);
  color: #fff;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.3);
}

.high-ping {
  color: var(--color-danger) !important;
  text-shadow: 0 0 5px var(--color-danger);
}
</style>
