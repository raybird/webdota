/**
 * FacingIndicator - 本地玩家腳下的面向箭頭
 *
 * 技能往角色面向的方向放出（docs/gameplay-v2/features/f3-skill-range.md），箭頭讓玩家知道會往哪裡放。
 * 地面平面與 TowerFeedback 的射程圈一樣對齊畫面（本地 +z 朝畫面下方），
 * 箭頭依面向角度畫在畫布上，畫布縱向依俯角壓縮，像素與地面貼圖同密度、不會因旋轉變形。
 * 角度量化成 DIRECTIONS 個方向，各方向的貼圖只畫一次。
 */

import * as pc from 'playcanvas';
import { PX_PER_UNIT } from './pixelSheet';
import { PITCH_SIN, screenDown, screenRight } from './view';

/** 箭頭方向的量化數 */
const DIRECTIONS = 32;
/** 平面半邊長（世界單位） */
const HALF_SIZE = 1.6;
/** 箭頭從腳下多遠開始、到多遠結束 */
const ARROW_FROM = 0.75;
const ARROW_TO = 1.5;
/** 箭頭頭部的半寬與長度 */
const HEAD_HALF_WIDTH = 0.32;
const HEAD_LENGTH = 0.38;
const Y = 0.035;
const COLOR = new pc.Color(1, 0.92, 0.75);
const OPACITY = 0.7;

export class FacingIndicator {
    private app: pc.Application;
    private entity: pc.Entity;
    private material: pc.StandardMaterial;
    private textures = new Map<number, pc.Texture>();
    private currentIndex = -1;

    constructor(app: pc.Application) {
        this.app = app;
        this.material = new pc.StandardMaterial();
        this.material.useLighting = false;
        this.material.useSkybox = false;
        this.material.useFog = false;
        this.material.diffuse = new pc.Color(0, 0, 0);
        this.material.emissive = COLOR;
        this.material.opacityMapChannel = 'a';
        this.material.opacity = OPACITY;
        this.material.blendType = pc.BLEND_NORMAL;
        this.material.depthWrite = false;
        this.material.cull = pc.CULLFACE_NONE;

        this.entity = new pc.Entity('FacingIndicator');
        this.entity.addComponent('render', { type: 'plane', material: this.material, castShadows: false, receiveShadows: false });
        this.entity.setLocalScale(HALF_SIZE * 2, 1, HALF_SIZE * 2);
        this.entity.enabled = false;
        app.root.addChild(this.entity);
    }

    /**
     * @param position 本地玩家位置；死亡或不在場上時傳 null 隱藏
     * @param direction 面向（世界座標，地面方向）
     */
    update(position: { x: number; z: number } | null, direction: { x: number; z: number } | null): void {
        if (!position || !direction || (direction.x === 0 && direction.z === 0)) {
            this.entity.enabled = false;
            return;
        }
        // 平面對齊畫面：視角在開局時才決定，每次都重算
        const down = screenDown();
        this.entity.setEulerAngles(0, (Math.atan2(down.x, down.z) * 180) / Math.PI, 0);
        this.entity.setPosition(position.x, Y, position.z);

        const index = directionIndex(direction);
        if (index !== this.currentIndex) {
            this.currentIndex = index;
            const texture = this.textureFor(index);
            this.material.emissiveMap = texture;
            this.material.opacityMap = texture;
            this.material.update();
        }
        this.entity.enabled = true;
    }

    /** 換視角（開新局）後，畫面方向不同，箭頭貼圖要重畫 */
    reset(): void {
        for (const texture of this.textures.values()) texture.destroy();
        this.textures.clear();
        this.currentIndex = -1;
        this.entity.enabled = false;
    }

    destroy(): void {
        this.reset();
        this.entity.destroy();
    }

    private textureFor(index: number): pc.Texture {
        let texture = this.textures.get(index);
        if (texture) return texture;
        const angle = (index / DIRECTIONS) * Math.PI * 2;
        const canvas = arrowCanvas({ x: Math.sin(angle), z: Math.cos(angle) });
        texture = new pc.Texture(this.app.graphicsDevice, {
            width: canvas.width, height: canvas.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
            minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE, name: 'facing-arrow'
        });
        texture.setSource(canvas);
        this.textures.set(index, texture);
        return texture;
    }
}

/** 世界方向量化成 0～DIRECTIONS-1（以 +z 為 0、往 +x 增加） */
export function directionIndex(direction: { x: number; z: number }): number {
    const angle = Math.atan2(direction.x, direction.z);
    return ((Math.round((angle / (Math.PI * 2)) * DIRECTIONS) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
}

/**
 * 畫一個指向 direction（世界方向）的箭頭。
 * 畫布 x 對應畫面右方、y 對應畫面下方；縱向每單位 PX_PER_UNIT × PITCH_SIN 像素（與地面貼圖相同）。
 * 畫布第 0 列落在平面 v=0，也就是本地 -z（畫面上方），與 TowerFeedback 的射程圈一致。
 */
function arrowCanvas(direction: { x: number; z: number }): HTMLCanvasElement {
    const width = Math.round(HALF_SIZE * 2 * PX_PER_UNIT);
    const height = Math.round(HALF_SIZE * 2 * PX_PER_UNIT * PITCH_SIN);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 世界方向換成畫面方向
    const right = screenRight();
    const down = screenDown();
    const sx = direction.x * right.x + direction.z * right.z;
    const sy = direction.x * down.x + direction.z * down.z;
    // 世界單位 → 畫布像素
    const toCanvas = (along: number, side: number) => {
        const wx = sx * along - sy * side;
        const wy = sy * along + sx * side;
        return [width / 2 + wx * PX_PER_UNIT, height / 2 + wy * PX_PER_UNIT * PITCH_SIN] as const;
    };

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    // 箭身
    ctx.beginPath();
    ctx.moveTo(...toCanvas(ARROW_FROM, 0));
    ctx.lineTo(...toCanvas(ARROW_TO - HEAD_LENGTH, 0));
    ctx.stroke();
    // 箭頭
    ctx.beginPath();
    ctx.moveTo(...toCanvas(ARROW_TO, 0));
    ctx.lineTo(...toCanvas(ARROW_TO - HEAD_LENGTH, HEAD_HALF_WIDTH));
    ctx.lineTo(...toCanvas(ARROW_TO - HEAD_LENGTH, -HEAD_HALF_WIDTH));
    ctx.closePath();
    ctx.fill();

    // 去掉抗鋸齒，只留全透明與全不透明
    const image = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < image.data.length; i += 4) {
        const on = image.data[i]! >= 100;
        image.data[i - 3] = image.data[i - 2] = image.data[i - 1] = 255;
        image.data[i] = on ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
}
