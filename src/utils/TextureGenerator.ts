/**
 * TextureGenerator - 程式化紋理生成器
 * 使用 Canvas API 動態生成紋理
 */
import * as pc from 'playcanvas';

export class TextureGenerator {
    private app: pc.Application;
    private textureCache: Map<string, pc.Texture> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
    }

    /**
     * 生成網格紋理 (用於石磚、地板)
     */
    generateGrid(
        name: string,
        baseColor: [number, number, number],
        lineColor: [number, number, number],
        size: number = 256,
        gridSize: number = 32
    ): pc.Texture {
        const cacheKey = `grid_${name}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey)!;
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // 填充背景色
        ctx.fillStyle = `rgb(${baseColor[0] * 255}, ${baseColor[1] * 255}, ${baseColor[2] * 255})`;
        ctx.fillRect(0, 0, size, size);

        // 繪製網格線
        ctx.strokeStyle = `rgb(${lineColor[0] * 255}, ${lineColor[1] * 255}, ${lineColor[2] * 255})`;
        ctx.lineWidth = 2;

        for (let x = 0; x <= size; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }

        for (let y = 0; y <= size; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        // 添加一些隨機噪點
        this.addNoise(ctx, size, 0.05);

        const texture = new pc.Texture(this.app.graphicsDevice, {
            width: size,
            height: size,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: true,
            addressU: pc.ADDRESS_REPEAT,
            addressV: pc.ADDRESS_REPEAT
        });

        texture.setSource(canvas);
        this.textureCache.set(cacheKey, texture);
        return texture;
    }

    /**
     * 生成噪點紋理 (用於草地、泥土)
     */
    generateNoise(
        name: string,
        baseColor: [number, number, number],
        variation: number = 0.2,
        size: number = 256
    ): pc.Texture {
        const cacheKey = `noise_${name}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey)!;
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // 填充背景色
        ctx.fillStyle = `rgb(${baseColor[0] * 255}, ${baseColor[1] * 255}, ${baseColor[2] * 255})`;
        ctx.fillRect(0, 0, size, size);

        // 添加色彩變化的噪點
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const randomFactor = 1 + (Math.random() - 0.5) * variation * 2;
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;
            data[i] = Math.min(255, Math.max(0, r * randomFactor));
            data[i + 1] = Math.min(255, Math.max(0, g * randomFactor));
            data[i + 2] = Math.min(255, Math.max(0, b * randomFactor));
        }

        ctx.putImageData(imageData, 0, 0);

        const texture = new pc.Texture(this.app.graphicsDevice, {
            width: size,
            height: size,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: true,
            addressU: pc.ADDRESS_REPEAT,
            addressV: pc.ADDRESS_REPEAT
        });

        texture.setSource(canvas);
        this.textureCache.set(cacheKey, texture);
        return texture;
    }

    /**
     * 生成簡單的顏色紋理 (純色 + 微噪)
     */
    generateSolid(
        name: string,
        color: [number, number, number],
        size: number = 64
    ): pc.Texture {
        const cacheKey = `solid_${name}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey)!;
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`;
        ctx.fillRect(0, 0, size, size);

        // 輕微噪點
        this.addNoise(ctx, size, 0.03);

        const texture = new pc.Texture(this.app.graphicsDevice, {
            width: size,
            height: size,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: true
        });

        texture.setSource(canvas);
        this.textureCache.set(cacheKey, texture);
        return texture;
    }

    /**
     * 添加噪點到 Canvas
     */
    private addNoise(ctx: CanvasRenderingContext2D, size: number, intensity: number) {
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 255 * intensity;
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;
            data[i] = Math.min(255, Math.max(0, r + noise));
            data[i + 1] = Math.min(255, Math.max(0, g + noise));
            data[i + 2] = Math.min(255, Math.max(0, b + noise));
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * 清理紋理快取
     */
    clearCache() {
        this.textureCache.forEach(texture => texture.destroy());
        this.textureCache.clear();
    }
}
