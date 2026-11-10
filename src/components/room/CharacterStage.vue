<script setup lang="ts">
import { computed, ref } from 'vue'
import { useIntegerFit } from '../../utils/useIntegerFit'
import type { Character } from '../../types/Character'
import { getSkill } from '../../data/skills'
import PixelSprite from '../common/PixelSprite.vue'
import CharacterAvatar from '../common/CharacterAvatar.vue'

const props = defineProps<{
  character: Character
}>()

/** 立繪原始每格尺寸（public/characters/*-idle.json） */
const FRAME_SIZE = 96

// 立繪只用整數倍放大：依立繪區塊實際大小取放得下的最大倍數
const portraitEl = ref<HTMLElement | null>(null)
const spriteScale = useIntegerFit(portraitEl, FRAME_SIZE, FRAME_SIZE)

/** 技能順序與遊戲內按鍵一致 */
const SKILL_KEYS = ['1', '2', '3', '4']

const skills = computed(() => {
  const list = props.character.skills.map((id, i) => ({ skill: getSkill(id), key: SKILL_KEYS[i] ?? '' }))
  const basic = getSkill('basic_attack')
  return [...list, { skill: basic, key: 'Space' }].filter(s => s.skill)
})
</script>

<template>
  <section class="stage" :style="{ '--char-color': character.appearance.color }" aria-live="polite">
    <div ref="portraitEl" class="portrait" aria-hidden="true">
      <div class="aura"></div>
      <Transition name="swap" mode="out-in">
        <PixelSprite :key="character.id" :src="`/characters/${character.id}-idle`" :scale="spriteScale" class="sprite">
          <template #fallback>
            <CharacterAvatar :character-id="character.id" :scale="spriteScale + 1" />
          </template>
        </PixelSprite>
      </Transition>
      <div class="pedestal"></div>
    </div>

    <div class="info">
      <p class="role">{{ character.role }}</p>
      <h2 class="name">{{ character.name }}</h2>
      <p class="tagline">{{ character.tagline }}</p>

      <div class="difficulty" :aria-label="`上手難度 ${character.difficulty} / 3`">
        <span class="difficulty-label">難度</span>
        <span v-for="n in 3" :key="n" class="pip" :class="{ on: n <= character.difficulty }"></span>
      </div>

      <ul class="skills">
        <li v-for="{ skill, key } in skills" :key="skill!.id" class="skill">
          <span class="skill-icon" aria-hidden="true">{{ skill!.icon }}</span>
          <kbd class="skill-key">{{ key }}</kbd>
          <div class="skill-text">
            <span class="skill-name">{{ skill!.name }}</span>
            <span class="skill-desc">{{ skill!.description }}</span>
          </div>
          <span class="skill-cd" :title="`冷卻 ${skill!.cooldown} 秒`">{{ skill!.cooldown }}s</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.stage {
  container: stage / inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  gap: clamp(0.75rem, 3cqi, 2rem);
  min-height: 0;
  height: 100%;
  padding: clamp(0.5rem, 2cqi, 1.5rem);
  box-sizing: border-box;
}

.portrait {
  position: relative;
  display: grid;
  place-items: center;
  align-self: stretch;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.aura {
  position: absolute;
  inset: 10% 5%;
  background: radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--char-color) 40%, transparent), transparent 65%);
  filter: blur(2px);
  transition: background 0.4s;
}

.sprite, .portrait :deep(.avatar) { position: relative; z-index: 1; }

.pedestal {
  position: absolute;
  bottom: 8%;
  width: 70%;
  height: 22px;
  background:
    radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--char-color) 50%, transparent), transparent 70%);
}

.info { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; min-height: 0; max-height: 100%; }

.role {
  margin: 0;
  align-self: flex-start;
  padding: 0.15em 0.6em;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #fff;
  background: color-mix(in srgb, var(--char-color) 55%, #1a1030);
}

.name {
  margin: 0;
  font-size: clamp(1.6rem, 1rem + 3cqi, 2.6rem);
  color: #fff;
  letter-spacing: 0.25em;
  text-shadow: 0 3px 0 color-mix(in srgb, var(--char-color) 60%, #000);
}

.tagline { margin: 0; color: var(--c-text-muted); font-size: 0.9rem; }

.difficulty { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: var(--c-text-muted); }
.difficulty-label { margin-right: 0.3rem; }
.pip { width: 14px; height: 6px; background: rgba(255, 255, 255, 0.12); }
.pip.on { background: var(--c-gold); }

.skills {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  min-height: 0;
}

.skill {
  display: grid;
  grid-template-columns: 1.8rem 2.6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.04);
}

.skill-icon { font-size: 1.2rem; text-align: center; }
.skill-key {
  font-family: var(--font-pixel);
  font-size: 0.7rem;
  text-align: center;
  padding: 0.15em 0;
  color: var(--c-gold);
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 2px solid rgba(245, 196, 81, 0.35);
}
/* 觸控裝置沒有鍵盤：保留欄位、隱藏按鍵 */
@media (hover: none) and (pointer: coarse) {
  .skill-key { visibility: hidden; }
}
.skill-text { display: flex; flex-direction: column; min-width: 0; }
.skill-name { font-weight: 700; color: #fff; font-size: 0.88rem; line-height: 1.3; }
.skill-desc { font-size: 0.75rem; color: var(--c-text-muted); line-height: 1.35; }
.skill-cd { font-size: 0.75rem; color: #8b84a8; font-variant-numeric: tabular-nums; }

.swap-enter-active, .swap-leave-active { transition: opacity 0.15s steps(3), transform 0.15s steps(3); }
.swap-enter-from { opacity: 0; transform: translateY(8px); }
.swap-leave-to { opacity: 0; transform: translateY(-8px); }

/* 中間欄窄時（橫向手機）：技能只留名稱，說明用 title 顯示 */
@container stage (max-width: 520px) {
  .tagline, .skill-desc, .skill-cd { display: none; }
  .skill { grid-template-columns: 1.6rem 2.8rem minmax(0, 1fr); padding: 0.2rem 0.4rem; }
  .skill-name { font-size: 0.8rem; }
  .skills { gap: 0.2rem; }
}

/* 更窄：拿掉技能圖示，立繪欄讓出寬度 */
@container stage (max-width: 400px) {
  .stage { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 0.5rem; }
  .skill-icon { display: none; }
  .skill { grid-template-columns: 2.4rem minmax(0, 1fr); }
  .name { letter-spacing: 0.1em; }
}

@media (prefers-reduced-motion: reduce) {
  .swap-enter-active, .swap-leave-active { transition: none; }
}
</style>
