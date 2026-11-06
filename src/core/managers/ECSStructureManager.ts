/**
 * ECSStructureManager - 防禦塔與主堡管理器
 * 主堡被摧毀時發出 GAME_OVER
 */

import type { UIManager } from '../UIManager';
import { eventBus } from '../../events/EventBus';
import {
    World,
    EntityFactory,
    ComponentType,
    HealthComponent,
    RenderComponent,
    type EntityId,
    type Team,
} from '../ecs';

export type StructureKind = 'tower' | 'base';

export interface StructureConfig {
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
}

/** 血條離建築原點的高度 */
const HP_BAR_OFFSET: Record<StructureKind, number> = { tower: 4.5, base: 7 };

export class ECSStructureManager {
    private world: World;
    private entityFactory: EntityFactory;
    private uiManager: UIManager;
    private structures: Map<EntityId, { kind: StructureKind; team: Team }> = new Map();
    private gameOver = false;

    constructor(world: World, entityFactory: EntityFactory, uiManager: UIManager) {
        this.world = world;
        this.entityFactory = entityFactory;
        this.uiManager = uiManager;
    }

    spawn(kind: StructureKind, team: Team, position: { x: number; y: number; z: number }, config: StructureConfig = {}): EntityId {
        const entityId = kind === 'tower'
            ? this.entityFactory.createTower({ team, position, ...config })
            : this.entityFactory.createBase({ team, position, ...config });

        this.structures.set(entityId, { kind, team });

        const render = this.world.getComponent<RenderComponent>(entityId, ComponentType.RENDER);
        render?.setHpBar(this.uiManager.createEntityUI(entityId, team), HP_BAR_OFFSET[kind]);

        return entityId;
    }

    /**
     * 每幀更新（Host）：主堡死亡時判定勝負，並移除已被銷毀的建築
     * HealthSystem 會在死亡當幀標記刪除、下一幀才真正銷毀，所以這裡還讀得到死亡的主堡
     */
    update(): void {
        for (const [entityId, { kind, team }] of this.structures) {
            if (!this.world.hasEntity(entityId)) {
                this.structures.delete(entityId);
                continue;
            }
            if (kind !== 'base' || this.gameOver) continue;

            const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            if (health?.isDead()) {
                this.gameOver = true;
                eventBus.emit({
                    type: 'GAME_OVER',
                    winnerTeam: team === 'red' ? 'blue' : 'red',
                    reason: 'base_destroyed'
                });
            }
        }
    }

    /**
     * 移除已被銷毀的建築（Client 由同步移除時使用）
     */
    prune(): void {
        for (const entityId of this.structures.keys()) {
            if (!this.world.hasEntity(entityId)) this.structures.delete(entityId);
        }
    }

    getAll(): ReadonlyMap<EntityId, { kind: StructureKind; team: Team }> {
        return this.structures;
    }

    clearAll(): void {
        for (const entityId of this.structures.keys()) {
            this.world.destroyEntity(entityId);
        }
        this.structures.clear();
        this.gameOver = false;
    }
}
