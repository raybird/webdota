<script setup lang="ts">
import type { Character } from '../../types/Character'
import CharacterAvatar from '../common/CharacterAvatar.vue'

defineProps<{
  characters: Character[]
  selectedId: string
  /** 已準備時鎖定選擇 */
  locked: boolean
  avatarScale: number
}>()

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <div class="picker" role="radiogroup" aria-label="選擇角色">
    <button
      v-for="char in characters"
      :key="char.id"
      type="button"
      role="radio"
      class="pick"
      :class="{ selected: char.id === selectedId }"
      :aria-checked="char.id === selectedId"
      :disabled="locked && char.id !== selectedId"
      :style="{ '--char-color': char.appearance.color }"
      :title="locked ? '取消準備後才能換角色' : `${char.name}・${char.role}`"
      @click="!locked && emit('select', char.id)"
    >
      <CharacterAvatar :character-id="char.id" :scale="avatarScale" />
      <span class="pick-name">{{ char.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.picker { display: flex; gap: 0.5rem; }

.pick {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.35rem 0.3rem;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: var(--c-text-muted);
  font: inherit;
  cursor: pointer;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08);
  transition: transform var(--trans-fast), box-shadow var(--trans-fast);
}

.pick:hover:not(:disabled) { transform: translateY(-2px); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--char-color) 60%, transparent); }
.pick:focus-visible { outline: 2px solid var(--c-gold); outline-offset: 2px; }
.pick:disabled { cursor: not-allowed; opacity: 0.4; }

.pick.selected {
  color: #fff;
  background: color-mix(in srgb, var(--char-color) 22%, transparent);
  box-shadow: inset 0 0 0 2px var(--c-gold), 0 0 14px rgba(245, 196, 81, 0.35);
}

/* 選中時頭頂的小箭頭 */
.pick.selected::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  translate: -50% 0;
  border: 5px solid transparent;
  border-top-color: var(--c-gold);
}

.pick-name { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; }
</style>
