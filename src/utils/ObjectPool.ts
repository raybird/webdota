/**
 * ObjectPool.ts - 通用物件池
 * 用於複用任何 JS 物件，減少 GC 壓力
 */

export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;

    constructor(
        factory: () => T,
        reset: (obj: T) => void,
        initialSize: number = 0
    ) {
        this.factory = factory;
        this.reset = reset;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * 從池中取得物件
     */
    acquire(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    /**
     * 歸還物件至池中
     */
    release(obj: T): void {
        this.reset(obj);
        this.pool.push(obj);
    }

    /**
     * 清空池
     */
    clear(): void {
        this.pool = [];
    }
}
