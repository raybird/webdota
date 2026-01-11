/**
 * HealthSystem.ts - 生命值系統
 * 處理死亡判定與狀態更新
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { HealthComponent } from '../components/HealthComponent';
import { RenderComponent } from '../components/RenderComponent';

export class HealthSystem extends System {
    readonly name = 'HealthSystem';
    readonly requiredComponents = [ComponentType.HEALTH] as const;

    priority = 50; // 中等優先級

    /** 死亡回調 */
    onEntityDeath?: (entityId: string, killerId: string | null) => void;

    update(world: World, _dt: number): void {
        const entities = world.query(ComponentType.HEALTH);

        for (const entityId of entities) {
            const health = world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);

            if (!health) continue;

            // 檢查死亡
            if (health.isDead()) {
                // 觸發死亡回調
                if (this.onEntityDeath) {
                    this.onEntityDeath(entityId, health.lastAttackerId);
                }

                // 銷毀渲染組件
                const render = world.getComponent<RenderComponent>(entityId, ComponentType.RENDER);
                if (render) {
                    render.destroy();
                }

                // 標記 Entity 待刪除
                world.removeEntity(entityId);
            }
        }
    }

    /**
     * 對實體造成傷害
     */
    static dealDamage(
        world: World,
        targetId: string,
        damage: number,
        attackerId?: string
    ): number {
        const health = world.getComponent<HealthComponent>(targetId, ComponentType.HEALTH);
        if (!health) return 0;

        const actualDamage = health.takeDamage(damage, attackerId);

        console.log(`[HealthSystem] ${targetId.substring(0, 8)} took ${actualDamage} damage from ${attackerId?.substring(0, 8) || 'unknown'}. HP: ${health.currentHp}/${health.maxHp}`);

        return actualDamage;
    }
}
