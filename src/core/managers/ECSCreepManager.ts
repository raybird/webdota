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
    HealthComponent,
    TeamComponent,
    RenderComponent,
    type EntityId,
    type Team,
} from '../ecs';

interface WaveConfig {
    creepsPerWave: number;
    waveIntervalSeconds: number;
}

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

    setWaveConfig(config: Partial<WaveConfig>): void {
        this.waveConfig = { ...this.waveConfig, ...config };
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

        const targetPosition = team === 'red' ? this.blueBasePosition : this.redBasePosition;

        // 判斷敵我 (灰色敵人)
        const roomStore = useRoomStore();
        const myTeam = roomStore.myPlayer?.team;
        const isEnemy = myTeam && myTeam !== team && myTeam !== 'neutral';

        for (let i = 0; i < this.waveConfig.creepsPerWave; i++) {
            const offsetX = (Math.random() - 0.5) * 2;
            const offsetZ = (Math.random() - 0.5) * 2;
            const position = {
                x: spawnPoint.position.x + offsetX,
                y: spawnPoint.position.y,
                z: spawnPoint.position.z + offsetZ
            };

            // 使用 EntityFactory 建立 ECS 小兵
            const creepId = this.entityFactory.createCreep({
                team,
                position,
                targetPosition: { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z },
                maxHp: 200,
                attackPower: 5,
                moveSpeed: 2.5,
                isEnemy
            });

            this.creeps.add(creepId);

            // 建立 UI
            const teamStr = team as 'red' | 'blue' | 'neutral';
            const ui = this.uiManager.createEntityUI(creepId, teamStr);

            // 設定 UI 參考到 RenderComponent (簡化：直接存到 World)
            const render = this.world.getComponent<RenderComponent>(creepId, ComponentType.RENDER);
            if (render && ui.hpBarEntity) {
                // 將 UI bar 作為子實體附加
                render.pcEntity.addChild(ui.hpBarEntity);
            }
        }
    }

    removeCreep(id: EntityId): void {
        if (!this.creeps.has(id)) return;

        // 銷毀 ECS Entity
        this.world.destroyEntity(id);
        this.uiManager.removePlayerUI(id);
        this.creeps.delete(id);
    }

    /**
     * 每幀更新（主要用於波次計時）
     * AI 邏輯已由 AISystem 處理
     */
    update(dt: number): void {
        // 波次計時器
        this.waveTimer += dt;
        if (this.waveTimer >= this.waveConfig.waveIntervalSeconds) {
            this.waveTimer = 0;
            this.spawnWave();
        }

        // 檢查死亡的小兵並移除
        const creepsToRemove: EntityId[] = [];

        for (const creepId of this.creeps) {
            const health = this.world.getComponent<HealthComponent>(creepId, ComponentType.HEALTH);
            if (health && health.isDead()) {
                creepsToRemove.push(creepId);
            }
        }

        creepsToRemove.forEach(id => this.removeCreep(id));
    }

    getAllCreepIds(): EntityId[] {
        return Array.from(this.creeps);
    }

    getCreepsByTeam(team: Team): EntityId[] {
        return Array.from(this.creeps).filter(id => {
            const teamComp = this.world.getComponent<TeamComponent>(id, ComponentType.TEAM);
            return teamComp?.team === team;
        });
    }

    clearAll(): void {
        for (const id of this.creeps) {
            this.world.destroyEntity(id);
            this.uiManager.removePlayerUI(id);
        }
        this.creeps.clear();
    }

    resetWaveTimer(): void {
        this.waveTimer = 0;
        this.waveCount = 0;
    }
}
