<script setup lang="ts">
/**
 * 角色頭像：public/characters/<id>-avatar.png（32×32 像素圖，整數倍放大）
 * 沒有圖或尚未選角時，改顯示角色色底加 emoji
 */
import { computed, ref, watch } from 'vue'
import { getCharacter } from '../../data/characters'

const props = withDefaults(defineProps<{
  characterId?: string
  /** 放大倍數，32px 的整數倍 */
  scale?: number
}>(), { scale: 2 })

const character = computed(() => (props.characterId ? getCharacter(props.characterId) : undefined))
const imageFailed = ref(false)
watch(() => props.characterId, () => { imageFailed.value = false })

const size = computed(() => `${32 * props.scale}px`)
</script>

<template>
  <span class="avatar" :style="{ width: size, height: size, '--avatar-size': size, '--char-color': character?.appearance.color ?? '#475569' }">
    <img
      v-if="character && !imageFailed"
      :src="`/characters/${character.id}-avatar.png`"
      :alt="character.name"
      width="32"
      height="32"
      @error="imageFailed = true"
    >
    <span v-else class="avatar-fallback" aria-hidden="true">{{ character?.icon ?? '?' }}</span>
  </span>
</template>

<style scoped>
.avatar {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  background:
    radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--char-color) 45%, transparent), transparent 70%),
    #120d22;
  border-radius: 6px;
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.avatar-fallback {
  font-size: calc(var(--avatar-size) * 0.5);
  line-height: 1;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6));
}
</style>
