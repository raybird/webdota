/**
 * PhysicsComponent.ts - 物理 Component
 * 封裝 Rapier RigidBody 與 Collider
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { type Component, ComponentType } from '../Component';
import { colliderRegistry } from '../ColliderMetadata';

export class PhysicsComponent implements Component {
    readonly type = ComponentType.PHYSICS;

    /** Rapier RigidBody */
    rigidBody: RAPIER.RigidBody;

    /** 主要 Collider */
    collider: RAPIER.Collider | null = null;

    /** 被擊退的次數：Host 累加並隨 GAME_STATE 同步，Client 看到變化就把自己的英雄拉到 Host 的位置 */
    forcedMoves = 0;

    /** Sensor Collider（用於攻擊判定） */
    sensorCollider: RAPIER.Collider | null = null;

    /** Physics World 參考（用於清理） */
    private physicsWorld: RAPIER.World;

    constructor(rigidBody: RAPIER.RigidBody, physicsWorld: RAPIER.World) {
        this.rigidBody = rigidBody;
        this.physicsWorld = physicsWorld;
    }

    /**
     * 設定主要 Collider
     */
    setCollider(collider: RAPIER.Collider): void {
        this.collider = collider;
    }

    /**
     * 設定 Sensor Collider（攻擊判定用）
     */
    setSensorCollider(collider: RAPIER.Collider): void {
        this.sensorCollider = collider;
    }

    /**
     * 取得當前位置
     */
    getPosition(): { x: number; y: number; z: number } {
        return this.rigidBody.translation();
    }

    /**
     * 取得當前旋轉
     */
    getRotation(): { x: number; y: number; z: number; w: number } {
        return this.rigidBody.rotation();
    }

    /**
     * 設定 Kinematic 位置
     */
    setKinematicPosition(x: number, y: number, z: number): void {
        this.rigidBody.setNextKinematicTranslation({ x, y, z });
    }

    /** 立即移到指定位置（擊退）：同一幀之後讀到的位置與廣播出去的位置都已經是新位置 */
    teleport(x: number, y: number, z: number): void {
        this.rigidBody.setTranslation({ x, y, z }, true);
        this.rigidBody.setNextKinematicTranslation({ x, y, z });
    }

    /**
     * 設定 Kinematic 旋轉
     */
    setKinematicRotation(x: number, y: number, z: number, w: number): void {
        this.rigidBody.setNextKinematicRotation({ x, y, z, w });
    }

    /**
     * 銷毀物理實體
     */
    dispose(): void {
        if (this.collider) colliderRegistry.remove(this.collider.handle);
        if (this.sensorCollider) colliderRegistry.remove(this.sensorCollider.handle);
        // removeRigidBody 會一併移除掛在上面的 Collider
        this.physicsWorld.removeRigidBody(this.rigidBody);
    }
}
