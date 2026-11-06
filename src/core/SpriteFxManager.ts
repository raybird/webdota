/**
 * SpriteFxManager - 像素連續圖特效（來源：pixelfx 輸出的 sprite sheet，見 public/fx/NOTICE.md）
 *
 * 防禦塔光彈與命中（tower-*）是原創素材，放在 public/env（見 public/env/NOTICE.md）。
 * 每個特效是一張連續圖 PNG 加 Aseprite 風格的 JSON。播放時用面向鏡頭的平面，
 * 依 fps 切換貼圖的 UV 偏移逐格播放；平面與材質以特效名稱分池重複使用。
 */

import * as pc from 'playcanvas';
import { loadPixelSheet, createPixelMaterial, setSheetFrame, fitQuadToSheet, type PixelSheet } from './pixelSheet';

const FX_NAMES = [
    'fireball-impact', 'hit-spark', 'respawn-beam', 'death-poof',
    'skill-slash', 'dash-thrust', 'ground-slam', 'divine-shield', 'spin-slash', 'crit-hit',
    'smoke-bomb', 'dagger-flurry', 'fireball', 'frost-nova', 'blink-out', 'blink-in', 'meteor',
    'tower-bolt-blue', 'tower-bolt-red', 'tower-impact-blue', 'tower-impact-red'
] as const;

export type SpriteFxName = typeof FX_NAMES[number];

type Vec3Like = { x: number; y: number; z: number };

export interface SpriteFxOptions {
    /** 延遲幾秒才開始播放 */
    delay?: number;
    /** 播放幾秒後結束；循環特效沒有指定時會一直播放到 stop() */
    duration?: number;
    /**
     * 特效的方向（世界座標 XZ）。pixelfx 有方向的效果原圖朝右：
     * 'rotate' 在畫面上轉向該方向（投射物、刺擊），'mirror' 只左右翻轉（揮砍，避免上下顛倒）
     */
    direction?: { x: number; z: number };
    facing?: 'rotate' | 'mirror';
    /** 每幀讀取位置，讓特效跟著單位移動 */
    follow?: () => Vec3Like;
}

/** play() 傳回的控制代碼；特效結束後就不再有作用 */
export interface SpriteFxHandle {
    moveTo(position: Vec3Like): void;
    stop(): void;
}


const FX_BASE_URL = '/fx/';
const ENV_FX_BASE_URL = '/env/';

/** 原創的防禦塔特效放在 public/env，其餘是 pixelfx 輸出的 public/fx */
const fxUrl = (name: SpriteFxName) => `${name.startsWith('tower-') ? ENV_FX_BASE_URL : FX_BASE_URL}${name}`;

/** 播放位置往鏡頭方向移的距離，避免被目標自己的模型或地面擋住 */
const TOWARD_CAMERA = 1.2;

interface ActiveFx {
    name: SpriteFxName;
    /** 對齊鏡頭的外層，位置在特效原點 */
    root: pc.Entity;
    /** 在鏡頭平面內旋轉或翻轉，讓有方向的效果朝向 direction */
    spin: pc.Entity;
    /** 特效原點的世界座標 */
    origin: pc.Vec3;
    /** 平面，依 pivot 偏移 */
    quad: pc.Entity;
    material: pc.StandardMaterial;
    time: number;
    frameIndex: number;
    duration: number;
    direction: { x: number; z: number } | null;
    facing: 'rotate' | 'mirror';
    follow: (() => Vec3Like) | null;
    stopped: boolean;
    /** 每次從池中取出就加一，讓舊的控制代碼失效 */
    generation: number;
}

export class SpriteFxManager {
    private app: pc.Application;
    private camera: pc.Entity | null = null;
    private sheets: Map<SpriteFxName, PixelSheet> = new Map();
    private loading: Set<SpriteFxName> = new Set();
    private active: ActiveFx[] = [];
    private pools: Map<SpriteFxName, ActiveFx[]> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
    }

    setCamera(camera: pc.Entity): void {
        this.camera = camera;
    }

    /**
     * 預先載入所有特效；載入失敗的特效之後播放時直接略過
     */
    preload(): void {
        for (const name of FX_NAMES) void this.load(name);
    }

    private async load(name: SpriteFxName): Promise<void> {
        if (this.sheets.has(name) || this.loading.has(name)) return;
        this.loading.add(name);
        try {
            this.sheets.set(name, await loadPixelSheet(this.app.graphicsDevice, fxUrl(name)));
        } catch (error) {
            console.warn(`[SpriteFx] Failed to load ${name}`, error);
        } finally {
            this.loading.delete(name);
        }
    }

    /**
     * 在世界座標播放特效（原點是 pixelfx 的 pivot，多數效果在地面上）；尚未載入完成時略過並傳回 null
     */
    play(name: SpriteFxName, position: Vec3Like, options: SpriteFxOptions = {}): SpriteFxHandle | null {
        const sheet = this.sheets.get(name);
        if (!sheet) return null;

        const fx = this.pools.get(name)?.pop() ?? this.create(name, sheet);

        fx.origin.set(position.x, position.y, position.z);
        fx.time = -(options.delay ?? 0);
        fx.frameIndex = -1;
        fx.duration = options.duration ?? Infinity;
        fx.direction = options.direction ?? null;
        fx.facing = options.facing ?? 'rotate';
        fx.follow = options.follow ?? null;
        fx.stopped = false;
        const generation = ++fx.generation;

        fitQuadToSheet(fx.quad, sheet);
        this.place(fx);
        fx.root.enabled = fx.time >= 0;
        this.setFrame(fx, sheet, 0);
        this.active.push(fx);

        return {
            moveTo: (p) => { if (fx.generation === generation) fx.origin.set(p.x, p.y, p.z); },
            stop: () => { if (fx.generation === generation) fx.stopped = true; }
        };
    }

    private create(name: SpriteFxName, sheet: PixelSheet): ActiveFx {
        const material = createPixelMaterial(sheet.texture, { depthWrite: false });

        const root = new pc.Entity(`SpriteFx-${name}`);
        const spin = new pc.Entity('Spin');
        const quad = new pc.Entity('Quad');
        // plane 的法線是 +Y，轉到 +Z 面向鏡頭
        quad.setLocalEulerAngles(90, 0, 0);
        quad.addComponent('render', { type: 'plane', material, castShadows: false, receiveShadows: false });
        spin.addChild(quad);
        root.addChild(spin);
        this.app.root.addChild(root);

        return {
            name, root, spin, origin: new pc.Vec3(), quad, material, time: 0, frameIndex: -1,
            duration: Infinity, direction: null, facing: 'rotate', follow: null, stopped: false, generation: 0
        };
    }

    private setFrame(fx: ActiveFx, sheet: PixelSheet, index: number): void {
        if (fx.frameIndex === index) return;
        fx.frameIndex = index;

        setSheetFrame(fx.material, sheet, index);
    }

    /**
     * 每個畫面幀更新：對齊鏡頭、推進格數、回收播完的特效
     */
    update(dt: number): void {
        if (this.active.length === 0) return;

        for (let i = this.active.length - 1; i >= 0; i--) {
            const fx = this.active[i]!;
            const sheet = this.sheets.get(fx.name)!;
            const { fps, loop } = sheet.json.meta.pixelfx;
            const count = sheet.json.frames.length;

            fx.time += dt;
            if (fx.time < 0) continue; // 延遲中
            let index = Math.floor(fx.time * fps);
            if (fx.stopped || fx.time >= fx.duration || (index >= count && !loop)) {
                this.release(i);
                continue;
            }
            index %= count;

            fx.root.enabled = true;
            this.place(fx);
            this.setFrame(fx, sheet, index);
        }
    }

    /**
     * 平面與鏡頭同向（spherical billboard）、往鏡頭方向移一點，並依 direction 在畫面上轉向
     */
    private place(fx: ActiveFx): void {
        if (fx.follow) {
            const p = fx.follow();
            fx.origin.set(p.x, p.y, p.z);
        }
        if (!this.camera) {
            fx.root.setPosition(fx.origin);
            return;
        }
        const back = this.camera.forward;
        fx.root.setPosition(
            fx.origin.x - back.x * TOWARD_CAMERA,
            fx.origin.y - back.y * TOWARD_CAMERA,
            fx.origin.z - back.z * TOWARD_CAMERA
        );
        fx.root.setRotation(this.camera.getRotation());

        if (!fx.direction) return;
        // 世界方向投影到鏡頭的右與上，得到畫面上的方向
        const right = this.camera.right, up = this.camera.up;
        const sx = fx.direction.x * right.x + fx.direction.z * right.z;
        const sy = fx.direction.x * up.x + fx.direction.z * up.z;
        if (fx.facing === 'mirror') {
            fx.spin.setLocalScale(sx < 0 ? -1 : 1, 1, 1);
        } else {
            fx.spin.setLocalEulerAngles(0, 0, Math.atan2(sy, sx) * pc.math.RAD_TO_DEG);
        }
    }

    private release(activeIndex: number): void {
        const fx = this.active[activeIndex]!;
        this.active.splice(activeIndex, 1);
        fx.root.enabled = false;
        fx.stopped = true;
        fx.follow = null;
        fx.spin.setLocalScale(1, 1, 1);
        fx.spin.setLocalEulerAngles(0, 0, 0);

        let pool = this.pools.get(fx.name);
        if (!pool) this.pools.set(fx.name, (pool = []));
        pool.push(fx);
    }

    destroy(): void {
        for (const fx of [...this.active, ...[...this.pools.values()].flat()]) {
            fx.root.destroy();
            fx.material.destroy();
        }
        this.active = [];
        this.pools.clear();
        for (const { texture } of this.sheets.values()) texture.destroy();
        this.sheets.clear();
    }
}
