import * as pc from 'playcanvas';
// import { PlayerEntity } from '../PlayerEntity'; // Removed

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
    /**
     * 同步視覺與物理 (Legacy - functionality moved to ECSRenderSystem)
     */
    // syncVisuals(players: Map<string, PlayerEntity>) { ... }

    /**
     * 更新相機跟隨
     */
    updateCamera() {
        if (!this.camera) return;

        // 此函數邏輯已移至 ECSRenderSystem
    }
}
