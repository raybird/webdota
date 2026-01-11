/**
 * PlayerInputSystem.ts - 玩家輸入處理系統
 * 處理玩家的移動輸入與技能使用
 */

import * as pc from 'playcanvas';
import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { CombatComponent } from '../components/CombatComponent';
import { PlayerInputComponent } from '../components/PlayerInputComponent';
import { SkillComponent } from '../components/SkillComponent';
import { AnimationComponent } from '../components/AnimationComponent';

export class PlayerInputSystem extends System {
    readonly name = 'PlayerInputSystem';
    readonly requiredComponents = [ComponentType.PLAYER_INPUT, ComponentType.TRANSFORM] as const;

    priority = 5; // 最優先執行

    update(world: World, dt: number): void {
        const entities = world.query(ComponentType.PLAYER_INPUT, ComponentType.TRANSFORM);

        for (const entityId of entities) {
            const input = world.getComponent<PlayerInputComponent>(entityId, ComponentType.PLAYER_INPUT);
            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);

            if (!input || !transform) continue;

            // 處理移動
            this.processMovement(world, entityId, input, transform, dt);
        }
    }

    /**
     * 處理移動輸入
     */
    private processMovement(
        world: World,
        entityId: string,
        input: PlayerInputComponent,
        _transform: TransformComponent,
        dt: number
    ): void {
        const physics = world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        const combat = world.getComponent<CombatComponent>(entityId, ComponentType.COMBAT);

        if (!physics || !combat) return;

        const { x, z } = input.moveInput;
        if (x === 0 && z === 0) return;

        const speed = combat.moveSpeed;
        const currentPos = physics.getPosition();

        // 計算新位置
        const newX = currentPos.x + x * speed * dt;
        const newZ = currentPos.z + z * speed * dt;

        physics.setKinematicPosition(newX, currentPos.y, newZ);

        // 更新朝向
        const angle = Math.atan2(x, z);
        input.facingAngle = angle;

        // 計算四元數並設定旋轉
        const halfAngle = angle / 2;
        physics.setKinematicRotation(0, Math.sin(halfAngle), 0, Math.cos(halfAngle));
    }

    /**
     * 處理技能使用（由外部呼叫）
     */
    static useSkill(
        world: World,
        entityId: string,
        skillId: string
    ): { skill: any; direction: pc.Vec3 } | null {
        const skill = world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        const input = world.getComponent<PlayerInputComponent>(entityId, ComponentType.PLAYER_INPUT);
        const animation = world.getComponent<AnimationComponent>(entityId, ComponentType.ANIMATION);

        if (!skill || !input) return null;

        const usedSkill = skill.useSkill(skillId);
        if (!usedSkill) return null;

        // 計算方向（使用朝向角度）
        const direction = new pc.Vec3(
            Math.sin(input.facingAngle),
            0,
            Math.cos(input.facingAngle)
        );

        // 播放動畫
        if (animation && usedSkill.animation) {
            animation.play(usedSkill.animation, 0.3);
        }

        return { skill: usedSkill, direction };
    }
}
