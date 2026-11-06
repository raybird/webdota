/**
 * StatusVisualSystem.ts - 依狀態效果改變單位外觀（每個端點各自依本地玩家的隊伍判斷）
 * - 隱身：隊友看到半透明，敵人看不到模型與血條
 * - 無敵：金色；緩速：藍色
 */

import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { StatusComponent } from '../components/StatusComponent';
import { RenderComponent } from '../components/RenderComponent';
import { TeamComponent, type Team } from '../components/TeamComponent';

const TINT_INVINCIBLE = new Float32Array([1.6, 1.35, 0.55]);
const TINT_SLOW = new Float32Array([0.55, 0.8, 1.5]);

export class StatusVisualSystem extends System {
    readonly name = 'StatusVisualSystem';
    readonly requiredComponents = [ComponentType.STATUS, ComponentType.RENDER] as const;
    priority = 95; // RenderSystem 之前

    /** 本地玩家的隊伍；同隊的隱身單位顯示半透明 */
    localTeam: Team | null = null;

    update(world: World, _dt: number): void {
        for (const entityId of world.query(ComponentType.STATUS, ComponentType.RENDER)) {
            const status = world.getComponent<StatusComponent>(entityId, ComponentType.STATUS)!;
            const render = world.getComponent<RenderComponent>(entityId, ComponentType.RENDER)!;

            if (status.has('invisible')) {
                const team = world.getComponent<TeamComponent>(entityId, ComponentType.TEAM)?.team;
                render.setStealth(team !== undefined && team === this.localTeam ? 'ally' : 'enemy');
            } else {
                render.setStealth('none');
            }

            render.setTint(status.has('invincible') ? TINT_INVINCIBLE : status.has('slow') ? TINT_SLOW : null);
        }
    }
}
