<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoomStore } from '../../stores/roomStore'
import { useCharacterStore } from '../../stores/characterStore'
import { RoomService } from '../../services/RoomService'
import { GameService } from '../../services/GameService'
import type { CharacterService } from '../../services/CharacterService'
import { getAllCharacters, getCharacter } from '../../data/characters'
import { useMediaQuery } from '../../utils/useMediaQuery'
import TeamPanel from './TeamPanel.vue'
import CharacterStage from './CharacterStage.vue'
import CharacterPicker from './CharacterPicker.vue'

const props = defineProps<{
  roomService: RoomService
  gameService: GameService
}>()

const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const characterService = inject<CharacterService>('characterService')

const characters = getAllCharacters()
const compact = useMediaQuery('(max-height: 500px)')

const myId = computed(() => roomStore.myPeerId)
const roomCode = computed(() => roomStore.roomCode)
const players = computed(() => roomStore.connectedPlayers)
const redPlayers = computed(() => players.value.filter(p => p.team === 'red'))
const bluePlayers = computed(() => players.value.filter(p => p.team === 'blue'))
const myTeam = computed(() => roomStore.myPlayer?.team)
const amIReady = computed(() => roomStore.amIReady)
const countdown = computed(() => roomStore.countdown)
const selectedCharacter = computed(() => getCharacter(characterStore.selectedCharacterId) ?? characters[0]!)

/** 未準備、沒在倒數時才能換隊 */
const canSwitchTo = (team: 'red' | 'blue') => myTeam.value !== team && !amIReady.value && countdown.value === 0

const status = computed(() => {
  if (countdown.value > 0) return '遊戲即將開始'
  const total = players.value.length
  const ready = roomStore.readyCount
  if (roomStore.isHost) {
    return roomStore.allPlayersReady ? '全員已準備，可以開始了' : `等待玩家準備（${ready}/${total}）`
  }
  return amIReady.value ? '已準備，等待房主開始遊戲' : '選好角色後按「準備」'
})

// 進房後移除邀請參數，離開房間回到大廳時不會再出現邀請畫面
onMounted(() => {
  const url = new URL(location.href)
  if (url.searchParams.has('room')) {
    url.searchParams.delete('room')
    history.replaceState(history.state, '', url)
  }
})

// --- 複製房間碼與邀請連結 ---
const toast = ref('')
let toastTimer: number | null = null
function showToast(message: string) {
  toast.value = message
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2200)
}
onBeforeUnmount(() => { if (toastTimer !== null) window.clearTimeout(toastTimer) })

const inviteLink = computed(() => `${location.origin}${location.pathname}?room=${roomCode.value}`)

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(done)
  } catch {
    showToast(`無法自動複製，請手動複製：${text}`)
  }
}

const copyCode = () => copy(roomCode.value, `已複製房間碼 ${roomCode.value}`)
const copyInvite = () => copy(inviteLink.value, '已複製邀請連結，傳給朋友就能直接加入')

// --- 動作 ---
function selectCharacter(id: string) {
  if (amIReady.value) return
  characterService?.selectCharacter(id)
}

const toggleReady = () => props.roomService.setReady(!amIReady.value)
const switchTeam = (team: 'red' | 'blue') => props.roomService.requestTeam(team)
const startGame = () => {
  if (roomStore.isHost && roomStore.allPlayersReady) props.roomService.startGameCountdown()
}
const leaveRoom = () => props.roomService.leaveRoom()
</script>

<template>
  <div class="room">
    <header class="topbar">
      <button type="button" class="btn-pixel is-ghost back" @click="leaveRoom">
        <span aria-hidden="true">←</span> 離開
      </button>

      <div class="room-id">
        <span class="room-label">房間</span>
        <button type="button" class="room-code" title="複製房間碼" @click="copyCode">{{ roomCode }}</button>
        <button type="button" class="btn-pixel is-ghost invite" @click="copyInvite">邀請連結</button>
      </div>

      <p class="headcount"><span class="num">{{ players.length }}</span> 位玩家</p>
    </header>

    <main class="arena">
      <TeamPanel
        team="red"
        :players="redPlayers"
        :my-id="myId"
        :host-id="roomCode"
        :can-switch="canSwitchTo('red')"
        :avatar-scale="compact ? 1 : 2"
        @switch="switchTeam('red')"
        @invite="copyInvite"
      />

      <CharacterStage class="center pixel-panel" :character="selectedCharacter" />

      <TeamPanel
        team="blue"
        :players="bluePlayers"
        :my-id="myId"
        :host-id="roomCode"
        :can-switch="canSwitchTo('blue')"
        :avatar-scale="compact ? 1 : 2"
        @switch="switchTeam('blue')"
        @invite="copyInvite"
      />
    </main>

    <footer class="actionbar">
      <CharacterPicker
        :characters="characters"
        :selected-id="selectedCharacter.id"
        :locked="amIReady || countdown > 0"
        :avatar-scale="compact ? 1 : 2"
        @select="selectCharacter"
      />

      <p class="status" aria-live="polite">{{ status }}</p>

      <div class="buttons">
        <button
          type="button"
          class="btn-pixel ready"
          :class="amIReady ? 'is-ghost' : 'is-success'"
          :aria-pressed="amIReady"
          :disabled="countdown > 0"
          @click="toggleReady"
        >
          {{ amIReady ? '取消準備' : '準備' }}
        </button>
        <button
          v-if="roomStore.isHost"
          type="button"
          class="btn-pixel is-primary start"
          :disabled="!roomStore.allPlayersReady || countdown > 0"
          @click="startGame"
        >
          開始遊戲
        </button>
      </div>
    </footer>

    <Transition name="fade">
      <div v-if="countdown > 0" class="countdown" role="status" aria-live="assertive">
        <p class="countdown-label">戰鬥即將開始</p>
        <p :key="countdown" class="countdown-num">{{ countdown }}</p>
      </div>
    </Transition>

    <Transition name="toast">
      <p v-if="toast" class="toast" role="status">{{ toast }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.room {
  container: room / inline-size;
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(0.4rem, 1.2vh, 0.9rem);
  padding: clamp(0.5rem, 1.5vh, 1.1rem) clamp(0.5rem, 2vw, 1.5rem);
  box-sizing: border-box;
  background:
    radial-gradient(ellipse at 50% 120%, rgba(124, 58, 237, 0.3), transparent 60%),
    linear-gradient(180deg, #0b0818 0%, #150d2c 100%);
  color: var(--c-text-main);
  overflow: hidden;
}

/* --- 頂列 --- */
.topbar { display: flex; align-items: center; gap: 1rem; }
.back { min-height: 38px; padding: 0.4em 1em; font-size: 0.9rem; }

.room-id { display: flex; align-items: center; gap: 0.6rem; margin: 0 auto; }
.room-label { font-size: 0.8rem; color: var(--c-text-muted); letter-spacing: 0.2em; }
.room-code {
  padding: 0.1em 0.5em;
  border: 2px solid rgba(245, 196, 81, 0.35);
  background: rgba(0, 0, 0, 0.45);
  color: var(--c-gold);
  font-family: var(--font-pixel);
  font-size: clamp(1.1rem, 0.9rem + 1vw, 1.6rem);
  letter-spacing: 0.2em;
  cursor: copy;
}
.room-code:hover { border-color: var(--c-gold); }
.room-code:focus-visible { outline: 2px solid var(--c-gold); outline-offset: 2px; }
.invite { min-height: 38px; padding: 0.4em 1em; font-size: 0.85rem; }

.headcount { margin: 0; font-size: 0.85rem; color: var(--c-text-muted); white-space: nowrap; }
.headcount .num { font-family: var(--font-pixel); color: #fff; }

/* --- 中央三欄 --- */
.arena {
  display: grid;
  grid-template-columns: minmax(160px, 260px) minmax(0, 1fr) minmax(160px, 260px);
  gap: clamp(0.4rem, 1.2vw, 1rem);
  min-height: 0;
}

.center { min-height: 0; overflow: hidden; }

/* --- 底列 --- */
.actionbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.25rem;
}

.status { flex: 1; margin: 0; text-align: center; color: var(--c-text-muted); font-size: 0.9rem; }
.buttons { display: flex; gap: 0.6rem; }
.ready, .start { min-width: 8.5rem; font-size: 1.05rem; }

/* --- 倒數 --- */
.countdown {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-content: center;
  text-align: center;
  background: rgba(6, 4, 14, 0.82);
}
.countdown-label { margin: 0; color: var(--c-text-muted); letter-spacing: 0.4em; }
.countdown-num {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: clamp(5rem, 20vh, 10rem);
  color: var(--c-gold);
  text-shadow: 0 6px 0 #8a4b12, 0 0 40px rgba(245, 196, 81, 0.4);
  animation: punch 1s steps(6) both;
}

/* --- 提示 --- */
.toast {
  position: absolute;
  left: 50%;
  bottom: clamp(4.5rem, 14vh, 7rem);
  translate: -50% 0;
  margin: 0;
  padding: 0.6em 1.1em;
  max-width: min(90%, 32rem);
  background: #1f1838;
  box-shadow: inset 0 0 0 2px var(--c-gold);
  color: #fff;
  font-size: 0.9rem;
  z-index: 30;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }

@keyframes punch {
  0% { transform: scale(1.6); opacity: 0; }
  30% { transform: scale(0.95); opacity: 1; }
  100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .countdown-num { animation: none; }
}

/* 橫向手機（高度 360～430px）：收緊間距 */
@media (max-height: 500px) {
  .back, .invite { min-height: 34px; padding: 0.3em 0.8em; font-size: 0.8rem; }
  .room-label, .headcount { display: none; }
  .ready, .start { min-width: 6.5rem; min-height: 40px; font-size: 0.95rem; }
  .status { font-size: 0.78rem; }
  /* 隊伍欄收窄，把寬度留給中間的角色資訊 */
  .arena { grid-template-columns: minmax(120px, 22%) minmax(0, 1fr) minmax(120px, 22%); }
}

/* 窄而夠高的視窗：隊伍放上排並排，角色資訊在下 */
@media (max-width: 700px) and (min-height: 501px) {
  .arena {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .center { grid-column: 1 / -1; grid-row: 2; }
  .actionbar { flex-wrap: wrap; justify-content: center; }
  .status { order: -1; flex-basis: 100%; }
}
</style>
