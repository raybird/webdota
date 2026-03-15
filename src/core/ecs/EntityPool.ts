/**
 * EntityPool.ts - 實體對象池
 * 用於複用 Entity ID，與 PoolableComponent 搭配使用
 */

import { type EntityId } from './Entity';

export class EntityPool {
    private static instance: EntityPool;
    private pools: Map<string, EntityId[]> = new Map();

    private constructor() {}

    static getInstance(): EntityPool {
        if (!this.instance) {
            this.instance = new EntityPool();
        }
        return this.instance;
    }

    /**
     * 獲取一個可用的實體 ID
     */
    acquire(templateName: string): EntityId | undefined {
        const pool = this.pools.get(templateName);
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        return undefined;
    }

    /**
     * 將實體 ID 歸還至池中
     */
    release(templateName: string, entityId: EntityId): void {
        if (!this.pools.has(templateName)) {
            this.pools.set(templateName, []);
        }
        this.pools.get(templateName)!.push(entityId);
    }

    /**
     * 清空所有池
     */
    clear(): void {
        this.pools.clear();
    }
}
