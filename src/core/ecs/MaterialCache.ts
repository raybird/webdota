/**
 * MaterialCache.ts - 材質快取系統
 * 避免重複建立 pc.StandardMaterial，減少 GC 壓力與 WebGL 狀態切換
 */

import * as pc from 'playcanvas';

export class MaterialCache {
    private static instance: MaterialCache;
    private cache: Map<string, pc.StandardMaterial> = new Map();

    private constructor() {}

    static getInstance(): MaterialCache {
        if (!this.instance) {
            this.instance = new MaterialCache();
        }
        return this.instance;
    }

    /**
     * 取得或建立材質
     * @param key 唯一識別符 (如 "team_red_0.8")
     * @param color 材質顏色
     * @param emissiveBrightness 發光亮度 (0-1)
     */
    getMaterial(key: string, color: pc.Color, emissiveBrightness: number = 0.2): pc.StandardMaterial {
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.emissive = new pc.Color(
            color.r * emissiveBrightness,
            color.g * emissiveBrightness,
            color.b * emissiveBrightness
        );
        material.update();

        this.cache.set(key, material);
        console.log(`[MaterialCache] Created new material: ${key}`);
        return material;
    }

    /**
     * 清空快取
     */
    clear(): void {
        this.cache.clear();
    }
}
