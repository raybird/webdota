<script setup lang="ts">
import { computed } from 'vue'
import type { RoomPlayer } from '../../stores/roomStore'
import { getCharacter } from '../../data/characters'
import { displayName } from '../../utils/nickname'
import CharacterAvatar from '../common/CharacterAvatar.vue'

const props = defineProps<{
  team: 'red' | 'blue'
  players: RoomPlayer[]
  myId: string
  hostId: string
  /** 顯示「換到這隊」按鈕 */
  canSwitch: boolean
  /** 頭像放大倍數 */
  avatarScale: number
}>()

const emit = defineEmits<{
  switch: []
  invite: []
}>()

const label = computed(() => (props.team === 'red' ? '紅隊' : '藍隊'))
const characterName = (id?: string) => (id ? getCharacter(id)?.name : undefined) ?? '選角中'
</script>

<template>
  <section class="team pixel-panel" :class="team" :aria-label="`${label}，${players.length} 位玩家`">
    <header class="team-head">
      <span class="team-flag" aria-hidden="true"></span>
      <h2 class="team-name">{{ label }}</h2>
      <span class="team-count">{{ players.length }}</span>
      <button v-if="canSwitch" type="button" class="btn-pixel is-ghost switch" @click="emit('switch')">換到這隊</button>
    </header>

    <ul class="roster">
      <li
        v-for="player in players"
        :key="player.id"
        class="member"
        :class="{ 'is-me': player.id === myId, 'is-ready': player.isReady }"
      >
        <CharacterAvatar :character-id="player.characterId" :scale="avatarScale" />
        <div class="member-info">
          <span class="member-line">
            <span class="member-name">{{ displayName(player) }}</span>
            <span v-if="player.id === myId" class="tag tag-me">你</span>
            <span v-if="player.id === hostId" class="tag tag-host" title="房主">房主</span>
          </span>
          <span class="member-sub">
            <span class="ready">{{ player.isReady ? '已準備' : '未準備' }}</span>
            <span class="member-char">{{ characterName(player.characterId) }}</span>
          </span>
        </div>
      </li>

      <li class="member empty">
        <button type="button" class="invite" @click="emit('invite')">＋ 邀請朋友</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.team {
  --team: var(--c-red);
  --team-dim: var(--c-red-dim);
  --panel-border: color-mix(in srgb, var(--team) 45%, transparent);
  --panel-bg: linear-gradient(180deg, color-mix(in srgb, var(--team) 14%, #120d24) 0%, rgba(14, 10, 28, 0.92) 40%);
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0.9rem;
  gap: 0.75rem;
}

.team.blue { --team: var(--c-blue); --team-dim: var(--c-blue-dim); }

.team-head { display: flex; align-items: center; gap: 0.5rem; }
.team-flag { width: 10px; height: 10px; background: var(--team); box-shadow: 0 0 8px var(--team); }
.team-name { margin: 0; font-size: 1rem; color: var(--team); letter-spacing: 0.2em; text-shadow: none; }
.team-count { font-family: var(--font-pixel); color: var(--c-text-muted); font-size: 0.85rem; }
.switch { margin-left: auto; min-height: 32px; padding: 0.3em 0.8em; font-size: 0.8rem; }

.roster {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  min-height: 0;
}

.member {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem;
  background: rgba(255, 255, 255, 0.04);
  border-left: 3px solid transparent;
}

.member.is-me { background: var(--team-dim); border-left-color: var(--team); }

.member-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.member-line { display: flex; align-items: center; gap: 0.35rem; min-width: 0; }
.member-name {
  min-width: 0;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.member-sub { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem; }
.member-char { font-size: 0.78rem; color: var(--c-text-muted); white-space: nowrap; }

.tag { font-size: 0.65rem; padding: 0.05em 0.4em; font-weight: 700; flex-shrink: 0; }
.tag-me { background: var(--team); color: #fff; }
.tag-host { background: rgba(245, 196, 81, 0.2); color: var(--c-gold); }

.ready {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.05em 0.45em;
  color: #6b6488;
  background: rgba(0, 0, 0, 0.35);
  flex-shrink: 0;
}
.is-ready .ready { color: #032b12; background: #4ade80; }

.member.empty { padding: 0; background: none; }
.invite {
  width: 100%;
  min-height: 40px;
  border: 2px dashed rgba(167, 139, 250, 0.25);
  background: none;
  color: #8b84a8;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
.invite:hover { color: var(--c-text-main); border-color: rgba(167, 139, 250, 0.55); }
.invite:focus-visible { outline: 2px solid var(--c-gold); outline-offset: 2px; }

/* 欄位窄時只留頭像、名字與準備狀態 */
@container room (max-width: 820px) {
  .team { padding: 0.6rem; gap: 0.5rem; }
  .team-head { flex-wrap: wrap; }
  .member-char { display: none; }
  .tag-host { display: none; }
  /* 自己的卡片已有底色與左邊框標示，窄欄時把空間留給暱稱 */
  .tag-me { display: none; }
}
</style>
