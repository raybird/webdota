/**
 * RenderComponent.ts - 渲染 Component
 * 關聯 PlayCanvas Entity 用於視覺呈現
 */

import * as pc from 'playcanvas';
import { type Component, ComponentType } from '../Component';

/** 受擊閃白時覆寫的 emissive 值 */
const FLASH_EMISSIVE = new Float32Array([1, 1, 1]);

export class RenderComponent implements Component {
    readonly type = ComponentType.RENDER;

    /** PlayCanvas Entity (視覺實體) */
    pcEntity: pc.Entity;

    /** 是否需要同步 Transform */
    syncTransform: boolean = true;

    /** 血條（由 UIManager 建立，生命週期跟著這個 Component） */
    hpBarEntity: pc.Entity | null = null;
    hpBarFillEntity: pc.Entity | null = null;
    energyBarFillEntity: pc.Entity | null = null;
    /** 血條離實體原點的高度 */
    hpBarOffsetY: number = 2;

    /** 有值時 dispose 交還視覺物件（物件池），否則直接銷毀 */
    private release: ((pcEntity: pc.Entity) => void) | null;

    private flashTimeout: number | null = null;

    constructor(pcEntity: pc.Entity, release: ((pcEntity: pc.Entity) => void) | null = null) {
        this.pcEntity = pcEntity;
        this.release = release;
    }

    /**
     * 受擊閃白
     * 材質由 MaterialCache 共用，所以只覆寫這個實體的 mesh instance 參數，不改材質本身
     */
    flashHit(durationMs: number = 80): void {
        const meshInstances = this.getMeshInstances();
        if (meshInstances.length === 0) return;

        if (this.flashTimeout !== null) window.clearTimeout(this.flashTimeout);
        for (const mi of meshInstances) mi.setParameter('material_emissive', FLASH_EMISSIVE);

        this.flashTimeout = window.setTimeout(() => {
            for (const mi of meshInstances) mi.deleteParameter('material_emissive');
            this.flashTimeout = null;
        }, durationMs);
    }

    private getMeshInstances(): pc.MeshInstance[] {
        const renders = this.pcEntity.findComponents('render') as pc.RenderComponent[];
        return renders.flatMap(r => r.meshInstances);
    }

    /**
     * 顯示或隱藏模型與頭頂血條（玩家陣亡時隱藏）
     */
    setVisible(visible: boolean): void {
        this.pcEntity.enabled = visible;
        if (this.hpBarEntity) this.hpBarEntity.enabled = visible;
    }

    setHpBar(
        bar: { hpBarEntity: pc.Entity; hpBarFillEntity: pc.Entity; energyBarFillEntity?: pc.Entity },
        offsetY: number
    ): void {
        this.hpBarEntity = bar.hpBarEntity;
        this.hpBarFillEntity = bar.hpBarFillEntity;
        this.energyBarFillEntity = bar.energyBarFillEntity ?? null;
        this.hpBarOffsetY = offsetY;
    }

    /** 填充條的 pivot 在左側，用 X 縮放表示百分比 */
    static setBarPercent(fill: pc.Entity | null, percent: number): void {
        if (!fill) return;
        const scale = fill.getLocalScale();
        const x = Math.max(0, Math.min(1, percent));
        if (scale.x !== x) fill.setLocalScale(x, scale.y, scale.z);
    }

    dispose(): void {
        if (this.flashTimeout !== null) {
            window.clearTimeout(this.flashTimeout);
            for (const mi of this.getMeshInstances()) mi.deleteParameter('material_emissive');
        }
        this.hpBarEntity?.destroy();
        if (this.release) {
            this.release(this.pcEntity);
        } else {
            this.pcEntity.destroy();
        }
    }
}
