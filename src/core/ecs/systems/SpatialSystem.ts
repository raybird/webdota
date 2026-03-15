/**
 * SpatialSystem.ts - 空間分區系統
 * 使用 Spatial Hashing 優化鄰近查詢，解決 O(N^2) 性能瓶頸
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { TransformComponent } from '../components/TransformComponent';
import type { EntityId } from '../Entity';

export class SpatialSystem extends System {
    readonly name = 'SpatialSystem';
    readonly requiredComponents = [ComponentType.TRANSFORM] as const;

    priority = 10; // 在 AI 和 物理邏輯之前更新

    private gridSize = 5.0;
    private grid: Map<string, EntityId[]> = new Map();

    /**
     * 更新空間索引
     */
    update(world: World, _dt: number): void {
        this.grid.clear();
        
        const entities = world.query(ComponentType.TRANSFORM);
        
        for (const entityId of entities) {
            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            if (!transform) continue;

            const key = this.getGridKey(transform.position.x, transform.position.z);
            if (!this.grid.has(key)) {
                this.grid.set(key, []);
            }
            this.grid.get(key)!.push(entityId);
        }
    }

    /**
     * 查詢附近的 Entity
     * @param x 中心 X
     * @param z 中心 Z
     * @param radius 搜尋半徑
     */
    queryNearby(x: number, z: number, radius: number): EntityId[] {
        const results: EntityId[] = [];
        const startX = Math.floor((x - radius) / this.gridSize);
        const endX = Math.floor((x + radius) / this.gridSize);
        const startZ = Math.floor((z - radius) / this.gridSize);
        const endZ = Math.floor((z + radius) / this.gridSize);

        for (let gx = startX; gx <= endX; gx++) {
            for (let gz = startZ; gz <= endZ; gz++) {
                const key = `${gx},${gz}`;
                const cellEntities = this.grid.get(key);
                if (cellEntities) {
                    results.push(...cellEntities);
                }
            }
        }
        return results;
    }

    private getGridKey(x: number, z: number): string {
        const gx = Math.floor(x / this.gridSize);
        const gz = Math.floor(z / this.gridSize);
        return `${gx},${gz}`;
    }
}
