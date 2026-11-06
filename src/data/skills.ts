import type { Skill } from '../types/Skill';

export const SKILLS: Record<string, Skill> = {
    // --- 通用技能 ---
    'basic_attack': {
        id: 'basic_attack',
        name: '普通攻擊',
        description: '對前方敵人揮出一擊',
        icon: '👊',
        type: 'basic',
        cooldown: 0.5,
        damage: 10,
        range: 2.5,
        knockback: 0.5,
        animation: 'attack_basic'
    },

    // --- 戰士技能 (Warrior) ---
    'warrior_q': {
        id: 'warrior_q',
        name: '衝鋒斬',
        description: '向前衝鋒 4 單位並斬擊前方敵人',
        icon: '⚔️',
        type: 'normal',
        cooldown: 5.0,
        energyCost: 20,
        damage: 30,
        range: 4.0,
        knockback: 2.0,
        dashDistance: 4.0, // 新增衝刺距離
        animation: 'skill_dash'
    },
    'warrior_w': {
        id: 'warrior_w',
        name: '震地猛擊',
        description: '重擊地面，震傷周圍 3 單位內的敵人',
        icon: '💥',
        type: 'normal',
        cooldown: 8.0,
        energyCost: 30,
        damage: 40,
        range: 3.0,
        aoe: 3.0,
        knockback: 3.0,
        animation: 'skill_stomp'
    },
    'warrior_e': {
        id: 'warrior_e',
        name: '鋼鐵意志',
        description: '2 秒內不受任何傷害',
        icon: '🛡️',
        type: 'normal',
        cooldown: 12.0,
        energyCost: 20,
        damage: 0,
        range: 0,
        effect: 'invincible',
        duration: 2.0,
        animation: 'skill_buff'
    },
    'warrior_r': {
        id: 'warrior_r',
        name: '旋風斬',
        description: '揮劍旋轉，重創周圍 4 單位內的所有敵人',
        icon: '🌪️',
        type: 'ultimate',
        cooldown: 60.0,
        energyCost: 100,
        damage: 100,
        range: 4.0,
        aoe: 4.0,
        knockback: 5.0,
        animation: 'skill_ultimate'
    },

    // --- 刺客技能 (Assassin) ---
    'assassin_q': {
        id: 'assassin_q',
        name: '瞬步',
        description: '瞬間向前移動 6 單位，劃傷前方敵人',
        icon: '💨',
        type: 'normal',
        cooldown: 4.0,
        energyCost: 15,
        damage: 20,
        range: 5.0,
        dashDistance: 6.0, // 瞬步更遠
        animation: 'skill_dash'
    },
    'assassin_w': {
        id: 'assassin_w',
        name: '致命一擊',
        description: '對近身目標造成高額傷害',
        icon: '🗡️',
        type: 'normal',
        cooldown: 6.0,
        energyCost: 25,
        damage: 60,
        range: 2.0,
        knockback: 1.0,
        animation: 'skill_stab'
    },
    'assassin_e': {
        id: 'assassin_e',
        name: '煙霧彈',
        description: '放出煙霧並隱身 3 秒',
        icon: '🌫️',
        type: 'normal',
        cooldown: 10.0,
        energyCost: 30,
        damage: 0,
        range: 0,
        effect: 'invisible', // 隱身狀態
        duration: 3.0,
        animation: 'skill_smoke'
    },
    'assassin_r': {
        id: 'assassin_r',
        name: '幻影殺陣',
        description: '化為幻影，在周圍 6 單位內連續斬擊',
        icon: '👻',
        type: 'ultimate',
        cooldown: 50.0,
        energyCost: 100,
        damage: 120,
        range: 6.0,
        aoe: 6.0, // 範圍內隨機攻擊
        knockback: 0,
        animation: 'skill_ultimate'
    },

    // --- 法師技能 (Mage) ---
    'mage_q': {
        id: 'mage_q',
        name: '火球術',
        description: '射出火球，命中時爆炸',
        icon: '🔥',
        type: 'normal',
        cooldown: 3.0,
        energyCost: 15,
        damage: 35,
        range: 8.0, // 遠程
        knockback: 1.0,
        projectile: true, // 投射物
        projectileSpeed: 15,
        animation: 'skill_cast'
    },
    'mage_w': {
        id: 'mage_w',
        name: '冰霜新星',
        description: '釋放冰霜，傷害並緩速周圍敵人 3 秒',
        icon: '❄️',
        type: 'normal',
        cooldown: 10.0,
        energyCost: 40,
        damage: 25,
        range: 4.0,
        aoe: 4.0,
        effect: 'slow', // 減速
        effectValue: 0.5,
        duration: 3.0,
        animation: 'skill_nova'
    },
    'mage_e': {
        id: 'mage_e',
        name: '閃現',
        description: '瞬移到前方 6 單位處',
        icon: '✨',
        type: 'normal',
        cooldown: 15.0,
        energyCost: 30,
        damage: 0,
        range: 6.0, // 移動距離
        teleport: true, // 瞬移
        animation: 'skill_blink'
    },
    'mage_r': {
        id: 'mage_r',
        name: '隕石術',
        description: '1 秒後隕石落在前方，造成大範圍傷害',
        icon: '☄️',
        type: 'ultimate',
        cooldown: 70.0,
        energyCost: 100,
        damage: 150,
        range: 10.0,
        aoe: 5.0,
        knockback: 4.0,
        delay: 1.0, // 延遲傷害
        targetDistance: 7.0, // 落在前方 7 單位
        animation: 'skill_ultimate'
    }
};

export const getSkill = (id: string): Skill | undefined => {
    return SKILLS[id];
};

export const getAllSkills = (): Skill[] => {
    return Object.values(SKILLS);
};
