import * as pc from 'playcanvas';
import type { ECSPlayerManager } from './ECSPlayerManager';
import { eventBus } from '../../events/EventBus';
import { PX_PER_UNIT } from '../pixelSheet';
import { viewOffset } from '../view';

/** 正交鏡頭只看方向（見 view.ts），距離只要讓近平面不切到場景 */
const CAMERA_DISTANCE = 60;
/**
 * 放大倍數 = floor(畫面高度 ÷ 這個值)（裝置像素）：720p 為 2 倍、1080p 為 3 倍；
 * 畫面高度約 19～38 個世界單位，各種螢幕看到的範圍接近
 */
const PIXELS_PER_SCALE_STEP = 360;

/**
 * 渲染管理器
 * 負責視覺同步與相機控制
 */
export class RenderManager {
    camera: pc.Entity | null = null;

    // Camera Shake
    private shakeTime: number = 0;
    private shakeIntensity: number = 0;

    // Camera Tracking
    private cameraOffset = new pc.Vec3();
    private targetPos = new pc.Vec3(0, 0, 0);
    /** 平滑跟隨中的注視點（再對齊到螢幕像素） */
    private focus = new pc.Vec3(0, 0, 0);
    private focusInitialized = false;
    private app: pc.Application;

    /** 目前的整數放大倍數（1 素材像素 = pixelScale 螢幕像素） */
    pixelScale = 1;

    private boundOnDamage: (event: any) => void;

    constructor(app: pc.Application) {
        this.app = app;
        this.boundOnDamage = this.onEntityTookDamage.bind(this);
        eventBus.on('ENTITY_TOOK_DAMAGE', this.boundOnDamage);
    }

    setCamera(camera: pc.Entity) {
        this.camera = camera;
        // 正交鏡頭：遠近大小一致，面向鏡頭的像素圖才能維持整數倍放大
        camera.camera!.projection = pc.PROJECTION_ORTHOGRAPHIC;
        camera.camera!.nearClip = 1;
        camera.camera!.farClip = CAMERA_DISTANCE * 3;
        this.updateProjection();
    }

    /**
     * 依畫面高度取整數放大倍數，orthoHeight（畫面高度的一半，世界單位）讓 1 單位剛好是 PX_PER_UNIT × 倍數個裝置像素
     */
    private updateProjection(): void {
        const camera = this.camera?.camera;
        if (!camera) return;
        const height = this.app.graphicsDevice.height;
        this.pixelScale = Math.max(1, Math.floor(height / PIXELS_PER_SCALE_STEP));
        const orthoHeight = height / (2 * PX_PER_UNIT * this.pixelScale);
        if (camera.orthoHeight !== orthoHeight) camera.orthoHeight = orthoHeight;
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

        this.updateProjection();
        // 視角依本地隊伍在遊戲開始時決定，每幀讀取
        const offset = viewOffset();
        this.cameraOffset.set(offset.x, offset.y, offset.z).normalize().mulScalar(CAMERA_DISTANCE);

        // 平滑跟隨
        if (!this.focusInitialized) {
            this.focus.copy(this.targetPos);
            this.focusInitialized = true;
        } else {
            this.focus.lerp(this.focus, this.targetPos, Math.min(1, dt * 10));
        }

        // 注視點沿鏡頭的右與上方向對齊到螢幕像素，鏡頭移動時場景不會在像素之間閃爍
        const unitsPerPixel = 1 / (PX_PER_UNIT * this.pixelScale);
        const right = this.camera.right, up = this.camera.up;
        const r = this.focus.dot(right), u = this.focus.dot(up);
        const snappedR = Math.round(r / unitsPerPixel) * unitsPerPixel;
        const snappedU = Math.round(u / unitsPerPixel) * unitsPerPixel;
        const look = new pc.Vec3().copy(this.focus)
            .add(right.clone().mulScalar(snappedR - r))
            .add(up.clone().mulScalar(snappedU - u));

        // 震動效果（只在鏡頭平面上位移）
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            look.add(right.clone().mulScalar((Math.random() - 0.5) * this.shakeIntensity));
            look.add(up.clone().mulScalar((Math.random() - 0.5) * this.shakeIntensity));
            this.shakeIntensity *= 0.9;
        }

        this.camera.setPosition(look.x + this.cameraOffset.x, look.y + this.cameraOffset.y, look.z + this.cameraOffset.z);
        this.camera.lookAt(look);
    }

    destroy() {
        eventBus.off('ENTITY_TOOK_DAMAGE', this.boundOnDamage);
    }
}
