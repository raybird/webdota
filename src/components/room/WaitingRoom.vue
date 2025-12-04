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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #0a0a2e 0%, #1a1a4e 50%, #0a0a2e 100%);
  color: white;
  display: flex;
  flex-direction: column;
  font-family: 'Arial Black', Arial, sans-serif;
  overflow: hidden;
}

/* 頂部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: linear-gradient(90deg, #ff0 0%, #f80 50%, #ff0 100%);
  color: #000;
  flex-shrink: 0;
}

.title {
  font-size: 1.5rem;
  margin: 0;
  text-shadow: 1px 1px 0 #fff;
}

.room-code-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #000;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.room-code-box:hover {
  box-shadow: 0 0 10px #0ff;
}

.code-label {
  font-size: 0.7rem;
  color: #888;
}

.code-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #0ff;
  letter-spacing: 3px;
  font-family: monospace;
}

.code-hint {
  font-size: 0.6rem;
  color: #888;
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
  width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.p-label {
  font-size: 1.2rem;
  color: #ff0;
}

.p-portrait {
  width: 100px;
  height: 120px;
  border: 3px solid #ff0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
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
  gap: 4px;
  width: 100%;
  max-width: 320px;
  padding: 0.5rem;
  background: rgba(0,0,0,0.3);
  border-radius: 6px;
  overflow-y: auto;
  max-height: 60vh;
}

.char {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  background: rgba(0,0,0,0.3);
  padding: 2px;
  transition: all 0.15s;
}

.char:hover {
  border-color: #fff;
}

.char.sel {
  border-color: #ff0;
  box-shadow: 0 0 8px rgba(255,255,0,0.5);
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
  gap: 0.5rem;
  margin-top: auto;
  padding: 0.5rem 0;
  flex-wrap: wrap;
  justify-content: center;
  flex-shrink: 0;
}

.btn {
  padding: 0.5rem 1.2rem;
  font-size: 0.85rem;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-leave {
  background: #444;
  color: #fff;
}

.btn-ready {
  background: #0a0;
  color: #fff;
}

.btn-ready.on {
  background: #f80;
}

.btn-start {
  background: linear-gradient(180deg, #ff0 0%, #f80 100%);
  color: #000;
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
