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
import ConnectionPanel from '../components/game/ConnectionPanel.vue'
import { useRoomStore } from '../stores/roomStore'

const gameStore = useGameStore()
const roomStore = useRoomStore()

// 遊戲結束狀態
const isGameOver = ref(false)
/** 本地玩家陣亡時的剩餘重生秒數 */
const respawnSeconds = ref<number | null>(null)
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
const showConnectionPanel = ref(false)
const toggleConnectionPanel = () => { showConnectionPanel.value = !showConnectionPanel.value }
/** 滑鼠或觸控點擊後放掉焦點，否則之後按空白鍵（普攻）會再觸發按鈕；鍵盤操作（detail 為 0）保留焦點 */
const onPingRowClick = (e: MouseEvent) => {
  toggleConnectionPanel()
  if (e.detail > 0) (e.currentTarget as HTMLElement | null)?.blur()
}

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
  if (e.key === 'n' || e.key === 'N') {
    toggleConnectionPanel()
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
  const remaining = engine.getLocalRespawnRemaining()
  respawnSeconds.value = remaining === null ? null : Math.ceil(remaining)
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
      <!-- 左上角：精簡狀態列（隊伍、角色、Frame、PING、金幣），不擋畫面操作 -->
      <div
        class="status-bar"
        :class="{
          'team-red': roomStore.myPlayer?.team === 'red',
          'team-blue': roomStore.myPlayer?.team === 'blue'
        }"
      >
        <span class="role-indicator" :class="{ host: roomStore.isHost }" :title="roomStore.isHost ? '房主' : '玩家'">
          {{ roomStore.isHost ? 'HOST' : 'CLIENT' }}
        </span>
        <span class="stat frame-counter" title="Frame">F {{ gameStore.currentFrame }}</span>
        <button
          type="button"
          class="stat ping-row"
          :aria-expanded="showConnectionPanel"
          aria-controls="connection-panel"
          title="連線診斷 (N)"
          @click="onPingRowClick"
        >
          <span :class="{ 'high-ping': currentPing > 150 }">{{ currentPing }} ms</span> ⓘ
        </button>
        <span class="stat gold-display" title="金幣">💰 <span class="gold-value">{{ gameStore.gold }}</span></span>
      </div>

      <ConnectionPanel
        v-if="showConnectionPanel"
        id="connection-panel"
        :game-service="gameService"
        @close="showConnectionPanel = false"
      />

      <!-- 右上角：小地圖 -->
      <div class="minimap-area">
        <Minimap
          :map-size="{ w: 60, h: 60 }"
          :entities="minimapEntities"
          :local-player-id="roomStore.myPeerId"
        />
      </div>

      <!-- 浮動商店按鈕 (手機用) -->
      <button type="button" class="floating-shop-btn" title="商店 (B)" aria-label="商店 (B)" @click="toggleShop">
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

      <!-- 陣亡倒數 -->
      <div v-if="respawnSeconds !== null && !isGameOver" class="respawn-banner card-glass">
        <span class="respawn-title">陣亡</span>
        <span class="respawn-count">{{ respawnSeconds }} 秒後重生</span>
      </div>

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
.respawn-banner {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 32px;
  pointer-events: none;
}

.respawn-title {
  font-family: var(--font-heading);
  font-size: 28px;
  color: var(--c-danger);
  letter-spacing: 0.1em;
}

.respawn-count {
  font-size: 16px;
  color: var(--c-text-main);
}

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

/* 傷害數字與通知是全畫面的覆蓋層，要讓點擊穿透到底下的 HUD（商店、搖桿、PING）與畫面 */
.hud-layer > .damage-layer,
.hud-layer > .notification-layer {
  pointer-events: none;
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

.status-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  max-inline-size: calc(100vw - 24px);
  padding: 4px 10px 4px 6px;
  border-radius: 999px;
  border-inline-start: 3px solid #777;
  background: rgba(10, 8, 24, 0.55);
  backdrop-filter: blur(4px);
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--c-text-main);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  /* 只有 PING 可以點：其餘部分讓點擊穿透到畫面 */
  pointer-events: none;
  /* 搖桿的觸控區佔滿全畫面（z-index 50），PING 要在它上面才點得到；傷害數字（60）仍畫在上方 */
  z-index: 55;
}

.status-bar.team-red { border-inline-start-color: var(--c-cta); }
.status-bar.team-blue { border-inline-start-color: #38BDF8; }

.stat {
  color: var(--c-text-muted);
}

.role-indicator {
  font-family: var(--font-heading);
  font-weight: bold;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  color: #4a9eff;
}

.role-indicator.host {
  color: var(--c-primary);
  text-shadow: 0 0 5px var(--c-primary);
}

.minimap-area {
  position: absolute;
  top: 20px;
  right: 20px;
}

/* 矮螢幕（手機橫向）：小地圖縮小貼齊右上角，讓出空間給右下的技能弧形 */
@media (max-height: 500px) {
  .minimap-area {
    top: 12px;
    right: 12px;
    transform: scale(0.72);
    transform-origin: 100% 0;
  }
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

.gold-value {
  font-weight: bold;
  color: var(--c-gold);
}

.ping-row {
  /* 觸控目標至少 32px 高 */
  min-block-size: 32px;
  padding: 0 4px;
  pointer-events: auto;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: start;
}

.ping-row:hover,
.ping-row:focus-visible {
  color: var(--c-secondary);
}

.ping-row:focus-visible {
  outline: 1px solid var(--c-secondary);
  outline-offset: 2px;
}

.high-ping {
  color: var(--color-danger) !important;
  text-shadow: 0 0 5px var(--color-danger);
}
</style>
