import { describe, it, expect } from 'vitest';
import { InventoryComponent } from '../components/InventoryComponent';
import { getItem } from '../../../data/items';

describe('InventoryComponent', () => {
    it('sums stats of equipped items', () => {
        const inventory = new InventoryComponent(2000);
        expect(inventory.buyItem(getItem('iron_sword')!)).toBe(true);
        expect(inventory.buyItem(getItem('iron_armor')!)).toBe(true);
        expect(inventory.buyItem(getItem('swift_cloak')!)).toBe(true);

        expect(inventory.gold).toBe(2000 - 300 - 500 - 700);
        expect(inventory.getTotalStats()).toEqual({
            maxHp: 50, attackPower: 15, defense: 20, moveSpeed: 2, cooldownReduction: 0.05, hpRegen: 0
        });
    });

    it('rejects purchases without enough gold and refunds half on sell', () => {
        const inventory = new InventoryComponent(500);
        expect(inventory.buyItem(getItem('battle_axe')!)).toBe(false);
        expect(inventory.buyItem(getItem('iron_sword')!)).toBe(true);
        expect(inventory.sellItem(0)).toBe(true);
        expect(inventory.gold).toBe(500 - 300 + 150);
        expect(inventory.getTotalStats().attackPower).toBe(0);
    });
});
