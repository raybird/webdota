/**
 * HealthSystem.ts - 生命值系統
 * 處理死亡判定與狀態更新
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { HealthComponent } from '../components/HealthComponent';
import { RenderComponent } from '../components/RenderComponent';
import { eventBus } from '../../../events/EventBus';

export class HealthSystem extends System {
    readonly name = 'HealthSystem';
    readonly requiredComponents = [ComponentType.HEALTH] as const;

    priority = 50; // 中等優先級

    update(world: World, _dt: number): void {
        const entities = world.query(ComponentType.HEALTH);

        for (const entityId of entities) {
            const health = world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);

            if (!health) continue;

            // 檢查死亡
            if (health.isDead()) {
                // 發送全域死亡事件
                eventBus.emit({
                    type: 'ENTITY_DIED',
                    entityId,
                    killerId: health.lastAttackerId
                });

                // 標記 Entity 待刪除（dispose 會一併釋放物理與渲染資源）
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

        // 如果大於0的傷害，觸發受擊效果與跳字
        if (actualDamage > 0) {
            // 發送傷害事件給 DamageNumber UI
            eventBus.emit({
                type: 'ENTITY_TOOK_DAMAGE',
                targetId,
                damage: actualDamage,
                isCrit: false // 預留爆擊機制
            });

            // 觸發受擊閃爍 (Hit Flash)
            const render = world.getComponent<RenderComponent>(targetId, ComponentType.RENDER);
            render?.flashHit();
        }

        return actualDamage;
    }
}
