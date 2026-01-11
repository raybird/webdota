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
        if (this.pcEntity) {
            this.pcEntity.destroy();
        }
        if (this.hpBarEntity) {
            this.hpBarEntity.destroy();
        }
    }
}
