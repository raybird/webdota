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

        // 使用大寫 ID 查找玩家
        const player = players.get(targetPlayerId.toUpperCase());
        if (player) {
            const pos = player.entity.getPosition();
            // 基礎相機設定
            let targetHeight = 25;
            let targetDistance = 15;

            // RWD 調整：偵測螢幕長寬比
            const aspectRatio = window.innerWidth / window.innerHeight;

            // 如果是直式螢幕 (或接近方形)，拉高相機以增加水平視野
            if (aspectRatio < 1.0) {
                // 簡單的反比公式：螢幕越窄，相機越高
                // 例如 Aspect Ratio 0.5 (9:16) -> Factor 2.0 -> Height 50
                const factor = 1.0 / aspectRatio;
                targetHeight *= factor;
                targetDistance *= factor;

                // 限制最大高度，避免過遠
                targetHeight = Math.min(targetHeight, 60);
                targetDistance = Math.min(targetDistance, 35);
            }

            // 更新相機位置
            this.camera.setPosition(pos.x, pos.y + targetHeight, pos.z + targetDistance);
            this.camera.lookAt(pos.x, pos.y, pos.z);
        }
    }
}
