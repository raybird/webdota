import { type GameState } from '../NetworkManager';

/**
 * RefereeManager - 共識主權與裁判規訓
 * 負責跨 P2P 節點的狀態一致性校驗，偵測並標記因果分歧
 */
export class RefereeManager {
    private static instance: RefereeManager;
    private stateHistory: Map<number, string> = new Map(); // frame -> stateHash

    private constructor() {}

    public static getInstance(): RefereeManager {
        if (!RefereeManager.instance) {
            RefereeManager.instance = new RefereeManager();
        }
        return RefereeManager.instance;
    }

    /**
     * 計算遊戲狀態的物理指紋 (State Fingerprint)
     */
    public calculateHash(state: GameState): string {
        // 僅選取關鍵數據進行 Hash，優化效能
        const payload = state.players.map((p: any) => ({
            id: p.id,
            pos: p.pos,
            hp: p.stats?.hp
        }));
        // 使用簡單的字串序列化作為指紋原型
        return btoa(JSON.stringify(payload));
    }

    /**
     * 提交本地狀態至裁判席
     */
    public submitState(frame: number, hash: string) {
        this.stateHistory.set(frame, hash);
        // 保留最近 300 幀的歷史，對沖網路延遲
        if (this.stateHistory.size > 300) {
            const keys = Array.from(this.stateHistory.keys());
            const oldestFrame = Math.min(...keys);
            this.stateHistory.delete(oldestFrame);
        }
    }

    /**
     * 校驗遠端狀態是否發生因果分歧
     */
    public validate(frame: number, remoteHash: string): boolean {
        const localHash = this.stateHistory.get(frame);
        if (!localHash) return true; // 尚未同步，暫不判定
        return localHash === remoteHash;
    }
}
