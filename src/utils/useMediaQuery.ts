import { onBeforeUnmount, ref, type Ref } from 'vue'

/** 媒體查詢是否成立，視窗大小改變時更新 */
export function useMediaQuery(query: string): Ref<boolean> {
    const mql = typeof matchMedia === 'function' ? matchMedia(query) : null
    const matches = ref(mql?.matches ?? false)
    const update = (e: MediaQueryListEvent) => { matches.value = e.matches }
    mql?.addEventListener('change', update)
    onBeforeUnmount(() => mql?.removeEventListener('change', update))
    return matches
}
