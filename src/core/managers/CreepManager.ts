/**
 * CreepManager - 小兵管理器
 * 負責小兵的生成、AI 更新與生命週期管理
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { CreepEntity } from '../entities/CreepEntity';
import { CombatEntity, type Team } from '../entities/CombatEntity';
import type { MapManager } from '../map/MapManager';
import type { UIManager } from '../UIManager';
import { useRoomStore } from '../../stores/roomStore';

export interface CreepSpawnConfig {
    maxHp?: number;
    attackPower?: number;
    moveSpeed?: number;
    attackRange?: number;
    attackCooldown?: number;
    colorOverride?: pc.Color;
}

export interface WaveConfig {
    creepsPerWave: number;
    waveIntervalSeconds: number;
}

export class CreepManager {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private mapManager: MapManager;
    private uiManager: UIManager;
    private creeps: Map<string, CreepEntity> = new Map();

    // 波次計時器
    private waveTimer: number = 0;
    private waveCount: number = 0;

    // 小兵 AI 目標 (敵方基地位置)
    private redBasePosition: pc.Vec3;
    private blueBasePosition: pc.Vec3;

    // 波次設定
    private waveConfig: WaveConfig = {
        creepsPerWave: 3,
        waveIntervalSeconds: 30
    };

    constructor(app: pc.Application, physicsWorld: RAPIER.World, mapManager: MapManager, uiManager: UIManager) {
        this.app = app;
        this.physicsWorld = physicsWorld;
        this.mapManager = mapManager;
        this.uiManager = uiManager;

        // 計算基地位置 (使用出生點的平均位置)
        this.redBasePosition = this.calculateBasePosition('red');
        this.blueBasePosition = this.calculateBasePosition('blue');

        console.log(`[CreepManager] Red base at (${this.redBasePosition.x}, ${this.redBasePosition.z})`);
        console.log(`[CreepManager] Blue base at (${this.blueBasePosition.x}, ${this.blueBasePosition.z})`);
    }

    /**
     * 計算隊伍基地位置
     */
    private calculateBasePosition(team: Team): pc.Vec3 {
        const spawnPoints = this.mapManager.getSpawnPoints(team as 'red' | 'blue');
        if (spawnPoints.length === 0) {
            // 預設位置
            return team === 'red' ? new pc.Vec3(22, 1, 22) : new pc.Vec3(-22, 1, -22);
        }

        let sumX = 0, sumZ = 0;
        spawnPoints.forEach(sp => {
            sumX += sp.position.x;
            sumZ += sp.position.z;
        });

        return new pc.Vec3(sumX / spawnPoints.length, 1, sumZ / spawnPoints.length);
    }

    /**
     * 設定波次配置
     */
    setWaveConfig(config: Partial<WaveConfig>): void {
        this.waveConfig = { ...this.waveConfig, ...config };
    }

    /**
     * 生成一波小兵
     */
    spawnWave(): void {
        this.waveCount++;
        console.log(`[CreepManager] Spawning wave ${this.waveCount}`);

        // 從紅隊和藍隊出生點各生成小兵
        this.spawnCreepsForTeam('red');
        this.spawnCreepsForTeam('blue');
    }

    /**
     * 為指定隊伍生成小兵
     */
    private spawnCreepsForTeam(team: Team): void {
        const spawnPoints = this.mapManager.getSpawnPoints(team as 'red' | 'blue');
        if (spawnPoints.length === 0) {
            console.warn(`[CreepManager] No spawn points for team ${team}`);
            return;
        }

        // 使用第一個出生點
        const spawnPoint = spawnPoints[0];
        if (!spawnPoint) {
            console.warn(`[CreepManager] Spawn point undefined for team ${team}`);
            return;
        }

        const targetPosition = team === 'red' ? this.blueBasePosition : this.redBasePosition;

        for (let i = 0; i < this.waveConfig.creepsPerWave; i++) {
            const creepId = `creep_${team}_w${this.waveCount}_${i}`;

            // 稍微錯開生成位置
            const offsetX = (Math.random() - 0.5) * 2;
            const offsetZ = (Math.random() - 0.5) * 2;
            const position = {
                x: spawnPoint.position.x + offsetX,
                y: spawnPoint.position.y,
                z: spawnPoint.position.z + offsetZ
            };

            this.spawnCreep(creepId, team, position, {}, targetPosition);
        }
    }

    /**
     * 生成單個小兵
     */
    spawnCreep(
        id: string,
        team: Team,
        position: { x: number; y: number; z: number },
        config: CreepSpawnConfig = {},
        targetPosition?: pc.Vec3
    ): CreepEntity {
        if (this.creeps.has(id)) {
            // console.warn(`[CreepManager] Creep ${id} already exists`);
            return this.creeps.get(id)!;
        }

        // 判斷是否為敵方小兵
        const roomStore = useRoomStore();
        const myTeam = roomStore.myPlayer?.team;
        const creepTeam = team;

        // 敵方判斷：只要我有隊伍，且小兵隊伍跟我不同，就是敵人
        const isEnemy = (myTeam === 'red' || myTeam === 'blue') &&
            (creepTeam === 'red' || creepTeam === 'blue') &&
            creepTeam !== myTeam;

        if (isEnemy) {
            config.colorOverride = new pc.Color(0.5, 0.5, 0.5);
            // console.log(`[CreepManager] Creep ${id} is ENEMY, setting color to GRAY`);
        }

        const creep = new CreepEntity(
            id,
            team,
            this.app,
            this.physicsWorld,
            position,
            config
        );

        // 設定目標位置
        if (targetPosition) {
            creep.setTargetPosition(targetPosition);
        } else {
            // 預設移動到敵方基地
            const target = team === 'red' ? this.blueBasePosition : this.redBasePosition;
            creep.setTargetPosition(target);
        }

        this.creeps.set(id, creep);

        // 建立 UI
        const teamStr = team as 'red' | 'blue' | 'neutral';
        const ui = this.uiManager.createEntityUI(id, teamStr);
        creep.setUIReferences(ui.hpBarEntity, ui.hpBarFillEntity);

        return creep;
    }

    /**
     * 移除小兵
     */
    removeCreep(id: string): void {
        const creep = this.creeps.get(id);
        if (creep) {
            creep.destroy();
            this.uiManager.removePlayerUI(id); // Reuse removal logic
            this.creeps.delete(id);
        }
    }

    /**
     * 每幀更新所有小兵
     * @param dt Delta time
     * @param allTargets 所有可攻擊目標
     */
    update(dt: number, allTargets: CombatEntity[]): void {
        // 波次計時器
        this.waveTimer += dt;
        if (this.waveTimer >= this.waveConfig.waveIntervalSeconds) {
            this.waveTimer = 0;
            this.spawnWave();
        }

        const creepsToRemove: string[] = [];

        this.creeps.forEach((creep, id) => {
            // 更新小兵狀態
            creep.update(dt);

            // 檢查是否死亡
            if (creep.isDead()) {
                // 處理擊殺獎勵
                if (creep.lastAttackerId) {
                    const attacker = allTargets.find(t => t.entityId === creep.lastAttackerId);
                    // 檢查攻擊者是否為玩家 (擁有 giveGold 方法)
                    if (attacker && 'giveGold' in attacker && typeof (attacker as any).giveGold === 'function') {
                        (attacker as any).giveGold(25);
                        console.log(`[CreepManager] Awarded 25 gold to ${attacker.entityId} for killing ${id}`);
                    }
                }
                creepsToRemove.push(id);
                return;
            }

            // 尋找最近的敵人並攻擊
            const closestEnemy = this.findClosestEnemy(creep, allTargets);
            if (closestEnemy) {
                const distance = creep.getPosition().distance(closestEnemy.getPosition());

                // 如果敵人在攻擊範圍內，停下來攻擊
                if (distance <= 2) { // 攻擊範圍稍大於實際攻擊判定
                    creep.setTargetPosition(creep.getPosition()); // 停止移動
                    creep.tryAttack(closestEnemy);
                } else {
                    // 否則追趕敵人
                    creep.setTargetPosition(closestEnemy.getPosition());
                }
            }
        });

        // 移除死亡的小兵
        creepsToRemove.forEach(id => this.removeCreep(id));
    }

    /**
     * 尋找最近的敵人
     */
    private findClosestEnemy(creep: CreepEntity, allTargets: CombatEntity[]): CombatEntity | null {
        let closest: CombatEntity | null = null;
        let closestDist = Infinity;
        const creepPos = creep.getPosition();

        for (const target of allTargets) {
            // 跳過同隊、中立、死亡
            if (target.team === creep.team || target.team === 'neutral') continue;
            if (target.isDead()) continue;
            // 跳過自己
            if (target.entityId === creep.entityId) continue;

            const dist = creepPos.distance(target.getPosition());
            if (dist < closestDist) {
                closestDist = dist;
                closest = target;
            }
        }

        return closest;
    }

    /**
     * 取得所有小兵
     */
    getAllCreeps(): Map<string, CreepEntity> {
        return this.creeps;
    }

    /**
     * 取得所有小兵作為 CombatEntity 陣列
     */
    getAllCreepsAsEntities(): CombatEntity[] {
        return Array.from(this.creeps.values());
    }

    /**
     * 取得指定隊伍的小兵
     */
    getCreepsByTeam(team: Team): CreepEntity[] {
        return Array.from(this.creeps.values()).filter(c => c.team === team);
    }

    /**
     * 清除所有小兵
     */
    clearAll(): void {
        this.creeps.forEach(creep => creep.destroy());
        this.creeps.clear();
        this.waveTimer = 0;
        this.waveCount = 0;
        console.log('[CreepManager] Cleared all creeps');
    }

    /**
     * 重置波次計時器 (遊戲開始時呼叫)
     */
    resetWaveTimer(): void {
        this.waveTimer = 0;
        this.waveCount = 0;
    }
}
