import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 正式建置的版本：Cloudflare Pages 提供 commit，本機建置讀 git；兩者取前 12 碼，同一個 commit 建出相同的檔案 */
function buildId(): string {
  const sha = process.env.CF_PAGES_COMMIT_SHA
    ?? (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { return '' } })()
  return sha ? sha.slice(0, 12) : 'unknown'
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  define: {
    // 開發伺服器一律是 dev，兩個分頁對測時版本相同
    __BUILD_ID__: JSON.stringify(command === 'build' ? buildId() : 'dev')
  },
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
}))
