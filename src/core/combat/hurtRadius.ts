/**
 * 從單位的碰撞體讀出受擊半徑（水平方向）
 */

import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsComponent } from '../ecs/components/PhysicsComponent';

/** 沒有碰撞體時的預設值 */
const FALLBACK_RADIUS = 0.5;

export function hurtRadiusOf(physics: PhysicsComponent | undefined | null): number {
    return physics?.collider ? colliderRadius(physics.collider) : FALLBACK_RADIUS;
}

/** 碰撞體的水平半徑；方塊取較長的半邊 */
export function colliderRadius(collider: RAPIER.Collider): number {
    switch (collider.shapeType()) {
        case RAPIER.ShapeType.Ball:
        case RAPIER.ShapeType.Cylinder:
        case RAPIER.ShapeType.Capsule:
            return collider.radius();
        case RAPIER.ShapeType.Cuboid: {
            const half = collider.halfExtents();
            return Math.max(half.x, half.z);
        }
        default:
            return FALLBACK_RADIUS;
    }
}
