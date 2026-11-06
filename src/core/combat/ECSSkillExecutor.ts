/**
 * ECSSkillExecutor.ts - ECS 版技能執行器
 * 使用 CollisionSystem 取代 HitboxManager
 */

import * as pc from 'playcanvas';
import { World } from '../ecs/World';
import { ComponentType } from '../ecs/Component';
import { PhysicsComponent } from '../ecs/components/PhysicsComponent';
import { TeamComponent } from '../ecs/components/TeamComponent';
import { CombatComponent } from '../ecs/components/CombatComponent';
import { CollisionSystem } from '../ecs/systems/CollisionSystem';
import { EffectManager } from '../EffectManager';
import { ProjectileManager } from './ProjectileManager';
import type { SoundManager } from '../SoundManager';
import type { Skill } from '../../types/Skill';

/**
 * ECS 版技能執行器
 */
export class ECSSkillExecutor {
    private collisionSystem: CollisionSystem;

    constructor(collisionSystem: CollisionSystem) {
        this.collisionSystem = collisionSystem;
    }

    /**
     * 執行技能
     */
    executeSkill(
        skill: Skill,
        casterId: string,
        direction: pc.Vec3,
        world: World,
        effectManager: EffectManager,
        projectileManager?: ProjectileManager,
        soundManager?: SoundManager
    ): void {
        const physics = world.getComponent<PhysicsComponent>(casterId, ComponentType.PHYSICS);
        const team = world.getComponent<TeamComponent>(casterId, ComponentType.TEAM);

        if (!physics || !team) {
            console.warn(`[ECSSkillExecutor] Caster ${casterId} missing physics or team component`);
            return;
        }

        const casterPos = physics.getPosition();

        // 裝備攻擊力加到技能傷害上，之後的判定與投射物都用這份
        const bonusDamage = world.getComponent<CombatComponent>(casterId, ComponentType.COMBAT)?.bonusDamage ?? 0;
        if (bonusDamage > 0) skill = { ...skill, damage: skill.damage + bonusDamage };

        // 0. 播放技能音效
        if (soundManager) {
            soundManager.playSkillSound(skill.id);
        }

        // 1. 播放特效
        effectManager.playSkillEffect(
            skill.id,
            new pc.Vec3(casterPos.x, casterPos.y, casterPos.z),
            direction
        );

        // 2. 處理位移技能
        if (skill.dashDistance && skill.dashDistance > 0) {
            this.handleDash(skill, physics, direction);
        } else if (skill.teleport) {
            this.handleTeleport(skill, physics, direction);
        }

        // 3. 處理投射物或傷害
        if (skill.projectile && projectileManager) {
            const startPos = new pc.Vec3(casterPos.x, casterPos.y, casterPos.z);
            startPos.add(direction.clone().mulScalar(1.0));
            projectileManager.createProjectile(casterId, team.team, skill, startPos, direction);
        } else if (skill.delay && skill.delay > 0) {
            this.handleDelayedHitbox(skill, casterId, casterPos, direction, team.team);
        } else {
            // 立即造成傷害
            this.createInstantHitbox(skill, casterId, casterPos, direction, team.team);
        }
    }

    /**
     * 處理衝刺
     */
    private handleDash(skill: Skill, physics: PhysicsComponent, direction: pc.Vec3): void {
        const dashDistance = skill.dashDistance || 5;
        const currentPos = physics.getPosition();
        const targetX = currentPos.x + direction.x * dashDistance;
        const targetZ = currentPos.z + direction.z * dashDistance;

        physics.setKinematicPosition(targetX, currentPos.y, targetZ);
    }

    /**
     * 處理瞬移
     */
    private handleTeleport(skill: Skill, physics: PhysicsComponent, direction: pc.Vec3): void {
        const range = skill.range || 6;
        const currentPos = physics.getPosition();
        const targetX = currentPos.x + direction.x * range;
        const targetZ = currentPos.z + direction.z * range;

        physics.setKinematicPosition(targetX, currentPos.y, targetZ);
    }

    /**
     * 處理延遲傷害
     */
    private handleDelayedHitbox(
        skill: Skill,
        casterId: string,
        origin: { x: number; y: number; z: number },
        direction: pc.Vec3,
        team: 'red' | 'blue' | 'neutral'
    ): void {
        const delay = skill.delay || 1.0;
        const targetX = origin.x + direction.x * 3.0;
        const targetZ = origin.z + direction.z * (skill.id === 'mage_r' ? 7.0 : 3.0);

        this.collisionSystem.scheduleHitbox(
            delay,
            { x: targetX, y: origin.y, z: targetZ },
            skill.aoe || 3.0,
            skill.damage,
            { x: direction.x * (skill.knockback || 0), z: direction.z * (skill.knockback || 0) },
            casterId,
            team,
            0.2
        );
    }

    /**
     * 創建立即判定
     */
    private createInstantHitbox(
        skill: Skill,
        casterId: string,
        origin: { x: number; y: number; z: number },
        direction: pc.Vec3,
        team: 'red' | 'blue' | 'neutral'
    ): void {
        // 往前偏移
        const hitboxX = origin.x + direction.x * 1.0;
        const hitboxZ = origin.z + direction.z * 1.0;

        const radius = skill.aoe || (skill.range ? skill.range * 0.75 : 1.5);

        this.collisionSystem.createHitbox(
            { x: hitboxX, y: origin.y, z: hitboxZ },
            radius,
            skill.damage,
            { x: direction.x * (skill.knockback || 0), z: direction.z * (skill.knockback || 0) },
            casterId,
            team,
            0.2
        );
    }
}
