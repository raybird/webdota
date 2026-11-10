/**
 * MapCollision - 英雄與小兵的移動碰撞（docs/gameplay-v2/features/f5-map-v2.md）
 *
 * 只看水平面：牆、木箱、柱子、建築與封閉區是障礙物，單位以移動佔位（圓）與它們推開，貼牆時沿牆滑動。
 * 單位之間不互相阻擋。Host 與 Client 用同一份資料與程式，Client 的本地預測才會與 Host 一致。
 * 移動分成小步推進，擊退、衝刺這類一次移動很遠的位移也不會穿過薄牆。
 */

import type { MapConfig } from './MapData';

export type Obstacle =
    | { kind: 'rect'; x: number; z: number; hw: number; hd: number }
    | { kind: 'circle'; x: number; z: number; r: number };

export interface GroundPoint {
    x: number;
    z: number;
}

/** 每一小步的最大距離（牆厚 2、移動佔位直徑 0.7 以上，0.25 不會穿過） */
const STEP = 0.25;
/** 推開的反覆次數（同時碰到兩個障礙物的轉角） */
const RESOLVE_ITERATIONS = 4;
/** 重疊小於這個值視為剛好貼著，避免浮點誤差讓貼牆的位置被當成重疊 */
const EPSILON = 1e-6;
/** 比這更矮的積木不擋路（地面標記之類） */
const MIN_BLOCK_HEIGHT = 0.3;

export class MapCollision {
    private statics: Obstacle[];
    private structures: Obstacle[] = [];
    private bounds: { minX: number; maxX: number; minZ: number; maxZ: number };

    constructor(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, statics: Obstacle[]) {
        this.bounds = bounds;
        this.statics = statics;
    }

    /** 建築（塔、主堡）會被摧毀，每幀由 GameEngine 更新 */
    setStructures(obstacles: Obstacle[]): void {
        this.structures = obstacles;
    }

    /** 從 from 往 to 移動，碰到障礙物時沿著表面滑動；回傳實際到達的位置 */
    move(from: GroundPoint, to: GroundPoint, radius: number): GroundPoint {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const distance = Math.hypot(dx, dz);
        if (distance === 0) return this.resolve(from, radius);

        const steps = Math.ceil(distance / STEP);
        const sx = dx / steps;
        const sz = dz / steps;
        let p = { x: from.x, z: from.z };
        for (let i = 0; i < steps; i++) {
            const next = this.resolve({ x: p.x + sx, z: p.z + sz }, radius);
            p = this.slideAroundCircle(p, next, sx, sz, radius);
        }
        return p;
    }

    /** 把位置推到不與任何障礙物重疊的地方（瞬移落點、重生點） */
    resolve(p: GroundPoint, radius: number): GroundPoint {
        let x = p.x;
        let z = p.z;
        for (let iter = 0; iter < RESOLVE_ITERATIONS; iter++) {
            let moved = false;
            for (const o of this.obstacles()) {
                const push = penetration(o, x, z, radius);
                if (!push) continue;
                x += push.x;
                z += push.z;
                moved = true;
            }
            const b = this.bounds;
            const cx = Math.min(Math.max(x, b.minX + radius), b.maxX - radius);
            const cz = Math.min(Math.max(z, b.minZ + radius), b.maxZ - radius);
            if (cx !== x || cz !== z) moved = true;
            x = cx;
            z = cz;
            if (!moved) break;
        }
        return { x, z };
    }

    /** 位置是否與障礙物重疊（測試與除錯用） */
    blocked(p: GroundPoint, radius: number): boolean {
        return this.obstacles().some(o => penetration(o, p.x, p.z, radius) !== null);
    }

    /** 地圖本身的障礙物（不含建築），小地圖用 */
    staticObstacles(): readonly Obstacle[] {
        return this.statics;
    }

    /** 障礙物列表（除錯畫面用） */
    obstacles(): Obstacle[] {
        return this.structures.length ? [...this.statics, ...this.structures] : this.statics;
    }

    /**
     * 正面撞上圓形障礙物（柱子、塔）時推開的方向剛好與移動方向相反，會原地卡住；
     * 這時改沿圓的切線前進，小兵沿主路走到塔前也能繞過去。
     */
    private slideAroundCircle(prev: GroundPoint, next: GroundPoint, sx: number, sz: number, radius: number): GroundPoint {
        const stepLength = Math.hypot(sx, sz);
        const progress = ((next.x - prev.x) * sx + (next.z - prev.z) * sz) / stepLength;
        if (progress > stepLength * 0.2) return next;

        const circle = this.obstacles().find(
            (o): o is Extract<Obstacle, { kind: 'circle' }> =>
                o.kind === 'circle' && Math.hypot(next.x - o.x, next.z - o.z) < o.r + radius + 0.01
        );
        if (!circle) return next;

        const nx = next.x - circle.x;
        const nz = next.z - circle.z;
        const len = Math.hypot(nx, nz) || 1;
        // 切線取與移動方向同側；正對圓心時固定往右手邊繞
        let tx = -nz / len;
        let tz = nx / len;
        if (tx * sx + tz * sz < 0) {
            tx = -tx;
            tz = -tz;
        }
        return this.resolve({ x: next.x + tx * stepLength, z: next.z + tz * stepLength }, radius);
    }
}

/** 圓（單位）與障礙物重疊時，把圓推出去的位移；沒重疊回傳 null */
function penetration(o: Obstacle, x: number, z: number, radius: number): GroundPoint | null {
    if (o.kind === 'circle') {
        const dx = x - o.x;
        const dz = z - o.z;
        const dist = Math.hypot(dx, dz);
        const overlap = o.r + radius - dist;
        if (overlap <= EPSILON) return null;
        if (dist === 0) return { x: overlap, z: 0 };
        return { x: (dx / dist) * overlap, z: (dz / dist) * overlap };
    }

    // 矩形：圓心到矩形最近點
    const px = Math.min(Math.max(x, o.x - o.hw), o.x + o.hw);
    const pz = Math.min(Math.max(z, o.z - o.hd), o.z + o.hd);
    const dx = x - px;
    const dz = z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > 0) {
        const overlap = radius - dist;
        if (overlap <= EPSILON) return null;
        return { x: (dx / dist) * overlap, z: (dz / dist) * overlap };
    }
    // 圓心在矩形內：往穿透最淺的一邊推出
    const left = x - (o.x - o.hw);
    const right = o.x + o.hw - x;
    const back = z - (o.z - o.hd);
    const front = o.z + o.hd - z;
    const min = Math.min(left, right, back, front);
    if (min === left) return { x: -(left + radius), z: 0 };
    if (min === right) return { x: right + radius, z: 0 };
    if (min === back) return { x: 0, z: -(back + radius) };
    return { x: 0, z: front + radius };
}

/** 地圖的靜態障礙物：會擋路的積木（忽略旋轉）與封閉區 */
export function obstaclesFromMap(config: MapConfig): Obstacle[] {
    const obstacles: Obstacle[] = [];
    for (const block of config.blocks) {
        if (block.isCollider === false || block.scale[1] < MIN_BLOCK_HEIGHT) continue;
        const [x, , z] = block.position;
        if (block.type === 'cylinder') {
            obstacles.push({ kind: 'circle', x, z, r: block.scale[0] / 2 });
        } else {
            obstacles.push({ kind: 'rect', x, z, hw: block.scale[0] / 2, hd: block.scale[2] / 2 });
        }
    }
    for (const zone of config.deadZones ?? []) {
        obstacles.push({ kind: 'rect', x: zone.x, z: zone.z, hw: zone.w / 2, hd: zone.d / 2 });
    }
    return obstacles;
}

export function mapCollisionFor(config: MapConfig): MapCollision {
    const hw = config.size.w / 2;
    const hh = config.size.h / 2;
    return new MapCollision({ minX: -hw, maxX: hw, minZ: -hh, maxZ: hh }, obstaclesFromMap(config));
}

// 目前地圖的碰撞資料：ECS 系統（AI、擊退）與 GameEngine 共用同一份
let active: MapCollision | null = null;

export function setActiveMapCollision(collision: MapCollision | null): void {
    active = collision;
}

export function activeMapCollision(): MapCollision | null {
    return active;
}

/** 有地圖碰撞時沿牆移動，沒有時（測試、地圖尚未載入）直接到目的地 */
export function moveWithCollision(from: GroundPoint, to: GroundPoint, radius: number): GroundPoint {
    return active ? active.move(from, to, radius) : { x: to.x, z: to.z };
}

/** 瞬移落點：可以越過薄牆，落點重疊時推到旁邊；推不出來或落在牆的另一側封閉區時，改成走過去停在牆邊 */
export function teleportDestination(from: GroundPoint, to: GroundPoint, radius: number): GroundPoint {
    if (!active) return { x: to.x, z: to.z };
    const landed = active.resolve(to, radius);
    if (!active.blocked(landed, radius)) return landed;
    return active.move(from, to, radius);
}
