/**
 * TeamComponent.ts - 隊伍歸屬 Component
 */

import { type Component, ComponentType } from '../Component';

export type Team = 'red' | 'blue' | 'neutral';

export class TeamComponent implements Component {
    readonly type = ComponentType.TEAM;

    /** 隊伍 */
    team: Team;

    constructor(team: Team = 'neutral') {
        this.team = team;
    }

    /**
     * 檢查是否為敵對關係
     */
    isEnemy(other: TeamComponent): boolean {
        // neutral 不與任何人敵對
        if (this.team === 'neutral' || other.team === 'neutral') {
            return false;
        }
        return this.team !== other.team;
    }

    /**
     * 檢查是否為友軍
     */
    isAlly(other: TeamComponent): boolean {
        if (this.team === 'neutral' || other.team === 'neutral') {
            return false;
        }
        return this.team === other.team;
    }
}
