/**
 * HealthComponent.ts - 生命值 Component
 */

import { type Component, ComponentType } from '../Component';

export class HealthComponent implements Component {
    readonly type = ComponentType.HEALTH;

    /** 當前生命值 */
    currentHp: number;

    /** 最大生命值 */
    maxHp: number;

    /** 防禦力 */
    defense: number;

    /** 最後攻擊者 ID（用於擊殺獎勵） */
    lastAttackerId: string | null = null;

    constructor(config: {
        maxHp?: number;
        currentHp?: number;
        defense?: number;
    } = {}) {
        this.maxHp = config.maxHp ?? 1000;
        this.currentHp = config.currentHp ?? this.maxHp;
        this.defense = config.defense ?? 0;
    }

    /**
     * 受到傷害
     * @returns 實際造成的傷害
     */
    takeDamage(amount: number, attackerId?: string): number {
        // 計算防禦減傷
        const reduction = Math.min(this.defense / (this.defense + 100), 0.8); // 最多減傷 80%
        const actualDamage = Math.floor(amount * (1 - reduction));

        this.currentHp = Math.max(0, this.currentHp - actualDamage);

        if (attackerId) {
            this.lastAttackerId = attackerId;
        }

        return actualDamage;
    }

    /**
     * 治療
     */
    heal(amount: number): number {
        const oldHp = this.currentHp;
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
        return this.currentHp - oldHp;
    }

    /**
     * 是否已死亡
     */
    isDead(): boolean {
        return this.currentHp <= 0;
    }

    /**
     * 生命值百分比
     */
    getHpPercent(): number {
        return this.currentHp / this.maxHp;
    }
}
