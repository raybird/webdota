/**
 * RenderSystem.ts - 渲染同步系統
 * 同步 ECS Transform 到 PlayCanvas Entity，並更新頭頂血條
 */

import * as pc from 'playcanvas';
import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { HealthComponent } from '../components/HealthComponent';
import { SkillComponent } from '../components/SkillComponent';

export class RenderSystem extends System {
    readonly name = 'RenderSystem';
    readonly requiredComponents = [ComponentType.TRANSFORM, ComponentType.RENDER] as const;
    priority = 100; // 渲染最後執行

    /** 血條朝向攝影機（Billboard）用 */
    camera: pc.Entity | null = null;

    update(world: World, _dt: number): void {
        const cameraRotation = this.camera?.getRotation() ?? null;
        const entities = world.query(ComponentType.TRANSFORM, ComponentType.RENDER);

        for (const entityId of entities) {
            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)!;
            const render = world.getComponent<RenderComponent>(entityId, ComponentType.RENDER)!;
            const { position, rotation } = transform;

            if (render.syncTransform) {
                render.pcEntity.setPosition(position.x, position.y, position.z);
                render.pcEntity.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
            }

            if (!render.hpBarEntity) continue;
            render.hpBarEntity.setPosition(position.x, position.y + render.hpBarOffsetY, position.z);
            if (cameraRotation) render.hpBarEntity.setRotation(cameraRotation);

            const health = world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            if (health) RenderComponent.setBarPercent(render.hpBarFillEntity, health.getHpPercent());

            if (render.energyBarFillEntity) {
                const skill = world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
                if (skill) RenderComponent.setBarPercent(render.energyBarFillEntity, skill.currentEnergy / skill.maxEnergy);
            }
        }
    }
}
