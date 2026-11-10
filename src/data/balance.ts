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

/** 移動佔位：與牆、建築的碰撞半徑，比受擊範圍小，轉角才不會卡住（D10） */
export const FOOTPRINT = {
    hero: 0.4,
    creep: 0.35,
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

/** 等級與成長（docs/gameplay-v2/features/f6-leveling.md） */
export const LEVELING = {
    maxLevel: 10,
    /** 從 n 級升到 n+1 級需要的經驗（索引 0 是 1→2） */
    thresholds: [150, 200, 250, 300, 350, 400, 450, 500, 550],
    /** 被動經驗（每秒，陣亡中也有） */
    passivePerSecond: 3,
    /** 小兵死亡時，死亡位置這個半徑內的敵方英雄平分 */
    shareRadius: 9,
    creepXp: 30,
    /** 擊殺英雄：基礎 + 被殺者等級 × perLevel，擊殺者與半徑內的隊友平分 */
    heroKillBase: 50,
    heroKillPerLevel: 20,
    /** 摧毀建築：對方全隊每人拿；依地圖的 order（外塔 1、內塔 2、主堡前塔 3） */
    towerXp: 80,
    frontTowerXp: 120,
    frontTowerOrder: 3,
    /** 每升一級：最大生命 +8%（以基礎生命計）、技能傷害 +5% */
    hpPerLevel: 0.08,
    damagePerLevel: 0.05,
    ultimateUnlockLevel: 4,
    /** 復活時間 = base + 等級 × perLevel */
    respawnBase: 4,
    respawnPerLevel: 0.8,
} as const;
