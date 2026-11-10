/**
 * AIComponent.ts - AI 控制 Component
 * 用於小兵與防禦塔的自動行為
 */

import * as pc from 'playcanvas';
import { type Component, ComponentType } from '../Component';

export type AIType = 'creep' | 'tower' | 'none';

export class AIComponent implements Component {
    readonly type = ComponentType.AI;

    /** AI 類型 */
    aiType: AIType;

    /** 目前要走去的位置（小兵路線上的下一個中繼點） */
    targetPosition: pc.Vec3 | null = null;

    /** 走到 targetPosition 之後的中繼點 */
    waypoints: pc.Vec3[] = [];

    /** 當前攻擊目標 Entity ID */
    currentTargetId: string | null = null;

    /** 攻擊範圍 */
    attackRange: number;

    /** 攻擊冷卻時間 */
    attackCooldown: number;

    /** 當前冷卻計時器 */
    cooldownTimer: number = 0;

    constructor(config: {
        aiType: AIType;
        attackRange?: number;
        attackCooldown?: number;
    }) {
        this.aiType = config.aiType;
        this.attackRange = config.attackRange ?? 1.5;
        this.attackCooldown = config.attackCooldown ?? 1.0;
    }

    /**
     * 設定移動目標
     */
    setTargetPosition(target: pc.Vec3): void {
        this.targetPosition = target.clone();
    }

    /** 設定整條路線：先走第一點，到了再依序換下一點 */
    setRoute(points: pc.Vec3[]): void {
        const [first, ...rest] = points;
        this.targetPosition = first ? first.clone() : null;
        this.waypoints = rest.map(p => p.clone());
    }

    /** 換到下一個中繼點；已經是終點時回傳 false */
    advanceWaypoint(): boolean {
        const next = this.waypoints.shift();
        if (!next) return false;
        this.targetPosition = next;
        return true;
    }

    /**
     * 更新冷卻
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
}
