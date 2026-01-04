export class CombatStats {
    maxHp: number = 1000;
    currentHp: number = 1000;
    maxEnergy: number = 100;
    currentEnergy: number = 50;  // 初始給 50 能量，讓玩家可以立即使用技能

    attackPower: number = 50;
    defense: number = 10;
    moveSpeed: number = 5;

    // 狀態管理 (狀態名稱 -> 到期時間戳)
    private states: Map<string, number> = new Map();

    constructor(config?: Partial<CombatStats>) {
        if (config) {
            Object.assign(this, config);
        }
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
     * 更新狀態 (清理過期狀態 + 能量回復)
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
    }
}
