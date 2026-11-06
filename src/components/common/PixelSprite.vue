<script setup lang="ts">
/**
 * 像素連續圖播放：讀取 Aseprite 風格 JSON（與 public/fx 相同格式），以整數倍放大逐格播放
 * 素材不存在或載入失敗時顯示 fallback slot
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { loadSpriteSheet, type SpriteSheetJson } from '../../utils/spriteSheet'

const props = withDefaults(defineProps<{
  /** 不含副檔名的路徑，例如 /characters/warrior-idle */
  src: string
  scale?: number
  /** 暫停在第一格 */
  paused?: boolean
}>(), { scale: 3, paused: false })

const sheet = ref<SpriteSheetJson | null>(null)
const failed = ref(false)
const frame = ref(0)
let timer: number | null = null

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function stop() {
  if (timer !== null) window.clearInterval(timer)
  timer = null
}

function start() {
  stop()
  const s = sheet.value
  if (!s || props.paused || reduceMotion || s.frames.length < 2) return
  const fps = s.meta.pixelfx?.fps ?? 8
  timer = window.setInterval(() => {
    frame.value = (frame.value + 1) % s.frames.length
  }, 1000 / fps)
}

watch(() => props.src, async (src) => {
  stop()
  sheet.value = null
  failed.value = false
  frame.value = 0
  const loaded = await loadSpriteSheet(src)
  if (src !== props.src) return
  if (loaded) {
    sheet.value = loaded
    start()
  } else {
    failed.value = true
  }
}, { immediate: true })

watch(() => props.paused, start)
onBeforeUnmount(stop)

const style = computed(() => {
  const s = sheet.value
  if (!s) return {}
  const rect = s.frames[frame.value]!.frame
  const k = props.scale
  const dir = props.src.substring(0, props.src.lastIndexOf('/') + 1)
  return {
    width: `${rect.w * k}px`,
    height: `${rect.h * k}px`,
    backgroundImage: `url("${dir}${s.meta.image}")`,
    backgroundSize: `${s.meta.size.w * k}px ${s.meta.size.h * k}px`,
    backgroundPosition: `-${rect.x * k}px -${rect.y * k}px`
  }
})
</script>

<template>
  <div v-if="sheet" class="pixel-sprite" :style="style" role="img" aria-hidden="true"></div>
  <slot v-else-if="failed" name="fallback"></slot>
</template>

<style scoped>
.pixel-sprite {
  background-repeat: no-repeat;
  image-rendering: pixelated;
  flex-shrink: 0;
}
</style>
