/**
 * RenderComponent.ts - 渲染 Component
 * 關聯 PlayCanvas Entity 用於視覺呈現
 */

import * as pc from 'playcanvas';
import { type Component, ComponentType } from '../Component';

export class RenderComponent implements Component {
    readonly type = ComponentType.RENDER;

    /** PlayCanvas Entity (視覺實體) */
    pcEntity: pc.Entity;

    /** 是否需要同步 Transform */
    syncTransform: boolean = true;

    /** 血條 Entity */
    hpBarEntity: pc.Entity | null = null;
    hpBarFillEntity: pc.Entity | null = null;

    constructor(pcEntity: pc.Entity) {
        this.pcEntity = pcEntity;
    }

    /** 原始材質顏色緩存，用於恢復 Hit Flash */
    private originalEmissiveColors: Map<pc.Material, pc.Color> = new Map();
    private flashTimeout: number | null = null;

    /**
     * 受擊閃爍 (Hit Flash)
     */
    flashHit(color: pc.Color = new pc.Color(1, 1, 1, 1), durationMs: number = 80): void {
        let meshInstances: pc.MeshInstance[] = [];
        if (this.pcEntity.render) {
            meshInstances = this.pcEntity.render.meshInstances;
        } else if ((this.pcEntity as any).model && (this.pcEntity as any).model.meshInstances) {
            meshInstances = (this.pcEntity as any).model.meshInstances;
        }

        if (meshInstances.length === 0) return;

        if (this.flashTimeout !== null) {
            window.clearTimeout(this.flashTimeout);
        }

        const materials = meshInstances.map(mi => mi.material as pc.StandardMaterial).filter(Boolean);

        for (const mat of materials) {
            if (!this.originalEmissiveColors.has(mat)) {
                this.originalEmissiveColors.set(mat, mat.emissive.clone());
            }
            mat.emissive = color;
            mat.update();
        }

        this.flashTimeout = window.setTimeout(() => {
            for (const mat of materials) {
                const orig = this.originalEmissiveColors.get(mat);
                if (orig) {
                    mat.emissive = orig;
                    mat.update();
                }
            }
            this.flashTimeout = null;
        }, durationMs);
    }

    /**
     * 設定血條 UI 參考
     */
    setHpBar(hpBarEntity: pc.Entity, hpBarFillEntity: pc.Entity): void {
        this.hpBarEntity = hpBarEntity;
        this.hpBarFillEntity = hpBarFillEntity;
    }

    /**
     * 更新血條顯示
     */
    updateHpBar(hpPercent: number): void {
        if (this.hpBarFillEntity) {
            const scale = this.hpBarFillEntity.getLocalScale();
            this.hpBarFillEntity.setLocalScale(hpPercent, scale.y, scale.z);
        }
    }

    /**
     * 銷毀視覺實體
     */
    destroy(): void {
        if (this.flashTimeout !== null) {
            window.clearTimeout(this.flashTimeout);
        }
        if (this.pcEntity) {
            this.pcEntity.destroy();
        }
        if (this.hpBarEntity) {
            this.hpBarEntity.destroy();
        }
    }
}
