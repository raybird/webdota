/**
 * ECSSkillExecutor.ts - ECS 版技能執行器
 * 使用 CollisionSystem 取代 HitboxManager
 */

import * as pc from 'playcanvas';
import { moveWithCollision, teleportDestination } from '../map/MapCollision';
import { FOOTPRINT } from '../../data/balance';
import { World } from '../ecs/World';
import { ComponentType } from '../ecs/Component';
import { PhysicsComponent } from '../ecs/components/PhysicsComponent';
import { TeamComponent } from '../ecs/components/TeamComponent';
import { CombatComponent } from '../ecs/components/CombatComponent';
import { CollisionSystem } from '../ecs/systems/CollisionSystem';
import { StatusComponent, type StatusKind } from '../ecs/components/StatusComponent';
import type { HitStatus } from '../ecs/ColliderMetadata';
import { EffectManager } from '../EffectManager';
import { ProjectileManager } from './ProjectileManager';
import type { SoundManager } from '../SoundManager';
import type { Skill } from '../../types/Skill';
import { instantHitboxCenter, instantHitboxRadius } from './skillGeometry';

/** 施放時加在自己身上的狀態；其餘 effect（如緩速）在命中時加在目標身上 */
const SELF_STATUS: ReadonlySet<StatusKind> = new Set(['invincible', 'invisible']);

/** 技能命中時對目標施加的狀態 */
function hitStatusOf(skill: Skill): HitStatus | undefined {
    return skill.effect === 'slow' ? { kind: 'slow', duration: skill.duration ?? 2, value: skill.effectValue } : undefined;
}

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

        // 裝備攻擊力加到技能傷害上、再乘等級倍率，之後的判定與投射物都用這份
        const combat = world.getComponent<CombatComponent>(casterId, ComponentType.COMBAT);
        const damage = scaledDamage(skill.damage, combat?.bonusDamage ?? 0, combat?.damageMultiplier ?? 1);
        if (damage !== skill.damage) skill = { ...skill, damage };

        // 0. 播放技能音效
        if (soundManager) {
            soundManager.playSkillSound(skill.id);
        }

        // 1. 播放特效
        effectManager.playSkillEffect(skill, casterPos, direction, () => physics.getPosition());

        // 狀態只由 Host 施加，再隨 GAME_STATE 同步
        if (this.collisionSystem.authoritative) this.applyCasterStatus(skill, casterId, world);

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
     * 自身增益（無敵、隱身）；放出有傷害的技能會解除隱身
     */
    private applyCasterStatus(skill: Skill, casterId: string, world: World): void {
        const status = world.getComponent<StatusComponent>(casterId, ComponentType.STATUS);
        if (!status) return;
        if (skill.damage > 0) status.remove('invisible');
        if (skill.effect && SELF_STATUS.has(skill.effect as StatusKind)) {
            status.apply(skill.effect as StatusKind, skill.duration ?? 2, skill.effectValue);
        }
    }

    /**
     * 處理衝刺
     */
    private handleDash(skill: Skill, physics: PhysicsComponent, direction: pc.Vec3): void {
        const dashDistance = skill.dashDistance || 5;
        const currentPos = physics.getPosition();
        // 衝刺途中撞牆就停在牆邊（沿牆滑動）
        const next = moveWithCollision(
            currentPos,
            { x: currentPos.x + direction.x * dashDistance, z: currentPos.z + direction.z * dashDistance },
            FOOTPRINT.hero
        );

        physics.setKinematicPosition(next.x, currentPos.y, next.z);
    }

    /**
     * 處理瞬移
     */
    private handleTeleport(skill: Skill, physics: PhysicsComponent, direction: pc.Vec3): void {
        const range = skill.range || 6;
        const currentPos = physics.getPosition();
        // 瞬移可以越過薄牆；落點在障礙物裡時推到旁邊，推不出來（例如落進封閉區）就改成走過去、停在牆邊
        const next = teleportDestination(
            currentPos,
            { x: currentPos.x + direction.x * range, z: currentPos.z + direction.z * range },
            FOOTPRINT.hero
        );

        physics.setKinematicPosition(next.x, currentPos.y, next.z);
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
        const distance = skill.targetDistance ?? 3.0;
        const targetX = origin.x + direction.x * distance;
        const targetZ = origin.z + direction.z * distance;

        this.collisionSystem.scheduleHitbox(
            delay,
            { x: targetX, y: origin.y, z: targetZ },
            skill.aoe || 3.0,
            skill.damage,
            { x: direction.x * (skill.knockback || 0), z: direction.z * (skill.knockback || 0) },
            casterId,
            team,
            0.2,
            hitStatusOf(skill)
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
        const center = instantHitboxCenter(skill, origin, direction);
        const radius = instantHitboxRadius(skill);
        const knockback = skill.knockback || 0;
        // 以自身為中心的技能把敵人往外推；前方判定沿面向推
        const self = skill.hitOrigin === 'self';

        this.collisionSystem.createHitbox(
            center,
            radius,
            skill.damage,
            self ? { x: 0, z: 0 } : { x: direction.x * knockback, z: direction.z * knockback },
            casterId,
            team,
            0.2,
            hitStatusOf(skill),
            self ? knockback : 0
        );
    }
}

/** 技能傷害：(基礎 + 裝備攻擊力) × 等級倍率；沒有傷害的技能維持 0 */
export function scaledDamage(base: number, bonus: number, multiplier: number): number {
    if (base <= 0) return base;
    return Math.round((base + bonus) * multiplier);
}
