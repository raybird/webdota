import type { Character } from '../types/Character';

/**
 * 角色資料庫
 * 定義所有可選角色
 */

export const CHARACTERS: Record<string, Character> = {
    warrior: {
        id: 'warrior',
        name: '戰士',
        description: '高耐久度的近戰戰士，擅長正面對抗',
        icon: '⚔️',
        appearance: {
            color: '#FF4444', // 紅色
            secondaryColor: '#AA0000'
        },
        baseStats: {
            maxHp: 100,
            moveSpeed: 5,
            attackPower: 10
        },
        skills: ['warrior_q', 'warrior_w', 'warrior_e', 'warrior_r']
    },

    assassin: {
        id: 'assassin',
        name: '刺客',
        description: '高機動性的刺殺者，擅長快速突襲',
        icon: '🗡️',
        appearance: {
            color: '#9B59B6', // 紫色
            secondaryColor: '#6C3483'
        },
        baseStats: {
            maxHp: 100,
            moveSpeed: 5,
            attackPower: 10
        },
        skills: ['assassin_q', 'assassin_w', 'assassin_e', 'assassin_r']
    },

    mage: {
        id: 'mage',
        name: '法師',
        description: '強大的魔法使用者，擅長範圍攻擊',
        icon: '🔮',
        appearance: {
            color: '#3498DB', // 藍色
            secondaryColor: '#2874A6'
        },
        baseStats: {
            maxHp: 100,
            moveSpeed: 5,
            attackPower: 10
        },
        skills: ['mage_q', 'mage_w', 'mage_e', 'mage_r']
    }
};

// 取得所有角色陣列（用於列表顯示）
export const getAllCharacters = (): Character[] => {
    return Object.values(CHARACTERS);
};

// 取得角色資料
export const getCharacter = (id: string): Character | undefined => {
    return CHARACTERS[id];
};
