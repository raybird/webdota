/**
 * TowerFeedback - 防禦塔（含主堡）的攻擊回饋
 *
 * - 光彈：塔頂水晶射出隊伍色光彈飛向目標，命中時爆開（傷害由 Host 的 AISystem 在命中時結算）。
 *   Host 由 TOWER_ATTACK 事件播放並轉播，Client 由網路訊息播放，兩端看到的是同一發。
 * - 射程圈：本地玩家接近敵方建築時，地面出現像素虛線橢圓；進入射程後變成紅色實線。
 *   圈的貼圖照畫面比例畫（水平每單位 19px、縱深每單位 11.4px），平面依視角轉向，像素與螢幕 1:1。
 */

import * as pc from 'playcanvas';
import type { SpriteFxManager } from './SpriteFxManager';
import type { ECSStructureManager } from './managers/ECSStructureManager';
import type { MapManager } from './map/MapManager';
import { World, ComponentType, TeamComponent, TransformComponent, type EntityId, type Team } from './ecs';
import { PX_PER_UNIT } from './pixelSheet';
import { PITCH_SIN, screenDown } from './view';

/** 光彈的發射高度（塔頂水晶、主堡核心） */
const MUZZLE_HEIGHT: Record<'tower' | 'base', number> = { tower: 4.1, base: 4.6 };
/** 命中點相對目標原點的高度（玩家與小兵的原點在地面上 1 單位） */
const IMPACT_Y_OFFSET = -0.2;

/** 距離射程多少單位內開始顯示射程圈 */
const RANGE_WARN_MARGIN = 4;
const RING_Y = 0.02;
const RING_COLOR_NEAR = new pc.Color(1, 0.92, 0.75);
const RING_COLOR_INSIDE = new pc.Color(1, 0.3, 0.25);
const RING_OPACITY_NEAR = 0.45;
const RING_OPACITY_INSIDE = 0.8;
/** 地圖沒有設定射程時的預設值（與 EntityFactory 相同） */
const DEFAULT_RANGE: Record<'tower' | 'base', number> = { tower: 10, base: 8 };

interface Ring {
    entity: pc.Entity;
    material: pc.StandardMaterial;
    texture: pc.Texture;
    range: number;
    state: 'hidden' | 'near' | 'inside';
}

export class TowerFeedback {
    private app: pc.Application;
    private world: World;
    private spriteFx: SpriteFxManager;
    private structures: ECSStructureManager;
    private mapManager: MapManager;
    private rings = new Map<EntityId, Ring>();

    constructor(app: pc.Application, world: World, spriteFx: SpriteFxManager, structures: ECSStructureManager, mapManager: MapManager) {
        this.app = app;
        this.world = world;
        this.spriteFx = spriteFx;
        this.structures = structures;
        this.mapManager = mapManager;
    }

    // ==================== 光彈 ====================

    /** 播放一發光彈：flightTime 秒內從發射點飛到目標（跟著目標移動），抵達時爆開 */
    playBolt(attackerId: EntityId, targetId: EntityId, flightTime: number): void {
        const start = this.world.getComponent<TransformComponent>(attackerId, ComponentType.TRANSFORM)?.position;
        const team = this.world.getComponent<TeamComponent>(attackerId, ComponentType.TEAM)?.team;
        const kind = this.structures.getAll().get(attackerId)?.kind ?? 'tower';
        if (!start || (team !== 'red' && team !== 'blue')) return;

        const from = { x: start.x, y: start.y + MUZZLE_HEIGHT[kind], z: start.z };
        const targetPos = () => {
            const p = this.world.getComponent<TransformComponent>(targetId, ComponentType.TRANSFORM)?.position;
            return p ? { x: p.x, y: p.y + IMPACT_Y_OFFSET, z: p.z } : null;
        };
        const to = targetPos();
        if (!to) return;

        // 目標移動時光彈跟著追；目標消失時停在最後位置
        let last = to;
        const startedAt = performance.now();
        const follow = () => {
            last = targetPos() ?? last;
            const t = Math.min(1, (performance.now() - startedAt) / 1000 / Math.max(flightTime, 0.01));
            return { x: from.x + (last.x - from.x) * t, y: from.y + (last.y - from.y) * t, z: from.z + (last.z - from.z) * t };
        };
        const direction = { x: to.x - from.x, z: to.z - from.z };
        const bolt = this.spriteFx.play(`tower-bolt-${team}`, from, { duration: flightTime, direction, follow })
            // 素材未載入時退回火球
            ?? this.spriteFx.play('fireball', from, { duration: flightTime, direction, follow });
        void bolt;
        this.spriteFx.play(`tower-impact-${team}`, to, { delay: flightTime, follow: () => targetPos() ?? last })
            ?? this.spriteFx.play('fireball-impact', to, { delay: flightTime, follow: () => targetPos() ?? last });
    }

    // ==================== 射程圈 ====================

    /**
     * 每個畫面幀更新：建立新出現的敵方建築的射程圈、移除已摧毀的，依本地玩家距離切換顯示
     */
    update(localTeam: Team | null, localPosition: pc.Vec3 | null): void {
        for (const [entityId, ring] of this.rings) {
            if (this.world.hasEntity(entityId)) continue;
            this.destroyRing(ring);
            this.rings.delete(entityId);
        }

        for (const [entityId, { kind, team }] of this.structures.getAll()) {
            if (!this.world.hasEntity(entityId) || !localTeam || team === localTeam) continue;
            const center = this.world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)?.position;
            if (!center) continue;
            let ring = this.rings.get(entityId);
            if (!ring) {
                ring = this.createRing(center, this.rangeAt(kind, center));
                this.rings.set(entityId, ring);
            }
            const distance = localPosition ? Math.hypot(localPosition.x - center.x, localPosition.z - center.z) : Infinity;
            this.setRingState(ring, distance <= ring.range ? 'inside' : distance <= ring.range + RANGE_WARN_MARGIN ? 'near' : 'hidden');
        }
    }

    /** 視角改變（遊戲開始依隊伍設定）時重建射程圈，讓貼圖方向跟著視角 */
    resetRings(): void {
        for (const ring of this.rings.values()) this.destroyRing(ring);
        this.rings.clear();
    }

    destroy(): void {
        this.resetRings();
    }

    /** 射程取地圖設定（Client 的建築鏡像沒有同步射程） */
    private rangeAt(kind: 'tower' | 'base', center: pc.Vec3): number {
        for (const entity of this.mapManager.getEntitiesByType(kind)) {
            const [x = 0, , z = 0] = entity.position;
            if (Math.hypot(x - center.x, z - center.z) < 0.5) {
                const range = entity.config?.attackRange;
                if (typeof range === 'number') return range;
            }
        }
        return DEFAULT_RANGE[kind];
    }

    private setRingState(ring: Ring, state: Ring['state']): void {
        if (ring.state === state) return;
        ring.state = state;
        ring.entity.enabled = state !== 'hidden';
        if (state === 'hidden') return;
        ring.material.emissive = state === 'inside' ? RING_COLOR_INSIDE : RING_COLOR_NEAR;
        ring.material.opacity = state === 'inside' ? RING_OPACITY_INSIDE : RING_OPACITY_NEAR;
        ring.material.update();
    }

    /**
     * 射程圈：照畫面比例畫的橢圓（虛線），平面的本地 x 對齊畫面右方、z 對齊畫面下方
     */
    private createRing(center: pc.Vec3, range: number): Ring {
        const width = Math.round(range * 2 * PX_PER_UNIT);
        const height = Math.round(range * 2 * PX_PER_UNIT * PITCH_SIN);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        // 虛線：約每 14px 一段
        ctx.setLineDash([9, 5]);
        ctx.beginPath();
        ctx.ellipse(width / 2, height / 2, width / 2 - 2, height / 2 - 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        // 二值化（canvas 筆畫有抗鋸齒）
        const image = ctx.getImageData(0, 0, width, height);
        for (let i = 3; i < image.data.length; i += 4) {
            const on = image.data[i]! >= 100;
            image.data[i - 3] = image.data[i - 2] = image.data[i - 1] = 255;
            image.data[i] = on ? 255 : 0;
        }
        ctx.putImageData(image, 0, 0);

        const texture = new pc.Texture(this.app.graphicsDevice, {
            width, height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
            minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE, name: 'tower-range'
        });
        texture.setSource(canvas);

        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.diffuse = new pc.Color(0, 0, 0);
        material.emissive = RING_COLOR_NEAR;
        material.emissiveMap = texture;
        material.opacityMap = texture;
        material.opacityMapChannel = 'a';
        material.opacity = RING_OPACITY_NEAR;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.cull = pc.CULLFACE_NONE;
        material.update();

        const entity = new pc.Entity('TowerRange');
        entity.addComponent('render', { type: 'plane', material, castShadows: false, receiveShadows: false });
        entity.setPosition(center.x, RING_Y, center.z);
        // 本地 +z 轉到畫面下方（朝向鏡頭），本地 x 就是畫面右方
        const down = screenDown();
        entity.setEulerAngles(0, (Math.atan2(down.x, down.z) * 180) / Math.PI, 0);
        entity.setLocalScale(range * 2, 1, range * 2);
        entity.enabled = false;
        this.app.root.addChild(entity);
        return { entity, material, texture, range, state: 'hidden' };
    }

    private destroyRing(ring: Ring): void {
        ring.entity.destroy();
        ring.material.destroy();
        ring.texture.destroy();
    }
}
