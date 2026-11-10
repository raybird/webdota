/**
 * 單位的移動佔位半徑（與牆、建築碰撞用，見 balance.ts 的 FOOTPRINT）
 */

import { World } from '../ecs/World';
import { ComponentType } from '../ecs/Component';
import type { AIComponent } from '../ecs/components/AIComponent';
import { FOOTPRINT } from '../../data/balance';

export function footprintOf(world: World, entityId: string): number {
    return world.getComponent<AIComponent>(entityId, ComponentType.AI)?.aiType === 'creep' ? FOOTPRINT.creep : FOOTPRINT.hero;
}
