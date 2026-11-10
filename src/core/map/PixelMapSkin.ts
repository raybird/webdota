/**
 * PixelMapSkin - 地圖的像素圖層（public/env，原創素材見 NOTICE.md）
 *
 * 素材照遊戲鏡頭的斜俯視比例畫（見 view.ts）：水平每單位 19px、地面與頂面縱深每單位 11.4px、垂直面每單位 15.2px，
 * 所以這裡的 UV 一律以「畫面座標」計算（右 = screenRight、下 = screenDown），兩隊的畫面方向不同，貼圖仍以正向顯示、
 * 像素與螢幕 1:1 對齊。視角依本地隊伍決定，所以整個圖層由 build() 在視角確定後建立。
 *
 * - 地面：依視角的整張烘焙圖（ground-blue／ground-red），自家主堡永遠在畫面左下
 * - 牆、掩體：自建網格，頂面與正面各一張可平鋪貼圖（5 單位一格），不打光、以頂點色做頂面與正面的明暗
 * - 石柱：直立的像素圖（只畫物體本身的明暗），平面放在柱子最靠近鏡頭的邊緣，下緣剛好貼地
 * - 投影：牆、柱、防禦塔、主堡依畫面左上光源投在地面上的影子，畫在一張與地面同解析度的遮罩上，重疊處不會加深
 * 素材缺少時，對應的積木由 MapManager 維持原本的打光材質（handles() 傳回 false）
 */

import * as pc from 'playcanvas';
import type { MapBlock, MapConfig } from './MapData';
import { loadPixelSheet, createPixelMaterial, createSheetQuad, setSheetFrame, type PixelSheet } from '../pixelSheet';
import { PITCH_COS, screenDown, screenRight, viewTeam } from '../view';

const ENV_URL = '/env/';
/** 平鋪貼圖每格對應 5 個世界單位（頂面 95×57、正面 95×76） */
const TILE_UNITS = 5;
/** 烘焙地面的像素密度：水平每單位 19px、縱深每單位 11.4px */
const GROUND_PX_H = 19;
const GROUND_PX_V = 11.4;

/** 頂面與正對鏡頭的面的亮度（貼圖已畫左上光源的細節，這裡只分面） */
const SHADE_TOP = 1.0;
const SHADE_FRONT = 0.85;
const SHADE_OTHER = 0.7;

/** 投影：每單位高度在地面上往畫面右方與下方延伸的長度（光源在畫面左上） */
const SHADOW_RIGHT_PER_HEIGHT = 0.55;
const SHADOW_DOWN_PER_HEIGHT = 0.3;
const SHADOW_RGB = [0x1a, 0x14, 0x22] as const;
const SHADOW_OPACITY = 0.55;
/** 投影離地高度，避免與地面深度衝突 */
const SHADOW_Y = 0.01;

/** 地圖材質 key 對應的平鋪貼圖組；highlight_* 是主堡標記，烘焙地面已經畫了廣場，不再繪製 */
const SKIN_OF_MATERIAL: Record<string, string> = {
    wall_stone: 'wall',
    obstacle_wood: 'crate',
};
const PILLAR_MATERIAL = 'pillar_dark';
const HIDDEN_WITH_GROUND = /^highlight_/;

/** 投影的形狀：圓（半徑隨高度收窄）或方塊 */
interface ShadowCaster {
    x: number;
    z: number;
    height: number;
    /** 圓的半徑；方塊時為 null */
    radius: number | null;
    /** 方塊的世界尺寸 */
    sizeX: number;
    sizeZ: number;
    /** 頂端尺寸相對底部的比例（塔、主堡上窄下寬） */
    taper: number;
}

/** 防禦塔與主堡的投影形狀（像素圖本身由 PixelActorManager 繪製） */
const STRUCTURE_SHADOW: Record<string, { radius: number | null; size: number; height: number; taper: number }> = {
    tower: { radius: 1, size: 2, height: 4.5, taper: 0.45 },
    base: { radius: null, size: 5, height: 6.5, taper: 0.55 },
};

interface Skin {
    side: pc.StandardMaterial;
    top: pc.StandardMaterial;
}

export class PixelMapSkin {
    private app: pc.Application;
    private grounds = new Map<string, pc.StandardMaterial>();
    private skins = new Map<string, Skin>();
    private pillars = new Map<'s' | 'l', PixelSheet>();
    private textures: pc.Texture[] = [];
    private materials: pc.StandardMaterial[] = [];
    /** build() 每次建立、下次 build 或 destroy 時釋放的資源 */
    private builtMaterials: pc.StandardMaterial[] = [];
    private builtTextures: pc.Texture[] = [];

    constructor(app: pc.Application) {
        this.app = app;
    }

    /**
     * 載入全部貼圖；個別失敗只影響那一組
     * 地面依地圖而不同：demo_arena 在 public/env/ground-*.png，其他地圖在 public/env/<地圖 id>/ground-*.png
     */
    async load(mapId: string): Promise<void> {
        const groundPrefix = mapId === 'demo_arena' ? '' : `${mapId}/`;
        const results = await Promise.allSettled([
            ...(['blue', 'red'] as const).map(async (team) => {
                this.grounds.set(team, this.createMaterial(await this.loadTexture(`${groundPrefix}ground-${team}`, false)));
            }),
            ...['wall', 'crate'].map(async (name) => {
                const [side, top] = await Promise.all([this.loadTexture(`${name}-side`, true), this.loadTexture(`${name}-top`, true)]);
                this.skins.set(name, { side: this.createMaterial(side), top: this.createMaterial(top) });
            }),
            ...(['s', 'l'] as const).map(async (size) => {
                this.pillars.set(size, await loadPixelSheet(this.app.graphicsDevice, `${ENV_URL}pillar-${size}-idle`));
            }),
        ]);
        if (results.some(r => r.status === 'rejected')) console.warn('[PixelMapSkin] Some environment textures failed to load');
    }

    get hasGround(): boolean {
        return this.grounds.size === 2;
    }

    /** 這個積木的視覺是否由像素圖層負責（或在有烘焙地面時不必繪製） */
    handles(block: MapBlock): boolean {
        if (this.hasGround && HIDDEN_WITH_GROUND.test(block.material)) return true;
        if (this.isPillar(block)) return this.pillars.has(this.pillarSize(block));
        return this.skins.has(SKIN_OF_MATERIAL[block.material] ?? '');
    }

    /** 依目前視角建立整個像素圖層；先釋放上一次建立的資源 */
    build(config: MapConfig): pc.Entity {
        this.releaseBuilt();
        const root = new pc.Entity('PixelMapLayer');
        const ground = this.createGround(config);
        if (ground) root.addChild(ground);

        const casters: ShadowCaster[] = [];
        for (const block of config.blocks) {
            if (!this.handles(block) || HIDDEN_WITH_GROUND.test(block.material)) continue;
            const visual = this.isPillar(block) ? this.createPillar(block) : this.createBox(block);
            if (visual) root.addChild(visual);
            casters.push({
                x: block.position[0], z: block.position[2], height: block.position[1] + block.scale[1] / 2,
                radius: block.type === 'cylinder' ? block.scale[0] / 2 : null,
                sizeX: block.scale[0], sizeZ: block.scale[2], taper: 1
            });
        }
        for (const entity of config.entities) {
            const shape = STRUCTURE_SHADOW[entity.type];
            if (!shape) continue;
            casters.push({
                x: entity.position[0], z: entity.position[2], height: shape.height,
                radius: shape.radius, sizeX: shape.size, sizeZ: shape.size, taper: shape.taper
            });
        }
        if (this.hasGround) root.addChild(this.createShadowLayer(config, casters));
        return root;
    }

    destroy(): void {
        this.releaseBuilt();
        for (const material of this.materials) material.destroy();
        for (const texture of this.textures) texture.destroy();
        for (const sheet of this.pillars.values()) sheet.texture.destroy();
        this.materials = [];
        this.textures = [];
        this.skins.clear();
        this.grounds.clear();
        this.pillars.clear();
    }

    private releaseBuilt(): void {
        for (const material of this.builtMaterials) material.destroy();
        for (const texture of this.builtTextures) texture.destroy();
        this.builtMaterials = [];
        this.builtTextures = [];
    }

    // ==================== 地面與投影 ====================

    /** 世界座標轉成畫面座標（右、下），單位仍是世界單位 */
    private toScreen(x: number, z: number): { r: number; d: number } {
        const right = screenRight(), down = screenDown();
        return { r: x * right.x + z * right.z, d: x * down.x + z * down.z };
    }

    /** 地面：整張地圖一個平面，頂面在 y=0 */
    private createGround(config: MapConfig): pc.Entity | null {
        const material = this.grounds.get(viewTeam());
        if (!material) return null;
        return this.entityWith('Ground', [new pc.MeshInstance(this.groundQuad(config, 0), material)]);
    }

    /**
     * 覆蓋整張地圖的平面，UV 對應烘焙圖的畫面方向（圖片左上是畫面左上，r = d = -w/2）
     * PNG 與畫布上傳成貼圖時第 0 列（圖片最上面）都在 v=0
     */
    private groundQuad(config: MapConfig, y: number): pc.Mesh {
        const hw = config.size.w / 2, hh = config.size.h / 2;
        const positions: number[] = [];
        const uvs: number[] = [];
        for (const [x, z] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as const) {
            const { r, d } = this.toScreen(x, z);
            positions.push(x, y, z);
            // 圖片上方（v=0）是畫面上方（d 最小）
            uvs.push((r + hw) / config.size.w, (d + hh) / config.size.h);
        }
        const builder = new MeshBuilder();
        builder.raw(positions, uvs, SHADE_TOP);
        return builder.build(this.app.graphicsDevice);
    }

    /**
     * 投影圖層：在與烘焙地面相同解析度的畫布上畫出所有投影（不透明），二值化後當成半透明遮罩，
     * 重疊的影子不會疊得更深，邊緣維持像素鋸齒
     */
    private createShadowLayer(config: MapConfig, casters: ShadowCaster[]): pc.Entity {
        const width = Math.round(config.size.w * GROUND_PX_H);
        const height = Math.round(config.size.h * GROUND_PX_V);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        const hw = config.size.w / 2, hh = config.size.h / 2;
        const px = (r: number) => (r + hw) * GROUND_PX_H;
        // 與烘焙地面同方向：畫布第 0 列是畫面上方
        const py = (d: number) => (d + hh) * GROUND_PX_V;
        const right = screenRight();

        for (const c of casters) {
            const base = this.toScreen(c.x, c.z);
            // 在畫面上的寬（沿 r）與深（沿 d）；兩隊鏡頭都沿 x 軸，所以 r 對應 z、d 對應 x
            const spanR = c.radius !== null ? c.radius * 2 : Math.abs(right.x) * c.sizeX + Math.abs(right.z) * c.sizeZ;
            const spanD = c.radius !== null ? c.radius * 2 : Math.abs(right.z) * c.sizeX + Math.abs(right.x) * c.sizeZ;
            // 沿光線方向掃過整個高度：每一層的截面往右下位移，取聯集
            const steps = Math.max(8, Math.ceil(c.height * 6));
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const h = c.height * t;
                const scale = 1 - (1 - c.taper) * t;
                const cr = base.r + h * SHADOW_RIGHT_PER_HEIGHT;
                const cd = base.d + h * SHADOW_DOWN_PER_HEIGHT;
                const halfR = (spanR / 2) * scale, halfD = (spanD / 2) * scale;
                ctx.beginPath();
                if (c.radius !== null) {
                    ctx.ellipse(px(cr), py(cd), halfR * GROUND_PX_H, halfD * GROUND_PX_V, 0, 0, Math.PI * 2);
                } else {
                    ctx.rect(px(cr - halfR), py(cd - halfD), halfR * 2 * GROUND_PX_H, halfD * 2 * GROUND_PX_V);
                }
                ctx.fill();
            }
        }

        // 二值化（canvas 的填色有抗鋸齒）
        const image = ctx.getImageData(0, 0, width, height);
        const data = image.data;
        for (let i = 0; i < data.length; i += 4) {
            const on = data[i + 3]! >= 128;
            data[i] = SHADOW_RGB[0];
            data[i + 1] = SHADOW_RGB[1];
            data[i + 2] = SHADOW_RGB[2];
            data[i + 3] = on ? 255 : 0;
        }
        ctx.putImageData(image, 0, 0);

        const texture = new pc.Texture(this.app.graphicsDevice, {
            width, height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
            minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            name: 'env-shadows'
        });
        texture.setSource(canvas);
        this.builtTextures.push(texture);

        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.diffuse = new pc.Color(0, 0, 0);
        material.emissive = new pc.Color(1, 1, 1);
        material.emissiveMap = texture;
        material.opacityMap = texture;
        material.opacityMapChannel = 'a';
        material.opacity = SHADOW_OPACITY;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.cull = pc.CULLFACE_NONE;
        material.update();
        this.builtMaterials.push(material);

        return this.entityWith('Shadows', [new pc.MeshInstance(this.groundQuad(config, SHADOW_Y), material)]);
    }

    // ==================== 積木 ====================

    private isPillar(block: MapBlock): boolean {
        return block.type === 'cylinder' && block.material === PILLAR_MATERIAL;
    }

    /** 直徑 2.5 以上用大柱 */
    private pillarSize(block: MapBlock): 's' | 'l' {
        return block.scale[0] >= 2.5 ? 'l' : 's';
    }

    /** 方塊（世界座標建網格）：側面與頂面；UV 以畫面座標計算，底面看不到不建 */
    private createBox(block: MapBlock): pc.Entity | null {
        const skin = this.skins.get(SKIN_OF_MATERIAL[block.material] ?? '');
        if (!skin) return null;
        const [cx, cy, cz] = block.position;
        const hx = block.scale[0] / 2, hy = block.scale[1] / 2, hz = block.scale[2] / 2;
        const y0 = cy - hy, y1 = cy + hy;
        const down = screenDown();
        const side = new MeshBuilder();
        const top = new MeshBuilder();

        // 四個側面：法線、由外看的左下角與右下角
        const faces: { n: [number, number]; a: [number, number]; b: [number, number] }[] = [
            { n: [0, 1], a: [cx - hx, cz + hz], b: [cx + hx, cz + hz] },
            { n: [0, -1], a: [cx + hx, cz - hz], b: [cx - hx, cz - hz] },
            { n: [1, 0], a: [cx + hx, cz + hz], b: [cx + hx, cz - hz] },
            { n: [-1, 0], a: [cx - hx, cz - hz], b: [cx - hx, cz + hz] },
        ];
        for (const { n, a, b } of faces) {
            const shade = n[0] * down.x + n[1] * down.z > 0.5 ? SHADE_FRONT : SHADE_OTHER;
            const ua = this.toScreen(a[0], a[1]).r / TILE_UNITS;
            const ub = this.toScreen(b[0], b[1]).r / TILE_UNITS;
            side.quad(
                [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]],
                [ua, y0 / TILE_UNITS], [ub, y0 / TILE_UNITS], [ub, y1 / TILE_UNITS], [ua, y1 / TILE_UNITS],
                shade
            );
        }

        // 頂面：u = 畫面右、v = 畫面上（-d）
        const corners: [number, number][] = [[cx - hx, cz + hz], [cx + hx, cz + hz], [cx + hx, cz - hz], [cx - hx, cz - hz]];
        const positions = corners.flatMap(([x, z]) => [x, y1, z]);
        const uvs = corners.flatMap(([x, z]) => {
            const { r, d } = this.toScreen(x, z);
            return [r / TILE_UNITS, -d / TILE_UNITS];
        });
        top.raw(positions, uvs, SHADE_TOP);

        return this.entityWith(block.id || `Block_${block.type}`, [
            new pc.MeshInstance(side.build(this.app.graphicsDevice), skin.side),
            new pc.MeshInstance(top.build(this.app.graphicsDevice), skin.top),
        ]);
    }

    /**
     * 石柱：直立的像素圖，只隨鏡頭水平方向轉向、高度拉長 1/cos(俯角)（畫面上的像素大小不變）。
     * 素材的 pivot 是底面最靠近鏡頭的點，所以平面放在柱子靠近鏡頭的邊緣，下緣剛好在地面上
     */
    private createPillar(block: MapBlock): pc.Entity | null {
        const sheet = this.pillars.get(this.pillarSize(block));
        if (!sheet) return null;
        const material = createPixelMaterial(sheet.texture, { depthWrite: true });
        setSheetFrame(material, sheet, 0);
        this.builtMaterials.push(material);

        const down = screenDown();
        const radius = block.scale[0] / 2;
        const entity = new pc.Entity(block.id || 'Pillar');
        entity.setPosition(block.position[0] + down.x * radius, 0, block.position[2] + down.z * radius);
        // 平面法線 +z 轉到朝向鏡頭的 screenDown
        entity.setEulerAngles(0, (Math.atan2(down.x, down.z) * 180) / Math.PI, 0);
        entity.setLocalScale(1, 1 / PITCH_COS, 1);
        entity.addChild(createSheetQuad(material, sheet));
        return entity;
    }

    private entityWith(name: string, meshInstances: pc.MeshInstance[]): pc.Entity {
        const entity = new pc.Entity(name);
        entity.addComponent('render', { meshInstances, castShadows: false, receiveShadows: false });
        return entity;
    }

    // ==================== 貼圖與材質 ====================

    private async loadTexture(name: string, repeat: boolean): Promise<pc.Texture> {
        const image = new Image();
        image.src = new URL(`${ENV_URL}${name}.png`, location.href).href;
        await image.decode();
        const address = repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
        const texture = new pc.Texture(this.app.graphicsDevice, {
            width: image.width,
            height: image.height,
            format: pc.PIXELFORMAT_RGBA8,
            // 貼圖照畫面比例畫，正常是 1:1 或整數倍放大；縮小（小螢幕）時用 mipmap 平均
            mipmaps: true,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: pc.FILTER_NEAREST,
            addressU: address,
            addressV: address,
            name: `env-${name}`
        });
        texture.setSource(image);
        this.textures.push(texture);
        return texture;
    }

    /** 不打光、貼圖乘上頂點色明暗 */
    private createMaterial(texture: pc.Texture): pc.StandardMaterial {
        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.diffuse = new pc.Color(0, 0, 0);
        material.emissive = new pc.Color(1, 1, 1);
        material.emissiveMap = texture;
        material.emissiveVertexColor = true;
        // 自建網格不保證頂點順序，雙面繪製（背面本來就被正面的深度擋住）
        material.cull = pc.CULLFACE_NONE;
        material.update();
        this.materials.push(material);
        return material;
    }
}

/** 累積四邊形的小工具 */
class MeshBuilder {
    private positions: number[] = [];
    private uvs: number[] = [];
    private colors: number[] = [];
    private indices: number[] = [];

    /** 四邊形 a-b-c-d（外側看逆時針）與各頂點的 UV */
    quad(a: number[], b: number[], c: number[], d: number[], ua: number[], ub: number[], uc: number[], ud: number[], shade: number): void {
        this.raw([...a, ...b, ...c, ...d], [...ua, ...ub, ...uc, ...ud], shade);
    }

    /** 四個頂點（順序同 quad）的位置與 UV */
    raw(positions: number[], uvs: number[], shade: number): void {
        const base = this.positions.length / 3;
        this.positions.push(...positions);
        this.uvs.push(...uvs);
        for (let i = 0; i < 4; i++) this.colors.push(shade, shade, shade, 1);
        this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    build(device: pc.GraphicsDevice): pc.Mesh {
        const mesh = new pc.Mesh(device);
        mesh.setPositions(this.positions);
        mesh.setUvs(0, this.uvs);
        mesh.setColors(this.colors);
        mesh.setIndices(this.indices);
        mesh.update();
        return mesh;
    }
}
