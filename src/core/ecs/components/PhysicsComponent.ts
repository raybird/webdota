/**
 * PhysicsComponent.ts - 物理 Component
 * 封裝 Rapier RigidBody 與 Collider
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { type Component, ComponentType } from '../Component';

export class PhysicsComponent implements Component {
    readonly type = ComponentType.PHYSICS;

    /** Rapier RigidBody */
    rigidBody: RAPIER.RigidBody;

    /** 主要 Collider */
    collider: RAPIER.Collider | null = null;

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

    /**
     * 設定 Kinematic 旋轉
     */
    setKinematicRotation(x: number, y: number, z: number, w: number): void {
        this.rigidBody.setNextKinematicRotation({ x, y, z, w });
    }

    /**
     * 銷毀物理實體
     */
    destroy(): void {
        if (this.rigidBody) {
            this.physicsWorld.removeRigidBody(this.rigidBody);
        }
    }
}
