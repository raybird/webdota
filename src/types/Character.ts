/**
 * 角色資料定義
 */

/**
 * 模型組件定義
 * 用於組合基本幾何體來建立 Low Poly 風格角色
 */
export interface ModelPart {
    type: 'box' | 'sphere' | 'cylinder' | 'capsule'; // 幾何體類型
    scale: { x: number; y: number; z: number };       // 縮放
    position: { x: number; y: number; z: number };    // 相對位置
    rotation?: { x: number; y: number; z: number };   // 相對旋轉 (度數)
    color?: string;                                   // 覆蓋顏色 (可選)
}

/**
 * 模型配置
 * 定義角色的幾何體組合
 */
export interface ModelConfig {
    bodyParts: ModelPart[];  // 身體部件列表
    height: number;          // 角色高度 (用於血條定位)
}

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

    // 模型配置 (Low Poly 幾何體組合)
    modelConfig?: ModelConfig;

    // 基礎屬性（目前所有角色相同，預留擴充）
    baseStats: {
        maxHp: number;
        moveSpeed: number;
        attackPower: number;
    };

    // 技能組 (Q, W, E, R)
    skills: string[];
}

export const DEFAULT_CHARACTER_ID = 'warrior';
