/**
 * EntitySyncManager - 建築與小兵的 Host → Client 同步
 *
 * Host：為每個建築與小兵配發網路 ID（各端的 ECS Entity ID 是各自產生的 UUID，不能直接對應），收集狀態廣播。
 * Client：依 Host 的狀態生成、更新、移除鏡像實體；鏡像不跑 AI，血量與位置都以 Host 為準。
 */

import type { ECSStructureManager } from './ECSStructureManager';
import type { MapManager } from '../map/MapManager';
import type { ECSCreepManager } from './ECSCreepManager';
import type { NetEntityKind, NetEntityState } from '../../utils/BinarySerializer';
import {
    World,
    ComponentType,
    HealthComponent,
    HealthSystem,
    PhysicsComponent,
    TeamComponent,
    TransformComponent,
    type EntityId,
} from '../ecs';

/** 網路 ID 以 Uint16 傳輸 */
const MAX_NET_ID = 0xffff;

export class EntitySyncManager {
    private world: World;
    private structureManager: ECSStructureManager;
    private creepManager: ECSCreepManager;

    /** Host：Entity → 網路 ID */
    private netIds: Map<EntityId, number> = new Map();
    private nextNetId = 1;

    /** Client：網路 ID → 鏡像 Entity */
    private mirrors: Map<number, EntityId> = new Map();

    private mapManager: MapManager;

    constructor(world: World, structureManager: ECSStructureManager, creepManager: ECSCreepManager, mapManager: MapManager) {
        this.world = world;
        this.structureManager = structureManager;
        this.creepManager = creepManager;
        this.mapManager = mapManager;
    }

    /**
     * Host 遷移：新 Host 沿用原 Host 的網路 ID，其他 Client 的鏡像才對得上，不會全部重建
     */
    adoptMirrors(): void {
        let maxNetId = 0;
        for (const [netId, entityId] of this.mirrors) {
            if (!this.world.hasEntity(entityId)) continue;
            this.netIds.set(entityId, netId);
            maxNetId = Math.max(maxNetId, netId);
        }
        this.nextNetId = maxNetId >= MAX_NET_ID ? 1 : maxNetId + 1;
        this.mirrors.clear();
    }

    reset(): void {
        this.netIds.clear();
        this.nextNetId = 1;
        this.mirrors.clear();
    }

    /**
     * Host：收集所有存活的建築與小兵狀態
     */
    collect(): NetEntityState[] {
        const states: NetEntityState[] = [];

        for (const [entityId, { kind }] of this.structureManager.getAll()) {
            this.pushState(states, entityId, kind);
        }
        for (const entityId of this.creepManager.getAllCreepIds()) {
            this.pushState(states, entityId, 'creep');
        }

        // 清掉已銷毀實體的網路 ID
        for (const entityId of this.netIds.keys()) {
            if (!this.world.hasEntity(entityId)) this.netIds.delete(entityId);
        }

        return states;
    }

    private pushState(states: NetEntityState[], entityId: EntityId, kind: NetEntityKind): void {
        const transform = this.world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);
        const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
        const team = this.world.getComponent<TeamComponent>(entityId, ComponentType.TEAM);
        if (!transform || !health || !team) return;

        const { x, y, z, w } = transform.rotation;
        states.push({
            netId: this.getNetId(entityId),
            kind,
            team: team.team,
            pos: { x: transform.position.x, y: transform.position.y, z: transform.position.z },
            yaw: Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)),
            hp: health.currentHp,
            maxHp: health.maxHp
        });
    }

    /** Host：建築或小兵的網路 ID；不是同步實體時傳回 undefined */
    netIdOf(entityId: EntityId): number | undefined {
        if (!this.world.hasEntity(entityId)) return undefined;
        if (!this.structureManager.getAll().has(entityId) && !this.creepManager.getAllCreepIds().has(entityId)) return undefined;
        return this.getNetId(entityId);
    }

    /** Client：網路 ID 對應的鏡像實體 */
    entityOf(netId: number): EntityId | undefined {
        return this.mirrors.get(netId);
    }

    private getNetId(entityId: EntityId): number {
        let netId = this.netIds.get(entityId);
        if (netId === undefined) {
            netId = this.nextNetId;
            this.nextNetId = this.nextNetId >= MAX_NET_ID ? 1 : this.nextNetId + 1;
            this.netIds.set(entityId, netId);
        }
        return netId;
    }

    /**
     * Client：套用 Host 的狀態
     */
    apply(states: NetEntityState[]): void {
        const seen = new Set<number>();

        for (const state of states) {
            seen.add(state.netId);
            let entityId = this.mirrors.get(state.netId);

            if (entityId && !this.world.hasEntity(entityId)) {
                // 本地已因血量歸零而移除
                this.mirrors.delete(state.netId);
                entityId = undefined;
            }

            if (!entityId) {
                if (state.hp <= 0) continue;
                entityId = this.spawnMirror(state);
                this.mirrors.set(state.netId, entityId);
                // 剛生成時直接套用血量，不當成受到傷害
                const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
                if (health) health.currentHp = state.hp;
            }

            this.updateMirror(entityId, state);
        }

        // Host 沒再送的實體已經死亡或移除
        for (const [netId, entityId] of this.mirrors) {
            if (seen.has(netId)) continue;
            this.world.destroyEntity(entityId);
            this.mirrors.delete(netId);
        }
        this.creepManager.prune();
        this.structureManager.prune();
    }

    private spawnMirror(state: NetEntityState): EntityId {
        if (state.kind === 'creep') return this.creepManager.spawnCreep(state.team, state.pos, state.maxHp);
        // 射程與攻擊力取地圖設定：畫面的射程圈要用，Host 遷移後也由這份鏡像繼續攻擊
        const config = { ...this.mapManager.structureConfigAt(state.kind, state.pos.x, state.pos.z), maxHp: state.maxHp };
        return this.structureManager.spawn(state.kind, state.team, state.pos, config);
    }

    private updateMirror(entityId: EntityId, state: NetEntityState): void {
        HealthSystem.syncHp(this.world, entityId, state.hp);

        if (state.kind !== 'creep') return;
        const physics = this.world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        if (!physics) return;
        physics.setKinematicPosition(state.pos.x, state.pos.y, state.pos.z);
        const half = state.yaw / 2;
        physics.setKinematicRotation(0, Math.sin(half), 0, Math.cos(half));
    }
}
