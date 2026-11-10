/**
 * ExperienceAwards - Host 計算經驗來源（docs/gameplay-v2/features/f6-leveling.md）
 *
 * - 被動：每位英雄每秒固定經驗（陣亡中也有）。
 * - 小兵：死亡位置半徑內、存活的敵方英雄平分，不需要最後一擊。
 * - 英雄：擊殺者（是英雄時一定算）與死亡位置半徑內、存活的隊友平分。擊殺者不是英雄時（塔、小兵），由半徑內的敵方英雄平分。
 * - 建築：對方全隊每人拿，主堡前塔較多；主堡被摧毀時遊戲結束，不給經驗。
 * 經驗只在 Host 累加，再隨 GAME_STATE 同步給 Client。
 */

import { LEVELING } from '../../data/balance';
import { heroKillXp, splitXp, structureXp } from './leveling';
import { ComponentType, TeamComponent, TransformComponent, type EntityId, type Team, type World } from '../ecs';
import type { ECSPlayerManager } from '../managers/ECSPlayerManager';
import type { ECSCreepManager } from '../managers/ECSCreepManager';
import type { ECSStructureManager } from '../managers/ECSStructureManager';

export class ExperienceAwards {
    private world: World;
    private players: ECSPlayerManager;
    private creeps: ECSCreepManager;
    private structures: ECSStructureManager;

    constructor(world: World, players: ECSPlayerManager, creeps: ECSCreepManager, structures: ECSStructureManager) {
        this.world = world;
        this.players = players;
        this.creeps = creeps;
        this.structures = structures;
    }

    /** 每個模擬幀：被動經驗 */
    tick(dt: number): void {
        for (const playerId of this.players.getAllPlayers().keys()) {
            this.players.addXp(playerId, LEVELING.passivePerSecond * dt);
        }
    }

    /** 單位死亡（ENTITY_DIED，此時實體還在） */
    onDeath(victimId: EntityId, killerId: string | null): void {
        const victimTeam = this.teamOf(victimId);
        if (!victimTeam || victimTeam === 'neutral') return;
        const enemyTeam: Team = victimTeam === 'red' ? 'blue' : 'red';

        const victimPlayer = this.players.getPlayerIdOf(victimId);
        if (victimPlayer) {
            const killerPlayer = killerId ? this.players.getPlayerIdOf(killerId) : undefined;
            const nearby = this.heroesNear(victimId, enemyTeam);
            const recipients = killerPlayer && !nearby.includes(killerPlayer) ? [killerPlayer, ...nearby] : nearby;
            this.give(splitXp(heroKillXp(this.players.getLevel(victimPlayer)), recipients));
            return;
        }

        if (this.creeps.getAllCreepIds().has(victimId)) {
            this.give(splitXp(LEVELING.creepXp, this.heroesNear(victimId, enemyTeam)));
            return;
        }

        const structure = this.structures.getAll().get(victimId);
        if (structure && structure.kind === 'tower') {
            const xp = structureXp(structure.order);
            for (const [playerId, entityId] of this.players.getAllPlayers()) {
                if (this.teamOf(entityId) === enemyTeam) this.players.addXp(playerId, xp);
            }
        }
    }

    private give(shares: { id: string; xp: number }[]): void {
        for (const { id, xp } of shares) this.players.addXp(id, xp);
    }

    /** 死亡位置半徑內、存活的指定隊伍英雄 */
    private heroesNear(victimId: EntityId, team: Team): string[] {
        const at = this.world.getComponent<TransformComponent>(victimId, ComponentType.TRANSFORM)?.position;
        if (!at) return [];
        const result: string[] = [];
        for (const [playerId, entityId] of this.players.getAllPlayers()) {
            if (this.teamOf(entityId) !== team || this.players.isDead(playerId)) continue;
            const pos = this.players.getPlayerPosition(playerId);
            if (pos && Math.hypot(pos.x - at.x, pos.z - at.z) <= LEVELING.shareRadius) result.push(playerId);
        }
        return result;
    }

    private teamOf(entityId: EntityId): Team | undefined {
        return this.world.getComponent<TeamComponent>(entityId, ComponentType.TEAM)?.team;
    }
}
