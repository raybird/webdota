/**
 * ConnectionDiagnostics - 每條 P2P 連線的品質診斷
 *
 * - 延遲：ping／pong 往返時間（RTT），保留最近 RTT_WINDOW 筆算平均與最大值
 * - 抖動：相鄰兩筆 RTT 差值的平滑平均（RFC 3550 的做法，增益 1/16）
 * - 卡住：資料通道是可靠、有序的（reliable），封包遺失會表現成重送造成的延遲尖峰，
 *   所以用「送出超過 STALL_MS 還沒回來的 ping」判斷連線卡住，不算遺失率
 * - 連線方式：從 RTCPeerConnection.getStats() 的選定 candidate pair 判斷直連（區域網路、NAT 穿透）或經中繼（TURN）
 * - 同步頻率：每秒收到（Client）或送出（Host）的 GAME_STATE、ENTITY_STATE 數
 *
 * 純資料邏輯不依賴 PeerJS，方便測試；NetworkManager 負責餵資料。
 */

export type ConnectionRoute = 'lan' | 'direct' | 'relay' | 'unknown';
export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'bad' | 'unknown';

/** 最近幾筆 RTT 用來算平均與最大值 */
const RTT_WINDOW = 20;
/** 抖動平滑增益（RFC 3550） */
const JITTER_GAIN = 1 / 16;
/** ping 超過這個時間沒回來視為連線卡住 */
export const STALL_MS = 3000;
/** 同步頻率的統計窗口 */
const RATE_WINDOW_MS = 2000;

/** 品質門檻（往返延遲，毫秒）：與 docs/architecture.md「連線診斷」一致 */
const QUALITY_RTT: Array<[number, ConnectionQuality]> = [[60, 'good'], [120, 'fair'], [250, 'poor']];
/** 抖動超過這個值時品質降一級 */
const JITTER_PENALTY_MS = 30;

export interface IceInfo {
    route: ConnectionRoute;
    localType: string | null;
    remoteType: string | null;
    protocol: string | null;
    /** WebRTC 層量到的 RTT（毫秒），比應用層 ping 少了 JS 排程的時間 */
    transportRtt: number | null;
}

export interface PeerDiagnostics {
    peerId: string;
    rtt: number | null;
    avgRtt: number | null;
    maxRtt: number | null;
    jitter: number | null;
    /** 目前最久一個還沒回來的 ping 已等多久（毫秒），沒有則為 0 */
    pendingMs: number;
    stalled: boolean;
    ice: IceInfo | null;
    quality: ConnectionQuality;
}

class PeerStats {
    rtts: number[] = [];
    jitter: number | null = null;
    pending = new Map<number, number>();
    ice: IceInfo | null = null;
}

export class ConnectionDiagnostics {
    private peers = new Map<string, PeerStats>();
    private stateEvents: Record<'game' | 'entity', number[]> = { game: [], entity: [] };
    private lastStateAt: number | null = null;

    // ==================== 延遲 ====================

    /** 送出 ping；傳回這次的序號，pong 要帶回來 */
    pingSent(peerId: string, seq: number, now: number): void {
        this.stats(peerId).pending.set(seq, now);
    }

    /** 收到 pong：記一筆 RTT，傳回 RTT；序號不認得（例如重連前送的）時傳回 null */
    pongReceived(peerId: string, seq: number, now: number): number | null {
        const stats = this.stats(peerId);
        const sentAt = stats.pending.get(seq);
        if (sentAt === undefined) return null;
        stats.pending.delete(seq);
        // 比這次更早送出的 ping 不會再回來（通道有序），一併清掉
        for (const [other, at] of stats.pending) if (at < sentAt) stats.pending.delete(other);

        const rtt = now - sentAt;
        const last = stats.rtts[stats.rtts.length - 1];
        if (last !== undefined) {
            const diff = Math.abs(rtt - last);
            stats.jitter = stats.jitter === null ? diff : stats.jitter + (diff - stats.jitter) * JITTER_GAIN;
        }
        stats.rtts.push(rtt);
        if (stats.rtts.length > RTT_WINDOW) stats.rtts.shift();
        return rtt;
    }

    setIce(peerId: string, ice: IceInfo | null): void {
        this.stats(peerId).ice = ice;
    }

    removePeer(peerId: string): void {
        this.peers.delete(peerId);
    }

    // ==================== 同步頻率 ====================

    /** 收到（Client）或送出（Host）一次狀態同步 */
    stateMessage(kind: 'game' | 'entity', now: number): void {
        const events = this.stateEvents[kind];
        events.push(now);
        while (events.length && events[0]! < now - RATE_WINDOW_MS) events.shift();
        this.lastStateAt = now;
    }

    /** 每秒同步次數 */
    stateRate(kind: 'game' | 'entity', now: number): number {
        const recent = this.stateEvents[kind].filter(at => at >= now - RATE_WINDOW_MS);
        return (recent.length * 1000) / RATE_WINDOW_MS;
    }

    /** 距離最後一次狀態同步多久（毫秒）；還沒有同步時為 null */
    stateAge(now: number): number | null {
        return this.lastStateAt === null ? null : now - this.lastStateAt;
    }

    // ==================== 彙整 ====================

    snapshot(now: number): PeerDiagnostics[] {
        return [...this.peers].map(([peerId, stats]) => {
            const rtts = stats.rtts;
            const rtt = rtts.length ? rtts[rtts.length - 1]! : null;
            const avgRtt = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
            const maxRtt = rtts.length ? Math.max(...rtts) : null;
            const oldest = Math.min(...stats.pending.values());
            const pendingMs = stats.pending.size ? Math.max(0, now - oldest) : 0;
            const stalled = pendingMs > STALL_MS;
            return {
                peerId, rtt, avgRtt, maxRtt, jitter: stats.jitter, pendingMs, stalled, ice: stats.ice,
                quality: rateQuality(avgRtt, stats.jitter, stalled)
            };
        });
    }

    clear(): void {
        this.peers.clear();
        this.stateEvents = { game: [], entity: [] };
        this.lastStateAt = null;
    }

    private stats(peerId: string): PeerStats {
        let stats = this.peers.get(peerId);
        if (!stats) {
            stats = new PeerStats();
            this.peers.set(peerId, stats);
        }
        return stats;
    }
}

/** 依平均延遲評等，抖動過大降一級，卡住直接為 bad */
export function rateQuality(avgRtt: number | null, jitter: number | null, stalled: boolean): ConnectionQuality {
    if (stalled) return 'bad';
    if (avgRtt === null) return 'unknown';
    const levels: ConnectionQuality[] = ['good', 'fair', 'poor', 'bad'];
    let level = QUALITY_RTT.findIndex(([limit]) => avgRtt < limit);
    if (level === -1) level = 3;
    if (jitter !== null && jitter > JITTER_PENALTY_MS) level = Math.min(3, level + 1);
    return levels[level]!;
}

/**
 * 從 RTCPeerConnection 的統計找出選定的 candidate pair，判斷連線方式
 */
export async function readIceInfo(pc: RTCPeerConnection): Promise<IceInfo | null> {
    const report = await pc.getStats();
    const byId = new Map<string, any>();
    report.forEach((stat: any) => byId.set(stat.id, stat));

    let pair: any = null;
    report.forEach((stat: any) => {
        if (stat.type === 'transport' && stat.selectedCandidatePairId) pair = byId.get(stat.selectedCandidatePairId) ?? pair;
    });
    // Firefox 沒有 transport.selectedCandidatePairId，改用 selected／nominated 旗標
    if (!pair) {
        report.forEach((stat: any) => {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && (stat.selected || stat.nominated)) pair ??= stat;
        });
    }
    if (!pair) return null;

    const local = byId.get(pair.localCandidateId);
    const remote = byId.get(pair.remoteCandidateId);
    const localType: string | null = local?.candidateType ?? null;
    const remoteType: string | null = remote?.candidateType ?? null;
    return {
        route: routeOf(localType, remoteType),
        localType,
        remoteType,
        protocol: local?.relayProtocol ?? local?.protocol ?? null,
        transportRtt: typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : null
    };
}

export function routeOf(localType: string | null, remoteType: string | null): ConnectionRoute {
    if (!localType || !remoteType) return 'unknown';
    if (localType === 'relay' || remoteType === 'relay') return 'relay';
    if (localType === 'host' && remoteType === 'host') return 'lan';
    return 'direct';
}
