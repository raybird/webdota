/**
 * Items Data
 * Predefined items available for purchase in the shop.
 */

import type { Item } from '../types/Item';

export const ITEMS: Item[] = [
    // ===== Offensive Items =====
    {
        id: 'iron_sword',
        name: '鐵劍',
        description: '基礎的攻擊武器',
        cost: 300,
        icon: '⚔️',
        stats: {
            attackPower: 15
        }
    },
    {
        id: 'battle_axe',
        name: '戰斧',
        description: '強力的戰鬥武器',
        cost: 600,
        icon: '🪓',
        stats: {
            attackPower: 30
        }
    },
    {
        id: 'fury_blade',
        name: '狂怒之刃',
        description: '蘊含狂暴力量的武器',
        cost: 1200,
        icon: '🗡️',
        stats: {
            attackPower: 50,
            cooldownReduction: 0.1
        }
    },

    // ===== Defensive Items =====
    {
        id: 'health_gem',
        name: '生命寶石',
        description: '增加最大生命值',
        cost: 250,
        icon: '💎',
        stats: {
            maxHp: 100,
            hpRegen: 2
        }
    },
    {
        id: 'iron_armor',
        name: '鐵甲',
        description: '堅固的護甲',
        cost: 500,
        icon: '🛡️',
        stats: {
            defense: 20,
            maxHp: 50
        }
    },
    {
        id: 'vitality_orb',
        name: '活力寶珠',
        description: '大幅提升生命力與回復',
        cost: 900,
        icon: '🔮',
        stats: {
            maxHp: 300,
            hpRegen: 10
        }
    },

    // ===== Utility Items =====
    {
        id: 'speed_boots',
        name: '疾風靴',
        description: '提升移動速度',
        cost: 350,
        icon: '👟',
        stats: {
            moveSpeed: 1.0
        }
    },
    {
        id: 'swift_cloak',
        name: '迅捷披風',
        description: '大幅提升移動速度',
        cost: 700,
        icon: '🧥',
        stats: {
            moveSpeed: 2.0,
            cooldownReduction: 0.05
        }
    },
    {
        id: 'arcane_tome',
        name: '奧術典籍',
        description: '減少技能冷卻時間',
        cost: 800,
        icon: '📖',
        stats: {
            cooldownReduction: 0.15
        }
    }
];

/**
 * Get item by ID
 */
export function getItem(id: string): Item | undefined {
    return ITEMS.find(item => item.id === id);
}

/**
 * Get all items
 */
export function getAllItems(): Item[] {
    return ITEMS;
}
