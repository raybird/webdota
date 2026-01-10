import type { ItemStats } from '../../types/Item';

export class CombatStats {
    // Base stats (from character)
    baseMaxHp: number = 1000;
    currentHp: number = 1000;
    maxEnergy: number = 100;
    currentEnergy: number = 50;  // 初始給 50 能量，讓玩家可以立即使用技能

    baseAttackPower: number = 50;
    baseDefense: number = 10;
    baseMoveSpeed: number = 5;
    baseCooldownReduction: number = 0;
    baseHpRegen: number = 1.0;

    // Item modifiers (set externally by InventoryManager)
    private itemModifiers: ItemStats = {};

    // 狀態管理 (狀態名稱 -> 到期時間戳)
    private states: Map<string, number> = new Map();

    constructor(config?: {
        maxHp?: number;
        currentHp?: number;
        maxEnergy?: number;
        currentEnergy?: number;
        attackPower?: number;
        defense?: number;
        moveSpeed?: number;
    }) {
        if (config) {
            if (config.maxHp !== undefined) this.baseMaxHp = config.maxHp;
            if (config.currentHp !== undefined) this.currentHp = config.currentHp;
            if (config.maxEnergy !== undefined) this.maxEnergy = config.maxEnergy;
            if (config.currentEnergy !== undefined) this.currentEnergy = config.currentEnergy;
            if (config.attackPower !== undefined) this.baseAttackPower = config.attackPower;
            if (config.defense !== undefined) this.baseDefense = config.defense;
            if (config.moveSpeed !== undefined) this.baseMoveSpeed = config.moveSpeed;
        }
    }

    /**
     * Set item modifiers (called by PlayerEntity when inventory changes)
     */
    setItemModifiers(modifiers: ItemStats): void {
        this.itemModifiers = modifiers;
    }

    /**
     * Get effective max HP (base + items)
     */
    get maxHp(): number {
        return this.baseMaxHp + (this.itemModifiers.maxHp || 0);
    }

    /**
     * Get effective attack power (base + items)
     */
    get attackPower(): number {
        return this.baseAttackPower + (this.itemModifiers.attackPower || 0);
    }

    /**
     * Get effective defense (base + items)
     */
    get defense(): number {
        return this.baseDefense + (this.itemModifiers.defense || 0);
    }

    /**
     * Get effective move speed (base + items)
     */
    get moveSpeed(): number {
        return this.baseMoveSpeed + (this.itemModifiers.moveSpeed || 0);
    }

    /**
     * Get cooldown reduction (from items only, 0-1)
     */
    get cooldownReduction(): number {
        return Math.min(0.4, this.baseCooldownReduction + (this.itemModifiers.cooldownReduction || 0));
    }

    /**
     * 受到傷害
     * @returns 實際受到的傷害值
     */
    takeDamage(damage: number): number {
        if (this.isInvincible()) return 0;

        // 計算減傷：傷害 - 防禦 (最低 1 點)
        const actualDamage = Math.max(1, damage - this.defense);
        this.currentHp = Math.max(0, this.currentHp - actualDamage);

        // 受傷增加少量能量 (怒氣機制)
        this.addEnergy(5);

        return actualDamage;
    }

    /**
     * 增加能量
     */
    addEnergy(amount: number) {
        this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + amount);
    }

    /**
     * 獲取當前移動速度 (考慮緩速)
     */
    getMoveSpeed(): number {
        let speed = this.moveSpeed;
        if (this.isSlowed()) {
            speed *= this.getSlowMultiplier();
        }
        return speed;
    }

    /**
     * 消耗能量
     */
    consumeEnergy(amount: number): boolean {
        if (this.currentEnergy >= amount) {
            this.currentEnergy -= amount;
            return true;
        }
        return false;
    }

    /**
     * 檢查是否無敵
     */
    isInvincible(): boolean {
        return this.hasState('invincible');
    }

    /**
     * 檢查是否隱身
     */
    isInvisible(): boolean {
        return this.hasState('invisible');
    }

    /**
     * 檢查是否緩速
     */
    isSlowed(): boolean {
        return this.hasState('slow');
    }

    /**
     * 獲取緩速倍率
     */
    getSlowMultiplier(): number {
        // 預設緩速 50%
        return 0.5;
    }

    /**
     * 添加狀態
     */
    addState(state: string, duration: number) {
        this.states.set(state, Date.now() + duration * 1000);
    }

    /**
     * 檢查狀態是否存在且未過期
     */
    hasState(state: string): boolean {
        const expiry = this.states.get(state);
        if (!expiry) return false;

        if (Date.now() > expiry) {
            this.states.delete(state);
            return false;
        }
        return true;
    }

    /**
     * Get HP regen (base + items)
     */
    get hpRegen(): number {
        return (this.baseHpRegen || 1.0) + (this.itemModifiers.hpRegen || 0);
    }

    /**
     * 更新狀態 (清理過期狀態 + 能量回復 + 生命回復)
     */
    update(dt: number) {
        const now = Date.now();
        for (const [state, expiry] of this.states.entries()) {
            if (now > expiry) {
                this.states.delete(state);
            }
        }

        // 自然回復能量 (每秒 10 點)
        this.addEnergy(10 * dt);

        // 生命回復 (只有在未死亡時)
        if (this.currentHp > 0 && this.currentHp < this.maxHp) {
            this.currentHp = Math.min(this.maxHp, this.currentHp + this.hpRegen * dt);
        }
    }
}
