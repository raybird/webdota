/**
 * TransformComponent.ts - 位置與旋轉 Component
 */

import * as pc from 'playcanvas';
import { type Component, ComponentType } from '../Component';

export class TransformComponent implements Component {
    readonly type = ComponentType.TRANSFORM;

    /** 世界座標位置 */
    position: pc.Vec3;

    /** 旋轉（四元數） */
    rotation: pc.Quat;

    /** 縮放 */
    scale: pc.Vec3;

    constructor(
        position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
        rotation: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 }
    ) {
        this.position = new pc.Vec3(position.x, position.y, position.z);
        this.rotation = new pc.Quat(rotation.x, rotation.y, rotation.z, rotation.w);
        this.scale = new pc.Vec3(scale.x, scale.y, scale.z);
    }

    /**
     * 設定位置
     */
    setPosition(x: number, y: number, z: number): void {
        this.position.set(x, y, z);
    }

    /**
     * 取得前方向量
     */
    getForward(): pc.Vec3 {
        const forward = new pc.Vec3(0, 0, 1);
        this.rotation.transformVector(forward, forward);
        return forward;
    }

    /**
     * 設定朝向角度（Y 軸旋轉）
     */
    setYaw(degrees: number): void {
        this.rotation.setFromEulerAngles(0, degrees, 0);
    }
}
