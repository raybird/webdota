<script setup lang="ts">
/**
 * 連線診斷面板：每條 P2P 連線的延遲、抖動、連線方式，以及狀態同步頻率
 * 開著時每 500ms 讀一次 GameService.getConnectionDiagnostics()
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { GameService } from '../../services/GameService'
import type { ConnectionQuality, ConnectionRoute, PeerDiagnostics } from '../../core/net/ConnectionDiagnostics'
import { useRoomStore } from '../../stores/roomStore'

const props = defineProps<{ gameService: GameService }>()
const emit = defineEmits<{ close: [] }>()
const roomStore = useRoomStore()

type Diagnostics = ReturnType<GameService['getConnectionDiagnostics']>
const data = ref<Diagnostics | null>(null)
let timer: number | undefined

const refresh = () => { data.value = props.gameService.getConnectionDiagnostics() }
onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 500)
})
onUnmounted(() => window.clearInterval(timer))

const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  good: '良好', fair: '普通', poor: '偏差', bad: '很差', unknown: '量測中'
}
const ROUTE_LABEL: Record<ConnectionRoute, string> = {
  lan: '直連（區域網路）', direct: '直連（NAT 穿透）', relay: '經中繼伺服器', unknown: '判斷中'
}

const nameOf = (peerId: string) =>
  roomStore.connectedPlayers.find(p => p.id.toUpperCase() === peerId.toUpperCase())?.name || peerId.substring(0, 8)

const ms = (value: number | null) => (value === null ? '—' : `${Math.round(value)} ms`)

const routeText = (peer: PeerDiagnostics) => {
  const ice = peer.ice
  if (!ice) return ROUTE_LABEL.unknown
  const protocol = ice.protocol ? ` · ${ice.protocol.toUpperCase()}` : ''
  return `${ROUTE_LABEL[ice.route]}${protocol}`
}

/** Host 列出所有玩家；Client 只關心與 Host 的連線，其他連線（Mesh）放後面 */
const peers = computed(() => {
  const list = [...(data.value?.peers ?? [])]
  const hostId = data.value?.hostId?.toUpperCase()
  return list.sort((a, b) => Number(b.peerId === hostId) - Number(a.peerId === hostId))
})

const hints = computed(() => {
  const d = data.value
  if (!d) return []
  const result: string[] = []
  if (d.peers.some(p => p.ice?.route === 'relay')) result.push('有連線經中繼伺服器轉送，延遲會比直連高。')
  if (d.peers.some(p => p.stalled)) result.push('有連線超過 3 秒沒有回應，可能正在斷線。')
  if (d.peers.some(p => (p.jitter ?? 0) > 30)) result.push('延遲忽高忽低（抖動大），常見於 Wi-Fi 訊號不穩或網路壅塞。')
  if (!d.isHost && d.stateAge !== null && d.stateAge > 1000) result.push('超過 1 秒沒收到房主的狀態同步。')
  return result
})
</script>

<template>
  <section class="connection-panel card-glass" aria-labelledby="connection-panel-title">
    <header class="panel-header">
      <h2 id="connection-panel-title">連線診斷</h2>
      <button type="button" class="close-btn" aria-label="關閉連線診斷" @click="emit('close')">✕</button>
    </header>

    <dl v-if="data" class="summary">
      <div>
        <dt>本機角色</dt>
        <dd>{{ data.isHost ? '房主（負責模擬）' : '玩家' }}</dd>
      </div>
      <div>
        <dt>本機 ID · 玩家數</dt>
        <dd>{{ roomStore.myPeerId?.substring(0, 8) || '—' }} · {{ roomStore.connectedPlayers.length }} 人</dd>
      </div>
      <div>
        <dt>{{ data.isHost ? '狀態送出' : '狀態接收' }}</dt>
        <dd>玩家 {{ data.gameRate.toFixed(1) }}/秒 · 建築小兵 {{ data.entityRate.toFixed(1) }}/秒</dd>
      </div>
      <div v-if="!data.isHost">
        <dt>最後同步</dt>
        <dd :class="{ warn: (data.stateAge ?? 0) > 1000 }">{{ data.stateAge === null ? '—' : `${Math.round(data.stateAge)} ms 前` }}</dd>
      </div>
    </dl>

    <p v-if="peers.length === 0" class="empty">目前沒有其他玩家連線。</p>

    <ul class="peer-list">
      <li v-for="peer in peers" :key="peer.peerId" class="peer">
        <div class="peer-head">
          <span class="peer-name">
            {{ nameOf(peer.peerId) }}
            <span v-if="peer.peerId === data?.hostId?.toUpperCase()" class="tag">房主</span>
          </span>
          <span class="quality" :class="`q-${peer.quality}`">{{ QUALITY_LABEL[peer.quality] }}</span>
        </div>
        <dl class="peer-stats">
          <div><dt>延遲</dt><dd>{{ ms(peer.rtt) }}</dd></div>
          <div><dt>平均／最高</dt><dd>{{ ms(peer.avgRtt) }}／{{ ms(peer.maxRtt) }}</dd></div>
          <div><dt>抖動</dt><dd>{{ ms(peer.jitter) }}</dd></div>
          <div><dt>連線方式</dt><dd :class="{ warn: peer.ice?.route === 'relay' }">{{ routeText(peer) }}</dd></div>
          <div v-if="peer.ice?.transportRtt != null"><dt>WebRTC 往返</dt><dd>{{ ms(peer.ice.transportRtt) }}</dd></div>
          <div v-if="peer.stalled"><dt>等待回應</dt><dd class="warn">{{ (peer.pendingMs / 1000).toFixed(1) }} 秒</dd></div>
        </dl>
      </li>
    </ul>

    <ul v-if="hints.length" class="hints">
      <li v-for="hint in hints" :key="hint">{{ hint }}</li>
    </ul>
    <p class="footnote">延遲是來回時間。60 ms 以下良好、120 ms 以下普通、250 ms 以上很差；抖動超過 30 ms 降一級。按 N 開關。</p>
  </section>
</template>

<style scoped>
.connection-panel {
  position: absolute;
  /* 避開畫面上方置中的浮動商店按鈕 */
  top: 88px;
  left: 50%;
  transform: translateX(-50%);
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100dvh - 108px);
  overflow-y: auto;
  padding: 14px 16px;
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--c-text-main);
  pointer-events: auto;
  /* 在搖桿全畫面觸控區（50）之上、傷害數字（60）之下 */
  z-index: 55;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.panel-header h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--c-secondary);
  letter-spacing: 1px;
}

.close-btn {
  inline-size: 32px;
  block-size: 32px;
  border: var(--border-glass);
  border-radius: 4px;
  background: transparent;
  color: var(--c-text-muted);
  cursor: pointer;
}

.close-btn:hover,
.close-btn:focus-visible {
  color: #fff;
  border-color: var(--c-secondary);
}

dl {
  margin: 0;
}

dt {
  color: var(--c-text-muted);
}

dd {
  margin: 0;
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.summary div,
.peer-stats div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0;
}

.summary {
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: var(--border-glass);
}

.empty {
  margin: 8px 0;
  color: var(--c-text-muted);
}

.peer-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.peer {
  padding: 8px 10px;
  border: var(--border-glass);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.peer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-weight: bold;
}

.peer-name {
  overflow-wrap: anywhere;
}

.tag {
  margin-inline-start: 6px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  background: var(--c-secondary-dark);
  color: var(--c-secondary);
}

.quality {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  white-space: nowrap;
}

.q-good { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.q-fair { background: rgba(245, 196, 81, 0.2); color: var(--c-gold); }
.q-poor { background: rgba(249, 115, 22, 0.22); color: #fdba74; }
.q-bad { background: rgba(239, 68, 68, 0.25); color: #fca5a5; }
.q-unknown { background: rgba(148, 163, 184, 0.2); color: var(--c-text-muted); }

.warn {
  color: #fca5a5;
}

.hints {
  margin: 10px 0 0;
  padding-inline-start: 18px;
  color: var(--c-gold);
}

.footnote {
  margin: 10px 0 0;
  font-size: 0.72rem;
  color: var(--c-text-muted);
}
</style>
