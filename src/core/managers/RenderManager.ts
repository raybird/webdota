import * as pc from 'playcanvas';
import { PlayerEntity } from '../PlayerEntity';

/**
 * 渲染管理器
 * 負責視覺同步與相機控制
 */
export class RenderManager {
    private camera: pc.Entity | null = null;

    constructor(_app: pc.Application) {
        // app is currently unused but kept in constructor for future extensibility
    }

    setCamera(camera: pc.Entity) {
        this.camera = camera;
    }

    /**
     * 同步視覺與物理
     */
    syncVisuals(players: Map<string, PlayerEntity>) {
        players.forEach(player => {
            // 1. 同步模型位置到物理剛體位置
            const pos = player.rigidBody.translation();
            const rot = player.rigidBody.rotation();

            player.entity.setPosition(pos.x, pos.y, pos.z);
            player.entity.setRotation(rot.x, rot.y, rot.z, rot.w);

            // 2. 更新 UI 位置
            player.updateUIPosition();
        });
    }

    /**
     * 更新相機跟隨
     */
    updateCamera(targetPlayerId: string, players: Map<string, PlayerEntity>) {
        if (!this.camera) return;

        const player = players.get(targetPlayerId);
        if (player) {
            const pos = player.entity.getPosition();
            // 簡單的相機跟隨：保持固定偏移
            this.camera.setPosition(pos.x, pos.y + 20, pos.z + 20);
            this.camera.lookAt(pos.x, pos.y, pos.z);
        }
    }
}
