/**
 * RenderComponent.ts - 渲染 Component
 * 關聯 PlayCanvas Entity 用於視覺呈現
 */

import * as pc from 'playcanvas';
import { type Component, ComponentType } from '../Component';

/** 受擊閃白時覆寫的 emissive 值（像素圖的 emissive 乘上貼圖，所以要大於 1 才會變白） */
const FLASH_EMISSIVE = new Float32Array([3, 3, 3]);

/** 隱身時隊友看到的不透明度 */
const STEALTH_ALLY_OPACITY = 0.4;

/** 帶這個 tag 的子實體不受閃白、色調與半透明影響（例如腳下的隊伍色圓環） */
export const NO_STATUS_FX_TAG = 'no-status-fx';

/** 隱身時的顯示方式：隊友看得到半透明，敵人完全看不到 */
export type StealthView = 'none' | 'ally' | 'enemy';

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
    private alive = true;
    private stealth: StealthView = 'none';
    /** 狀態效果的色調（覆寫 emissive）；null 為原色 */
    private tint: Float32Array | null = null;

    /** 視覺物件交還或銷毀前呼叫（釋放掛在上面的像素圖） */
    private onDispose: ((pcEntity: pc.Entity) => void) | null;

    constructor(
        pcEntity: pc.Entity,
        release: ((pcEntity: pc.Entity) => void) | null = null,
        onDispose: ((pcEntity: pc.Entity) => void) | null = null
    ) {
        this.pcEntity = pcEntity;
        this.release = release;
        this.onDispose = onDispose;
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
            this.flashTimeout = null;
            this.applyEmissive();
        }, durationMs);
    }

    /** 狀態效果色調；受擊閃白結束後會回到這個色調 */
    setTint(tint: Float32Array | null): void {
        if (this.tint === tint) return;
        this.tint = tint;
        if (this.flashTimeout === null) this.applyEmissive();
    }

    private applyEmissive(): void {
        for (const mi of this.getMeshInstances()) {
            if (this.tint) mi.setParameter('material_emissive', this.tint);
            else mi.deleteParameter('material_emissive');
        }
    }

    setStealth(view: StealthView): void {
        if (this.stealth === view) return;
        this.stealth = view;
        for (const mi of this.getMeshInstances()) {
            if (view === 'ally') mi.setParameter('material_opacity', STEALTH_ALLY_OPACITY);
            else mi.deleteParameter('material_opacity');
        }
        this.applyVisibility();
    }

    /** 敵方隱身中（看不到）時為 true */
    get hiddenByStealth(): boolean {
        return this.stealth === 'enemy';
    }

    private getMeshInstances(): pc.MeshInstance[] {
        const renders = this.pcEntity.findComponents('render') as pc.RenderComponent[];
        return renders.filter(r => !r.entity.tags.has(NO_STATUS_FX_TAG)).flatMap(r => r.meshInstances);
    }

    /**
     * 顯示或隱藏模型與頭頂血條（玩家陣亡時隱藏）
     */
    setVisible(visible: boolean): void {
        this.alive = visible;
        this.applyVisibility();
    }

    private applyVisibility(): void {
        const shown = this.alive && this.stealth !== 'enemy';
        this.pcEntity.enabled = shown;
        if (this.hpBarEntity) this.hpBarEntity.enabled = shown;
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
        if (this.flashTimeout !== null) window.clearTimeout(this.flashTimeout);
        // 物件池會重複使用視覺物件，交還前清掉這個實體的覆寫參數
        for (const mi of this.getMeshInstances()) {
            mi.deleteParameter('material_emissive');
            mi.deleteParameter('material_opacity');
        }
        this.hpBarEntity?.destroy();
        this.onDispose?.(this.pcEntity);
        if (this.release) {
            this.release(this.pcEntity);
        } else {
            this.pcEntity.destroy();
        }
    }
}
