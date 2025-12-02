/**
 * 角色資料定義
 */

export interface Character {
    id: string;
    name: string;
    description: string;
    icon: string; // Emoji 圖示

    // 外觀設定
    appearance: {
        color: string; // 主要顏色 (Hex)
        secondaryColor?: string; // 次要顏色
    };

    // 基礎屬性（目前所有角色相同，預留擴充）
    baseStats: {
        maxHp: number;
        moveSpeed: number;
        attackPower: number;
    };
}

export const DEFAULT_CHARACTER_ID = 'warrior';
