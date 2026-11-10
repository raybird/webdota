/**
 * 除錯模式：網址加 ?debug 或按 ` 鍵切換
 * App 的除錯面板與遊戲內的判定圈顯示共用這個開關
 */
import { ref } from 'vue'

export const debugMode = ref(typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))
