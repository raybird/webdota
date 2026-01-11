/**
 * SkillComponent.ts - 技能管理 Component
 * 管理 Entity 的技能列表、冷卻與能量
 */

import { type Component, ComponentType } from '../Component';
import type { Skill } from '../../combat/SkillManager';

export interface SkillState {
    skill: Skill;
    cooldownRemaining: number;
}

export class SkillComponent implements Component {
    readonly type = ComponentType.SKILL;

    /** 技能列表 */
    private skills: Map<string, SkillState> = new Map();

    /** 最大能量 */
    maxEnergy: number;

    /** 當前能量 */
    currentEnergy: number;

    /** 能量回復速度 (每秒) */
    energyRegenRate: number;

    constructor(config: {
        maxEnergy?: number;
        currentEnergy?: number;
        energyRegenRate?: number;
    } = {}) {
        this.maxEnergy = config.maxEnergy ?? 100;
        this.currentEnergy = config.currentEnergy ?? 100;
        this.energyRegenRate = config.energyRegenRate ?? 5;
    }

    /**
     * 添加技能
     */
    addSkill(skill: Skill): void {
        this.skills.set(skill.id, {
            skill,
            cooldownRemaining: 0
        });
    }

    /**
     * 取得所有技能 ID
     */
    getSkillIds(): string[] {
        return Array.from(this.skills.keys());
    }

    /**
     * 取得技能資料
     */
    getSkill(skillId: string): Skill | undefined {
        return this.skills.get(skillId)?.skill;
    }

    /**
     * 檢查技能是否可用
     */
    canUseSkill(skillId: string): boolean {
        const state = this.skills.get(skillId);
        if (!state) return false;

        // 檢查冷卻
        if (state.cooldownRemaining > 0) return false;

        // 檢查能量
        if ((state.skill.energyCost ?? 0) > this.currentEnergy) return false;

        return true;
    }

    /**
     * 使用技能
     */
    useSkill(skillId: string): Skill | null {
        const state = this.skills.get(skillId);
        if (!state || !this.canUseSkill(skillId)) return null;

        // 消耗能量
        this.currentEnergy -= state.skill.energyCost ?? 0;

        // 設定冷卻
        state.cooldownRemaining = state.skill.cooldown ?? 0;

        return state.skill;
    }

    /**
     * 更新（冷卻與能量回復）
     */
    update(dt: number): void {
        // 更新冷卻
        for (const state of this.skills.values()) {
            if (state.cooldownRemaining > 0) {
                state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
            }
        }

        // 能量回復
        this.currentEnergy = Math.min(
            this.maxEnergy,
            this.currentEnergy + this.energyRegenRate * dt
        );
    }

    /**
     * 取得所有技能冷卻狀態
     */
    getCooldowns(): Map<string, number> {
        const cooldowns = new Map<string, number>();
        for (const [id, state] of this.skills) {
            cooldowns.set(id, state.cooldownRemaining);
        }
        return cooldowns;
    }
}
