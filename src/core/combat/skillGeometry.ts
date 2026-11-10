/**
 * 技能判定的幾何計算（純函式，方便測試）
 */

import type { Skill } from '../../types/Skill';
import { FRONT_HITBOX_OFFSET, FRONT_HITBOX_RANGE_RATIO, PROJECTILE_RADIUS } from '../../data/balance';

type XZ = { x: number; z: number };

/** 立即判定的圓心：self 技能在施法者身上，其餘在前方 FRONT_HITBOX_OFFSET */
export function instantHitboxCenter<T extends XZ>(skill: Skill, origin: T, direction: XZ): T {
    if (skill.hitOrigin === 'self') return { ...origin };
    return { ...origin, x: origin.x + direction.x * FRONT_HITBOX_OFFSET, z: origin.z + direction.z * FRONT_HITBOX_OFFSET };
}

/** 立即判定的半徑：有 aoe 用 aoe，否則依射程換算 */
export function instantHitboxRadius(skill: Skill): number {
    return skill.aoe || (skill.range ? skill.range * FRONT_HITBOX_RANGE_RATIO : 1.5);
}

/** 投射物是否碰到目標：水平距離小於投射物半徑加目標受擊半徑 */
export function projectileTouches(projectile: XZ, target: XZ, targetRadius: number): boolean {
    return Math.hypot(projectile.x - target.x, projectile.z - target.z) < PROJECTILE_RADIUS + targetRadius;
}
