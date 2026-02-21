import * as pc from 'playcanvas';
import type { ECSPlayerManager } from './ECSPlayerManager';
import { eventBus } from '../../events/EventBus';

/**
 * 渲染管理器
 * 負責視覺同步與相機控制
 */
export class RenderManager {
    private camera: pc.Entity | null = null;

    // Camera Shake
    private shakeTime: number = 0;
    private shakeIntensity: number = 0;

    // Camera Tracking
    private cameraOffset = new pc.Vec3(0, 25, 30);
    private targetPos = new pc.Vec3(0, 0, 0);

    private boundOnDamage: (event: any) => void;

    constructor(_app: pc.Application) {
        this.boundOnDamage = this.onEntityTookDamage.bind(this);
        eventBus.on('ENTITY_TOOK_DAMAGE', this.boundOnDamage);
    }

    setCamera(camera: pc.Entity) {
        this.camera = camera;
    }

    private onEntityTookDamage(event: any) {
        if (event.type !== 'ENTITY_TOOK_DAMAGE') return;
        // 每當有高傷害或爆擊時震動鏡頭
        if (event.damage >= 50 || event.isCrit) {
            this.shakeCamera(0.4, 0.15);
        } else if (event.damage >= 20) {
            this.shakeCamera(0.2, 0.1);
        }
    }

    /**
     * 觸發相機震動
     */
    shakeCamera(intensity: number, duration: number = 0.2) {
        // 取最大值避免覆蓋更強的震動
        if (intensity > this.shakeIntensity) {
            this.shakeIntensity = intensity * 2;
        }
        if (duration > this.shakeTime) {
            this.shakeTime = duration;
        }
    }

    /**
     * 更新相機跟隨與震動
     */
    updateCamera(dt: number, localPlayerId: string, playerManager?: ECSPlayerManager) {
        if (!this.camera) return;

        // 追蹤本地玩家
        if (playerManager) {
            const pos = playerManager.getPlayerPosition(localPlayerId);
            if (pos) {
                this.targetPos.copy(pos);
            }
        }

        // 基礎相機位置
        const baseCamPos = new pc.Vec3().add2(this.targetPos, this.cameraOffset);

        // 震動效果
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            const offsetX = (Math.random() - 0.5) * this.shakeIntensity;
            const offsetY = (Math.random() - 0.5) * this.shakeIntensity;
            const offsetZ = (Math.random() - 0.5) * this.shakeIntensity;

            this.camera.setPosition(
                baseCamPos.x + offsetX,
                baseCamPos.y + offsetY,
                baseCamPos.z + offsetZ
            );

            this.shakeIntensity *= 0.9;
        } else {
            // 平滑跟隨
            const currentPos = this.camera.getPosition();
            const newPos = new pc.Vec3().lerp(currentPos, baseCamPos, dt * 10);
            this.camera.setPosition(newPos);
        }

        this.camera.lookAt(this.targetPos);
    }

    destroy() {
        eventBus.off('ENTITY_TOOK_DAMAGE', this.boundOnDamage);
    }
}
