import { type GameState } from '../NetworkManager';
import { ProvenanceManager } from './ProvenanceManager';

/**
 * RefereeManager - 共識主權與裁判規訓 (v26.0325 證據硬化版)
 * 負責跨 P2P 節點的狀態一致性校驗，實現物理與邏輯分層規訓。
 */
export class RefereeManager {
    private static instance: RefereeManager;
    private stateHistory: Map<number, string> = new Map(); 
    private divergenceLog: Array<{frame: number, local: string, remote: string}> = [];
    private lastConsistentFrame: number = 0;
    private consecutiveDivergenceCount: number = 0;
    private readonly COLLAPSE_THRESHOLD: number = 10; // 連續 10 幀分歧則坍縮

    private constructor() {}

    public static getInstance(): RefereeManager {
        if (!RefereeManager.instance) {
            RefereeManager.instance = new RefereeManager();
        }
        return RefereeManager.instance;
    }

    /**
     * 計算分層狀態指紋 (Layered Fingerprint)
     */
    public calculateHash(state: GameState): string {
        const payload = {
            p: state.players.map((p) => ({
                i: p.id,
                v: [p.pos.x.toFixed(2), p.pos.y.toFixed(2), p.pos.z.toFixed(2)], 
                h: p.stats?.hp || 0,
                e: p.stats?.energy || 0
            })),
            f: state.frame
        };
        return btoa(JSON.stringify(payload));
    }

    /**
     * 提交本地狀態，維持因果窗口
     */
    public submitState(frame: number, hash: string) {
        this.stateHistory.set(frame, hash);
        if (this.stateHistory.size > 600) {
            const oldest = Math.min(...Array.from(this.stateHistory.keys()));
            this.stateHistory.delete(oldest);
        }
    }

    /**
     * 校驗遠端狀態
     */
    public validate(frame: number, remoteHash: string): boolean {
        const localHash = this.stateHistory.get(frame);
        if (!localHash) return true; 

        if (localHash !== remoteHash) {
            this.consecutiveDivergenceCount++;
            this.divergenceLog.push({ frame, local: localHash, remote: remoteHash });
            
            if (this.consecutiveDivergenceCount >= this.COLLAPSE_THRESHOLD) {
                console.error(`[Referee] 因果分歧突破臨界位 (@ Frame ${frame}). 執行『狀態坍縮』協議...`);
                
                // 執行數位存證
                ProvenanceManager.getInstance().recordEvent(frame, 'STATE_COLLAPSE', {
                    localHash,
                    remoteHash,
                    lastConsistentFrame: this.lastConsistentFrame
                });

                this.triggerStateCollapse(frame);
                this.consecutiveDivergenceCount = 0;
            }
            return false;
        } else {
            this.lastConsistentFrame = frame;
            this.consecutiveDivergenceCount = 0;
            return true;
        }
    }

    /**
     * 狀態坍縮：強制接受外部權威狀態並重置本地因果地板
     */
    private triggerStateCollapse(frame: number) {
        window.dispatchEvent(new CustomEvent('WEBDOTA_STATE_COLLAPSE', { 
            detail: { 
                frame, 
                rollbackTo: this.lastConsistentFrame 
            } 
        }));
    }

    public getDivergenceStats() {
        return this.divergenceLog;
    }
}
