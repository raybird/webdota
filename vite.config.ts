import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// Triggering v27 re-deployment
export default defineConfig({
  base: '/webdota/',
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'playcanvas': ['playcanvas'],
          'vue-vendor': ['vue', 'pinia'],
          'physics': ['@dimforge/rapier3d-compat'],
          'network': ['peerjs']
        }
      }
    }
  }
})
