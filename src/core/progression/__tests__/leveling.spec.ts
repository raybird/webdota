import { describe, it, expect } from 'vitest';
import {
    MAX_XP, levelOf, levelProgress, respawnSecondsFor, levelHpBonus, damageMultiplierFor,
    isUltimateUnlocked, splitXp, heroKillXp, structureXp
} from '../leveling';

describe('等級門檻', () => {
    it('0 經驗是 1 級，150 升 2 級，350 升 3 級', () => {
        expect(levelOf(0)).toBe(1);
        expect(levelOf(149)).toBe(1);
        expect(levelOf(150)).toBe(2);
        expect(levelOf(349)).toBe(2);
        expect(levelOf(350)).toBe(3);
    });

    it('累計 3150 到 10 級，之後不再升', () => {
        expect(MAX_XP).toBe(3150);
        expect(levelOf(3149)).toBe(9);
        expect(levelOf(3150)).toBe(10);
        expect(levelOf(99999)).toBe(10);
    });

    it('等級內進度', () => {
        expect(levelProgress(200)).toEqual({ level: 2, current: 50, need: 200 });
        expect(levelProgress(3150)).toEqual({ level: 10, current: 0, need: 0 });
    });
});

describe('成長', () => {
    it('復活時間 4 + 等級 × 0.8', () => {
        expect(respawnSecondsFor(1)).toBeCloseTo(4.8);
        expect(respawnSecondsFor(10)).toBeCloseTo(12);
    });

    it('每級最大生命 +8%、技能傷害 +5%', () => {
        expect(levelHpBonus(1000, 1)).toBe(0);
        expect(levelHpBonus(1000, 4)).toBe(240);
        expect(damageMultiplierFor(1)).toBe(1);
        expect(damageMultiplierFor(5)).toBeCloseTo(1.2);
    });

    it('大招 4 級解鎖', () => {
        expect(isUltimateUnlocked(3)).toBe(false);
        expect(isUltimateUnlocked(4)).toBe(true);
    });
});

describe('經驗分配', () => {
    it('平分給所有人', () => {
        expect(splitXp(30, ['a', 'b', 'c'])).toEqual([{ id: 'a', xp: 10 }, { id: 'b', xp: 10 }, { id: 'c', xp: 10 }]);
        expect(splitXp(30, [])).toEqual([]);
    });

    it('擊殺英雄 50 + 被殺者等級 × 20', () => {
        expect(heroKillXp(1)).toBe(70);
        expect(heroKillXp(5)).toBe(150);
    });

    it('建築：主堡前塔 120，其他塔 80', () => {
        expect(structureXp(1)).toBe(80);
        expect(structureXp(2)).toBe(80);
        expect(structureXp(3)).toBe(120);
    });
});
