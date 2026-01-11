/**
 * PlayerInputComponent.ts - 玩家輸入 Component
 * 標記此 Entity 由玩家控制
 */

import { type Component, ComponentType } from '../Component';
import type { SkillManager } from '../../combat/SkillManager';
import type { InventoryManager } from '../../managers/InventoryManager';

export class PlayerInputComponent implements Component {
    readonly type = ComponentType.PLAYER_INPUT;

    /** 玩家 ID */
    playerId: string;

    /** 角色 ID */
    characterId: string;

    /** 技能管理器 */
    skillManager: SkillManager | null = null;

    /** 物品欄管理器 */
    inventoryManager: InventoryManager | null = null;

    /** 當前移動輸入 */
    moveInput: { x: number; z: number } = { x: 0, z: 0 };

    /** 朝向角度 */
    facingAngle: number = 0;

    /** 金幣 */
    gold: number = 500;

    constructor(config: {
        playerId: string;
        characterId: string;
    }) {
        this.playerId = config.playerId;
        this.characterId = config.characterId;
    }

    /**
     * 設定移動輸入
     */
    setMoveInput(x: number, z: number): void {
        this.moveInput.x = x;
        this.moveInput.z = z;
    }

    /**
     * 設定管理器參考
     */
    setManagers(skillManager: SkillManager, inventoryManager: InventoryManager): void {
        this.skillManager = skillManager;
        this.inventoryManager = inventoryManager;
    }

    /**
     * 給予金幣
     */
    giveGold(amount: number): void {
        this.gold += amount;
    }
}
