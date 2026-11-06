/**
 * StatusSystem.ts - 狀態效果倒數（只在 Host 啟用，Client 的狀態由 GAME_STATE 旗標同步）
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { StatusComponent, type StatusKind } from '../components/StatusComponent';

export class StatusSystem extends System {
    readonly name = 'StatusSystem';
    readonly requiredComponents = [ComponentType.STATUS] as const;
    priority = 12; // 在技能與移動之前，讓到期的緩速不再影響這一幀

    update(world: World, dt: number): void {
        for (const entityId of world.query(ComponentType.STATUS)) {
            world.getComponent<StatusComponent>(entityId, ComponentType.STATUS)!.tick(dt);
        }
    }

    static has(world: World, entityId: string, kind: StatusKind): boolean {
        return world.getComponent<StatusComponent>(entityId, ComponentType.STATUS)?.has(kind) ?? false;
    }

    static speedMultiplier(world: World, entityId: string): number {
        return world.getComponent<StatusComponent>(entityId, ComponentType.STATUS)?.speedMultiplier ?? 1;
    }
}
