import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * 像素圖只能整數倍放大：依元素實際大小，算出內容（contentWidth × contentHeight 原始像素）放得下的最大倍數
 */
export function useIntegerFit(
    el: Ref<HTMLElement | null>,
    contentWidth: number,
    contentHeight: number,
    options: { min?: number; max?: number } = {}
): Ref<number> {
    const { min = 1, max = 5 } = options
    const scale = ref(min)
    let observer: ResizeObserver | null = null

    onMounted(() => {
        if (!el.value || typeof ResizeObserver === 'undefined') return
        observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry!.contentRect
            const fit = Math.floor(Math.min(width / contentWidth, height / contentHeight))
            scale.value = Math.max(min, Math.min(max, fit))
        })
        observer.observe(el.value)
    })
    onBeforeUnmount(() => observer?.disconnect())

    return scale
}
