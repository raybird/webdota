/**
 * HealthSystem.ts - 生命值系統
 * 處理死亡判定與狀態更新
 */

import { StatusSystem } from './StatusSystem';
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

            // 玩家陣亡不移除，由 ECSPlayerManager 處理隱藏與重生
            if (health.isDead() && !world.hasComponent(entityId, ComponentType.PLAYER_INPUT)) {
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
     * 套用權威端（Host）的血量
     * 血量下降時與 dealDamage 一樣觸發傷害數字與受擊閃白，讓 Client 也看得到所有傷害
     */
    static syncHp(world: World, targetId: string, hp: number): void {
        const health = world.getComponent<HealthComponent>(targetId, ComponentType.HEALTH);
        if (!health || health.currentHp === hp) return;

        const damage = health.currentHp - hp;
        health.currentHp = hp;
        if (damage <= 0) return;

        eventBus.emit({ type: 'ENTITY_TOOK_DAMAGE', targetId, damage, isCrit: false });
        world.getComponent<RenderComponent>(targetId, ComponentType.RENDER)?.flashHit();
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
        if (!health || health.isDead()) return 0;
        if (StatusSystem.has(world, targetId, 'invincible')) return 0;

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
