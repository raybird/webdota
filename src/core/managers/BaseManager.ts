/**
 * BaseManager - 主堡管理器
 * 負責主堡的生成、更新與生命週期管理
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { BaseEntity } from '../entities/BaseEntity';
import { CombatEntity, type Team } from '../entities/CombatEntity';

interface BaseConfig {
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
}

export class BaseManager {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private bases: Map<string, BaseEntity> = new Map();

    constructor(app: pc.Application, physicsWorld: RAPIER.World) {
        this.app = app;
        this.physicsWorld = physicsWorld;
    }

    /**
     * 生成主堡
     */
    spawnBase(
        id: string,
        team: Team,
        position: { x: number; y: number; z: number },
        config: BaseConfig = {}
    ): BaseEntity {
        const base = new BaseEntity(
            id,
            team,
            this.app,
            this.physicsWorld,
            position,
            config
        );

        this.bases.set(id, base);
        console.log(`[BaseManager] Spawned base ${id} for team ${team}`);
        return base;
    }

    /**
     * 移除主堡
     */
    removeBase(id: string): void {
        const base = this.bases.get(id);
        if (base) {
            base.destroy();
            this.bases.delete(id);
            console.log(`[BaseManager] Removed base ${id}`);
        }
    }

    /**
     * 每幀更新所有主堡
     * @param dt Delta time
     * @param allTargets 所有可攻擊目標
     */
    update(dt: number, allTargets: CombatEntity[]): void {
        this.bases.forEach(base => {
            base.update(dt);

            // 主堡具有自衛能力
            base.tryAttack(allTargets);
        });
    }

    /**
     * 取得所有主堡
     */
    getAllBases(): Map<string, BaseEntity> {
        return this.bases;
    }

    /**
     * 取得所有主堡作為 CombatEntity 陣列
     */
    getAllBasesAsEntities(): CombatEntity[] {
        return Array.from(this.bases.values());
    }

    /**
     * 取得指定隊伍的主堡
     */
    getBaseByTeam(team: Team): BaseEntity | undefined {
        return Array.from(this.bases.values()).find(b => b.team === team);
    }

    /**
     * 清除所有主堡
     */
    clearAll(): void {
        this.bases.forEach(base => base.destroy());
        this.bases.clear();
        console.log('[BaseManager] Cleared all bases');
    }
}
