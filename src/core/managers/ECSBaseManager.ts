/**
 * ECSBaseManager - ECS 版主堡管理器
 * 使用 EntityFactory 與 ECS World 取代 BaseEntity class
 */

import type { UIManager } from '../UIManager';
import { eventBus } from '../../events/EventBus';
import {
    World,
    EntityFactory,
    ComponentType,
    HealthComponent,
    TeamComponent,
    RenderComponent,
    type EntityId,
    type Team,
} from '../ecs';

export class ECSBaseManager {
    private world: World;
    private entityFactory: EntityFactory;
    private uiManager: UIManager;

    /** 所有主堡 EntityId */
    private bases: Set<EntityId> = new Set();

    constructor(
        world: World,
        entityFactory: EntityFactory,
        uiManager: UIManager
    ) {
        this.world = world;
        this.entityFactory = entityFactory;
        this.uiManager = uiManager;

        console.log('[ECSBaseManager] Initialized');
    }

    /**
     * 生成主堡
     */
    spawnBase(
        _id: string, // legacy id, not used
        team: Team,
        position: { x: number; y: number; z: number },
        config: {
            maxHp?: number;
            attackPower?: number;
            attackRange?: number;
            attackCooldown?: number;
        } = {}
    ): EntityId {
        const baseId = this.entityFactory.createBase({
            team,
            position,
            maxHp: config.maxHp ?? 5000,
            attackPower: config.attackPower ?? 50,
            attackRange: config.attackRange ?? 8,
            attackCooldown: config.attackCooldown ?? 3.0
        });

        this.bases.add(baseId);

        // 建立 UI (血條)
        const teamStr = team as 'red' | 'blue' | 'neutral';
        const ui = this.uiManager.createEntityUI(baseId, teamStr, true); // true for isBase layout adjustment

        const render = this.world.getComponent<RenderComponent>(baseId, ComponentType.RENDER);
        if (render && ui.hpBarEntity) {
            // 微調主堡血條高度
            ui.hpBarEntity.setLocalPosition(0, 8, 0);
            render.pcEntity.addChild(ui.hpBarEntity);
        }

        console.log(`[ECSBaseManager] Spawned base ${baseId.substring(0, 8)} for team ${team} at (${position.x}, ${position.z})`);

        return baseId;
    }

    /**
     * 移除主堡
     */
    removeBase(id: EntityId): void {
        if (!this.bases.has(id)) return;

        this.world.destroyEntity(id);
        this.uiManager.removePlayerUI(id);
        this.bases.delete(id);

        console.log(`[ECSBaseManager] Removed base ${id.substring(0, 8)}`);
    }

    /**
     * 每幀更新
     * AI 攻擊邏輯由 AISystem 處理
     */
    update(dt: number): void {
        void dt;

        for (const baseId of this.bases) {
            const health = this.world.getComponent<HealthComponent>(baseId, ComponentType.HEALTH);

            // 檢查主堡是否被摧毀
            if (health && health.isDead()) {
                const teamComp = this.world.getComponent<TeamComponent>(baseId, ComponentType.TEAM);
                const lostTeam = teamComp?.team || 'unknown';

                console.log(`[ECSBaseManager] Base ${baseId.substring(0, 8)} has been destroyed! Team ${lostTeam} loses!`);
                eventBus.emit({
                    type: 'GAME_OVER',
                    winnerTeam: lostTeam === 'red' ? 'blue' : 'red',
                    reason: 'base_destroyed'
                });

                // Remove it after game over triggers
                this.removeBase(baseId);
            }
        }
    }

    getAllBaseIds(): EntityId[] {
        return Array.from(this.bases);
    }

    getBasesByTeam(team: Team): EntityId[] {
        return Array.from(this.bases).filter(id => {
            const teamComp = this.world.getComponent<TeamComponent>(id, ComponentType.TEAM);
            return teamComp?.team === team;
        });
    }

    clearAll(): void {
        for (const id of this.bases) {
            this.world.destroyEntity(id);
            this.uiManager.removePlayerUI(id);
        }
        this.bases.clear();
        console.log('[ECSBaseManager] Cleared all bases');
    }
}
