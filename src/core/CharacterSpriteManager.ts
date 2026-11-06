/**
 * CharacterSpriteManager - 遊戲內角色的像素連續圖（public/characters/<id>-<anim>，原創素材見 NOTICE.md）
 *
 * 每位玩家一張面向鏡頭的平面，掛在玩家的視覺實體底下：
 * - 移動中播 run，靜止播 battle-idle；放技能時播一次 attack 或 cast 再回到移動／待機
 * - 依移動或技能方向在畫面上左右翻轉（素材面向右）
 * 平面的材質每位玩家各一份（各自的格數 UV），受擊閃白、狀態色調與半透明沿用 RenderComponent 的 mesh 參數
 */

import * as pc from 'playcanvas';
import { loadPixelSheet, createPixelMaterial, setSheetFrame, createSheetQuad, fitQuadToSheet, type PixelSheet } from './pixelSheet';

export const CHARACTER_ANIMS = ['battle-idle', 'run', 'attack', 'cast'] as const;
export type CharacterAnim = typeof CHARACTER_ANIMS[number];
export type CharacterAction = 'attack' | 'cast';

const BASE_URL = '/characters/';

/** 水平移動速度超過這個值（單位／秒）才算在跑 */
const RUN_SPEED_THRESHOLD = 0.8;
/** 停下後維持跑步動畫的秒數；Client 的遠端玩家位置以較低頻率更新，避免 run／idle 來回閃 */
const RUN_GRACE_SECONDS = 0.15;
/** 腳底相對視覺實體原點的高度（玩家實體原點在地面上 1 單位） */
const FEET_OFFSET_Y = -1;

interface CharacterSprite {
    owner: pc.Entity;
    characterId: string;
    /** 對齊鏡頭的外層，位置在腳底 */
    root: pc.Entity;
    /** 左右翻轉用 */
    flip: pc.Entity;
    quad: pc.Entity;
    material: pc.StandardMaterial;
    anim: CharacterAnim;
    time: number;
    frameIndex: number;
    facing: 1 | -1;
    lastPos: pc.Vec3;
    runGrace: number;
    /** 播放中的動作（播完回到移動／待機） */
    action: CharacterAction | null;
}

export class CharacterSpriteManager {
    private app: pc.Application;
    private camera: pc.Entity | null = null;
    /** characterId → 動作 → 連續圖 */
    private sheets = new Map<string, Map<CharacterAnim, PixelSheet>>();
    private sprites = new Map<pc.Entity, CharacterSprite>();

    constructor(app: pc.Application) {
        this.app = app;
    }

    setCamera(camera: pc.Entity): void {
        this.camera = camera;
    }

    /**
     * 載入角色的全部動作；任一動作載入失敗的角色不使用像素圖（維持方塊模型）
     */
    async preload(characterIds: readonly string[]): Promise<void> {
        await Promise.all(characterIds.map(async (id) => {
            try {
                const entries = await Promise.all(CHARACTER_ANIMS.map(async (anim) =>
                    [anim, await loadPixelSheet(this.app.graphicsDevice, BASE_URL, `${id}-${anim}`)] as const
                ));
                this.sheets.set(id, new Map(entries));
            } catch (error) {
                console.warn(`[CharacterSprites] Failed to load ${id}`, error);
            }
        }));
    }

    has(characterId: string): boolean {
        return this.sheets.has(characterId);
    }

    /** 把角色像素圖掛到玩家的視覺實體底下；素材未載入時傳回 false */
    attach(owner: pc.Entity, characterId: string): boolean {
        const sheets = this.sheets.get(characterId);
        const idle = sheets?.get('battle-idle');
        if (!sheets || !idle) return false;

        const material = createPixelMaterial(idle.texture, { depthWrite: true });
        const root = new pc.Entity('CharacterSprite');
        const flip = new pc.Entity('Flip');
        const quad = createSheetQuad(material, idle);
        flip.addChild(quad);
        root.addChild(flip);
        root.setLocalPosition(0, FEET_OFFSET_Y, 0);
        owner.addChild(root);

        const sprite: CharacterSprite = {
            owner, characterId, root, flip, quad, material,
            anim: 'battle-idle', time: Math.random(), frameIndex: -1, facing: 1,
            lastPos: owner.getPosition().clone(), runGrace: 0, action: null
        };
        this.sprites.set(owner, sprite);
        this.setFrame(sprite, idle, 0);
        return true;
    }

    /** 播放一次攻擊或施法動作，並轉向技能方向 */
    playAction(owner: pc.Entity, action: CharacterAction, direction?: { x: number; z: number }): void {
        const sprite = this.sprites.get(owner);
        if (!sprite) return;
        if (direction) this.face(sprite, direction.x, direction.z);
        sprite.action = action;
        this.switchAnim(sprite, action);
    }

    /** 每個畫面幀更新：對齊鏡頭、判斷移動、推進格數 */
    update(dt: number): void {
        const cameraRotation = this.camera?.getRotation();

        for (const [owner, sprite] of this.sprites) {
            // 玩家實體被銷毀（離開遊戲、重開一局）後從場景移除
            if (!owner.parent) {
                sprite.material.destroy();
                this.sprites.delete(owner);
                continue;
            }
            if (!owner.enabled) continue;

            if (cameraRotation) sprite.root.setRotation(cameraRotation);

            const pos = owner.getPosition();
            const dx = pos.x - sprite.lastPos.x;
            const dz = pos.z - sprite.lastPos.z;
            sprite.lastPos.copy(pos);
            const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
            if (speed > RUN_SPEED_THRESHOLD) {
                sprite.runGrace = RUN_GRACE_SECONDS;
                // 動作播放中維持技能方向
                if (!sprite.action) this.face(sprite, dx, dz);
            } else {
                sprite.runGrace = Math.max(0, sprite.runGrace - dt);
            }

            const sheets = this.sheets.get(sprite.characterId)!;
            let sheet = sheets.get(sprite.anim)!;
            const { fps, loop } = sheet.json.meta.pixelfx;
            const count = sheet.json.frames.length;
            sprite.time += dt;
            let index = Math.floor(sprite.time * fps);

            if (sprite.action && index >= count) sprite.action = null;
            if (!sprite.action) {
                const next: CharacterAnim = sprite.runGrace > 0 ? 'run' : 'battle-idle';
                if (next !== sprite.anim) {
                    this.switchAnim(sprite, next);
                    sheet = sheets.get(next)!;
                    index = 0;
                }
            }
            this.setFrame(sprite, sheet, loop ? index % count : Math.min(index, count - 1));
        }
    }

    private switchAnim(sprite: CharacterSprite, anim: CharacterAnim): void {
        const sheet = this.sheets.get(sprite.characterId)?.get(anim);
        if (!sheet) return;
        sprite.anim = anim;
        sprite.time = 0;
        sprite.frameIndex = -1;
        sprite.material.emissiveMap = sheet.texture;
        sprite.material.opacityMap = sheet.texture;
        fitQuadToSheet(sprite.quad, sheet);
        this.setFrame(sprite, sheet, 0);
    }

    private setFrame(sprite: CharacterSprite, sheet: PixelSheet, index: number): void {
        if (sprite.frameIndex === index) return;
        sprite.frameIndex = index;
        setSheetFrame(sprite.material, sheet, index);
    }

    /** 世界方向投影到鏡頭右方，決定畫面上面向左或右 */
    private face(sprite: CharacterSprite, x: number, z: number): void {
        const right = this.camera?.right;
        const sx = right ? x * right.x + z * right.z : x;
        if (Math.abs(sx) < 1e-3) return;
        const facing = sx < 0 ? -1 : 1;
        if (facing === sprite.facing) return;
        sprite.facing = facing;
        sprite.flip.setLocalScale(facing, 1, 1);
    }

    clear(): void {
        for (const sprite of this.sprites.values()) sprite.material.destroy();
        this.sprites.clear();
    }
}
