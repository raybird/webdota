/**
 * CombatSystem.ts - 戰鬥系統
 * 處理攻擊冷卻與戰鬥邏輯
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { CombatComponent } from '../components/CombatComponent';

export class CombatSystem extends System {
    readonly name = 'CombatSystem';
    readonly requiredComponents = [ComponentType.COMBAT] as const;

    priority = 20; // 在移動之後

    update(world: World, dt: number): void {
        const entities = world.query(ComponentType.COMBAT);

        for (const entityId of entities) {
            const combat = world.getComponent<CombatComponent>(entityId, ComponentType.COMBAT);

            if (!combat) continue;

            // 更新冷卻
            combat.update(dt);
        }
    }
}
