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

    /** 每秒回復的生命值（裝備加成，只在 Host 生效） */
    hpRegen: number = 0;

    /** 距離上次受傷或造成傷害的秒數（脫戰回血用，只在 Host 計算） */
    outOfCombatSeconds: number = 0;

    /** 建築依序攻擊：前一座建築還沒破時為 true，不受傷害（ECSStructureManager 每幀更新） */
    shielded = false;

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

    /** 受傷或造成傷害：脫戰計時歸零 */
    markCombat(): void {
        this.outOfCombatSeconds = 0;
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
