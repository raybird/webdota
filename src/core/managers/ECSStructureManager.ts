/**
 * ECSStructureManager - 防禦塔與主堡管理器
 * 主堡被摧毀時發出 GAME_OVER
 */

import * as pc from 'playcanvas';
import type { UIManager, EntityBarUI } from '../UIManager';
import { eventBus } from '../../events/EventBus';
import { shieldedStructures } from '../combat/structureOrder';
import {
    World,
    EntityFactory,
    ComponentType,
    HealthComponent,
    RenderComponent,
    TransformComponent,
    AIComponent,
    type EntityId,
    type Team,
} from '../ecs';

export type StructureKind = 'tower' | 'base';

export interface StructureConfig {
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
    /** 依序攻擊的順序（外塔 1 … 主堡 4），見 combat/structureOrder.ts */
    order?: number;
}

interface StructureInfo {
    kind: StructureKind;
    team: Team;
    order?: number;
    bar: EntityBarUI;
    /** 血條原本的顏色，受保護時改成灰色 */
    fillColor: pc.Color;
}

/** 受保護的建築：血條改成灰色、半透明 */
const SHIELDED_FILL = new pc.Color(0.55, 0.55, 0.6);
const SHIELDED_OPACITY = 0.6;
/** 本地玩家走到受保護的敵方建築射程外這麼遠以內時提示 */
const SHIELD_HINT_MARGIN = 2;
/** 同一座建築的提示間隔（秒） */
const SHIELD_HINT_INTERVAL = 3;
export const SHIELD_HINT_LABEL = '先摧毀前一座塔';

/** 血條離建築原點的高度：要高過像素圖（塔約 6.5 單位、主堡約 10 單位），否則被圖擋住 */
const HP_BAR_OFFSET: Record<StructureKind, number> = { tower: 6.8, base: 9.4 };
/** 血條大小（UI 像素 × 0.01 = 世界單位）：比小兵的 80×10 大，遠處也看得到 */
const HP_BAR_SIZE: Record<StructureKind, { width: number; height: number }> = {
    tower: { width: 180, height: 16 },
    base: { width: 260, height: 20 },
};

export class ECSStructureManager {
    private world: World;
    private entityFactory: EntityFactory;
    private uiManager: UIManager;
    private structures: Map<EntityId, StructureInfo> = new Map();
    /** 建築 → 距離下次可以再提示的秒數 */
    private hintCooldowns = new Map<EntityId, number>();
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

        const bar = this.uiManager.createEntityUI(entityId, team, HP_BAR_SIZE[kind]);
        const fillColor = bar.hpBarFillEntity.element!.color.clone();
        this.structures.set(entityId, { kind, team, order: config.order, bar, fillColor });

        const render = this.world.getComponent<RenderComponent>(entityId, ComponentType.RENDER);
        render?.setHpBar(bar, HP_BAR_OFFSET[kind]);

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

    /** 該隊主堡的位置（泉水中心）；主堡已被摧毀時回傳 null */
    basePosition(team: Team): { x: number; z: number } | null {
        for (const [entityId, info] of this.structures) {
            if (info.kind !== 'base' || info.team !== team) continue;
            const transform = this.world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            if (transform) return { x: transform.position.x, z: transform.position.z };
        }
        return null;
    }

    getAll(): ReadonlyMap<EntityId, { kind: StructureKind; team: Team; order?: number }> {
        return this.structures;
    }

    /** 每個模擬幀（Host 與 Client）：依序攻擊的保護狀態與血條顏色 */
    updateShields(): void {
        const shielded = shieldedStructures([...this.structures].map(([id, info]) => ({
            id, team: info.team, order: info.order,
            alive: this.world.hasEntity(id) && !this.world.getComponent<HealthComponent>(id, ComponentType.HEALTH)?.isDead()
        })));

        for (const [entityId, info] of this.structures) {
            const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            const isShielded = shielded.has(entityId);
            if (!health || health.shielded === isShielded) continue;
            health.shielded = isShielded;
            const fill = info.bar.hpBarFillEntity.element;
            if (fill) {
                fill.color = isShielded ? SHIELDED_FILL : info.fillColor;
                fill.opacity = isShielded ? SHIELDED_OPACITY : 1;
            }
        }
    }

    /** 每個畫面幀：本地玩家靠近受保護的敵方建築時，建築頭上提示要先打前一座 */
    updateShieldHints(dt: number, localTeam: Team | null, localPosition: { x: number; z: number } | null): void {
        for (const [entityId, info] of this.structures) {
            const cooldown = Math.max(0, (this.hintCooldowns.get(entityId) ?? 0) - dt);
            this.hintCooldowns.set(entityId, cooldown);
            if (cooldown > 0 || !localTeam || !localPosition || info.team === localTeam) continue;
            if (!this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH)?.shielded) continue;
            const transform = this.world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
            if (!transform) continue;
            const range = this.world.getComponent<AIComponent>(entityId, ComponentType.AI)?.attackRange ?? 10;
            const distance = Math.hypot(transform.position.x - localPosition.x, transform.position.z - localPosition.z);
            if (distance > range + SHIELD_HINT_MARGIN) continue;
            this.hintCooldowns.set(entityId, SHIELD_HINT_INTERVAL);
            eventBus.emit({ type: 'STRUCTURE_SHIELDED', targetId: entityId, label: SHIELD_HINT_LABEL });
        }
    }

    clearAll(): void {
        for (const entityId of this.structures.keys()) {
            this.world.destroyEntity(entityId);
        }
        this.structures.clear();
        this.hintCooldowns.clear();
        this.gameOver = false;
    }
}
