/**
 * MovementSystem.ts - 移動系統
 * 處理實體移動邏輯
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { CombatComponent } from '../components/CombatComponent';

export class MovementSystem extends System {
    readonly name = 'MovementSystem';
    readonly requiredComponents = [ComponentType.TRANSFORM, ComponentType.PHYSICS] as const;

    priority = 10; // 移動在戰鬥之前

    update(world: World, _dt: number): void {
        const entities = world.query(ComponentType.TRANSFORM, ComponentType.PHYSICS);

        for (const entityId of entities) {
            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            const physics = world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);

            if (!transform || !physics) continue;

            // 同步物理位置到 Transform
            const pos = physics.getPosition();
            transform.position.set(pos.x, pos.y, pos.z);

            const rot = physics.getRotation();
            transform.rotation.set(rot.x, rot.y, rot.z, rot.w);
        }
    }

    /**
     * 移動實體到指定方向
     * 由外部（InputSystem 或 AI）呼叫
     */
    static moveEntity(
        world: World,
        entityId: string,
        direction: { x: number; z: number },
        dt: number
    ): void {
        const physics = world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        const combat = world.getComponent<CombatComponent>(entityId, ComponentType.COMBAT);

        if (!physics) return;

        const speed = combat?.moveSpeed ?? 5.0;
        const currentPos = physics.getPosition();

        const newX = currentPos.x + direction.x * speed * dt;
        const newZ = currentPos.z + direction.z * speed * dt;

        physics.setKinematicPosition(newX, currentPos.y, newZ);

        // 更新朝向
        if (direction.x !== 0 || direction.z !== 0) {
            const angle = Math.atan2(direction.x, direction.z);
            const halfAngle = angle / 2;
            const sinHalf = Math.sin(halfAngle);
            const cosHalf = Math.cos(halfAngle);
            physics.setKinematicRotation(0, sinHalf, 0, cosHalf);
        }
    }
}
