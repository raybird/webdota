import { describe, it, expect } from 'vitest';
import { MapCollision, mapCollisionFor, type Obstacle } from '../MapCollision';
import type { MapConfig } from '../MapData';
import arenaV2 from '../../../data/maps/arena_v2.json';
import { FOOTPRINT } from '../../../data/balance';

const R = FOOTPRINT.hero;
const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

/** 以每秒 5、每幀 1/60 秒的速度往 dir 走 seconds 秒 */
function walk(c: MapCollision, from: { x: number; z: number }, dir: { x: number; z: number }, seconds: number) {
    const len = Math.hypot(dir.x, dir.z);
    const step = (5 / 60) / len;
    let p = from;
    for (let i = 0; i < seconds * 60; i++) p = c.move(p, { x: p.x + dir.x * step, z: p.z + dir.z * step }, R);
    return p;
}

describe('MapCollision', () => {
    const wall: Obstacle = { kind: 'rect', x: 0, z: 0, hw: 1, hd: 5 };

    it('不能穿牆', () => {
        const c = new MapCollision(bounds, [wall]);
        const p = walk(c, { x: -5, z: 0 }, { x: 1, z: 0 }, 3);
        expect(p.x).toBeCloseTo(-1 - R, 2);
        expect(c.blocked(p, R)).toBe(false);
    });

    it('斜著撞牆時沿牆滑動', () => {
        const c = new MapCollision(bounds, [{ kind: 'rect', x: 0, z: 0, hw: 1, hd: 15 }]);
        const p = walk(c, { x: -5, z: 0 }, { x: 1, z: 1 }, 2);
        expect(p.x).toBeCloseTo(-1 - R, 2);
        expect(p.z).toBeGreaterThan(4);
    });

    it('一次移動很遠（擊退、衝刺）也不會穿過薄牆', () => {
        const c = new MapCollision(bounds, [wall]);
        const p = c.move({ x: -2, z: 0 }, { x: 6, z: 0 }, R);
        expect(p.x).toBeLessThan(-1);
    });

    it('正面撞上圓柱會繞過去，不會卡住', () => {
        const c = new MapCollision(bounds, [{ kind: 'circle', x: 0, z: 0, r: 1 }]);
        const p = walk(c, { x: -5, z: 0 }, { x: 1, z: 0 }, 3);
        expect(p.x).toBeGreaterThan(2);
    });

    it('不能走出地圖', () => {
        const c = new MapCollision(bounds, []);
        const p = walk(c, { x: 0, z: 0 }, { x: 0, z: 1 }, 6);
        expect(p.z).toBeCloseTo(20 - R, 5);
    });

    it('瞬移落在牆裡時推到牆外', () => {
        const c = new MapCollision(bounds, [wall]);
        const p = c.resolve({ x: 0.5, z: 0 }, R);
        expect(c.blocked(p, R)).toBe(false);
        expect(p.x).toBeCloseTo(1 + R, 5);
    });

    it('建築可以隨時更新（被摧毀後不再擋路）', () => {
        const c = new MapCollision(bounds, []);
        c.setStructures([{ kind: 'circle', x: 0, z: 0, r: 1 }]);
        expect(c.blocked({ x: 0.5, z: 0 }, R)).toBe(true);
        c.setStructures([]);
        expect(c.blocked({ x: 0.5, z: 0 }, R)).toBe(false);
    });
});

describe('arena_v2', () => {
    const map = arenaV2 as unknown as MapConfig;
    const c = mapCollisionFor(map);
    const at = (type: string, team: string) => {
        const e = map.entities.find(e => e.type === type && e.team === team)!;
        return { x: e.position[0], z: e.position[2] };
    };

    it('出生點、小兵出生點、中繼點都不在障礙物裡', () => {
        for (const team of ['blue', 'red']) {
            expect(c.blocked(at('spawn_point', team), R)).toBe(false);
            expect(c.blocked(at('creep_spawn', team), FOOTPRINT.creep)).toBe(false);
            for (const [x, z] of map.lanes![team as 'blue']!) {
                // 中繼點可能在中央柱旁，只要求不在牆裡
                expect(c.blocked({ x: x + 2, z: z - 2 }, R) && c.blocked({ x: x - 2, z: z + 2 }, R)).toBe(false);
            }
        }
    });

    it('封閉區走不進去', () => {
        for (const zone of map.deadZones!) {
            expect(c.blocked({ x: zone.x, z: zone.z }, R)).toBe(true);
        }
    });

    it('沿主路從藍方走到紅方主堡前約 19 秒內', () => {
        const blue = map.lanes!.blue!;
        let p = { x: -36, z: -33 };
        let t = 0;
        for (const [x, z] of blue) {
            while (Math.hypot(x - p.x, z - p.z) > 0.6 && t < 60) {
                const d = { x: x - p.x, z: z - p.z };
                const len = Math.hypot(d.x, d.z);
                p = c.move(p, { x: p.x + (d.x / len) * (5 / 60), z: p.z + (d.z / len) * (5 / 60) }, R);
                t += 1 / 60;
            }
        }
        expect(Math.hypot(33 - p.x, 33 - p.z)).toBeLessThan(1);
        expect(t).toBeGreaterThan(17);
        expect(t).toBeLessThan(22);
    });
});
