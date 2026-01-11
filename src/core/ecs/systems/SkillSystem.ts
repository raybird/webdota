/**
 * SkillSystem.ts - 技能系統
 * 處理技能冷卻更新與能量回復
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { SkillComponent } from '../components/SkillComponent';
import { AnimationComponent } from '../components/AnimationComponent';

export class SkillSystem extends System {
    readonly name = 'SkillSystem';
    readonly requiredComponents = [ComponentType.SKILL] as const;

    priority = 15; // 在輸入之後，戰鬥之前

    update(world: World, dt: number): void {
        const entities = world.query(ComponentType.SKILL);

        for (const entityId of entities) {
            const skill = world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
            const animation = world.getComponent<AnimationComponent>(entityId, ComponentType.ANIMATION);

            if (skill) {
                skill.update(dt);
            }

            if (animation) {
                animation.update(dt);
            }
        }
    }
}
