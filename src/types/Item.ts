/**
 * Item Type Definition
 * Defines the structure for equipment items in the game.
 */

/**
 * Stats that an item can modify
 */
export interface ItemStats {
    maxHp?: number;
    attackPower?: number;
    defense?: number;
    moveSpeed?: number;
    cooldownReduction?: number; // Percentage (0-1)
    hpRegen?: number; // HP per second
}

/**
 * Item interface
 */
export interface Item {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: string; // Emoji or icon name
    stats: ItemStats;
}
