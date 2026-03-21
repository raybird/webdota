import { type GameState } from '../NetworkManager';

/**
 * RefereeManager - 共識主權與裁判規訓 (v26.0322 硬化版)
 * 負責跨 P2P 節點的狀態一致性校驗，實現物理與邏輯分層規訓。
 */
export class RefereeManager {
    private static instance: RefereeManager;
    private stateHistory: Map<number, string> = new Map(); 
    private divergenceLog: Array<{frame: number, local: string, remote: string}> = [];

    private constructor() {}

    public static getInstance(): RefereeManager {
        if (!RefereeManager.instance) {
            RefereeManager.instance = new RefereeManager();
        }
        return RefereeManager.instance;
    }

    /**
     * 計算分層狀態指紋 (Layered Fingerprint)
     * 物理層：位置 (x, y, z)
     * 邏輯層：血量、能量 (stats)
     */
    public calculateHash(state: GameState): string {
        const payload = {
            p: state.players.map((p) => ({
                i: p.id,
                v: [p.pos.x.toFixed(2), p.pos.y.toFixed(2), p.pos.z.toFixed(2)], // 物理層 (精度規訓)
                h: p.stats?.hp || 0, // 邏輯層
                e: p.stats?.energy || 0
            })),
            f: state.frame
        };
        // 對齊 2026 因果對焦：採用 Base64 壓縮指紋
        return btoa(JSON.stringify(payload));
    }

    /**
     * 提交本地狀態，維持因果窗口
     */
    public submitState(frame: number, hash: string) {
        this.stateHistory.set(frame, hash);
        if (this.stateHistory.size > 600) { // 擴張至 10 秒窗口 (60fps)
            const oldest = Math.min(...Array.from(this.stateHistory.keys()));
            this.stateHistory.delete(oldest);
        }
    }

    /**
     * 校驗遠端狀態並觸發自癒
     * @returns boolean 是否通過一致性檢查
     */
    public validate(frame: number, remoteHash: string): boolean {
        const localHash = this.stateHistory.get(frame);
        if (!localHash) return true; 

        if (localHash !== remoteHash) {
            this.divergenceLog.push({ frame, local: localHash, remote: remoteHash });
            console.error(`[Referee] 偵測到因果分歧 @ Frame ${frame}. 啟動主權自癒協議...`);
            this.triggerSelfHealing(frame);
            return false;
        }
        return true;
    }

    /**
     * 觸發自癒：請求重新同步或回溯至最後一個有效 Checkpoint
     */
    private triggerSelfHealing(frame: number) {
        // 預演：發出 RE_SYNC 事件至 NetworkManager
        window.dispatchEvent(new CustomEvent('WEBDOTA_RESYNC_REQUEST', { detail: { frame } }));
    }

    public getDivergenceStats() {
        return this.divergenceLog;
    }
}
