/**
 * RenderSystem.ts - 渲染同步系統
 * 同步 ECS Transform 到 PlayCanvas Entity
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { HealthComponent } from '../components/HealthComponent';

export class RenderSystem extends System {
    readonly name = 'RenderSystem';
    readonly requiredComponents = [ComponentType.TRANSFORM, ComponentType.RENDER] as const;

    priority = 100; // 渲染最後執行

    update(world: World, _dt: number): void {
        const entities = world.query(ComponentType.TRANSFORM, ComponentType.RENDER);

        for (const entityId of entities) {
            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            const render = world.getComponent<RenderComponent>(entityId, ComponentType.RENDER);

            if (!transform || !render) continue;

            // 同步位置
            if (render.syncTransform) {
                render.pcEntity.setPosition(
                    transform.position.x,
                    transform.position.y,
                    transform.position.z
                );
                render.pcEntity.setRotation(
                    transform.rotation.x,
                    transform.rotation.y,
                    transform.rotation.z,
                    transform.rotation.w
                );
            }

            // 更新血條位置
            if (render.hpBarEntity) {
                render.hpBarEntity.setPosition(
                    transform.position.x,
                    transform.position.y + 1.5,
                    transform.position.z
                );
            }

            // 更新血條數值
            const health = world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            if (health && render.hpBarFillEntity) {
                render.updateHpBar(health.getHpPercent());
            }
        }
    }
}
