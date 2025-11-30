export class CombatStats {
    maxHp: number = 1000;
    currentHp: number = 1000;
    maxEnergy: number = 100;
    currentEnergy: number = 0;

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
     * 更新狀態 (清理過期狀態)
     */
    update(dt: number) {
        const now = Date.now();
        for (const [state, expiry] of this.states.entries()) {
            if (now > expiry) {
                this.states.delete(state);
            }
        }

        // 自然回覆能量 (可選)
        // this.addEnergy(1 * dt);
    }
}
