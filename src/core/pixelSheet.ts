/**
 * pixelSheet.ts - 像素連續圖（Aseprite 風格 JSON + PNG）的載入與逐格 UV
 * 特效（public/fx）與遊戲內角色（public/characters）共用
 */

import * as pc from 'playcanvas';

/** 連續圖 JSON（只列用到的欄位） */
export interface PixelSheetJson {
    frames: { frame: { x: number; y: number; w: number; h: number } }[];
    meta: {
        image: string;
        size: { w: number; h: number };
        pixelfx: { fps: number; loop: boolean; frameSize: [number, number]; pivot: [number, number] };
    };
}

export interface PixelSheet {
    texture: pc.Texture;
    json: PixelSheetJson;
}

/**
 * 每個世界單位對應的素材像素數
 * 特效與角色都以約 38px 高的角色為基準設計，角色約 2 單位高、在畫面上約 40px，
 * 用 19 大約是 1 素材像素對 1 螢幕像素（更小會讓細線被濾掉）
 */
export const PX_PER_UNIT = 19;

/** 載入 `${baseUrl}${name}.json` 與它指向的 PNG */
export async function loadPixelSheet(device: pc.GraphicsDevice, baseUrl: string, name: string): Promise<PixelSheet> {
    const json = await fetch(`${baseUrl}${name}.json`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PixelSheetJson>;
    });
    const image = new Image();
    image.src = `${baseUrl}${json.meta.image}`;
    await image.decode();

    const texture = new pc.Texture(device, {
        width: image.width,
        height: image.height,
        format: pc.PIXELFORMAT_RGBA8,
        // 放大保持像素銳利；縮小（小螢幕）用 mipmap 平均，避免 1 像素細線消失
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        name
    });
    texture.setSource(image);
    return { texture, json };
}

/**
 * 不受光、以 emissive 貼圖顯示、alpha 透明的材質
 * emissive 與 opacity 刻意不設成剛好 1，讓 shader 保留這兩個 uniform，
 * 之後才能用 mesh instance 參數做受擊閃白、狀態色調與半透明
 */
export function createPixelMaterial(texture: pc.Texture, options: { depthWrite: boolean }): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.useLighting = false;
    material.useSkybox = false;
    material.useFog = false;
    material.diffuse = new pc.Color(0, 0, 0);
    material.emissive = new pc.Color(0.999, 0.999, 0.999);
    material.emissiveMap = texture;
    material.opacity = 0.999;
    material.opacityMap = texture;
    material.opacityMapChannel = 'a';
    // 素材 alpha 只有 0／255；門檻要低於隱身時的半透明（0.4），否則隊友的隱身會整個被丟掉
    material.alphaTest = options.depthWrite ? 0.1 : 0;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = options.depthWrite;
    material.cull = pc.CULLFACE_NONE;
    material.update();
    return material;
}

/** 把材質的貼圖切到第 index 格 */
export function setSheetFrame(material: pc.StandardMaterial, sheet: PixelSheet, index: number): void {
    const rect = sheet.json.frames[index]?.frame;
    if (!rect) return;
    const { w: sheetW, h: sheetH } = sheet.json.meta.size;
    const tiling = new pc.Vec2(rect.w / sheetW, rect.h / sheetH);
    // UV 原點在左下，圖片的列從上往下數
    const offset = new pc.Vec2(rect.x / sheetW, 1 - (rect.y + rect.h) / sheetH);

    material.emissiveMapTiling = tiling;
    material.emissiveMapOffset = offset;
    material.opacityMapTiling = tiling;
    material.opacityMapOffset = offset;
    material.update();
}

/** 建立對齊連續圖 pivot 的平面（plane 的法線是 +Y，轉到 +Z 面向鏡頭） */
export function createSheetQuad(material: pc.StandardMaterial, sheet: PixelSheet): pc.Entity {
    const quad = new pc.Entity('Quad');
    quad.setLocalEulerAngles(90, 0, 0);
    quad.addComponent('render', { type: 'plane', material, castShadows: false, receiveShadows: false });
    fitQuadToSheet(quad, sheet);
    return quad;
}

/** 依連續圖的格子大小與 pivot 設定平面的大小與偏移 */
export function fitQuadToSheet(quad: pc.Entity, sheet: PixelSheet): void {
    const { frameSize, pivot } = sheet.json.meta.pixelfx;
    const unit = 1 / PX_PER_UNIT;
    quad.setLocalScale(frameSize[0] * unit, 1, frameSize[1] * unit);
    // 平面中心相對原點的偏移（像素 y 向下，世界 y 向上）
    quad.setLocalPosition((frameSize[0] / 2 - pivot[0]) * unit, (pivot[1] - frameSize[1] / 2) * unit, 0);
}
