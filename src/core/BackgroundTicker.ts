/**
 * BackgroundTicker - 不受背景節流影響的計時器
 *
 * 分頁在背景、視窗被遮住或失去焦點時，瀏覽器會停掉或節流 requestAnimationFrame（PlayCanvas 的 update 跟著變慢），
 * 主執行緒的 setInterval 也會被節流到每秒一次以下；Host 的模擬一慢，所有 Client 都會跟著卡住。
 * Dedicated Worker 的計時器不受這些節流影響，所以由 Worker 定時發訊息回主執行緒，讓呼叫端判斷是否要補跑模擬。
 */

const WORKER_SOURCE =
    'let timer = null;' +
    'onmessage = (e) => {' +
    '  clearInterval(timer);' +
    '  timer = e.data > 0 ? setInterval(() => postMessage(0), e.data) : null;' +
    '};';

export class BackgroundTicker {
    private worker: Worker | null = null;
    private onTick: () => void;
    private intervalMs: number;

    constructor(onTick: () => void, intervalMs: number) {
        this.onTick = onTick;
        this.intervalMs = intervalMs;
    }

    start(): void {
        if (this.worker) return;
        try {
            const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
            this.worker = new Worker(url);
            URL.revokeObjectURL(url);
            this.worker.onmessage = () => this.onTick();
            this.worker.postMessage(this.intervalMs);
        } catch (error) {
            // 不支援 Worker（或被 CSP 擋下）時退回原本行為：只靠 requestAnimationFrame
            console.warn('[BackgroundTicker] Worker unavailable, simulation follows requestAnimationFrame only', error);
            this.worker = null;
        }
    }

    destroy(): void {
        this.worker?.terminate();
        this.worker = null;
    }
}
