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
        modelConfig: {
            height: 2.0,
            bodyParts: [
                // 身體 (寬大的軀幹)
                { type: 'box', scale: { x: 0.8, y: 1.0, z: 0.5 }, position: { x: 0, y: 0.5, z: 0 } },
                // 頭部
                { type: 'box', scale: { x: 0.4, y: 0.4, z: 0.4 }, position: { x: 0, y: 1.2, z: 0 } },
                // 左臂
                { type: 'box', scale: { x: 0.2, y: 0.6, z: 0.2 }, position: { x: -0.5, y: 0.5, z: 0 } },
                // 右臂
                { type: 'box', scale: { x: 0.2, y: 0.6, z: 0.2 }, position: { x: 0.5, y: 0.5, z: 0 } },
                // 腿部
                { type: 'box', scale: { x: 0.3, y: 0.5, z: 0.3 }, position: { x: -0.2, y: -0.25, z: 0 } },
                { type: 'box', scale: { x: 0.3, y: 0.5, z: 0.3 }, position: { x: 0.2, y: -0.25, z: 0 } },
                // 盾牌 (左手)
                { type: 'box', scale: { x: 0.1, y: 0.6, z: 0.5 }, position: { x: -0.7, y: 0.5, z: 0.2 }, color: '#AA0000' },
                // 大劍 (右手)
                { type: 'box', scale: { x: 0.1, y: 1.2, z: 0.15 }, position: { x: 0.7, y: 0.8, z: 0 }, color: '#888888' }
            ]
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
        modelConfig: {
            height: 1.8,
            bodyParts: [
                // 身體 (纖瘦的軀幹)
                { type: 'capsule', scale: { x: 0.4, y: 0.8, z: 0.3 }, position: { x: 0, y: 0.4, z: 0 } },
                // 頭部 (兜帽造型)
                { type: 'sphere', scale: { x: 0.35, y: 0.4, z: 0.35 }, position: { x: 0, y: 1.0, z: 0 } },
                // 披風 (背後)
                { type: 'box', scale: { x: 0.5, y: 0.7, z: 0.1 }, position: { x: 0, y: 0.5, z: -0.25 }, color: '#6C3483' },
                // 左臂 (細長)
                { type: 'capsule', scale: { x: 0.12, y: 0.5, z: 0.12 }, position: { x: -0.35, y: 0.4, z: 0 } },
                // 右臂 (細長)
                { type: 'capsule', scale: { x: 0.12, y: 0.5, z: 0.12 }, position: { x: 0.35, y: 0.4, z: 0 } },
                // 腿部
                { type: 'capsule', scale: { x: 0.15, y: 0.5, z: 0.15 }, position: { x: -0.15, y: -0.25, z: 0 } },
                { type: 'capsule', scale: { x: 0.15, y: 0.5, z: 0.15 }, position: { x: 0.15, y: -0.25, z: 0 } },
                // 左短刀
                { type: 'box', scale: { x: 0.05, y: 0.5, z: 0.08 }, position: { x: -0.5, y: 0.3, z: 0.3 }, rotation: { x: 45, y: 0, z: 0 }, color: '#C0C0C0' },
                // 右短刀
                { type: 'box', scale: { x: 0.05, y: 0.5, z: 0.08 }, position: { x: 0.5, y: 0.3, z: 0.3 }, rotation: { x: 45, y: 0, z: 0 }, color: '#C0C0C0' }
            ]
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
        modelConfig: {
            height: 1.9,
            bodyParts: [
                // 身體 (長袍造型 - 圓柱體)
                { type: 'cylinder', scale: { x: 0.5, y: 1.0, z: 0.5 }, position: { x: 0, y: 0.5, z: 0 } },
                // 頭部 (兜帽)
                { type: 'sphere', scale: { x: 0.35, y: 0.35, z: 0.35 }, position: { x: 0, y: 1.2, z: 0 } },
                // 尖帽頂部
                { type: 'cylinder', scale: { x: 0.2, y: 0.4, z: 0.2 }, position: { x: 0, y: 1.5, z: 0 }, color: '#2874A6' },
                // 左臂 (寬袖)
                { type: 'box', scale: { x: 0.15, y: 0.5, z: 0.25 }, position: { x: -0.4, y: 0.6, z: 0 } },
                // 右臂 (持法杖)
                { type: 'box', scale: { x: 0.15, y: 0.5, z: 0.25 }, position: { x: 0.4, y: 0.6, z: 0 } },
                // 法杖
                { type: 'cylinder', scale: { x: 0.05, y: 1.5, z: 0.05 }, position: { x: 0.6, y: 0.75, z: 0 }, color: '#8B4513' },
                // 法杖頂端水晶
                { type: 'sphere', scale: { x: 0.15, y: 0.15, z: 0.15 }, position: { x: 0.6, y: 1.6, z: 0 }, color: '#00FFFF' },
                // 漂浮魔法球 (環繞效果)
                { type: 'sphere', scale: { x: 0.12, y: 0.12, z: 0.12 }, position: { x: -0.7, y: 1.0, z: 0.3 }, color: '#00FFFF' },
                { type: 'sphere', scale: { x: 0.1, y: 0.1, z: 0.1 }, position: { x: 0.3, y: 1.3, z: -0.5 }, color: '#87CEEB' }
            ]
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
