<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { RoomService } from '../services/RoomService'
import { JoinRoomError } from '../core/NetworkManager'
import type { AudioManager } from '../core/AudioManager'
import { getAllCharacters } from '../data/characters'
import PixelSprite from '../components/common/PixelSprite.vue'
import CharacterAvatar from '../components/common/CharacterAvatar.vue'
import { NICKNAME_MAX_LENGTH, normalizeNickname, randomNickname } from '../utils/nickname'
import { useIntegerFit } from '../utils/useIntegerFit'

const props = defineProps<{
  roomService: RoomService
}>()

const audioManager = inject<AudioManager>('audioManager')
const playClick = () => audioManager?.playClick()
const playHover = () => audioManager?.playHover()

const CODE_LENGTH = 6
const characters = getAllCharacters()
/** 三位角色並排（每格 96px、間距與名字約佔 40px），只用整數倍放大 */
const lineupEl = ref<HTMLElement | null>(null)
const spriteScale = useIntegerFit(lineupEl, 96 * 3 + 48, 96 + 40, { max: 3 })

const nickname = ref(props.roomService.getNickname())
const roomCode = ref('')
const busy = ref<'create' | 'join' | null>(null)
const errorMessage = ref('')
const codeInput = ref<HTMLInputElement | null>(null)

/** 從邀請連結（?room=XXXXXX）帶入的房間碼 */
const inviteCode = ref('')

const canJoin = computed(() => roomCode.value.length === CODE_LENGTH && !busy.value)

onMounted(() => {
  const code = sanitizeCode(new URLSearchParams(location.search).get('room') ?? '')
  if (code.length === CODE_LENGTH) {
    inviteCode.value = code
    roomCode.value = code
  }
})

function sanitizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
}

function onCodeInput(event: Event) {
  const input = event.target as HTMLInputElement
  roomCode.value = sanitizeCode(input.value)
  input.value = roomCode.value
  errorMessage.value = ''
}

function rollNickname() {
  playClick()
  nickname.value = randomNickname()
  commitNickname()
}

function commitNickname() {
  const name = normalizeNickname(nickname.value) || randomNickname()
  nickname.value = name
  props.roomService.setNickname(name)
}

async function createRoom() {
  if (busy.value) return
  playClick()
  commitNickname()
  busy.value = 'create'
  errorMessage.value = ''
  try {
    await props.roomService.createRoom()
  } catch (error) {
    console.error('Failed to create room:', error)
    errorMessage.value = '建立房間失敗，請檢查網路連線後再試一次'
  } finally {
    busy.value = null
  }
}

async function joinRoom() {
  if (!canJoin.value) {
    if (roomCode.value.length !== CODE_LENGTH) {
      errorMessage.value = `房間碼是 ${CODE_LENGTH} 碼英數字`
      codeInput.value?.focus()
    }
    return
  }
  playClick()
  commitNickname()
  busy.value = 'join'
  errorMessage.value = ''
  try {
    await props.roomService.joinRoom(roomCode.value)
  } catch (error) {
    console.error('Failed to join room:', error)
    if (error instanceof JoinRoomError && error.reason === 'not-found') {
      errorMessage.value = `找不到房間 ${roomCode.value}，可能已關閉或房間碼有誤`
    } else if (error instanceof JoinRoomError) {
      errorMessage.value = '連線逾時，請確認房主仍在房間內後再試一次'
    } else {
      errorMessage.value = '加入房間失敗，請稍後再試'
    }
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <main class="lobby">
    <div class="sky" aria-hidden="true"></div>

    <section class="hero">
      <h1 class="logo">
        <span class="logo-top">Mythic</span>
        <span class="logo-bottom">Legends</span>
      </h1>
      <p class="tagline">打開瀏覽器就能開戰的多人競技場</p>

      <div ref="lineupEl" class="lineup" aria-hidden="true">
        <div v-for="(char, i) in characters" :key="char.id" class="hero-slot" :style="{ '--i': i, '--char-color': char.appearance.color }">
          <PixelSprite :src="`/characters/${char.id}-idle`" :scale="spriteScale">
            <template #fallback>
              <CharacterAvatar :character-id="char.id" :scale="spriteScale" />
            </template>
          </PixelSprite>
          <span class="hero-name">{{ char.name }}</span>
        </div>
      </div>
    </section>

    <section class="panel pixel-panel" aria-labelledby="lobby-panel-title">
      <h2 id="lobby-panel-title" class="sr-only">開始遊戲</h2>

      <div class="field">
        <label for="nickname" class="field-label">你的暱稱</label>
        <div class="field-row">
          <input
            id="nickname"
            v-model="nickname"
            class="input-pixel"
            type="text"
            autocomplete="nickname"
            :maxlength="NICKNAME_MAX_LENGTH"
            @blur="commitNickname"
            @keyup.enter="commitNickname"
          >
          <button type="button" class="btn-pixel is-ghost dice" title="隨機暱稱" aria-label="隨機產生暱稱" @click="rollNickname">🎲</button>
        </div>
      </div>

      <template v-if="inviteCode">
        <p class="invite">你被邀請加入房間 <strong class="code">{{ inviteCode }}</strong></p>
        <button class="btn-pixel is-primary action" :disabled="!!busy" @click="joinRoom" @mouseenter="playHover">
          {{ busy === 'join' ? '連線中…' : '加入房間' }}
        </button>
        <button class="btn-pixel is-ghost action" :disabled="!!busy" @click="createRoom" @mouseenter="playHover">
          {{ busy === 'create' ? '建立中…' : '改為建立新房間' }}
        </button>
      </template>

      <template v-else>
        <button class="btn-pixel is-primary action" :disabled="!!busy" @click="createRoom" @mouseenter="playHover">
          {{ busy === 'create' ? '建立中…' : '建立房間' }}
        </button>

        <div class="divider"><span>或加入朋友的房間</span></div>

        <form class="join" @submit.prevent="joinRoom">
          <label for="room-code" class="sr-only">房間碼</label>
          <input
            id="room-code"
            ref="codeInput"
            :value="roomCode"
            class="input-pixel code-input"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="房間碼"
            :maxlength="CODE_LENGTH"
            :disabled="!!busy"
            @input="onCodeInput"
          >
          <button type="submit" class="btn-pixel" :disabled="!!busy" @mouseenter="playHover">
            {{ busy === 'join' ? '連線中…' : '加入' }}
          </button>
        </form>
      </template>

      <p class="error" role="alert">{{ errorMessage }}</p>
      <p class="hint">玩家之間直接 P2P 連線，不需要註冊帳號</p>
    </section>
  </main>
</template>

<style scoped>
.lobby {
  position: relative;
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 400px);
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  gap: clamp(1.5rem, 4vw, 4rem);
  padding: clamp(1rem, 4vw, 4rem);
  box-sizing: border-box;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 30% 110%, rgba(124, 58, 237, 0.35), transparent 60%),
    radial-gradient(ellipse at 90% -10%, rgba(244, 63, 94, 0.18), transparent 55%),
    linear-gradient(180deg, #0b0818 0%, #140c2b 60%, #1b1036 100%);
  color: var(--c-text-main);
}

/* 像素星空：兩層 1px／2px 方點 */
.sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(1px 1px at 12% 18%, #fff8 99%, transparent),
    radial-gradient(1px 1px at 38% 8%, #fff6 99%, transparent),
    radial-gradient(2px 2px at 64% 22%, #ffe9a8aa 99%, transparent),
    radial-gradient(1px 1px at 82% 12%, #fff7 99%, transparent),
    radial-gradient(1px 1px at 22% 42%, #fff5 99%, transparent),
    radial-gradient(2px 2px at 92% 48%, #c4b5fd99 99%, transparent),
    radial-gradient(1px 1px at 52% 36%, #fff5 99%, transparent),
    radial-gradient(1px 1px at 6% 66%, #fff4 99%, transparent);
  animation: twinkle 6s steps(3) infinite alternate;
}

.hero {
  container: hero / inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 0;
  align-self: stretch;
  justify-content: center;
  min-height: 0;
}

.logo {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.95;
  font-family: var(--font-pixel);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-gold);
  text-shadow: 0 4px 0 #8a4b12, 0 8px 0 rgba(0, 0, 0, 0.45), 0 0 30px rgba(245, 196, 81, 0.35);
}

.logo-top { font-size: clamp(1rem, 6cqi, 3rem); color: #e9d5ff; text-shadow: 0 3px 0 #5b21b6, 0 6px 0 rgba(0, 0, 0, 0.45); }
.logo-bottom { font-size: clamp(1.6rem, 12cqi, 6rem); }

.tagline {
  margin: 1rem 0 0;
  color: var(--c-text-muted);
  font-size: clamp(0.9rem, 0.8rem + 0.4vw, 1.15rem);
  letter-spacing: 0.08em;
}

.lineup {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: clamp(0.5rem, 3vh, 2rem);
}

.hero-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  animation: bob 3.2s steps(4) infinite;
  animation-delay: calc(var(--i) * -1.1s);
}

/* 腳下的光圈底座 */
.hero-slot::before {
  content: '';
  position: absolute;
  bottom: 1.6rem;
  width: 120%;
  height: 18px;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--char-color) 55%, transparent), transparent 70%);
  z-index: -1;
}

.hero-name {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: color-mix(in srgb, var(--char-color) 60%, white);
}

.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.6rem;
}

.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-size: 0.8rem; color: var(--c-text-muted); letter-spacing: 0.1em; }
.field-row { display: flex; gap: 0.5rem; }
.dice { padding: 0; width: 44px; flex-shrink: 0; font-size: 1.2rem; }

.action { width: 100%; font-size: 1.1rem; }

.invite { margin: 0; color: var(--c-text-muted); }
.invite .code, .code-input { font-family: var(--font-pixel); letter-spacing: 0.25em; color: var(--c-gold); }

.divider {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: #6b6488;
  font-size: 0.8rem;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 2px;
  background: repeating-linear-gradient(90deg, rgba(167, 139, 250, 0.3) 0 4px, transparent 4px 8px);
}

.join { display: flex; gap: 0.5rem; }
.join .btn-pixel { flex-shrink: 0; white-space: nowrap; }
.code-input { text-align: center; font-size: 1.15rem; text-transform: uppercase; }
.code-input::placeholder { font-family: var(--font-body); letter-spacing: 0.1em; text-transform: none; }

.error { min-height: 1.2em; margin: 0; color: #fda4af; font-size: 0.85rem; }
.error:empty { display: none; }
.hint { margin: 0; color: #6b6488; font-size: 0.75rem; text-align: center; }

@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes twinkle {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-slot, .sky { animation: none; }
}

/* 窄而夠高的螢幕：上下排列（橫向手機高度不夠，維持左右兩欄） */
@media (max-width: 760px) and (min-height: 501px) {
  .lobby {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    align-content: center;
    overflow-y: auto;
  }
  .lineup { flex: none; height: 38vh; }
}

/* 橫向手機：高度只有 360～430px，縮小立繪、收起口號 */
@media (max-height: 500px) {
  .lobby { grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); padding: 1rem 1.5rem; gap: 1.5rem; }
  .tagline { display: none; }
  .hero-name { font-size: 0.7rem; }
  .panel { padding: 1rem 1.2rem; gap: 0.6rem; }
  .hint { display: none; }
}
</style>
