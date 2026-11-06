import * as pc from 'playcanvas';
import { CollisionSystem } from '../ecs/systems/CollisionSystem';
import { World } from '../ecs/World';
import { ComponentType } from '../ecs/Component';
import type { TransformComponent } from '../ecs/components/TransformComponent';
import type { HealthComponent } from '../ecs/components/HealthComponent';
import type { TeamComponent, Team } from '../ecs/components/TeamComponent';
import type { Skill } from '../../types/Skill';

/** 投射物碰撞半徑 + 實體半徑 */
const HIT_DISTANCE = 0.8 + 0.5;

interface Projectile {
    ownerId: string;
    team: Team;
    skill: Skill;
    position: pc.Vec3;
    direction: pc.Vec3;
    speed: number;
    maxRange: number;
    traveledDistance: number;
    entity: pc.Entity;
}

/**
 * 投射物管理器
 * 負責管理所有活躍投射物的移動、碰撞檢測和生命週期
 */
export class ProjectileManager {
    private app: pc.Application;
    private projectiles: Projectile[] = [];

    /** 材質快取 (使用顏色作為 key) */
    private materialCache: Map<string, pc.StandardMaterial> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
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
            entity: this.createVisualEntity(skill, startPosition)
        });
    }

    private createVisualEntity(skill: Skill, position: pc.Vec3): pc.Entity {
        const entity = new pc.Entity(`Projectile_${skill.id}`);

        const color = skill.id.includes('ice') || skill.id.includes('frost')
            ? new pc.Color(0.5, 0.8, 1)  // 冰藍色
            : new pc.Color(1, 0.4, 0);   // 火球橙色

        entity.addComponent('render', {
            type: 'sphere',
            material: this.getGlowMaterial(color)
        });
        entity.setLocalScale(0.3, 0.3, 0.3);
        entity.setPosition(position);

        this.app.root.addChild(entity);
        return entity;
    }

    private getGlowMaterial(color: pc.Color): pc.StandardMaterial {
        const colorKey = `${color.r.toFixed(2)}_${color.g.toFixed(2)}_${color.b.toFixed(2)}`;
        let material = this.materialCache.get(colorKey);
        if (!material) {
            material = new pc.StandardMaterial();
            material.diffuse = color;
            material.emissive = color;
            material.emissiveIntensity = 2;
            material.useLighting = false;
            material.update();
            this.materialCache.set(colorKey, material);
        }
        return material;
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
            proj.entity.setPosition(proj.position);

            if (proj.traveledDistance >= proj.maxRange) {
                // 到達最大距離：有 AOE 的技能在終點爆炸
                if (proj.skill.aoe && proj.skill.aoe > 0) {
                    this.explode(proj, collisionSystem, proj.skill.aoe, 0.2);
                }
                proj.entity.destroy();
                return false;
            }

            if (this.hitsEnemy(proj, world, targets)) {
                this.explode(proj, collisionSystem, proj.skill.aoe || 1.0, 0.1);
                proj.entity.destroy();
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
            if (proj.position.distance(transform.position) < HIT_DISTANCE) return true;
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

    clearAll(): void {
        this.projectiles.forEach(proj => proj.entity.destroy());
        this.projectiles = [];
    }
}
