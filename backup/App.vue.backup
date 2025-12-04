<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import VirtualJoystick from './components/VirtualJoystick.vue'
import SkillPanel from './components/SkillPanel.vue'
import { DEFAULT_CHARACTER_ID } from './types/Character'

const showLobby = ref(true)
const myPeerId = ref('載入中...')
const roomIdInput = ref('')
const playerCount = ref(0)
const isReady = ref(false)

// Debug panel
const showDebug = ref(true)
const networkEvents = ref<string[]>([])
const lastSentInput = ref('')
const lastReceivedInput = ref('')
const currentFrame = ref(0)

function addNetworkEvent(event: string) {
  networkEvents.value.unshift(event)
  if (networkEvents.value.length > 10) {
    networkEvents.value.pop()
  }
}

const health = ref(100)
const maxHealth = ref(100)
const mana = ref(100)
const maxMana = ref(100)

// Waiting Room State
const isInRoom = ref(false)
const connectedPlayers = ref<{id: string, isReady: boolean, characterId?: string}[]>([])
const amIReady = ref(false)
const isHost = ref(false)
const countdown = ref(0)

// Character Selection
const selectedCharacterId = ref<string>(DEFAULT_CHARACTER_ID)
const showCharacterSelector = ref(false)

// 偵測是否為觸控裝置
const isTouchDevice = ref(false)
const forceShowJoystick = ref(false) // 手動切換（用於開發測試）

// 儲存 gameApp 參考
const gameApp = ref<any>(null)

// 技能系統狀態（參考灌籃高手布局）
const skills = ref([
  { id: 'basic', name: '籃板', icon: '🏀', cooldown: 0, type: 'basic' as const },           // 4. 基礎普通攻擊（最大）
  { id: 'skill1', name: '加速', icon: '💨', cooldown: 3, type: 'normal' as const },          // 1. 突進
  { id: 'skill2', name: '檔拆', icon: '⚡', cooldown: 4, type: 'normal' as const },          // 2. 震地
  { id: 'skill3', name: '卡位', icon: '🛡️', cooldown: 2, type: 'normal' as const },         // 3. 格檔
  { id: 'ultimate', name: '決勝三分', icon: '🔥', cooldown: 0, type: 'ultimate' as const }    // 大招（最上方）
])

const skillCooldowns = ref<Map<string, number>>(new Map())
const skillPanelRef = ref<InstanceType<typeof SkillPanel> | null>(null)

const canStartGame = computed(() => {
  if (connectedPlayers.value.length === 0) return false
  return connectedPlayers.value.every(p => p.isReady)
})

// 切換虛擬搖桿顯示（開發用）
const toggleJoystick = () => {
  forceShowJoystick.value = !forceShowJoystick.value
}

// 計算是否應該顯示搖桿
const shouldShowJoystick = computed(() => {
  return (isTouchDevice.value || forceShowJoystick.value) && !showLobby.value
})

// 虛擬搖桿事件處理
const handleJoystickMove = (moveX: number, moveY: number) => {
  if (gameApp.value) {
    gameApp.value.setMobileInput(moveX, moveY)
  }
}

const handleJoystickEnd = () => {
  if (gameApp.value) {
    gameApp.value.setMobileInput(0, 0)
  }
}

// 角色相關輔助函式
import { getCharacter as getCharacterData, getAllCharacters as getAllChars } from './data/characters'

const getAllCharacters = () => {
  return getAllChars()
}

const getCharacterIcon = (characterId: string): string => {
  const character = getCharacterData(characterId)
  return character?.icon || '👤'
}

const getCharacter = (characterId: string) => {
  return getCharacterData(characterId)
}

const selectCharacter = (characterId: string) => {
  selectedCharacterId.value = characterId
  addNetworkEvent(`🎭 選擇角色: ${characterId}`)
  
  // 同步到 GameApp（讓它知道我們的角色選擇）
  const game = (window as any).game
  if (game) {
    game.setMyCharacter(characterId)
  }
  
  // 廣播角色選擇到其他玩家
  if (game && game.networkManager) {
    game.networkManager.sendCharacterSelected(characterId)
  }
  
  // 更新自己在玩家列表中的角色（使用響應式方式）
  const myPlayerIndex = connectedPlayers.value.findIndex(p => p.id === myPeerId.value)
  if (myPlayerIndex !== -1) {
    const existingPlayer = connectedPlayers.value[myPlayerIndex]!
    connectedPlayers.value[myPlayerIndex] = {
      id: existingPlayer.id,
      isReady: existingPlayer.isReady,
      characterId
    }
    console.log('[App.vue] Updated my character:', characterId, connectedPlayers.value)
  }
}

// 技能按下處理
// 技能按下處理
const handleSkillPress = (skillId: string) => {
  console.log(`Skill pressed: ${skillId}`)
  
  // 呼叫遊戲核心的技能系統
  if (gameApp.value) {
    gameApp.value.useSkill(skillId)
  }
  
  // 測試接招模式（技能 1 加速後可接招）
  if (skillId === 'skill1') {
    setTimeout(() => {
      skillPanelRef.value?.activateComboMode('basic_dash_combo', '💥')
      setTimeout(() => {
        skillPanelRef.value?.deactivateComboMode()
      }, 1000)
    }, 100)
  }
}

onMounted(() => {
  // 偵測是否為觸控裝置
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  // 等待遊戲初始化
  const checkGame = setInterval(() => {
    if ((window as any).game && (window as any).game.networkManager) {
      const game = (window as any).game
      const networkManager = game.networkManager
      
      // 儲存 gameApp 參考
      gameApp.value = game
      
      // 監聽連線成功事件
      const originalOnConnected = networkManager.onConnected
      networkManager.onConnected = () => {
        if (originalOnConnected) originalOnConnected()
        myPeerId.value = networkManager.peerId
        isReady.value = true
        addNetworkEvent(`✅ 連線成功: ${networkManager.peerId.substring(0, 8)}`)
      }
      
      // 如果已經連線了，直接取得 Peer ID
      if (networkManager.peerId) {
        myPeerId.value = networkManager.peerId
        isReady.value = true
        addNetworkEvent(`✅ Peer ID: ${networkManager.peerId.substring(0, 8)}`)
      }
      
      // 監聽輸入接收
      const originalOnInputReceived = networkManager.onInputReceived
      networkManager.onInputReceived = (input: any) => {
        if (originalOnInputReceived) originalOnInputReceived(input)
        if (input.moveX !== 0 || input.moveY !== 0) {
          lastReceivedInput.value = `從 ${input.playerId.substring(0, 8)} 收到: (${input.moveX}, ${input.moveY}) @F${input.frame}`
          addNetworkEvent(`📥 收到輸入: ${input.playerId.substring(0, 8)} (${input.moveX},${input.moveY})`)
        }
      }
      
      // 攔截 broadcastInput 來顯示發送的輸入
      const originalBroadcastInput = networkManager.broadcastInput.bind(networkManager)
      networkManager.broadcastInput = (input: any) => {
        if (input.moveX !== 0 || input.moveY !== 0) {
          lastSentInput.value = `發送: (${input.moveX}, ${input.moveY}) @F${input.frame} → ${networkManager.connections.size} 個玩家`
          addNetworkEvent(`📤 發送輸入: (${input.moveX},${input.moveY}) → ${networkManager.connections.size} peers`)
        }
        originalBroadcastInput(input)
      }
      
      // 監聽大廳事件
      // 監聽大廳事件
      const originalOnPlayerReady = networkManager.onPlayerReady
      networkManager.onPlayerReady = (peerId: string, isReady: boolean) => {
        if (originalOnPlayerReady) originalOnPlayerReady(peerId, isReady)
        const player = connectedPlayers.value.find(p => p.id === peerId)
        if (player) {
          player.isReady = isReady
        } else {
          // 如果玩家不在列表中（可能是剛加入），先加入
          connectedPlayers.value.push({ id: peerId, isReady })
        }
        addNetworkEvent(`👤 玩家 ${peerId.substring(0, 8)} ${isReady ? '已準備' : '取消準備'}`)
      }

      // 監聽角色選擇事件
      const originalOnCharacterSelected = networkManager.onCharacterSelected
      networkManager.onCharacterSelected = (peerId: string, characterId: string) => {
        if (originalOnCharacterSelected) originalOnCharacterSelected(peerId, characterId)
        
        // 尋找玩家並更新角色
        const playerIndex = connectedPlayers.value.findIndex(p => p.id === peerId)
        if (playerIndex !== -1) {
          // 使用 Vue 的方式更新以觸發響應式
          const existingPlayer = connectedPlayers.value[playerIndex]!
          connectedPlayers.value[playerIndex] = {
            id: existingPlayer.id,
            isReady: existingPlayer.isReady,
            characterId
          }
        } else {
          // 如果玩家不在列表中，先加入
          connectedPlayers.value.push({ id: peerId, isReady: false, characterId })
        }
        addNetworkEvent(`🎭 玩家 ${peerId.substring(0, 8)} 選擇角色: ${characterId}`)
        console.log('[App.vue] Updated player character:', peerId, characterId, connectedPlayers.value)
      }

      const originalOnGameStartCountdown = networkManager.onGameStartCountdown
      networkManager.onGameStartCountdown = (seconds: number) => {
        if (originalOnGameStartCountdown) originalOnGameStartCountdown(seconds)
        countdown.value = seconds
        if (seconds > 0) {
            addNetworkEvent(`⏰ 遊戲開始倒數: ${seconds}`)
            setTimeout(() => {
                if (countdown.value > 0) countdown.value--
            }, 1000)
        }
      }

      const originalOnGameStarted = networkManager.onGameStarted
      networkManager.onGameStarted = () => {
        console.log('[App.vue] onGameStarted triggered')
        countdown.value = 0
        isInRoom.value = false
        console.log('[App.vue] Game started, countdown reset, isInRoom = false')
        
        if (originalOnGameStarted) {
          console.log('[App.vue] Calling original onGameStarted')
          originalOnGameStarted()
        }
        showLobby.value = false
        addNetworkEvent(`🚀 遊戲開始！`)
      }

      // 監聽玩家數量與屬性變化
      setInterval(() => {
        playerCount.value = game?.players.size || 0
        currentFrame.value = game?.currentFrame || 0
        
        // 更新 Host 狀態
        isHost.value = game.hostManager.isHost

        // 更新玩家列表 (從 GameApp.players 同步)
        // 注意：這裡簡單做，實際上應該有更嚴謹的同步機制
        if (isInRoom.value) {
            const currentPlayers = Array.from(game.players.keys()) as string[]
            // 加入自己
            if (networkManager.peerId && !currentPlayers.includes(networkManager.peerId)) {
                currentPlayers.push(networkManager.peerId)
            }
            
            // 同步列表
            currentPlayers.forEach(pid => {
                if (!connectedPlayers.value.find(p => p.id === pid)) {
                    connectedPlayers.value.push({ id: pid, isReady: false })
                }
            })
            // 移除已斷線
            connectedPlayers.value = connectedPlayers.value.filter(p => currentPlayers.includes(p.id))
        }
        
        // 更新本地玩家屬性
        if (networkManager.peerId && game.players.has(networkManager.peerId)) {
          const player = game.players.get(networkManager.peerId)
          if (player && player.stats) {
            health.value = player.stats.hp
            maxHealth.value = player.stats.maxHp
            mana.value = player.stats.mp
            maxMana.value = player.stats.maxMp
          }
        }
      }, 100)
      
      clearInterval(checkGame)
    }
  }, 100)
})

function createRoom() {
  if (!isReady.value) {
    alert('請等待連線初始化...')
    return
  }
  (window as any).createRoom()
  isHost.value = true
  addNetworkEvent('🏠 建立房間')
  
  // 直接進入等待室
  isInRoom.value = true
  connectedPlayers.value = [{ id: myPeerId.value, isReady: false }]
  // showLobby 保持 true，不隱藏
}

function joinRoom() {
  if (!isReady.value) {
    alert('請等待連線初始化...')
    return
  }
  if (roomIdInput.value.trim()) {
    (window as any).joinRoom(roomIdInput.value.trim())
    addNetworkEvent(`🚪 加入房間: ${roomIdInput.value.substring(0, 8)}`)
    
    // 直接進入等待室
    isInRoom.value = true
    connectedPlayers.value = [{ id: myPeerId.value, isReady: false }]
    // showLobby 保持 true，不隱藏
  } else {
    alert('請輸入房間 ID')
  }
}

function toggleReady() {
    amIReady.value = !amIReady.value
    const game = (window as any).game
    if (game && game.networkManager) {
        game.networkManager.sendPlayerReady(amIReady.value)
    }
}

function startGame() {
    const game = (window as any).game
    if (game && game.networkManager) {
        // 發送倒數
        let count = 3
        game.networkManager.broadcastGameStartCountdown(count)
        
        const timer = setInterval(() => {
            count--
            if (count > 0) {
                game.networkManager.broadcastGameStartCountdown(count)
            } else {
                clearInterval(timer)
                game.networkManager.broadcastGameStarted()
            }
        }, 1000)
    }
}

function copyRoomId() {
    navigator.clipboard.writeText(roomIdInput.value || myPeerId.value)
    alert('已複製房號！')
}

function copyPeerId() {
  if (isReady.value) {
    navigator.clipboard.writeText(myPeerId.value)
    alert('已複製到剪貼簿！')
  }
}

function leaveLobby() {
  showLobby.value = false
}
</script>

<template>
  <div class="hud">
    <!-- 房間大廳 / 等待室 -->
    <div v-if="showLobby" class="lobby-overlay">
      <div class="lobby-panel">
        <h1>🎮 Web MOBA</h1>
        
        <!-- 尚未加入房間 -->
        <div v-if="!isInRoom">
            <div class="peer-id-section">
            <label>你的 Peer ID:</label>
            <div class="peer-id-display">
                <input type="text" :value="myPeerId" readonly :class="{ loading: !isReady }" />
                <button @click="copyPeerId" :disabled="!isReady">複製</button>
            </div>
            <div v-if="!isReady" class="loading-hint">⏳ 正在連線到 PeerJS Server...</div>
            </div>
            
            <div class="actions">
            <button class="primary-btn" @click="createRoom" :disabled="!isReady">
                建立房間
            </button>
            
            <div class="join-section">
                <input 
                v-model="roomIdInput" 
                type="text" 
                placeholder="輸入房間 ID (Host 的 Peer ID)"
                @keyup.enter="joinRoom"
                :disabled="!isReady"
                />
                <button class="primary-btn" @click="joinRoom" :disabled="!isReady">
                加入房間
                </button>
            </div>
            </div>
        </div>

        <!-- 已加入房間 (等待室) -->
        <div v-else class="waiting-room">
            <h2>等待室 ({{ connectedPlayers.length }} 人)</h2>
            <div class="room-id-info">
                房號: {{ roomIdInput || myPeerId }} 
                <button class="small-btn" @click="copyRoomId">複製</button>
            </div>

            <!-- 選擇你的角色 -->
            <div class="character-selection-section">
                <h3>選擇你的角色</h3>
                <div class="character-cards">
                    <div
                        v-for="character in getAllCharacters()"
                        :key="character.id"
                        class="character-card-inline"
                        :class="{ selected: selectedCharacterId === character.id }"
                        @click="selectCharacter(character.id)"
                    >
                        <div class="character-icon-inline" :style="{ backgroundColor: character.appearance.color }">
                            {{ character.icon }}
                        </div>
                        <div class="character-name-inline">{{ character.name }}</div>
                        <div class="character-check-inline" v-if="selectedCharacterId === character.id">✓</div>
                    </div>
                </div>
                <div class="selected-character-info" v-if="getCharacter(selectedCharacterId)">
                    <strong>{{ getCharacter(selectedCharacterId)?.name }}</strong>: 
                    {{ getCharacter(selectedCharacterId)?.description }}
                </div>
            </div>

            <!-- 玩家列表 -->
            <div class="player-list">
                <h3>房間成員</h3>
                <div v-for="p in connectedPlayers" :key="p.id" class="player-item">
                    <div class="player-info-left">
                        <span class="player-character">
                            {{ p.id === myPeerId ? getCharacterIcon(selectedCharacterId) : (p.characterId ? getCharacterIcon(p.characterId) : '👤') }}
                        </span>
                        <div class="player-details">
                            <span class="p-name">{{ p.id === myPeerId ? '你' : p.id.substring(0, 8) }}</span>
                            <span class="p-character-name">
                                {{ p.id === myPeerId ? getCharacter(selectedCharacterId)?.name : (p.characterId ? getCharacter(p.characterId)?.name : '等待選擇...') }}
                            </span>
                        </div>
                    </div>
                    <div class="player-actions">
                        <span class="p-status" :class="{ ready: p.isReady }">
                            {{ p.isReady ? '✓ 準備' : '等待中' }}
                        </span>
                    </div>
                </div>
            </div>

            <div class="waiting-actions">
                <button class="ready-btn" :class="{ 'is-ready': amIReady }" @click="toggleReady">
                    {{ amIReady ? '取消準備' : '準備' }}
                </button>
                
                <button v-if="isHost" class="start-btn" :disabled="!canStartGame" @click="startGame">
                    開始遊戲
                </button>
            </div>
        </div>
      </div>
    </div>

    <!-- 倒數計時 Overlay -->
    <div v-if="countdown > 0" class="countdown-overlay">
        <div class="countdown-number">{{ countdown }}</div>
    </div>

    <!-- 遊戲中 HUD -->
    <div v-else class="game-hud">
      <div class="top-bar">
        <div class="player-info">玩家數量: {{ playerCount }}</div>
        <div class="frame-info">Frame: {{ currentFrame }}</div>
        <div class="peer-id-mini" @click="copyPeerId" title="點擊複製">
          ID: {{ myPeerId.substring(0, 8) }}...
        </div>
      </div>
      
      <!-- Debug Panel -->
      <div v-if="showDebug" class="debug-panel">
        <div class="debug-header">
          <span>🔍 網路除錯面板</span>
          <button @click="showDebug = false" class="close-btn">✕</button>
        </div>
        
        <div class="debug-section">
          <div class="debug-label">📤 最後發送:</div>
          <div class="debug-value">{{ lastSentInput || '無' }}</div>
        </div>
        
        <div class="debug-section">
          <div class="debug-label">📥 最後接收:</div>
          <div class="debug-value">{{ lastReceivedInput || '無' }}</div>
        </div>
        
        <div class="debug-section">
          <div class="debug-label">📋 事件記錄:</div>
          <div class="event-log">
            <div v-for="(event, i) in networkEvents" :key="i" class="event-item">
              {{ event }}
            </div>
            <div v-if="networkEvents.length === 0" class="event-item empty">
              尚無事件
            </div>
          </div>
        </div>
      </div>
      
      <button v-else @click="showDebug = true" class="show-debug-btn">
        🔍 顯示除錯
      </button>
      
      <!-- Bottom HUD -->
      <div class="bottom-bar">
        <div class="status-panel">
          <div class="avatar"></div>
          <div class="bars">
            <div class="bar hp" :style="{ width: (health / maxHealth * 100) + '%' }"></div>
            <div class="bar mp" :style="{ width: (mana / maxMana * 100) + '%' }"></div>
          </div>
        </div>
        
        <div class="skills-panel">
          <div class="skill" v-for="i in 4" :key="i">Q</div>
        </div>
        
        <div class="items-panel">
          <div class="item" v-for="i in 6" :key="i"></div>
        </div>
      </div>

      <div class="controls-hint">
        <p>WASD - 移動 | 空白鍵 - 測試扣血</p>
        <button 
          v-if="!showLobby" 
          @click="toggleJoystick" 
          class="joystick-toggle-btn"
          style="pointer-events: auto; margin-top: 10px; padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 8px; color: white; cursor: pointer;"
        >
          {{ forceShowJoystick ? '隱藏' : '顯示' }} 虛擬搖桿 (測試)
        </button>
      </div>
    </div>

    <!-- 虛擬搖桿（觸控裝置或手動開啟） -->
    <VirtualJoystick 
      v-if="shouldShowJoystick"
      @move="handleJoystickMove"
      @end="handleJoystickEnd"
    />
    
    <!-- 技能面板（遊戲進行中） -->
    <SkillPanel
      v-if="!showLobby"
      ref="skillPanelRef"
      :skills="skills"
      :current-cooldowns="skillCooldowns"
      @skill-press="handleSkillPress"
    />
  </div>
</template>

<style scoped>
.hud {
  width: 100%;
  height: 100%;
  pointer-events: none;
  color: white;
  font-family: 'Arial', sans-serif;
}

/* 房間大廳 */
.lobby-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 1000;
}

.lobby-panel {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 500px;
  width: 90%;
}

.lobby-panel h1 {
  text-align: center;
  margin: 0 0 30px 0;
  font-size: 36px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.peer-id-section {
  margin-bottom: 30px;
}

.peer-id-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  opacity: 0.9;
}

.peer-id-display {
  display: flex;
  gap: 10px;
}

.peer-id-display input {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-family: monospace;
  font-size: 12px;
}

.peer-id-display input.loading {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.loading-hint {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.join-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.join-section input {
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 14px;
}

.join-section input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

button {
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.primary-btn {
  background: #4CAF50;
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.peer-id-display button {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

/* 遊戲中 HUD */
.game-hud {
  pointer-events: auto;
}

.top-bar {
  position: fixed;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.player-info {
  font-size: 18px;
  font-weight: bold;
}

.frame-info {
  font-size: 14px;
  font-family: monospace;
  opacity: 0.8;
}

.peer-id-mini {
  font-family: monospace;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}

.peer-id-mini:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Debug Panel */
.debug-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 400px;
  max-height: 500px;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #4CAF50;
  border-radius: 10px;
  padding: 15px;
  font-size: 12px;
  overflow-y: auto;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: bold;
  font-size: 14px;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.debug-section {
  margin-bottom: 15px;
}

.debug-label {
  font-weight: bold;
  margin-bottom: 5px;
  color: #4CAF50;
}

.debug-value {
  background: rgba(255, 255, 255, 0.05);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}

.event-log {
  background: rgba(255, 255, 255, 0.05);
  padding: 8px;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.event-item {
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-family: monospace;
  font-size: 11px;
}

.event-item:last-child {
  border-bottom: none;
}

.event-item.empty {
  opacity: 0.5;
  text-align: center;
}

.show-debug-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #4CAF50;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}

.show-debug-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.controls-hint {
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.6);
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.controls-hint p {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

/* Bottom HUD */
.bottom-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 20px;
  pointer-events: auto;
}

.status-panel {
  display: flex;
  gap: 10px;
  background: rgba(0,0,0,0.6);
  padding: 10px;
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.avatar {
  width: 64px;
  height: 64px;
  background: #555;
  border: 2px solid #888;
  border-radius: 4px;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
  justify-content: center;
  width: 200px;
}

.bar {
  height: 20px;
  background: #333;
  border: 1px solid #000;
  transition: width 0.2s;
}

.bar.hp { background: #e74c3c; }
.bar.mp { background: #3498db; }

.skills-panel, .items-panel {
  display: flex;
  gap: 5px;
  background: rgba(0,0,0,0.6);
  padding: 10px;
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.skill {
  width: 50px;
  height: 50px;
  background: #444;
  border: 2px solid #666;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
}

.skill:hover {
  background: #555;
  border-color: #888;
}

.item {
  width: 40px;
  height: 40px;
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
}

/* Waiting Room */
.waiting-room {
  text-align: center;
  width: 100%;
}

.waiting-room h2 {
  margin-top: 0;
  margin-bottom: 20px;
}

.room-id-info {
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-family: monospace;
}

.small-btn {
  padding: 4px 8px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.player-list {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 20px;
  max-height: 200px;
  overflow-y: auto;
}


/* 等待室內的角色選擇區 */
.character-selection-section {
  margin-bottom: 25px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.character-selection-section h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #fff;
}

.character-cards {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  justify-content: center;
}

.character-card-inline {
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  text-align: center;
  min-width: 100px;
}

.character-card-inline:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

.character-card-inline.selected {
  border-color: #4CAF50;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
  background: rgba(76, 175, 80, 0.1);
}

.character-icon-inline {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin: 0 auto 10px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.character-name-inline {
  font-size: 14px;
  font-weight: bold;
  color: #fff;
}

.character-check-inline {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: #4CAF50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: bold;
}

.selected-character-info {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

.selected-character-info strong {
  color: #fff;
}

.player-list h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 10px;
  transition: background 0.3s;
}

.player-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.player-info-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.player-character {
  font-size: 32px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.p-name {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
}

.p-character-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.player-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.select-character-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.select-character-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.p-status {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.p-status.ready {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  font-weight: bold;
}

.waiting-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.ready-btn {
  background: #555;
  color: white;
  width: 120px;
}

.ready-btn.is-ready {
  background: #4CAF50;
}

.start-btn {
  background: #f39c12;
  color: white;
  width: 120px;
}

.start-btn:disabled {
  background: #7f8c8d;
  opacity: 0.5;
  cursor: not-allowed;
}

/* Countdown Overlay */
.countdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  pointer-events: none;
}

.countdown-number {
  font-size: 200px;
  font-weight: bold;
  color: #f39c12;
  text-shadow: 0 0 50px rgba(243, 156, 18, 0.8);
  animation: zoomIn 1s ease-out infinite;
}

@keyframes zoomIn {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}
</style>

