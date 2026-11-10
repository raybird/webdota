/**
 * 等級與經驗的計算（docs/gameplay-v2/features/f6-leveling.md，數值在 balance.ts 的 LEVELING）
 *
 * 只存累計經驗，等級由經驗推得：Host 與 Client 用同一份規則，同步時只要傳經驗。
 */

import { LEVELING } from '../../data/balance';

/** 累計經驗的上限（滿級所需），超過的經驗不再累加 */
export const MAX_XP = LEVELING.thresholds.reduce((sum, n) => sum + n, 0);

export function levelOf(totalXp: number): number {
    let level = 1;
    let need = 0;
    for (const step of LEVELING.thresholds) {
        need += step;
        if (totalXp < need) break;
        level++;
    }
    return Math.min(level, LEVELING.maxLevel);
}

/** 目前等級內的進度：已得、這一級需要；滿級時 need 為 0 */
export function levelProgress(totalXp: number): { level: number; current: number; need: number } {
    const level = levelOf(totalXp);
    if (level >= LEVELING.maxLevel) return { level, current: 0, need: 0 };
    const before = LEVELING.thresholds.slice(0, level - 1).reduce((sum, n) => sum + n, 0);
    return { level, current: totalXp - before, need: LEVELING.thresholds[level - 1]! };
}

export function respawnSecondsFor(level: number): number {
    return LEVELING.respawnBase + level * LEVELING.respawnPerLevel;
}

/** 最大生命的成長量（以基礎生命計，裝備加成另外加） */
export function levelHpBonus(baseMaxHp: number, level: number): number {
    return Math.round(baseMaxHp * LEVELING.hpPerLevel * (level - 1));
}

export function damageMultiplierFor(level: number): number {
    return 1 + LEVELING.damagePerLevel * (level - 1);
}

export function isUltimateUnlocked(level: number): boolean {
    return level >= LEVELING.ultimateUnlockLevel;
}

/** 平分經驗；沒有人可分時回傳空陣列 */
export function splitXp<Id>(amount: number, recipients: readonly Id[]): { id: Id; xp: number }[] {
    if (recipients.length === 0) return [];
    const share = amount / recipients.length;
    return recipients.map(id => ({ id, xp: share }));
}

export function heroKillXp(victimLevel: number): number {
    return LEVELING.heroKillBase + victimLevel * LEVELING.heroKillPerLevel;
}

export function structureXp(order: number | undefined): number {
    return order === LEVELING.frontTowerOrder ? LEVELING.frontTowerXp : LEVELING.towerXp;
}
