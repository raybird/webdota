/**
 * TowerManager - 防禦塔管理器
 * 負責防禦塔的生成、更新與生命週期管理
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { TowerEntity } from '../entities/TowerEntity';
import { CombatEntity, type Team } from '../entities/CombatEntity';
import type { ProjectileManager } from '../combat/ProjectileManager';
import { useRoomStore } from '../../stores/roomStore';

export interface TowerSpawnConfig {
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
    colorOverride?: pc.Color;
}

export class TowerManager {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private towers: Map<string, TowerEntity> = new Map();
    private projectileManager: ProjectileManager | null = null;

    constructor(app: pc.Application, physicsWorld: RAPIER.World) {
        this.app = app;
        this.physicsWorld = physicsWorld;
    }

    /**
     * 設定 ProjectileManager 參考
     */
    setProjectileManager(pm: ProjectileManager) {
        this.projectileManager = pm;
        // 更新所有現有塔的 ProjectileManager
        this.towers.forEach(tower => tower.setProjectileManager(pm));
    }

    /**
     * 生成防禦塔
     */
    spawnTower(
        id: string,
        team: Team,
        position: { x: number; y: number; z: number },
        config: TowerSpawnConfig = {}
    ): TowerEntity {
        if (this.towers.has(id)) {
            console.warn(`[TowerManager] Tower ${id} already exists`);
            return this.towers.get(id)!;
        }

        // 判斷是否為敵方塔
        const roomStore = useRoomStore();
        const myTeam = roomStore.myPlayer?.team;
        const towerTeam = team;

        const isEnemy = (myTeam === 'red' || myTeam === 'blue') &&
            (towerTeam === 'red' || towerTeam === 'blue') &&
            towerTeam !== myTeam;

        if (isEnemy) {
            config.colorOverride = new pc.Color(0.5, 0.5, 0.5);
            // console.log(`[TowerManager] Tower ${id} is ENEMY, setting color to GRAY`);
        }


        const tower = new TowerEntity(
            id,
            team,
            this.app,
            this.physicsWorld,
            position,
            config
        );

        if (this.projectileManager) {
            tower.setProjectileManager(this.projectileManager);
        }

        this.towers.set(id, tower);
        console.log(`[TowerManager] Spawned tower ${id} for team ${team}`);
        return tower;
    }

    /**
     * 移除防禦塔
     */
    removeTower(id: string): void {
        const tower = this.towers.get(id);
        if (tower) {
            tower.destroy();
            this.towers.delete(id);
            console.log(`[TowerManager] Removed tower ${id}`);
        }
    }

    /**
     * 每幀更新所有防禦塔
     * @param dt Delta time
     * @param allTargets 所有可攻擊目標
     */
    update(dt: number, allTargets: CombatEntity[]): void {
        const towersToRemove: string[] = [];

        this.towers.forEach((tower, id) => {
            // 更新塔狀態
            tower.update(dt);

            // 檢查是否死亡
            if (tower.isDead()) {
                towersToRemove.push(id);
                return;
            }

            // 嘗試攻擊
            tower.tryAttack(allTargets);
        });

        // 移除死亡的塔
        towersToRemove.forEach(id => this.removeTower(id));
    }

    /**
     * 取得所有防禦塔
     */
    getAllTowers(): Map<string, TowerEntity> {
        return this.towers;
    }

    /**
     * 取得所有防禦塔作為 CombatEntity 陣列
     */
    getAllTowersAsEntities(): CombatEntity[] {
        return Array.from(this.towers.values());
    }

    /**
     * 取得指定隊伍的防禦塔
     */
    getTowersByTeam(team: Team): TowerEntity[] {
        return Array.from(this.towers.values()).filter(t => t.team === team);
    }

    /**
     * 清除所有防禦塔
     */
    clearAll(): void {
        this.towers.forEach(tower => tower.destroy());
        this.towers.clear();
        console.log('[TowerManager] Cleared all towers');
    }
}
