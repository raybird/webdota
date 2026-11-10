import * as pc from 'playcanvas';
import { CollisionSystem } from '../ecs/systems/CollisionSystem';
import { World } from '../ecs/World';
import { ComponentType } from '../ecs/Component';
import type { TransformComponent } from '../ecs/components/TransformComponent';
import type { HealthComponent } from '../ecs/components/HealthComponent';
import type { TeamComponent, Team } from '../ecs/components/TeamComponent';
import type { Skill } from '../../types/Skill';
import type { SpriteFxHandle, SpriteFxManager } from '../SpriteFxManager';
import type { PhysicsComponent } from '../ecs/components/PhysicsComponent';
import { projectileTouches } from './skillGeometry';
import { hurtRadiusOf } from './hurtRadius';


interface Projectile {
    ownerId: string;
    team: Team;
    skill: Skill;
    position: pc.Vec3;
    direction: pc.Vec3;
    speed: number;
    maxRange: number;
    traveledDistance: number;
    /** 飛行中的像素火球；素材還沒載入完成時為 null */
    visual: SpriteFxHandle | null;
}

/**
 * 投射物管理器
 * 負責管理所有活躍投射物的移動、碰撞檢測和生命週期
 */
export class ProjectileManager {
    private fx: SpriteFxManager;
    private projectiles: Projectile[] = [];

    constructor(fx: SpriteFxManager) {
        this.fx = fx;
    }

    createProjectile(ownerId: string, team: Team, skill: Skill, startPosition: pc.Vec3, direction: pc.Vec3): void {
        this.projectiles.push({
            ownerId,
            team,
            skill,
            position: startPosition.clone(),
            direction: direction.clone().normalize(),
            speed: skill.projectileSpeed || 15,
            maxRange: skill.range || 10,
            traveledDistance: 0,
            visual: this.fx.play('fireball', startPosition, { direction })
        });
    }

    /**
     * 更新所有投射物（每個 fixedUpdate 呼叫一次）
     */
    update(dt: number, world: World, collisionSystem: CollisionSystem): void {
        if (this.projectiles.length === 0) return;

        const targets = world.query(ComponentType.TRANSFORM, ComponentType.HEALTH, ComponentType.TEAM);

        this.projectiles = this.projectiles.filter(proj => {
            const moveDistance = proj.speed * dt;
            proj.position.x += proj.direction.x * moveDistance;
            proj.position.y += proj.direction.y * moveDistance;
            proj.position.z += proj.direction.z * moveDistance;
            proj.traveledDistance += moveDistance;
            proj.visual?.moveTo(proj.position);

            if (proj.traveledDistance >= proj.maxRange) {
                // 到達最大距離：有 AOE 的技能在終點爆炸
                if (proj.skill.aoe && proj.skill.aoe > 0) {
                    this.explode(proj, collisionSystem, proj.skill.aoe, 0.2);
                }
                this.finish(proj);
                return false;
            }

            if (this.hitsEnemy(proj, world, targets)) {
                this.explode(proj, collisionSystem, proj.skill.aoe || 1.0, 0.1);
                this.finish(proj);
                return false;
            }

            return true;
        });
    }

    private hitsEnemy(proj: Projectile, world: World, targets: string[]): boolean {
        for (const entityId of targets) {
            if (entityId === proj.ownerId) continue;

            const team = world.getComponent<TeamComponent>(entityId, ComponentType.TEAM)!;
            if (proj.team !== 'neutral' && team.team === proj.team) continue;

            const health = world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH)!;
            if (health.isDead()) continue;

            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)!;
            const radius = hurtRadiusOf(world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS));
            if (projectileTouches(proj.position, transform.position, radius)) return true;
        }
        return false;
    }

    private explode(proj: Projectile, collisionSystem: CollisionSystem, radius: number, duration: number): void {
        const knockback = proj.skill.knockback || 0;
        collisionSystem.createHitbox(
            proj.position,
            radius,
            proj.skill.damage,
            { x: proj.direction.x * knockback, z: proj.direction.z * knockback },
            proj.ownerId,
            proj.team,
            duration
        );
    }

    /** 收掉飛行特效，在投射物停下的位置播放命中爆炸 */
    private finish(proj: Projectile): void {
        proj.visual?.stop();
        this.fx.play('fireball-impact', proj.position);
    }

    clearAll(): void {
        this.projectiles.forEach(proj => proj.visual?.stop());
        this.projectiles = [];
    }
}
