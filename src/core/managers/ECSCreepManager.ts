/**
 * ECSCreepManager - ECS 版小兵管理器
 * 使用 EntityFactory 與 ECS World 取代 CreepEntity class
 */

import * as pc from 'playcanvas';
import type { MapManager } from '../map/MapManager';
import type { UIManager } from '../UIManager';
import { useRoomStore } from '../../stores/roomStore';

import {
    World,
    EntityFactory,
    ComponentType,
    RenderComponent,
    type EntityId,
    type Team,
} from '../ecs';

interface WaveConfig {
    creepsPerWave: number;
    waveIntervalSeconds: number;
}

/** 小兵出生位置距主堡中心的距離（主堡底面半寬 2.5） */
const CREEP_SPAWN_OFFSET = 5;

export class ECSCreepManager {
    private mapManager: MapManager;
    private uiManager: UIManager;
    private world: World;
    private entityFactory: EntityFactory;

    /** 所有小兵 EntityId */
    private creeps: Set<EntityId> = new Set();

    // 波次計時器
    private waveTimer: number = 0;
    private waveCount: number = 0;

    // 目標位置
    private redBasePosition: pc.Vec3;
    private blueBasePosition: pc.Vec3;

    // 波次設定
    private waveConfig: WaveConfig = {
        creepsPerWave: 3,
        waveIntervalSeconds: 30
    };

    constructor(
        mapManager: MapManager,
        uiManager: UIManager,
        world: World,
        entityFactory: EntityFactory
    ) {
        this.mapManager = mapManager;
        this.uiManager = uiManager;
        this.world = world;
        this.entityFactory = entityFactory;

        this.redBasePosition = this.calculateBasePosition('red');
        this.blueBasePosition = this.calculateBasePosition('blue');

        console.log(`[ECSCreepManager] Initialized. Red base: (${this.redBasePosition.x}, ${this.redBasePosition.z}), Blue base: (${this.blueBasePosition.x}, ${this.blueBasePosition.z})`);
    }

    private calculateBasePosition(team: Team): pc.Vec3 {
        const spawnPoints = this.mapManager.getSpawnPoints(team as 'red' | 'blue');
        if (spawnPoints.length === 0) {
            return team === 'red' ? new pc.Vec3(22, 1, 22) : new pc.Vec3(-22, 1, -22);
        }

        let sumX = 0, sumZ = 0;
        spawnPoints.forEach(sp => {
            sumX += sp.position.x;
            sumZ += sp.position.z;
        });

        return new pc.Vec3(sumX / spawnPoints.length, 1, sumZ / spawnPoints.length);
    }


    spawnWave(): void {
        this.waveCount++;
        console.log(`[ECSCreepManager] Spawning wave ${this.waveCount}`);

        this.spawnCreepsForTeam('red');
        this.spawnCreepsForTeam('blue');
    }

    private spawnCreepsForTeam(team: Team): void {
        const spawnPoints = this.mapManager.getSpawnPoints(team as 'red' | 'blue');
        if (spawnPoints.length === 0) return;

        const spawnPoint = spawnPoints[0];
        if (!spawnPoint) return;

        // 出生點是主堡中心；往地圖中央移出主堡底面（5×5），一出生就在主堡像素圖旁邊看得到，也已朝向兵線
        const { x, z } = spawnPoint.position;
        const len = Math.hypot(x, z) || 1;
        const originX = x - (x / len) * CREEP_SPAWN_OFFSET;
        const originZ = z - (z / len) * CREEP_SPAWN_OFFSET;

        for (let i = 0; i < this.waveConfig.creepsPerWave; i++) {
            this.spawnCreep(team, {
                x: originX + (Math.random() - 0.5) * 2,
                y: spawnPoint.position.y,
                z: originZ + (Math.random() - 0.5) * 2
            });
        }
    }

    /**
     * 生成單一小兵（Host 生成波次，Client 依 Host 同步的狀態生成鏡像）
     */
    spawnCreep(team: Team, position: { x: number; y: number; z: number }, maxHp: number = 200): EntityId {
        const targetPosition = team === 'red' ? this.blueBasePosition : this.redBasePosition;

        // 判斷敵我 (灰色敵人)
        const myTeam = useRoomStore().myPlayer?.team;
        const isEnemy = myTeam && myTeam !== team && myTeam !== 'neutral';

        const creepId = this.entityFactory.createCreep({
            team,
            position,
            targetPosition: { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z },
            maxHp,
            attackPower: 5,
            moveSpeed: 2.5,
            isEnemy
        });
        this.creeps.add(creepId);

        const render = this.world.getComponent<RenderComponent>(creepId, ComponentType.RENDER);
        render?.setHpBar(this.uiManager.createEntityUI(creepId, team), 1.5);

        return creepId;
    }

    /**
     * 每幀更新（Host）：波次計時，並移除已被 HealthSystem 銷毀的小兵
     * AI 邏輯由 AISystem 處理
     */
    update(dt: number): void {
        this.waveTimer += dt;
        if (this.waveTimer >= this.waveConfig.waveIntervalSeconds) {
            this.waveTimer = 0;
            this.spawnWave();
        }

        this.prune();
    }

    /**
     * 移除已被銷毀（HealthSystem 或同步移除）的小兵
     */
    prune(): void {
        for (const creepId of this.creeps) {
            if (!this.world.hasEntity(creepId)) this.creeps.delete(creepId);
        }
    }

    getAllCreepIds(): ReadonlySet<EntityId> {
        return this.creeps;
    }

    clearAll(): void {
        for (const id of this.creeps) {
            this.world.destroyEntity(id);
        }
        this.creeps.clear();
    }

    resetWaveTimer(): void {
        this.waveTimer = 0;
        this.waveCount = 0;
    }
}
