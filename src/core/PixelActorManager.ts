/**
 * PixelActorManager - 場景中面向鏡頭的像素單位：玩家角色、防禦塔、主堡、小兵
 * （素材：public/characters、public/env，皆為原創，見各目錄 NOTICE.md）
 *
 * 每個單位一張直立的平面，掛在它的視覺實體底下：
 * - 平面只隨鏡頭的水平方向轉向、不隨俯角傾斜，高度拉長 1/cos(俯角)；正交投影下畫面上的像素大小不變，
 *   深度則等於單位實際站的位置，站在柱子前面不會被柱子切掉上半身
 * - 防禦塔與主堡的素材 pivot 是底面最靠近鏡頭的點，平面移到底面靠近鏡頭的邊緣，下緣才不會沒入地面
 * - 角色與小兵腳下有一片斜角橢圓陰影（地圖物件的投影由 PixelMapSkin 畫在地面上）
 * - 移動中播 move、靜止播 idle；玩家放技能時播一次 attack 或 cast 再回到移動／待機
 * - 可翻轉的單位依移動或技能方向在畫面上左右翻轉（素材面向右）
 * 材質每個單位各一份（各自的格數 UV），受擊閃白、狀態色調與半透明沿用 RenderComponent 的 mesh 參數
 */

import * as pc from 'playcanvas';
import { loadPixelSheet, createPixelMaterial, setSheetFrame, createSheetQuad, fitQuadToSheet, PX_PER_UNIT, type PixelSheet } from './pixelSheet';
import type { Team } from './ecs/components/TeamComponent';
import { NO_STATUS_FX_TAG } from './ecs/components/RenderComponent';
import { PITCH_SIN, screenDown } from './view';

export type ActorAction = 'attack' | 'cast';

/** 一種單位的素材與動作設定 */
interface ActorSet {
    /** 連續圖路徑前綴，動作名接在後面，例如 '/characters/warrior-' + 'run' */
    prefix: string;
    idle: string;
    move?: string;
    actions?: Partial<Record<ActorAction, string>>;
    /** 是否依方向左右翻轉 */
    flip: boolean;
    /** 底面半徑：平面往鏡頭方向移這麼多（素材 pivot 在底面最靠近鏡頭的點） */
    groundRadius?: number;
    /** 腳下陰影 */
    shadow?: ShadowKind;
}

type ShadowKind = 'unit' | 'creep';
/** 陰影貼圖已是斜角下的橢圓：寬每單位 19px、縱深每單位 19 × sin(俯角) px */
const SHADOW_OPACITY = 0.35;
const SHADOW_Y = 0.03;

const CHARACTER_IDS = ['warrior', 'assassin', 'mage'] as const;
const TEAMS: Team[] = ['red', 'blue'];

const ACTOR_SETS: Record<string, ActorSet> = {
    ...Object.fromEntries(CHARACTER_IDS.map(id => [id, {
        prefix: `/characters/${id}-`, idle: 'battle-idle', move: 'run', actions: { attack: 'attack', cast: 'cast' }, flip: true, shadow: 'unit'
    }])),
    ...Object.fromEntries(TEAMS.flatMap(team => [
        [`tower-${team}`, { prefix: `/env/tower-${team}-`, idle: 'idle', flip: false, groundRadius: 1 }],
        [`base-${team}`, { prefix: `/env/base-${team}-`, idle: 'idle', flip: false, groundRadius: 2.5 }],
        // 小兵停下來就是在攻擊，所以靜止時循環播攻擊動作（Client 不需要知道小兵何時出手）
        [`creep-${team}`, { prefix: `/env/creep-${team}-`, idle: 'attack', move: 'walk', flip: true, shadow: 'creep' }],
    ])),
};

export const actorSetOfCharacter = (characterId: string) => characterId;
export const actorSetOfStructure = (kind: 'tower' | 'base', team: Team) => `${kind}-${team}`;
export const actorSetOfCreep = (team: Team) => `creep-${team}`;

/** 水平移動速度超過這個值（單位／秒）才算在移動 */
const MOVE_SPEED_THRESHOLD = 0.8;
/** 停下後維持移動動畫的秒數；Client 的遠端單位位置以較低頻率更新，避免移動／待機來回閃 */
const MOVE_GRACE_SECONDS = 0.15;

interface Actor {
    owner: pc.Entity;
    set: ActorSet;
    sheets: Map<string, PixelSheet>;
    /** 面向鏡頭的外層，位置在腳底 */
    root: pc.Entity;
    flip: pc.Entity;
    quad: pc.Entity;
    material: pc.StandardMaterial;
    anim: string;
    time: number;
    frameIndex: number;
    facing: 1 | -1;
    lastPos: pc.Vec3;
    moveGrace: number;
    /** 播放中的一次性動作（播完回到移動／待機） */
    action: string | null;
    feetY: number;
}

export class PixelActorManager {
    private app: pc.Application;
    private camera: pc.Entity | null = null;
    /** 單位種類 → 動作名 → 連續圖 */
    private sheets = new Map<string, Map<string, PixelSheet>>();
    private actors = new Map<pc.Entity, Actor>();
    /** 腳下陰影：共用材質與貼圖尺寸 */
    private shadows = new Map<ShadowKind, { material: pc.StandardMaterial; width: number; height: number }>();

    constructor(app: pc.Application) {
        this.app = app;
    }

    setCamera(camera: pc.Entity): void {
        this.camera = camera;
    }

    /**
     * 載入所有單位的素材；任一動作載入失敗的種類不使用像素圖（維持方塊模型）
     */
    async preload(): Promise<void> {
        await Promise.all([
            ...(['unit', 'creep'] as const).map(kind => this.loadShadow(kind)),
            ...Object.entries(ACTOR_SETS).map(async ([key, set]) => {
            const anims = new Set([set.idle, set.move, ...Object.values(set.actions ?? {})].filter((a): a is string => !!a));
            try {
                const entries = await Promise.all([...anims].map(async (anim) =>
                    [anim, await loadPixelSheet(this.app.graphicsDevice, `${set.prefix}${anim}`)] as const
                ));
                this.sheets.set(key, new Map(entries));
            } catch (error) {
                console.warn(`[PixelActors] Failed to load ${key}`, error);
            }
        })]);
    }

    private async loadShadow(kind: ShadowKind): Promise<void> {
        try {
            const image = new Image();
            image.src = new URL(`/env/shadow-${kind}.png`, location.href).href;
            await image.decode();
            const texture = new pc.Texture(this.app.graphicsDevice, {
                width: image.width, height: image.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
                minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE, name: `shadow-${kind}`
            });
            texture.setSource(image);
            const material = new pc.StandardMaterial();
            material.useLighting = false;
            material.useSkybox = false;
            material.useFog = false;
            material.diffuse = new pc.Color(0, 0, 0);
            material.emissive = new pc.Color(0, 0, 0);
            material.opacityMap = texture;
            material.opacityMapChannel = 'a';
            material.opacity = SHADOW_OPACITY;
            material.blendType = pc.BLEND_NORMAL;
            material.depthWrite = false;
            material.cull = pc.CULLFACE_NONE;
            material.update();
            this.shadows.set(kind, { material, width: image.width, height: image.height });
        } catch (error) {
            console.warn(`[PixelActors] Failed to load shadow-${kind}`, error);
        }
    }

    /** 腳下的斜角橢圓陰影：掛在面向鏡頭的外層底下，本地 x = 畫面右、z = 畫面下 */
    private createShadow(kind: ShadowKind): pc.Entity | null {
        const shadow = this.shadows.get(kind);
        if (!shadow) return null;
        const entity = new pc.Entity('FootShadow');
        entity.addComponent('render', { type: 'plane', material: shadow.material, castShadows: false, receiveShadows: false });
        entity.setLocalScale(shadow.width / PX_PER_UNIT, 1, shadow.height / (PX_PER_UNIT * PITCH_SIN));
        entity.setLocalPosition(0, SHADOW_Y, 0);
        // 受擊閃白、狀態色調與隱身半透明不套用在陰影上
        entity.tags.add(NO_STATUS_FX_TAG);
        return entity;
    }

    has(setKey: string): boolean {
        return this.sheets.has(setKey);
    }

    /**
     * 把像素圖掛到視覺實體底下；feetY 是腳底相對實體原點的高度。素材未載入時傳回 false
     */
    attach(owner: pc.Entity, setKey: string, feetY: number): boolean {
        const set = ACTOR_SETS[setKey];
        const sheets = this.sheets.get(setKey);
        const idle = sheets?.get(set?.idle ?? '');
        if (!set || !sheets || !idle) return false;

        const material = createPixelMaterial(idle.texture, { depthWrite: true });
        const root = new pc.Entity('PixelActor');
        const flip = new pc.Entity('Flip');
        const quad = createSheetQuad(material, idle);
        flip.addChild(quad);
        root.addChild(flip);
        const shadow = set.shadow ? this.createShadow(set.shadow) : null;
        if (shadow) root.addChild(shadow);
        root.setLocalPosition(0, feetY, 0);
        owner.addChild(root);

        const actor: Actor = {
            owner, set, sheets, root, flip, quad, material, feetY,
            anim: set.idle, time: Math.random(), frameIndex: -1, facing: 1,
            lastPos: owner.getPosition().clone(), moveGrace: 0, action: null
        };
        this.actors.set(owner, actor);
        this.setFrame(actor, idle, 0);
        return true;
    }

    /** 視覺實體銷毀時呼叫，釋放材質 */
    detach(owner: pc.Entity): void {
        const actor = this.actors.get(owner);
        if (!actor) return;
        actor.material.destroy();
        actor.root.destroy();
        this.actors.delete(owner);
    }

    /** 播放一次攻擊或施法動作，並轉向技能方向 */
    playAction(owner: pc.Entity, action: ActorAction, direction?: { x: number; z: number }): void {
        const actor = this.actors.get(owner);
        const anim = actor?.set.actions?.[action];
        if (!actor || !anim) return;
        if (direction) this.face(actor, direction.x, direction.z);
        actor.action = anim;
        this.switchAnim(actor, anim);
    }

    /** 每個畫面幀更新：面向鏡頭、判斷移動、推進格數 */
    update(dt: number): void {
        // 鏡頭水平朝向與俯角補償（forward 的水平長度就是 cos(俯角)）
        let yawDeg: number | null = null;
        let stretch = 1;
        const down = screenDown();
        if (this.camera) {
            const forward = this.camera.forward;
            const horizontal = Math.hypot(forward.x, forward.z);
            if (horizontal > 1e-3) {
                yawDeg = (Math.atan2(-forward.x, -forward.z) * 180) / Math.PI;
                stretch = 1 / horizontal;
            }
        }

        for (const actor of this.actors.values()) {
            // 物件池中閒置（從場景移除）或隱藏的單位不更新
            if (!actor.owner.parent || !actor.owner.enabled) continue;

            if (yawDeg !== null) {
                actor.root.setEulerAngles(0, yawDeg, 0);
                actor.root.setLocalScale(1, stretch, 1);
            }
            const radius = actor.set.groundRadius ?? 0;
            if (radius > 0) actor.root.setLocalPosition(down.x * radius, actor.feetY, down.z * radius);

            const pos = actor.owner.getPosition();
            const dx = pos.x - actor.lastPos.x;
            const dz = pos.z - actor.lastPos.z;
            actor.lastPos.copy(pos);
            const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
            if (speed > MOVE_SPEED_THRESHOLD && actor.set.move) {
                actor.moveGrace = MOVE_GRACE_SECONDS;
                // 動作播放中維持技能方向
                if (!actor.action) this.face(actor, dx, dz);
            } else {
                actor.moveGrace = Math.max(0, actor.moveGrace - dt);
            }

            let sheet = actor.sheets.get(actor.anim)!;
            const count = sheet.json.frames.length;
            actor.time += dt;
            let index = Math.floor(actor.time * sheet.json.meta.pixelfx.fps);

            if (actor.action && index >= count) actor.action = null;
            if (!actor.action) {
                const next = actor.moveGrace > 0 && actor.set.move ? actor.set.move : actor.set.idle;
                if (next !== actor.anim) {
                    this.switchAnim(actor, next);
                    sheet = actor.sheets.get(next)!;
                    index = 0;
                }
            }
            // 一次性動作停在最後一格；待機與移動一律循環（小兵的待機是攻擊動作）
            const looping = !actor.action;
            this.setFrame(actor, sheet, looping ? index % count : Math.min(index, count - 1));
        }
    }

    private switchAnim(actor: Actor, anim: string): void {
        const sheet = actor.sheets.get(anim);
        if (!sheet) return;
        actor.anim = anim;
        actor.time = 0;
        actor.frameIndex = -1;
        actor.material.emissiveMap = sheet.texture;
        actor.material.opacityMap = sheet.texture;
        fitQuadToSheet(actor.quad, sheet);
        this.setFrame(actor, sheet, 0);
    }

    private setFrame(actor: Actor, sheet: PixelSheet, index: number): void {
        if (actor.frameIndex === index) return;
        actor.frameIndex = index;
        setSheetFrame(actor.material, sheet, index);
    }

    /** 世界方向投影到鏡頭右方，決定畫面上面向左或右 */
    private face(actor: Actor, x: number, z: number): void {
        if (!actor.set.flip) return;
        const right = this.camera?.right;
        const sx = right ? x * right.x + z * right.z : x;
        if (Math.abs(sx) < 1e-3) return;
        const facing = sx < 0 ? -1 : 1;
        if (facing === actor.facing) return;
        actor.facing = facing;
        actor.flip.setLocalScale(facing, 1, 1);
    }

    clear(): void {
        for (const actor of this.actors.values()) actor.material.destroy();
        this.actors.clear();
    }
}
