/**
 * CombatComponent.ts - 戰鬥屬性 Component
 */

import { type Component, ComponentType } from '../Component';

export class CombatComponent implements Component {
    readonly type = ComponentType.COMBAT;

    /** 攻擊力 */
    attackPower: number;

    /** 攻擊範圍 */
    attackRange: number;

    /** 攻擊冷卻時間（秒） */
    attackCooldown: number;

    /** 當前冷卻計時器 */
    cooldownTimer: number = 0;

    /** 移動速度 */
    moveSpeed: number;

    constructor(config: {
        attackPower?: number;
        attackRange?: number;
        attackCooldown?: number;
        moveSpeed?: number;
    } = {}) {
        this.attackPower = config.attackPower ?? 50;
        this.attackRange = config.attackRange ?? 1.5;
        this.attackCooldown = config.attackCooldown ?? 1.0;
        this.moveSpeed = config.moveSpeed ?? 5.0;
    }

    /**
     * 更新冷卻計時器
     */
    update(dt: number): void {
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
        }
    }

    /**
     * 是否可以攻擊
     */
    canAttack(): boolean {
        return this.cooldownTimer <= 0;
    }

    /**
     * 觸發攻擊（重置冷卻）
     */
    triggerAttack(): void {
        this.cooldownTimer = this.attackCooldown;
    }

    /**
     * 取得冷卻進度 (0-1)
     */
    getCooldownProgress(): number {
        if (this.attackCooldown <= 0) return 1;
        return 1 - Math.max(0, this.cooldownTimer / this.attackCooldown);
    }
}
