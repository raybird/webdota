/**
 * World.ts - ECS 世界管理器
 * 管理所有 Entity、Component 與 System
 */

import { createEntityId, type EntityId } from './Entity';
import type { Component } from './Component';
import type { System } from './System';

/**
 * ECS World - 遊戲世界的核心容器
 */
export class World {
    /** 所有存活的 Entity */
    private entities: Set<EntityId> = new Set();

    /** Component 儲存：Map<ComponentType, Map<EntityId, Component>> */
    private components: Map<string, Map<EntityId, Component>> = new Map();

    /** 已註冊的 Systems（按 priority 排序） */
    private systems: System[] = [];

    /** 待刪除的 Entity（延遲刪除避免迭代問題） */
    private entitiesToRemove: Set<EntityId> = new Set();


    // ==================== Entity 管理 ====================

    /**
     * 建立新 Entity
     */
    createEntity(): EntityId {
        const id = createEntityId();
        this.entities.add(id);
        return id;
    }

    /**
     * 標記 Entity 為待刪除（下一幀處理）
     */
    removeEntity(entityId: EntityId): void {
        this.entitiesToRemove.add(entityId);
    }

    /**
     * 刪除 Entity 並移除其所有 Component
     */
    destroyEntity(entityId: EntityId): void {
        // 冪等：同一個 Entity 可能同時被 HealthSystem 與 Manager 要求銷毀
        if (!this.entities.has(entityId)) return;
        this.entities.delete(entityId);
        for (const componentMap of this.components.values()) {
            const component = componentMap.get(entityId);
            if (!component) continue;
            component.dispose?.();
            componentMap.delete(entityId);
        }
    }

    /**
     * 檢查 Entity 是否存在
     */
    hasEntity(entityId: EntityId): boolean {
        return this.entities.has(entityId);
    }

    /**
     * 取得所有 Entity
     */
    getAllEntities(): ReadonlySet<EntityId> {
        return this.entities;
    }

    // ==================== Component 管理 ====================

    /**
     * 為 Entity 添加 Component
     */
    addComponent<T extends Component>(entityId: EntityId, component: T): void {
        if (!this.entities.has(entityId)) {
            console.warn(`[World] Cannot add component to non-existent entity: ${entityId}`);
            return;
        }

        const type = component.type;
        if (!this.components.has(type)) {
            this.components.set(type, new Map());
        }
        this.components.get(type)!.set(entityId, component);
    }

    /**
     * 取得 Entity 的特定 Component
     */
    getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
        return this.components.get(type)?.get(entityId) as T | undefined;
    }

    /**
     * 檢查 Entity 是否有特定 Component
     */
    hasComponent(entityId: EntityId, type: string): boolean {
        return this.components.get(type)?.has(entityId) ?? false;
    }

    /**
     * 移除 Entity 的特定 Component
     */
    removeComponent(entityId: EntityId, type: string): void {
        this.components.get(type)?.delete(entityId);
    }

    /**
     * 取得所有擁有特定 Component 類型的 Entity
     */
    getEntitiesWithComponent(type: string): EntityId[] {
        const componentMap = this.components.get(type);
        if (!componentMap) return [];
        return Array.from(componentMap.keys());
    }

    /**
     * 查詢擁有所有指定 Component 類型的 Entity
     */
    query(...componentTypes: string[]): EntityId[] {
        const [firstType, ...restTypes] = componentTypes;
        if (!firstType) return Array.from(this.entities);

        const candidates = this.components.get(firstType);
        if (!candidates) return [];

        const restMaps = restTypes.map(type => this.components.get(type));
        if (restMaps.some(map => !map)) return [];

        const result: EntityId[] = [];
        for (const entityId of candidates.keys()) {
            if (restMaps.every(map => map!.has(entityId))) result.push(entityId);
        }
        return result;
    }

    // ==================== System 管理 ====================

    /**
     * 註冊 System
     */
    addSystem(system: System): void {
        this.systems.push(system);
        // 按 priority 排序
        this.systems.sort((a, b) => a.priority - b.priority);
        system.init(this);
    }

    /**
     * 移除 System
     */
    removeSystem(system: System): void {
        const index = this.systems.indexOf(system);
        if (index !== -1) {
            system.destroy(this);
            this.systems.splice(index, 1);
        }
    }

    /**
     * 取得指定名稱的 System
     */
    getSystem<T extends System>(name: string): T | undefined {
        return this.systems.find(s => s.name === name) as T | undefined;
    }

    // ==================== 主迴圈 ====================

    /**
     * 更新所有 System
     */
    update(dt: number): void {
        // 1. 處理延遲刪除的 Entity
        for (const entityId of this.entitiesToRemove) {
            this.destroyEntity(entityId);
        }
        this.entitiesToRemove.clear();

        // 2. 執行所有啟用的 System
        for (const system of this.systems) {
            if (system.enabled) {
                system.update(this, dt);
            }
        }
    }

    // ==================== 除錯工具 ====================

    /**
     * 取得 World 統計資訊
     */
    getStats(): { entityCount: number; componentCounts: Record<string, number>; systemCount: number } {
        const componentCounts: Record<string, number> = {};
        for (const [type, map] of this.components) {
            componentCounts[type] = map.size;
        }

        return {
            entityCount: this.entities.size,
            componentCounts,
            systemCount: this.systems.length,
        };
    }

    /**
     * 清空所有資料
     */
    clear(): void {
        // 先銷毀所有 Entity，讓 Component 釋放物理與渲染資源
        for (const entityId of Array.from(this.entities)) {
            this.destroyEntity(entityId);
        }

        // 銷毀所有 System
        for (const system of this.systems) {
            system.destroy(this);
        }
        this.systems = [];
        this.components.clear();
        this.entities.clear();
        this.entitiesToRemove.clear();
    }
}
