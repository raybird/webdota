/**
 * CollisionSystem.ts - 碰撞系統
 * 使用 Rapier Sensor 處理攻擊判定，取代 HitboxManager
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { HealthComponent } from '../components/HealthComponent';
import type { Team } from '../components/TeamComponent';
import { colliderRegistry, type ColliderMetadata } from '../ColliderMetadata';

/**
 * 命中事件
 */
export interface HitEvent {
    targetId: string;
    attackerId: string;
    damage: number;
    knockback?: { x: number; z: number };
}

/**
 * CollisionSystem - 使用 Rapier Sensor 處理攻擊碰撞
 */
export class CollisionSystem extends System {
    readonly name = 'CollisionSystem';
    readonly requiredComponents = [ComponentType.PHYSICS] as const;

    priority = 30; // 在 Movement 之後，Combat 邏輯之前

    /** Rapier 物理世界 */
    private physicsWorld: RAPIER.World;

    /** 待處理的命中事件 */
    private pendingHits: HitEvent[] = [];

    /** 待移除的 Hitbox (handle) */
    private hitboxesToRemove: number[] = [];

    constructor(physicsWorld: RAPIER.World) {
        super();
        this.physicsWorld = physicsWorld;
    }

    /**
     * 建立技能 Hitbox Sensor
     */
    createHitbox(
        position: { x: number; y: number; z: number },
        radius: number,
        damage: number,
        knockback: { x: number; z: number },
        ownerId: string,
        ownerTeam: Team,
        duration: number = 0.2
    ): { rigidBody: RAPIER.RigidBody; collider: RAPIER.Collider } {
        // 建立 Kinematic RigidBody
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

        // 建立 Sensor Collider
        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setSensor(true)
            .setActiveCollisionTypes(
                RAPIER.ActiveCollisionTypes.DEFAULT |
                RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED |
                RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC
            );

        const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody);

        // 註冊元資料
        const metadata: ColliderMetadata = {
            type: 'hitbox',
            entityId: ownerId,
            team: ownerTeam,
            damage,
            knockback,
            hitTargets: new Set(),
            duration
        };
        colliderRegistry.register(collider.handle, metadata);

        console.log(`[CollisionSystem] Created hitbox: owner=${ownerId.substring(0, 6)}, team=${ownerTeam}, radius=${radius}`);

        return { rigidBody, collider };
    }

    /**
     * 為 Entity 註冊 Collider
     */
    registerEntityCollider(collider: RAPIER.Collider, entityId: string, team: Team): void {
        colliderRegistry.register(collider.handle, {
            type: 'entity',
            entityId,
            team
        });
    }

    update(world: World, dt: number): void {
        // 1. 更新 Hitbox 持續時間
        this.updateHitboxDurations(dt);

        // 2. 檢測 Hitbox 與 Entity 的碰撞（使用輪詢方式）
        this.checkHitboxCollisions(world);

        // 3. 移除過期的 Hitbox
        this.removeExpiredHitboxes();

        // 4. 應用命中效果
        this.applyPendingHits(world);
    }

    /**
     * 更新所有 Hitbox 的持續時間
     */
    private updateHitboxDurations(dt: number): void {
        const hitboxes = colliderRegistry.getAllHitboxes();

        for (const { handle, metadata } of hitboxes) {
            if (metadata.duration !== undefined) {
                metadata.duration -= dt;
                if (metadata.duration <= 0) {
                    this.hitboxesToRemove.push(handle);
                }
            }
        }
    }

    /**
     * 使用輪詢方式檢測 Hitbox 碰撞
     * 遍歷所有 Hitbox，使用 intersectionPair 檢查是否與其他 Collider 相交
     */
    private checkHitboxCollisions(world: World): void {
        const hitboxes = colliderRegistry.getAllHitboxes();

        for (const { handle: hitboxHandle, metadata: hitboxMeta } of hitboxes) {
            const hitboxCollider = this.physicsWorld.getCollider(hitboxHandle);
            if (!hitboxCollider) continue;

            // 遍歷所有 Entity 的 Collider
            this.physicsWorld.forEachCollider((entityCollider) => {
                const entityHandle = entityCollider.handle;

                // 跳過自己
                if (entityHandle === hitboxHandle) return true;

                const entityMeta = colliderRegistry.get(entityHandle);
                if (!entityMeta || entityMeta.type !== 'entity') return true;

                // 檢查是否相交
                if (!this.physicsWorld.intersectionPair(hitboxCollider, entityCollider)) {
                    return true;
                }

                // 檢查是否已命中過此目標
                if (hitboxMeta.hitTargets?.has(entityMeta.entityId)) return true;

                // 檢查是否為自己
                if (hitboxMeta.entityId === entityMeta.entityId) return true;

                // 檢查敵我關係
                if (hitboxMeta.team === entityMeta.team && hitboxMeta.team !== 'neutral') return true;

                // 檢查目標是否存活
                const health = world.getComponent<HealthComponent>(entityMeta.entityId, ComponentType.HEALTH);
                if (health?.isDead()) return true;

                // 標記為已命中
                hitboxMeta.hitTargets?.add(entityMeta.entityId);

                // 加入待處理命中
                this.pendingHits.push({
                    targetId: entityMeta.entityId,
                    attackerId: hitboxMeta.entityId,
                    damage: hitboxMeta.damage ?? 0,
                    knockback: hitboxMeta.knockback
                });

                console.log(`[CollisionSystem] Hit! ${hitboxMeta.entityId.substring(0, 6)} -> ${entityMeta.entityId.substring(0, 6)} (${hitboxMeta.damage})`);

                return true; // 繼續遍歷
            });
        }
    }

    /**
     * 移除過期的 Hitbox
     */
    private removeExpiredHitboxes(): void {
        for (const handle of this.hitboxesToRemove) {
            const collider = this.physicsWorld.getCollider(handle);
            if (collider) {
                const rigidBody = collider.parent();
                this.physicsWorld.removeCollider(collider, true);
                if (rigidBody) {
                    this.physicsWorld.removeRigidBody(rigidBody);
                }
            }
            colliderRegistry.remove(handle);
        }
        this.hitboxesToRemove = [];
    }

    /**
     * 應用待處理的命中效果
     */
    private applyPendingHits(world: World): void {
        for (const hit of this.pendingHits) {
            const health = world.getComponent<HealthComponent>(hit.targetId, ComponentType.HEALTH);
            if (health && !health.isDead()) {
                health.takeDamage(hit.damage, hit.attackerId);
            }

            // 擊退效果（可選）
            if (hit.knockback) {
                const physics = world.getComponent<PhysicsComponent>(hit.targetId, ComponentType.PHYSICS);
                if (physics) {
                    const pos = physics.getPosition();
                    physics.setKinematicPosition(
                        pos.x + hit.knockback.x,
                        pos.y,
                        pos.z + hit.knockback.z
                    );
                }
            }
        }
        this.pendingHits = [];
    }

    /**
     * 取得待處理的命中事件（供外部邏輯使用）
     */
    getPendingHits(): readonly HitEvent[] {
        return this.pendingHits;
    }

    destroy(_world: World): void {
        // 清理所有 Hitbox
        const hitboxes = colliderRegistry.getAllHitboxes();
        for (const { handle } of hitboxes) {
            const collider = this.physicsWorld.getCollider(handle);
            if (collider) {
                const rigidBody = collider.parent();
                this.physicsWorld.removeCollider(collider, true);
                if (rigidBody) {
                    this.physicsWorld.removeRigidBody(rigidBody);
                }
            }
        }
        colliderRegistry.clear();
    }
}
