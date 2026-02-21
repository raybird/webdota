<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { GameService } from '../services/GameService'
import { eventBus } from '../events/EventBus'
import { useGameStore } from '../stores/gameStore'
import SkillPanel from '../components/SkillPanel.vue'
import VirtualJoystick from '../components/VirtualJoystick.vue'
import EntityStatus from '../components/game/EntityStatus.vue'
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

const canvasRef = ref<HTMLCanvasElement | null>(null)
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

// Shop keyboard shortcut
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'b' || e.key === 'B') {
    gameStore.toggleShop()
  }
}

const toggleShop = () => {
  gameStore.toggleShop()
}

const animationFrameId = ref<number>(0)

// 取得所有可見實體 (用於渲染血量條)
const allEntities = ref<any[]>([])

// 小地圖專用資料
const minimapEntities = ref<Array<{
  id: string
  type: 'player' | 'tower' | 'creep' | 'base'
  team: 'red' | 'blue' | 'neutral'
  position: { x: number; z: number }
}>>([])

const updateEntities = () => {
  if (props.gameService.gameEngine) {
    // 取得塔、小兵、主堡
    const towers = props.gameService.gameEngine.towerManager?.getAllTowersAsEntities() || []
    const creeps = props.gameService.gameEngine.creepManager?.getAllCreepsAsEntities() || []
    const bases = props.gameService.gameEngine.baseManager?.getAllBasesAsEntities() || []
    const players = props.gameService.gameEngine.playerManager?.getAllPlayers() || new Map()
    
    allEntities.value = [
      ...towers.map((e: any) => ({ entity: e, type: 'tower' })),
      ...creeps.map((e: any) => ({ entity: e, type: 'creep' })),
      ...bases.map((e: any) => ({ entity: e, type: 'base' }))
    ]

    // 更新小地圖資料
    const minimapData: typeof minimapEntities.value = []
    
    // 加入塔
    towers.forEach((t: any) => {
      const pos = t.getPosition()
      minimapData.push({ id: t.entityId, type: 'tower', team: t.team, position: { x: pos.x, z: pos.z } })
    })
    // 加入主堡
    bases.forEach((b: any) => {
      const pos = b.getPosition()
      minimapData.push({ id: b.entityId, type: 'base', team: b.team, position: { x: pos.x, z: pos.z } })
    })
    // 加入小兵
    creeps.forEach((c: any) => {
      const pos = c.getPosition()
      minimapData.push({ id: c.entityId, type: 'creep', team: c.team, position: { x: pos.x, z: pos.z } })
    })
    // 加入玩家
    players.forEach((p: any, id: string) => {
      const pos = p.getPosition()
      minimapData.push({ id, type: 'player', team: p.team || 'neutral', position: { x: pos.x, z: pos.z } })
    })

    minimapEntities.value = minimapData
  }
}

onMounted(async () => {
  // 監聽遊戲開始事件以更新技能
  eventBus.on('GAME_STARTED', refreshSkills)
  
  // 監聽角色選擇事件 (如果有的話，或者重試機制)
  // 監聽遊戲結束事件
  eventBus.on('GAME_OVER', (event) => {
    isGameOver.value = true
    winnerTeam.value = event.winnerTeam
    gameOverReason.value = event.reason
    console.log('[GameView] GAME OVER:', event)
  })

  // 簡單起見，設定一個定時器檢查技能是否已載入
  const checkInterval = setInterval(() => {
    if (skills.value.length === 0) {
      refreshSkills()
    } else {
      clearInterval(checkInterval)
    }
  }, 500)

  // 先等待 GameEngine 初始化完成
  if (canvasRef.value) {
    await props.gameService.init(canvasRef.value)
    props.gameService.startGame()
    
    // init 完成後才啟動冷卻與實體更新循環
    const updateLoop = () => {
      currentCooldowns.value = props.gameService.getCooldowns()
      updateEntities()
      // 同步庫存狀態
      props.gameService.syncInventory()
      animationFrameId.value = requestAnimationFrame(updateLoop)
    }
    updateLoop()
    
    eventBus.on('PING_UPDATED', handlePingUpdate)
  }

  // 監聯 Shop 快捷鍵
  window.addEventListener('keydown', handleKeyDown)
})

const handlePingUpdate = (e: any) => {
  if (e.type === 'PING_UPDATED') {
    currentPing.value = e.ping
  }
}

onUnmounted(() => {
  // 清理資源
  cancelAnimationFrame(animationFrameId.value)
  window.removeEventListener('keydown', handleKeyDown)
  eventBus.off('PING_UPDATED', handlePingUpdate)
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

      <!-- 螢幕空間 UI 層：血量條 -->
      <div class="entity-ui-layer">
        <EntityStatus
          v-for="item in allEntities"
          :key="`${item.type}_${item.entity.entityId}`"
          :app="gameService.gameEngine.app"
          :entity="item.entity"
          :type="item.type"
        />
      </div>

      <!-- 螢幕空間 UI 層：傷害跳字 -->
      <DamageNumberLayer
        v-if="gameService.gameEngine && gameService.gameEngine.app"
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
        @back-to-lobby="gameService.leaveRoom()"
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

.entity-ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
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
