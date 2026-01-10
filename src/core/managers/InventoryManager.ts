/**
 * InventoryManager
 * Manages a player's item inventory (max 6 slots) and calculates stat bonuses.
 */

import type { Item, ItemStats } from '../../types/Item';
import { getItem } from '../../data/items';

export const MAX_INVENTORY_SLOTS = 6;

export class InventoryManager {
    private items: (Item | null)[] = new Array(MAX_INVENTORY_SLOTS).fill(null);
    private gold: number = 0;

    constructor(initialGold: number = 0) {
        this.gold = initialGold;
    }

    /**
     * Get current gold
     */
    getGold(): number {
        return this.gold;
    }

    /**
     * Add gold
     */
    addGold(amount: number): void {
        this.gold += amount;
    }

    /**
     * Spend gold (returns false if insufficient)
     */
    spendGold(amount: number): boolean {
        if (this.gold < amount) {
            return false;
        }
        this.gold -= amount;
        return true;
    }

    /**
     * Buy an item by ID
     * @returns true if purchase successful, false otherwise
     */
    buyItem(itemId: string): boolean {
        const item = getItem(itemId);
        if (!item) {
            console.warn(`[InventoryManager] Item not found: ${itemId}`);
            return false;
        }

        // Check gold
        if (this.gold < item.cost) {
            console.log(`[InventoryManager] Not enough gold: ${this.gold}/${item.cost}`);
            return false;
        }

        // Find empty slot
        const emptySlot = this.items.findIndex(slot => slot === null);
        if (emptySlot === -1) {
            console.log('[InventoryManager] Inventory full');
            return false;
        }

        // Purchase
        this.gold -= item.cost;
        this.items[emptySlot] = item;
        console.log(`[InventoryManager] Bought ${item.name} for ${item.cost} gold`);
        return true;
    }

    /**
     * Sell an item at index (returns 50% of cost)
     */
    sellItem(index: number): boolean {
        if (index < 0 || index >= MAX_INVENTORY_SLOTS) return false;
        const item = this.items[index];
        if (!item) return false;

        const sellValue = Math.floor(item.cost * 0.5);
        this.gold += sellValue;
        this.items[index] = null;
        console.log(`[InventoryManager] Sold ${item.name} for ${sellValue} gold`);
        return true;
    }

    /**
     * Get all items in inventory
     */
    getItems(): (Item | null)[] {
        return [...this.items];
    }

    /**
     * Check if has specific item
     */
    hasItem(itemId: string): boolean {
        return this.items.some(item => item?.id === itemId);
    }

    /**
     * Count of items
     */
    getItemCount(): number {
        return this.items.filter(item => item !== null).length;
    }

    /**
     * Calculate total stat bonuses from all equipped items
     */
    getTotalStats(): ItemStats {
        const totals: ItemStats = {
            maxHp: 0,
            attackPower: 0,
            defense: 0,
            moveSpeed: 0,
            cooldownReduction: 0
        };

        this.items.forEach(item => {
            if (item) {
                totals.maxHp! += item.stats.maxHp || 0;
                totals.attackPower! += item.stats.attackPower || 0;
                totals.defense! += item.stats.defense || 0;
                totals.moveSpeed! += item.stats.moveSpeed || 0;
                totals.cooldownReduction! += item.stats.cooldownReduction || 0;
                totals.hpRegen! += item.stats.hpRegen || 0;
            }
        });

        return totals;
    }

    /**
     * Serialize for network sync
     */
    serialize(): { gold: number; itemIds: (string | null)[] } {
        return {
            gold: this.gold,
            itemIds: this.items.map(item => item?.id || null)
        };
    }

    /**
     * Deserialize from network sync
     */
    deserialize(data: { gold: number; itemIds: (string | null)[] }): void {
        this.gold = data.gold;
        this.items = data.itemIds.map(id => (id ? getItem(id) || null : null));
    }
}
