<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useRoomStore } from '../../stores/roomStore'
import { useCharacterStore } from '../../stores/characterStore'
import { RoomService } from '../../services/RoomService'
import { GameService } from '../../services/GameService'
import { CharacterService } from '../../services/CharacterService'
import { getAllCharacters, getCharacter } from '../../data/characters'

const props = defineProps<{
  roomService: RoomService
  gameService: GameService
}>()

const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const characterService = inject<CharacterService>('characterService')

const characters = getAllCharacters()
const isHost = computed(() => roomStore.isHost)
const amIReady = computed(() => roomStore.amIReady)
const allPlayersReady = computed(() => roomStore.allPlayersReady)
const countdown = computed(() => roomStore.countdown)
const roomCode = computed(() => roomStore.roomCode)
const players = computed(() => roomStore.connectedPlayers)
const myPeerId = computed(() => roomStore.myPeerId)

// 選中的角色
const selectedCharacterId = computed(() => characterStore.selectedCharacterId)
const selectedCharacter = computed(() => getCharacter(selectedCharacterId.value))

// 複製提示
const showCopied = ref(false)

// 玩家選擇的角色
const getPlayerCharacter = (characterId?: string) => {
  if (!characterId) return null
  return getCharacter(characterId)
}

const selectCharacter = (id: string) => {
  if (characterService) {
    characterService.selectCharacter(id)
  }
}

const toggleReady = () => {
  props.roomService.setReady(!amIReady.value)
}

const startGame = () => {
  if (isHost.value && allPlayersReady.value) {
    props.roomService.startGameCountdown()
  }
}

const leaveRoom = () => {
  props.roomService.leaveRoom()
}

const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(roomCode.value)
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}
</script>

<template>
  <div class="kof-screen">
    <!-- 頂部標題列 -->
    <header class="header">
      <h1 class="title">SELECT</h1>
      
      <!-- 房間碼 - 大而明顯 -->
      <div class="room-code-box" @click="copyRoomCode">
        <span class="code-label">ROOM</span>
        <span class="code-value">{{ roomCode }}</span>
        <span class="code-hint">{{ showCopied ? '✓複製' : '點擊' }}</span>
      </div>
    </header>

    <!-- 主區域 -->
    <main class="main">
      <!-- 左側：玩家 1P -->
      <aside class="p1-area">
        <div class="p-label">1P</div>
        <div class="p-portrait" v-if="selectedCharacter" :style="{ backgroundColor: selectedCharacter.appearance.color }">
          <span class="p-icon">{{ selectedCharacter.icon }}</span>
        </div>
        <div class="p-portrait p-empty" v-else>?</div>
        <div class="p-name">{{ selectedCharacter?.name || '---' }}</div>
        <div class="p-status" :class="{ ready: amIReady }">{{ amIReady ? 'READY' : '...' }}</div>
      </aside>

      <!-- 中央：角色選擇 -->
      <section class="center">
        <div class="chars">
          <div 
            v-for="char in characters" 
            :key="char.id"
            class="char"
            :class="{ sel: selectedCharacterId === char.id }"
            @click="selectCharacter(char.id)"
          >
            <div class="char-icon" :style="{ backgroundColor: char.appearance.color }">{{ char.icon }}</div>
            <div class="char-name">{{ char.name }}</div>
          </div>
        </div>

        <!-- 倒數 -->
        <div v-if="countdown > 0" class="countdown">
          <div class="cd-num">{{ countdown }}</div>
        </div>

        <!-- 按鈕 -->
        <div class="btns">
          <button class="btn btn-leave" @click="leaveRoom">離開</button>
          <button class="btn btn-ready" :class="{ on: amIReady }" @click="toggleReady">
            {{ amIReady ? '取消' : '準備' }}
          </button>
          <button v-if="isHost" class="btn btn-start" :disabled="!allPlayersReady" @click="startGame">開始</button>
        </div>
      </section>

      <!-- 右側：玩家列表 -->
      <aside class="players">
        <div class="players-title">連線 ({{ players.length }})</div>
        <div class="players-list">
          <div 
            v-for="(p, i) in players" 
            :key="p.id"
            class="player"
            :class="{ me: p.id === myPeerId, rdy: p.isReady }"
          >
            <span class="player-idx">P{{ i + 1 }}</span>
            <div class="player-avatar" v-if="getPlayerCharacter(p.characterId)" :style="{ backgroundColor: getPlayerCharacter(p.characterId)?.appearance.color }">
              {{ getPlayerCharacter(p.characterId)?.icon }}
            </div>
            <div class="player-avatar player-empty" v-else>?</div>
            <span class="player-char">{{ getPlayerCharacter(p.characterId)?.name || '---' }}</span>
            <span class="player-status">{{ p.isReady ? '✓' : '...' }}</span>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* 根容器 - 確保填滿視口且不超出 */
.kof-screen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at center, #1a0b2e 0%, #0a0a12 100%);
  color: var(--c-primary);
  display: flex;
  flex-direction: column;
  font-family: var(--font-heading);
  overflow: hidden;
}

/* 頂部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1.5rem;
  background: linear-gradient(90deg, #240046 0%, #3c096c 50%, #240046 100%);
  border-bottom: 2px solid var(--c-primary-dim);
  box-shadow: 0 0 15px rgba(0,0,0,0.8);
  flex-shrink: 0;
  z-index: 10;
}

.title {
  font-size: 2rem;
  margin: 0;
  text-shadow: 0 0 10px var(--c-primary);
  letter-spacing: 2px;
}

.room-code-box {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.5rem 1.2rem;
  border: 1px solid var(--c-primary-dim);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.room-code-box:hover {
  border-color: var(--c-primary);
  box-shadow: 0 0 15px var(--c-secondary);
}

.code-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--c-primary);
  letter-spacing: 4px;
  text-shadow: 0 0 5px var(--c-primary);
}

/* 主區域 */
.main {
  flex: 1;
  display: flex;
  padding: 0.5rem;
  gap: 0.5rem;
  min-height: 0; /* 重要：允許flex子項縮小 */
  overflow: hidden;
}

/* 左側 1P */
.p1-area {
  width: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding-top: 2rem;
}

.p-label {
  font-size: 1.5rem;
  color: var(--c-primary);
  text-shadow: 0 0 5px var(--c-primary);
}

.p-portrait {
  width: 120px;
  height: 140px;
  border: 3px solid var(--c-primary);
  box-shadow: 0 0 20px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #1a1a1a;
  position: relative;
  overflow: hidden;
}

.p-portrait::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  pointer-events: none;
}

.p-icon {
  font-size: 3.5rem;
}

.p-empty {
  font-size: 2rem;
  color: #444;
  background: rgba(0,0,0,0.5);
}

.p-name {
  font-size: 0.9rem;
}

.p-status {
  font-size: 0.8rem;
  color: #666;
  padding: 0.2rem 0.5rem;
  background: rgba(0,0,0,0.5);
  border-radius: 4px;
}

.p-status.ready {
  color: #0f0;
}

/* 中央區 */
.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  overflow: hidden;
}

/* 角色網格 */
.chars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 400px;
  padding: 1rem;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  overflow-y: auto;
  max-height: 60vh;
  backdrop-filter: blur(5px);
}

.char {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  padding: 4px;
  transition: all 0.2s;
  position: relative;
}

.char:hover {
  border-color: rgba(255, 215, 0, 0.5);
  transform: translateY(-2px);
  background: rgba(255,255,255,0.1);
}

.char.sel {
  border-color: var(--c-primary);
  box-shadow: 0 0 15px var(--c-primary);
  background: rgba(255, 215, 0, 0.1);
  transform: scale(1.05);
  z-index: 2;
}

.char-icon {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.char-name {
  font-size: 0.55rem;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}

/* 倒數 */
.countdown {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.9);
  border: 3px solid #f00;
  border-radius: 8px;
  padding: 1rem 2rem;
  z-index: 10;
}

.cd-num {
  font-size: 4rem;
  color: #ff0;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  50% { transform: scale(1.1); }
}

/* 按鈕區 */
.btns {
  display: flex;
  gap: 1.5rem;
  margin-top: auto;
  padding: 1.5rem 0;
  flex-wrap: wrap;
  justify-content: center;
  flex-shrink: 0;
}

.btn {
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-family: var(--font-heading);
  font-weight: bold;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.btn-leave {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
}

.btn-leave:hover {
  border-color: #fff;
  color: #fff;
  background: rgba(255,255,255,0.1);
}

.btn-ready {
  background: var(--c-secondary-dark);
  border: 1px solid var(--c-secondary);
  color: var(--c-secondary);
  box-shadow: 0 0 10px rgba(157, 78, 221, 0.2);
}

.btn-ready:hover {
  background: var(--c-secondary);
  color: white;
  box-shadow: 0 0 20px var(--c-secondary);
}

.btn-ready.on {
  background: var(--c-success);
  border-color: #fff;
  color: #000;
  box-shadow: 0 0 20px var(--c-success);
}

.btn-start {
  background: linear-gradient(135deg, var(--c-primary), #b8860b);
  color: #000;
  border: 1px solid #fff;
  font-weight: 800;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.btn-start:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
}

/* 右側玩家列表 */
.players {
  width: 140px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
}

.players-title {
  font-size: 0.8rem;
  color: #ff0;
  text-align: center;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid #ff0;
  flex-shrink: 0;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  padding-top: 0.25rem;
}

.player {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background: rgba(0,0,0,0.3);
  border: 1px solid #333;
  border-radius: 4px;
  font-size: 0.7rem;
}

.player.me {
  border-color: #0ff;
  background: rgba(0,255,255,0.1);
}

.player.rdy {
  border-color: #0f0;
}

.player-idx {
  color: #ff0;
  font-weight: bold;
  width: 20px;
}

.player-avatar {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

.player-empty {
  background: #222;
  color: #444;
}

.player-char {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-status {
  color: #0f0;
}

/* 響應式 */
@media (max-width: 600px) {
  .p1-area {
    display: none;
  }
  
  .players {
    width: 100px;
  }
  
  .chars {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-height: 500px) {
  .p-portrait {
    height: 80px;
  }
  
  .chars {
    max-height: 40vh;
  }
}
</style>
