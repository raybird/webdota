/**
 * TowerFeedback - 防禦塔（含主堡）的攻擊回饋
 *
 * - 光彈：塔頂水晶射出隊伍色光彈飛向目標，命中時爆開（傷害由 Host 的 AISystem 在命中時結算）。
 *   Host 由 TOWER_ATTACK 事件播放並轉播，Client 由網路訊息播放，兩端看到的是同一發。
 * - 射程圈：本地玩家接近敵方建築時，地面出現像素虛線橢圓；進入射程後變成紅色。
 * - 鎖定指示：敵方建築鎖定的目標（最近一發光彈的目標）腳下出現準星，地面有一條從建築流向目標的虛線；
 *   鎖定的是自己時為紅色。目標離開射程、死亡，或建築超過一輪冷卻沒再開火時消失。
 *
 * 地面貼圖照畫面比例畫（水平每單位 19px、縱深每單位 11.4px），平面依視角轉向，像素與螢幕 1:1。
 */

import * as pc from 'playcanvas';
import type { SpriteFxManager } from './SpriteFxManager';
import type { ECSStructureManager } from './managers/ECSStructureManager';
import {
    World, ComponentType, AIComponent, HealthComponent, TeamComponent, TransformComponent,
    type EntityId, type Team
} from './ecs';
import { PX_PER_UNIT } from './pixelSheet';
import { PITCH_SIN, screenDown } from './view';

/** 光彈的發射高度（塔頂水晶、主堡核心） */
const MUZZLE_HEIGHT: Record<'tower' | 'base', number> = { tower: 4.1, base: 4.6 };
/** 命中點相對目標原點的高度（玩家與小兵的原點在地面上 1 單位） */
const IMPACT_Y_OFFSET = -0.2;
/** 建築底面半徑：鎖定線從底面邊緣出發 */
const FOOTPRINT_RADIUS: Record<'tower' | 'base', number> = { tower: 1, base: 2.5 };

/** 距離射程多少單位內開始顯示射程圈 */
const RANGE_WARN_MARGIN = 4;
const RING_Y = 0.02;
const LOCK_Y = 0.03;
const COLOR_NEUTRAL = new pc.Color(1, 0.92, 0.75);
const COLOR_DANGER = new pc.Color(1, 0.3, 0.25);
const RING_OPACITY_NEAR = 0.45;
const RING_OPACITY_INSIDE = 0.8;

/** 鎖定：超過「冷卻 + 這個秒數」沒再開火就視為解除 */
const LOCK_GRACE = 0.6;
const RETICLE_RADIUS = 0.9;
const LOCK_LINE_WIDTH = 0.16;
/** 鎖定線的虛線週期（世界單位）與流動速度（單位／秒） */
const LOCK_DASH_LENGTH = 0.8;
const LOCK_FLOW_SPEED = 3;

interface GroundQuad {
    entity: pc.Entity;
    material: pc.StandardMaterial;
    texture: pc.Texture;
}

interface Ring extends GroundQuad {
    range: number;
    state: 'hidden' | 'near' | 'inside';
}

interface Lock {
    targetId: EntityId;
    lastShotAt: number;
    line: GroundQuad;
    reticle: GroundQuad;
    danger: boolean | null;
}

export class TowerFeedback {
    private app: pc.Application;
    private world: World;
    private spriteFx: SpriteFxManager;
    private structures: ECSStructureManager;
    private rings = new Map<EntityId, Ring>();
    private locks = new Map<EntityId, Lock>();
    private flow = 0;

    constructor(app: pc.Application, world: World, spriteFx: SpriteFxManager, structures: ECSStructureManager) {
        this.app = app;
        this.world = world;
        this.spriteFx = spriteFx;
        this.structures = structures;
    }

    // ==================== 光彈 ====================

    /** 播放一發光彈：flightTime 秒內從發射點飛到目標（跟著目標移動），抵達時爆開；同時更新鎖定目標 */
    playBolt(attackerId: EntityId, targetId: EntityId, flightTime: number): void {
        const start = this.positionOf(attackerId);
        const team = this.world.getComponent<TeamComponent>(attackerId, ComponentType.TEAM)?.team;
        const kind = this.kindOf(attackerId);
        if (!start || (team !== 'red' && team !== 'blue')) return;

        const from = { x: start.x, y: start.y + MUZZLE_HEIGHT[kind], z: start.z };
        const targetPos = () => {
            const p = this.positionOf(targetId);
            return p ? { x: p.x, y: p.y + IMPACT_Y_OFFSET, z: p.z } : null;
        };
        const to = targetPos();
        if (!to) return;

        this.setLock(attackerId, targetId);

        // 目標移動時光彈跟著追；目標消失時停在最後位置
        let last = to;
        const startedAt = performance.now();
        const follow = () => {
            last = targetPos() ?? last;
            const t = Math.min(1, (performance.now() - startedAt) / 1000 / Math.max(flightTime, 0.01));
            return { x: from.x + (last.x - from.x) * t, y: from.y + (last.y - from.y) * t, z: from.z + (last.z - from.z) * t };
        };
        const direction = { x: to.x - from.x, z: to.z - from.z };
        // 素材未載入時退回火球
        this.spriteFx.play(`tower-bolt-${team}`, from, { duration: flightTime, direction, follow })
            ?? this.spriteFx.play('fireball', from, { duration: flightTime, direction, follow });
        const impactAt = () => targetPos() ?? last;
        this.spriteFx.play(`tower-impact-${team}`, to, { delay: flightTime, follow: impactAt })
            ?? this.spriteFx.play('fireball-impact', to, { delay: flightTime, follow: impactAt });
    }

    // ==================== 每幀更新 ====================

    /**
     * 每個畫面幀更新射程圈與鎖定指示
     * @param localPlayerId 本地玩家的實體（死亡時傳 null：不顯示射程圈，鎖定指示照常）
     */
    update(dt: number, localTeam: Team | null, localPlayerId: EntityId | null): void {
        this.updateRings(localTeam, localPlayerId ? this.positionOf(localPlayerId) : null);
        this.updateLocks(dt, localTeam, localPlayerId);
    }

    /** 視角改變（遊戲開始依隊伍設定）時重建，讓貼圖方向跟著視角 */
    reset(): void {
        for (const ring of this.rings.values()) this.destroyQuad(ring);
        this.rings.clear();
        for (const lock of this.locks.values()) this.destroyLock(lock);
        this.locks.clear();
    }

    destroy(): void {
        this.reset();
    }

    // ==================== 射程圈 ====================

    private updateRings(localTeam: Team | null, localPosition: pc.Vec3 | null): void {
        for (const [entityId, ring] of this.rings) {
            if (this.world.hasEntity(entityId)) continue;
            this.destroyQuad(ring);
            this.rings.delete(entityId);
        }

        for (const [entityId, { team }] of this.structures.getAll()) {
            if (!this.world.hasEntity(entityId) || !localTeam || team === localTeam) continue;
            const center = this.positionOf(entityId);
            if (!center) continue;
            let ring = this.rings.get(entityId);
            if (!ring) {
                const range = this.rangeOf(entityId);
                const quad = this.createGroundQuad(ellipseCanvas(range, true), center, range, RING_Y, COLOR_NEUTRAL, RING_OPACITY_NEAR);
                ring = { ...quad, range, state: 'hidden' };
                this.rings.set(entityId, ring);
            }
            const distance = localPosition ? Math.hypot(localPosition.x - center.x, localPosition.z - center.z) : Infinity;
            this.setRingState(ring, distance <= ring.range ? 'inside' : distance <= ring.range + RANGE_WARN_MARGIN ? 'near' : 'hidden');
        }
    }

    private setRingState(ring: Ring, state: Ring['state']): void {
        if (ring.state === state) return;
        ring.state = state;
        ring.entity.enabled = state !== 'hidden';
        if (state === 'hidden') return;
        setQuadColor(ring, state === 'inside' ? COLOR_DANGER : COLOR_NEUTRAL, state === 'inside' ? RING_OPACITY_INSIDE : RING_OPACITY_NEAR);
    }

    // ==================== 鎖定指示 ====================

    private setLock(attackerId: EntityId, targetId: EntityId): void {
        const now = performance.now();
        const lock = this.locks.get(attackerId);
        if (lock) {
            lock.targetId = targetId;
            lock.lastShotAt = now;
            return;
        }
        const line = this.createGroundQuad(dashCanvas(), { x: 0, y: 0, z: 0 } as pc.Vec3, 1, LOCK_Y, COLOR_NEUTRAL, 0.5, true);
        line.entity.setEulerAngles(0, 0, 0);
        const reticle = this.createGroundQuad(ellipseCanvas(RETICLE_RADIUS, false), { x: 0, y: 0, z: 0 } as pc.Vec3, RETICLE_RADIUS, LOCK_Y, COLOR_NEUTRAL, 0.5);
        this.locks.set(attackerId, { targetId, lastShotAt: now, line, reticle, danger: null });
    }

    private updateLocks(dt: number, localTeam: Team | null, localPlayerId: EntityId | null): void {
        const now = performance.now();
        this.flow = (this.flow + dt * LOCK_FLOW_SPEED / LOCK_DASH_LENGTH) % 1;

        for (const [attackerId, lock] of this.locks) {
            const from = this.positionOf(attackerId);
            const to = this.positionOf(lock.targetId);
            const ai = this.world.getComponent<AIComponent>(attackerId, ComponentType.AI);
            const alive = !this.world.getComponent<HealthComponent>(lock.targetId, ComponentType.HEALTH)?.isDead();
            const team = this.world.getComponent<TeamComponent>(attackerId, ComponentType.TEAM)?.team;

            if (!from || !to || !ai || !alive) {
                this.destroyLock(lock);
                this.locks.delete(attackerId);
                continue;
            }
            const distance = Math.hypot(to.x - from.x, to.z - from.z);
            const active = distance <= ai.attackRange + 0.5
                && now - lock.lastShotAt <= (ai.attackCooldown + LOCK_GRACE) * 1000;
            // 只顯示敵方建築的鎖定：那是玩家要判斷能不能越塔的資訊
            const visible = active && !!localTeam && team !== localTeam;
            lock.line.entity.enabled = visible;
            lock.reticle.entity.enabled = visible;
            if (!visible) continue;

            const danger = lock.targetId === localPlayerId;
            if (lock.danger !== danger) {
                lock.danger = danger;
                setQuadColor(lock.line, danger ? COLOR_DANGER : COLOR_NEUTRAL, danger ? 0.9 : 0.55);
                setQuadColor(lock.reticle, danger ? COLOR_DANGER : COLOR_NEUTRAL, danger ? 0.9 : 0.6);
            }

            // 線從建築底面邊緣到準星邊緣；平面的本地 x 對齊線的方向
            const dx = (to.x - from.x) / (distance || 1);
            const dz = (to.z - from.z) / (distance || 1);
            const startOffset = FOOTPRINT_RADIUS[this.kindOf(attackerId)];
            const length = Math.max(0, distance - startOffset - RETICLE_RADIUS);
            const mid = startOffset + length / 2;
            lock.line.entity.setPosition(from.x + dx * mid, LOCK_Y, from.z + dz * mid);
            lock.line.entity.setEulerAngles(0, (Math.atan2(-dz, dx) * 180) / Math.PI, 0);
            lock.line.entity.setLocalScale(length, 1, LOCK_LINE_WIDTH);
            const tiling = length / LOCK_DASH_LENGTH;
            lock.line.material.emissiveMapTiling.set(tiling, 1);
            lock.line.material.opacityMapTiling.set(tiling, 1);
            // 虛線從建築往目標流動
            lock.line.material.emissiveMapOffset.set(-this.flow, 0);
            lock.line.material.opacityMapOffset.set(-this.flow, 0);
            lock.line.material.update();

            lock.reticle.entity.setPosition(to.x, LOCK_Y, to.z);
        }
    }

    private destroyLock(lock: Lock): void {
        this.destroyQuad(lock.line);
        this.destroyQuad(lock.reticle);
    }

    // ==================== 共用 ====================

    private positionOf(entityId: EntityId): pc.Vec3 | null {
        return this.world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM)?.position ?? null;
    }

    private kindOf(entityId: EntityId): 'tower' | 'base' {
        return this.structures.getAll().get(entityId)?.kind ?? 'tower';
    }

    private rangeOf(entityId: EntityId): number {
        return this.world.getComponent<AIComponent>(entityId, ComponentType.AI)?.attackRange ?? 10;
    }

    /**
     * 貼在地面的四邊形；預設本地 x 對齊畫面右方、z 對齊畫面下方，大小為 2·radius 見方
     */
    private createGroundQuad(
        canvas: HTMLCanvasElement, center: pc.Vec3, radius: number, y: number,
        color: pc.Color, opacity: number, repeat = false
    ): GroundQuad {
        const address = repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
        const texture = new pc.Texture(this.app.graphicsDevice, {
            width: canvas.width, height: canvas.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
            minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
            addressU: address, addressV: pc.ADDRESS_CLAMP_TO_EDGE, name: 'tower-feedback'
        });
        texture.setSource(canvas);

        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.diffuse = new pc.Color(0, 0, 0);
        material.emissive = color;
        material.emissiveMap = texture;
        material.opacityMap = texture;
        material.opacityMapChannel = 'a';
        material.opacity = opacity;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.cull = pc.CULLFACE_NONE;
        material.update();

        const entity = new pc.Entity('TowerFeedback');
        entity.addComponent('render', { type: 'plane', material, castShadows: false, receiveShadows: false });
        entity.setPosition(center.x, y, center.z);
        // 本地 +z 轉到畫面下方（朝向鏡頭），本地 x 就是畫面右方
        const down = screenDown();
        entity.setEulerAngles(0, (Math.atan2(down.x, down.z) * 180) / Math.PI, 0);
        entity.setLocalScale(radius * 2, 1, radius * 2);
        entity.enabled = false;
        this.app.root.addChild(entity);
        return { entity, material, texture };
    }

    private destroyQuad(quad: GroundQuad): void {
        quad.entity.destroy();
        quad.material.destroy();
        quad.texture.destroy();
    }
}

function setQuadColor(quad: GroundQuad, color: pc.Color, opacity: number): void {
    quad.material.emissive = color;
    quad.material.opacity = opacity;
    quad.material.update();
}

/** 照畫面比例畫的橢圓（白色、alpha 二值化） */
function ellipseCanvas(radius: number, dashed: boolean): HTMLCanvasElement {
    const width = Math.round(radius * 2 * PX_PER_UNIT);
    const height = Math.round(radius * 2 * PX_PER_UNIT * PITCH_SIN);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    // 虛線：約每 14px 一段
    if (dashed) ctx.setLineDash([9, 5]);
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width / 2 - 2, height / 2 - 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (!dashed) {
        // 準星：上下左右四個短刻度
        ctx.fillStyle = '#fff';
        ctx.fillRect(width / 2 - 1, 0, 2, 4);
        ctx.fillRect(width / 2 - 1, height - 4, 2, 4);
        ctx.fillRect(0, height / 2 - 1, 4, 2);
        ctx.fillRect(width - 4, height / 2 - 1, 4, 2);
    }
    binarize(ctx, width, height);
    return canvas;
}

/** 鎖定線的一個虛線週期：前 60% 實線 */
function dashCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 2;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 10, 2);
    return canvas;
}

/** canvas 筆畫有抗鋸齒，轉成只有全透明與全不透明 */
function binarize(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const image = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < image.data.length; i += 4) {
        const on = image.data[i]! >= 100;
        image.data[i - 3] = image.data[i - 2] = image.data[i - 1] = 255;
        image.data[i] = on ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
}
