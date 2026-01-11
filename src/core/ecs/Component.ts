/**
 * Component.ts - ECS Component 基底介面
 * Component 是純資料容器，不包含邏輯
 */

/**
 * 所有 Component 必須實作此介面
 */
export interface Component {
    /** Component 類型識別符 */
    readonly type: string;
}

/**
 * Component 類型名稱常數
 * 使用常數避免字串打字錯誤
 */
export const ComponentType = {
    TRANSFORM: 'Transform',
    HEALTH: 'Health',
    TEAM: 'Team',
    COMBAT: 'Combat',
    SKILL: 'Skill',
    RENDER: 'Render',
    PHYSICS: 'Physics',
    AI: 'AI',
    PLAYER_INPUT: 'PlayerInput',
    ANIMATION: 'Animation',
    INVENTORY: 'Inventory',
} as const;

export type ComponentTypeName = typeof ComponentType[keyof typeof ComponentType];
