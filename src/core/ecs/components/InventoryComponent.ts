/**
 * InventoryComponent.ts - 背包 Component
 * 金幣與 6 格物品欄
 */

import { type Component, ComponentType } from '../Component';
import type { Item, ItemStats } from '../../../types/Item';

export const MAX_INVENTORY_SLOTS = 6;

/** 賣出物品時退回的金幣比例 */
const SELL_RATIO = 0.5;

export class InventoryComponent implements Component {
    readonly type = ComponentType.INVENTORY;

    gold: number;
    slots: (Item | null)[] = new Array(MAX_INVENTORY_SLOTS).fill(null);

    constructor(initialGold: number = 500) {
        this.gold = initialGold;
    }

    buyItem(item: Item): boolean {
        const emptySlot = this.slots.indexOf(null);
        if (emptySlot === -1 || this.gold < item.cost) return false;

        this.gold -= item.cost;
        this.slots[emptySlot] = item;
        return true;
    }

    sellItem(slotIndex: number): boolean {
        const item = this.slots[slotIndex];
        if (!item) return false;

        this.gold += Math.floor(item.cost * SELL_RATIO);
        this.slots[slotIndex] = null;
        return true;
    }

    earnGold(amount: number): void {
        this.gold += amount;
    }

    /**
     * 所有裝備的屬性加總
     */
    getTotalStats(): Required<ItemStats> {
        const total: Required<ItemStats> = {
            maxHp: 0, attackPower: 0, defense: 0, moveSpeed: 0, cooldownReduction: 0, hpRegen: 0
        };
        for (const item of this.slots) {
            if (!item) continue;
            for (const key of Object.keys(total) as (keyof ItemStats)[]) {
                total[key] += item.stats[key] ?? 0;
            }
        }
        return total;
    }
}
