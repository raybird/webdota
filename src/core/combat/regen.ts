/**
 * 自動回血的速度計算（Host 用），數值見 src/data/balance.ts 的 REGEN
 */

import { REGEN } from '../../data/balance';

export interface RegenInput {
    maxHp: number;
    /** 裝備提供的每秒回血 */
    itemRegen: number;
    /** 距離上次受傷或造成傷害的秒數 */
    outOfCombatSeconds: number;
    /** 是否站在自家泉水 */
    inFountain: boolean;
}

/** 每秒回復的生命值 */
export function regenPerSecond({ maxHp, itemRegen, outOfCombatSeconds, inFountain }: RegenInput): number {
    let ratio = REGEN.baseRatio;
    if (outOfCombatSeconds >= REGEN.outOfCombatDelay) ratio += REGEN.outOfCombatRatio;
    if (inFountain) ratio += REGEN.fountainRatio;
    return maxHp * ratio + itemRegen;
}

/** 位置是否在泉水（主堡中心 fountainRadius 內，只看水平距離） */
export function isInFountain(position: { x: number; z: number }, fountain: { x: number; z: number } | null): boolean {
    if (!fountain) return false;
    return Math.hypot(position.x - fountain.x, position.z - fountain.z) <= REGEN.fountainRadius;
}
