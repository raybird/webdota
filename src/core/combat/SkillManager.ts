export interface Skill {
    id: string;
    name: string;
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

export class SkillManager {
    skills: Map<string, Skill>;
    cooldowns: Map<string, number> = new Map();

    constructor(skillTemplates: Skill[]) {
        this.skills = new Map(skillTemplates.map(s => [s.id, s]));
    }

    /**
     * 檢查技能是否可用
     */
    canUseSkill(skillId: string, energy: number): boolean {
        const skill = this.skills.get(skillId);
        if (!skill) {
            console.log(`[SkillManager] Skill ${skillId} not found in skills map. Available: ${Array.from(this.skills.keys()).join(', ')}`);
            return false;
        }

        // 檢查冷卻
        const cooldownEnd = this.cooldowns.get(skillId) || 0;
        if (Date.now() < cooldownEnd) {
            console.log(`[SkillManager] Skill ${skillId} on cooldown`);
            return false;
        }

        // 檢查能量
        if (skill.energyCost && energy < skill.energyCost) {
            console.log(`[SkillManager] Skill ${skillId} needs ${skill.energyCost} energy, have ${energy}`);
            return false;
        }

        return true;
    }

    /**
     * 使用技能
     * @returns 使用的技能資料，如果失敗則返回 null
     */
    useSkill(skillId: string): Skill | null {
        const skill = this.skills.get(skillId);
        if (!skill) return null;

        // 設定冷卻
        if (skill.cooldown > 0) {
            this.cooldowns.set(skillId, Date.now() + skill.cooldown * 1000);
        }

        return skill;
    }

    /**
     * 獲取當前冷卻時間 (秒)
     */
    getCurrentCooldown(skillId: string): number {
        const end = this.cooldowns.get(skillId);
        if (!end) return 0;
        return Math.max(0, (end - Date.now()) / 1000);
    }

    /**
     * 獲取所有技能的冷卻狀態
     */
    getAllCooldowns(): Map<string, number> {
        const result = new Map<string, number>();
        for (const [id, end] of this.cooldowns) {
            const remaining = Math.max(0, (end - Date.now()) / 1000);
            if (remaining > 0) {
                result.set(id, remaining);
            }
        }
        return result;
    }

    /**
     * 更新 (預留)
     */
    update(_dt: number) {
        // 目前冷卻使用 Date.now() 判定，不需 delta time 更新
        // 可用於其他技能狀態效果
    }
}

// 預設技能配置 (與 UI 對應)
export const DEFAULT_SKILLS: Skill[] = [
    {
        id: 'basic',
        name: '籃板',
        type: 'basic',
        cooldown: 0,
        damage: 15,
        range: 1.5,
        knockback: 0.3,
        animation: 'attack_basic'
    },
    {
        id: 'skill1',
        name: '加速',
        type: 'normal',
        cooldown: 3.0,
        damage: 20,
        range: 3.0,
        knockback: 1.0,
        enablesCombo: 'basic_dash_combo',
        animation: 'skill_dash'
    },
    {
        id: 'skill2',
        name: '檔拆',
        type: 'normal',
        cooldown: 4.0,
        damage: 30,
        range: 2.0,
        aoe: 2.5,
        knockback: 2.0,
        enablesCombo: 'basic_shockwave',
        animation: 'skill_stomp'
    },
    {
        id: 'skill3',
        name: '卡位',
        type: 'normal',
        cooldown: 2.0,
        damage: 0,
        range: 0,
        effect: 'invincible',
        duration: 0.5,
        enablesCombo: 'basic_counter',
        animation: 'skill_block'
    },
    {
        id: 'ultimate',
        name: '決勝三分',
        type: 'ultimate',
        cooldown: 0,
        energyCost: 100,
        damage: 150,
        range: 4.0,
        aoe: 4.0,
        knockback: 5.0,
        stun: 2.0,
        animation: 'skill_ultimate'
    },
    // 接招技能
    {
        id: 'basic_dash_combo',
        name: '加速衝撞',
        type: 'combo',
        cooldown: 0,
        damage: 45,
        range: 2.5,
        knockback: 3.0,
        animation: 'attack_dash'
    },
    {
        id: 'basic_shockwave',
        name: '震地波',
        type: 'combo',
        cooldown: 0,
        damage: 50,
        range: 3.0,
        aoe: 3.0,
        knockback: 3.5,
        animation: 'attack_shockwave'
    },
    {
        id: 'basic_counter',
        name: '反擊',
        type: 'combo',
        cooldown: 0,
        damage: 40,
        range: 2.0,
        knockback: 2.5,
        stun: 0.5,
        animation: 'attack_counter'
    }
];
