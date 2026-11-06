/**
 * PlayerInputComponent.ts - 玩家 Component
 * 標記此 Entity 由玩家操控，保存玩家與角色識別
 */

import { type Component, ComponentType } from '../Component';

export class PlayerInputComponent implements Component {
    readonly type = ComponentType.PLAYER_INPUT;

    playerId: string;
    characterId: string;

    constructor(config: { playerId: string; characterId: string }) {
        this.playerId = config.playerId;
        this.characterId = config.characterId;
    }
}
