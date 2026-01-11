/**
 * InventoryComponent.ts - 物品欄 Component
 * 管理金幣與物品加成
 */

import { type Component, ComponentType } from '../Component';

export interface ItemStats {
    attackPower?: number;
    defense?: number;
    maxHp?: number;
    moveSpeed?: number;
}

export class InventoryComponent implements Component {
    readonly type = ComponentType.INVENTORY;

    /** 金幣 */
    gold: number;

    /** 物品 ID 列表 */
    items: string[] = [];

    /** 物品加成統計 */
    private itemStats: ItemStats = {};

    constructor(initialGold: number = 500) {
        this.gold = initialGold;
    }

    /**
     * 添加物品
     */
    addItem(itemId: string, stats: ItemStats): boolean {
        this.items.push(itemId);

        // 累加加成
        this.itemStats.attackPower = (this.itemStats.attackPower ?? 0) + (stats.attackPower ?? 0);
        this.itemStats.defense = (this.itemStats.defense ?? 0) + (stats.defense ?? 0);
        this.itemStats.maxHp = (this.itemStats.maxHp ?? 0) + (stats.maxHp ?? 0);
        this.itemStats.moveSpeed = (this.itemStats.moveSpeed ?? 0) + (stats.moveSpeed ?? 0);

        return true;
    }

    /**
     * 取得總加成
     */
    getTotalStats(): ItemStats {
        return { ...this.itemStats };
    }

    /**
     * 消費金幣
     */
    spendGold(amount: number): boolean {
        if (this.gold < amount) return false;
        this.gold -= amount;
        return true;
    }

    /**
     * 獲得金幣
     */
    earnGold(amount: number): void {
        this.gold += amount;
    }
}
