/**
 * 對戰可調數值
 *
 * 數值與調整紀錄見 docs/gameplay-v2/balance.md；改這裡時同步更新該文件。
 * 技能本身的範圍、傷害與冷卻在 src/data/skills.ts。
 */

/** 受擊範圍：決定技能是否命中。圓柱、不隨面向旋轉，約為外觀寬度的 80% */
export const HURTBOX = {
    /** 英雄外觀寬約 1.6、高約 1.8 */
    hero: { radius: 0.65, halfHeight: 0.9 },
    /** 小兵外觀寬約 1.1 */
    creep: { radius: 0.45, halfHeight: 0.6 },
} as const;

/** 投射物本身的半徑；命中距離 = 投射物半徑 + 目標受擊半徑（英雄 1.5、小兵 1.3，小兵與改版前相同） */
export const PROJECTILE_RADIUS = 0.85;

/** 範圍技能沒有設定 aoe 時，判定半徑 = 射程 × 這個比例 */
export const FRONT_HITBOX_RANGE_RATIO = 0.75;

/** front 判定的圓心在施法者前方多遠 */
export const FRONT_HITBOX_OFFSET = 1.0;

/** 自動回血（docs/gameplay-v2/features/f4-regen.md），比例都是每秒占最大生命的比例 */
export const REGEN = {
    /** 基礎回血，與裝備 hpRegen 相加 */
    baseRatio: 0.002,
    /** 多久沒受傷、沒造成傷害算脫戰（秒） */
    outOfCombatDelay: 5,
    /** 脫戰額外回血 */
    outOfCombatRatio: 0.015,
    /** 泉水：自家主堡多遠以內 */
    fountainRadius: 6,
    /** 泉水額外回血 */
    fountainRatio: 0.15,
} as const;
