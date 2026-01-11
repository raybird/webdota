/**
 * ColliderMetadata.ts - Collider 元資料管理
 * 用於關聯 Rapier Collider Handle 與遊戲邏輯資料
 */

import type { Team } from './components/TeamComponent';

/**
 * Collider 類型
 */
export type ColliderType = 'entity' | 'hitbox' | 'sensor';

/**
 * Collider 元資料
 */
export interface ColliderMetadata {
    /** Collider 類型 */
    type: ColliderType;

    /** 關聯的 Entity ID */
    entityId: string;

    /** 所屬隊伍 */
    team: Team;

    /** 如果是 Hitbox，傷害值 */
    damage?: number;

    /** 如果是 Hitbox，擊退力道 */
    knockback?: { x: number; z: number };

    /** 如果是 Hitbox，已命中的目標 */
    hitTargets?: Set<string>;

    /** Hitbox 持續時間 */
    duration?: number;
}

/**
 * Collider 元資料註冊表
 * 使用 Collider Handle 作為 Key
 */
export class ColliderRegistry {
    private metadata: Map<number, ColliderMetadata> = new Map();

    /**
     * 註冊 Collider 元資料
     */
    register(handle: number, metadata: ColliderMetadata): void {
        this.metadata.set(handle, metadata);
    }

    /**
     * 取得 Collider 元資料
     */
    get(handle: number): ColliderMetadata | undefined {
        return this.metadata.get(handle);
    }

    /**
     * 移除 Collider 元資料
     */
    remove(handle: number): void {
        this.metadata.delete(handle);
    }

    /**
     * 檢查是否存在
     */
    has(handle: number): boolean {
        return this.metadata.has(handle);
    }

    /**
     * 取得所有 Hitbox 類型的 metadata
     */
    getAllHitboxes(): Array<{ handle: number; metadata: ColliderMetadata }> {
        const result: Array<{ handle: number; metadata: ColliderMetadata }> = [];
        for (const [handle, metadata] of this.metadata) {
            if (metadata.type === 'hitbox') {
                result.push({ handle, metadata });
            }
        }
        return result;
    }

    /**
     * 清空註冊表
     */
    clear(): void {
        this.metadata.clear();
    }
}

// 全域單例（可由 World 管理）
export const colliderRegistry = new ColliderRegistry();
