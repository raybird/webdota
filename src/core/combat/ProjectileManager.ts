import * as pc from 'playcanvas';
import { HitboxManager } from './HitboxManager';
import type { Skill } from './SkillManager';
import type { PlayerEntity } from '../PlayerEntity';

/**
 * 投射物介面
 */
interface Projectile {
    id: string;
    ownerId: string;
    skill: Skill;
    position: pc.Vec3;
    direction: pc.Vec3;
    speed: number;
    maxRange: number;
    traveledDistance: number;
    entity: pc.Entity | null; // 視覺實體（可選）
}

/**
 * 投射物管理器
 * 負責管理所有活躍投射物的移動、碰撞檢測和生命週期
 */
export class ProjectileManager {
    private app: pc.Application;
    private projectiles: Map<string, Projectile> = new Map();
    private nextId: number = 0;
    /** 材質快取 (使用顏色 hex 作為 key) */
    private materialCache: Map<string, pc.StandardMaterial> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
    }

    /**
     * 創建新的投射物
     */
    createProjectile(
        ownerId: string,
        skill: Skill,
        startPosition: pc.Vec3,
        direction: pc.Vec3
    ): string {
        const id = `proj_${this.nextId++}`;

        // 標準化方向向量
        const normalizedDir = direction.clone().normalize();

        // 創建視覺實體
        const entity = this.createVisualEntity(skill, startPosition);

        const projectile: Projectile = {
            id,
            ownerId,
            skill,
            position: startPosition.clone(),
            direction: normalizedDir,
            speed: skill.projectileSpeed || 15,
            maxRange: skill.range || 10,
            traveledDistance: 0,
            entity
        };

        this.projectiles.set(id, projectile);
        console.log(`[ProjectileManager] Created projectile ${id} for skill ${skill.name}`);

        return id;
    }

    /**
     * 創建投射物的視覺實體
     */
    private createVisualEntity(skill: Skill, position: pc.Vec3): pc.Entity | null {
        const entity = new pc.Entity(`Projectile_${skill.id}`);

        // 根據技能類型設置外觀
        let color = new pc.Color(1, 0.5, 0); // 預設橙色 (火球)
        let scale = 0.3;

        if (skill.id.includes('mage_q')) {
            color = new pc.Color(1, 0.3, 0); // 火球紅橙
        } else if (skill.id.includes('ice') || skill.id.includes('frost')) {
            color = new pc.Color(0.5, 0.8, 1); // 冰藍色
        }

        // 創建球形 Mesh
        entity.addComponent('render', {
            type: 'sphere',
            material: this.createGlowMaterial(color)
        });

        entity.setLocalScale(scale, scale, scale);
        entity.setPosition(position);

        this.app.root.addChild(entity);
        return entity;
    }

    /**
     * 創建發光材質 (使用快取)
     */
    private createGlowMaterial(color: pc.Color): pc.StandardMaterial {
        // 使用顏色的 hex 值作為 key
        const colorKey = `${color.r.toFixed(2)}_${color.g.toFixed(2)}_${color.b.toFixed(2)}`;

        // 檢查快取中是否已有此材質
        const cachedMaterial = this.materialCache.get(colorKey);
        if (cachedMaterial) {
            return cachedMaterial;
        }

        // 建立新材質並存入快取
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.emissive = color;
        material.emissiveIntensity = 2;
        material.useLighting = false;
        material.update();

        this.materialCache.set(colorKey, material);
        return material;
    }

    /**
     * 更新所有投射物（每幀呼叫）
     */
    update(dt: number, hitboxManager: HitboxManager, players: Map<string, PlayerEntity>): void {
        const toRemove: string[] = [];

        this.projectiles.forEach((proj, id) => {
            // 計算移動距離
            const moveDistance = proj.speed * dt;
            const movement = proj.direction.clone().mulScalar(moveDistance);

            // 更新位置
            proj.position.add(movement);
            proj.traveledDistance += moveDistance;

            // 更新視覺實體位置
            if (proj.entity) {
                proj.entity.setPosition(proj.position);
            }

            // 檢查是否超過最大距離
            if (proj.traveledDistance >= proj.maxRange) {
                this.onProjectileExpire(proj, hitboxManager);
                toRemove.push(id);
                return;
            }

            // 檢查碰撞（簡化版：檢查與玩家的距離）
            const hitTarget = this.checkCollision(proj, players);
            if (hitTarget) {
                this.onProjectileHit(proj, hitTarget, hitboxManager);
                toRemove.push(id);
                return;
            }
        });

        // 移除已結束的投射物
        toRemove.forEach(id => this.removeProjectile(id));
    }

    /**
     * 檢查投射物碰撞
     */
    private checkCollision(proj: Projectile, players: Map<string, PlayerEntity>): string | null {
        const hitRadius = 0.8; // 投射物碰撞半徑

        for (const [playerId, player] of players) {
            // 不打自己
            if (playerId === proj.ownerId) continue;

            const playerPos = player.getPosition();
            const distance = proj.position.distance(playerPos);

            if (distance < hitRadius + 0.5) { // 玩家半徑約 0.5
                return playerId;
            }
        }

        return null;
    }

    /**
     * 投射物命中目標
     */
    private onProjectileHit(proj: Projectile, targetId: string, hitboxManager: HitboxManager): void {
        console.log(`[ProjectileManager] Projectile ${proj.id} hit ${targetId}`);

        // 在命中位置創建傷害判定
        hitboxManager.createHitbox(
            proj.position,
            proj.skill.aoe || 1.0,
            proj.skill.damage,
            proj.direction.clone().mulScalar(proj.skill.knockback || 0),
            proj.ownerId,
            0.1
        );

        // 移除視覺實體
        this.destroyVisualEntity(proj);
    }

    /**
     * 投射物到達最大距離（爆炸）
     */
    private onProjectileExpire(proj: Projectile, hitboxManager: HitboxManager): void {
        console.log(`[ProjectileManager] Projectile ${proj.id} expired at max range`);

        // 在終點創建 AOE 傷害（如果有 AOE 屬性）
        if (proj.skill.aoe && proj.skill.aoe > 0) {
            hitboxManager.createHitbox(
                proj.position,
                proj.skill.aoe,
                proj.skill.damage,
                proj.direction.clone().mulScalar(proj.skill.knockback || 0),
                proj.ownerId,
                0.2
            );
        }

        // 移除視覺實體
        this.destroyVisualEntity(proj);
    }

    /**
     * 銷毀投射物視覺實體
     */
    private destroyVisualEntity(proj: Projectile): void {
        if (proj.entity) {
            proj.entity.destroy();
            proj.entity = null;
        }
    }

    /**
     * 移除投射物
     */
    private removeProjectile(id: string): void {
        const proj = this.projectiles.get(id);
        if (proj) {
            this.destroyVisualEntity(proj);
            this.projectiles.delete(id);
        }
    }

    /**
     * 清除所有投射物
     */
    clearAll(): void {
        this.projectiles.forEach(proj => this.destroyVisualEntity(proj));
        this.projectiles.clear();
    }
}
