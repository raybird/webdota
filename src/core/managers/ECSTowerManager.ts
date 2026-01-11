/**
 * ECSTowerManager - ECS 版防禦塔管理器
 * 使用 EntityFactory 與 ECS World 取代 TowerEntity class
 */

import type { UIManager } from '../UIManager';

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

export class ECSTowerManager {
    private world: World;
    private entityFactory: EntityFactory;
    private uiManager: UIManager;

    /** 所有防禦塔 EntityId */
    private towers: Set<EntityId> = new Set();

    constructor(
        world: World,
        entityFactory: EntityFactory,
        uiManager: UIManager
    ) {
        this.world = world;
        this.entityFactory = entityFactory;
        this.uiManager = uiManager;

        console.log('[ECSTowerManager] Initialized');
    }

    /**
     * 生成防禦塔
     */
    spawnTower(
        _id: string, // legacy id, not used - EntityFactory generates UUID
        team: Team,
        position: { x: number; y: number; z: number },
        config: {
            maxHp?: number;
            attackPower?: number;
            attackRange?: number;
            attackCooldown?: number;
        } = {}
    ): EntityId {
        // EntityFactory 生成唯一 UUID，不需要重複檢查

        // 使用 EntityFactory 建立塔
        const towerId = this.entityFactory.createTower({
            team,
            position,
            maxHp: config.maxHp ?? 2000,
            attackPower: config.attackPower ?? 80,
            attackRange: config.attackRange ?? 10,
            attackCooldown: config.attackCooldown ?? 2.0
        });

        this.towers.add(towerId);

        // 建立 UI
        const teamStr = team as 'red' | 'blue' | 'neutral';
        const ui = this.uiManager.createEntityUI(towerId, teamStr);

        const render = this.world.getComponent<RenderComponent>(towerId, ComponentType.RENDER);
        if (render && ui.hpBarEntity) {
            render.pcEntity.addChild(ui.hpBarEntity);
        }

        console.log(`[ECSTowerManager] Spawned tower ${towerId.substring(0, 8)} for team ${team} at (${position.x}, ${position.z})`);

        return towerId;
    }

    /**
     * 移除防禦塔
     */
    removeTower(id: EntityId): void {
        if (!this.towers.has(id)) return;

        this.world.destroyEntity(id);
        this.uiManager.removePlayerUI(id);
        this.towers.delete(id);

        console.log(`[ECSTowerManager] Removed tower ${id.substring(0, 8)}`);
    }

    /**
     * 每幀更新
     * 注意：塔的攻擊邏輯由 AISystem 處理
     */
    update(dt: number): void {
        void dt; // unused - AI logic handled by AISystem

        // 檢查死亡的塔並移除
        const towersToRemove: EntityId[] = [];

        for (const towerId of this.towers) {
            const health = this.world.getComponent<HealthComponent>(towerId, ComponentType.HEALTH);
            if (health && health.isDead()) {
                towersToRemove.push(towerId);
            }
        }

        towersToRemove.forEach(id => this.removeTower(id));
    }

    getAllTowerIds(): EntityId[] {
        return Array.from(this.towers);
    }

    getTowersByTeam(team: Team): EntityId[] {
        return Array.from(this.towers).filter(id => {
            const teamComp = this.world.getComponent<TeamComponent>(id, ComponentType.TEAM);
            return teamComp?.team === team;
        });
    }

    clearAll(): void {
        for (const id of this.towers) {
            this.world.destroyEntity(id);
            this.uiManager.removePlayerUI(id);
        }
        this.towers.clear();
        console.log('[ECSTowerManager] Cleared all towers');
    }
}
