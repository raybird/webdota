import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'

// Mount Vue UI
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

console.log('🎮 WebDota 已啟動')
console.log('使用新的模組化架構')
console.log('Services 可透過 window.services 訪問 (開發用)')
