/**
 * Skill Type Definition
 */

export interface Skill {
    id: string;
    name: string;
    description?: string;    // 選角畫面與技能提示的說明
    icon?: string;           // Emoji or image path
    type: 'normal' | 'ultimate' | 'basic' | 'combo';

    // 冷卻與消耗
    cooldown: number;        // 秒
    energyCost?: number;     // 能量消耗

    // 傷害屬性
    damage: number;
    range: number;           // 攻擊距離
    aoe?: number;            // 範圍半徑 (0 = 單體)

    // 控制效果
    knockback?: number;      // 擊退距離
    stun?: number;           // 暈眩時間 (秒)

    // 狀態效果
    effect?: string;         // 如 'invincible', 'invisible', 'slow'
    duration?: number;       // 效果持續時間
    effectValue?: number;    // 效果數值 (如緩速倍率 0.5)

    // 位移技能
    dashDistance?: number;      // 衝刺距離
    teleport?: boolean;         // 是否瞬移（無動畫）

    // 投射物技能
    projectile?: boolean;       // 是否為投射物
    projectileSpeed?: number;   // 投射物速度

    // 延遲技能
    delay?: number;             // 傷害延遲（秒）
    targetDistance?: number;    // 延遲判定中心在施法者前方的距離（預設 3）

    // 多段攻擊
    multiHit?: number;          // 多次打擊次數
    multiHitInterval?: number;  // 多次打擊間隔

    // 連擊系統
    enablesCombo?: string;   // 啟用哪個接招技能
    comboWindow?: number;    // 接招窗口時間

    // 動畫
    castTime?: number;       // 施法前搖
    animation?: string;      // 動畫名稱
}
