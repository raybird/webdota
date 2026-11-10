import { describe, it, expect } from 'vitest';
import { shieldedStructures } from '../structureOrder';

const blue = (id: string, order: number | undefined, alive = true) => ({ id, team: 'blue', order, alive });

describe('shieldedStructures', () => {
    it('外塔還在時，內塔、前塔、主堡都受保護', () => {
        const s = shieldedStructures([blue('outer', 1), blue('inner', 2), blue('front', 3), blue('base', 4)]);
        expect([...s].sort()).toEqual(['base', 'front', 'inner']);
    });

    it('外塔破了換內塔可以打', () => {
        const s = shieldedStructures([blue('outer', 1, false), blue('inner', 2), blue('front', 3), blue('base', 4)]);
        expect([...s].sort()).toEqual(['base', 'front']);
    });

    it('三座塔都破了，主堡可以打', () => {
        const s = shieldedStructures([blue('inner', 2, false), blue('front', 3, false), blue('base', 4)]);
        expect(s.size).toBe(0);
    });

    it('兩隊各自計算', () => {
        const s = shieldedStructures([blue('b1', 1, false), blue('b2', 2), { id: 'r1', team: 'red', order: 1, alive: true }, { id: 'r2', team: 'red', order: 2, alive: true }]);
        expect([...s]).toEqual(['r2']);
    });

    it('沒有順序的建築不受保護', () => {
        expect(shieldedStructures([blue('a', undefined), blue('b', undefined)]).size).toBe(0);
    });
});
