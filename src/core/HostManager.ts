import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

export interface NPCState {
    id: string;
    type: 'minion' | 'turret' | 'jungle_creep';
    position: { x: number; y: number; z: number };
    health: number;
    team: 'blue' | 'red';
}

export class HostManager {
    isHost: boolean = false;
    app: pc.Application;
    physicsWorld: RAPIER.World;

    // NPC 管理
    npcs: Map<string, NPCState> = new Map();
    minionSpawnTimer: number = 0;
    minionSpawnInterval: number = 30; // 每 30 秒生成一波兵線

    constructor(app: pc.Application, physicsWorld: RAPIER.World) {
        this.app = app;
        this.physicsWorld = physicsWorld;
    }

    setHost(isHost: boolean) {
        this.isHost = isHost;
        console.log(`[HostManager] Host status: ${isHost}`);
    }

    /**
     * 每 Frame 更新 (僅 Host 執行)
     */
    update(dt: number) {
        if (!this.isHost) return;

        // 更新兵線生成計時器
        this.minionSpawnTimer += dt;
        if (this.minionSpawnTimer >= this.minionSpawnInterval) {
            this.spawnMinionWave();
            this.minionSpawnTimer = 0;
        }

        // 更新 NPC AI (簡化版)
        this.updateNPCs(dt);
    }

    /**
     * 生成一波兵線
     */
    private spawnMinionWave() {
        console.log('[HostManager] Spawning minion wave');

        // 藍隊兵線 (3 路)
        this.spawnMinion('blue', 'top', -10, 0, 10);
        this.spawnMinion('blue', 'mid', 0, 0, 10);
        this.spawnMinion('blue', 'bot', 10, 0, 10);

        // 紅隊兵線 (3 路)
        this.spawnMinion('red', 'top', -10, 0, -10);
        this.spawnMinion('red', 'mid', 0, 0, -10);
        this.spawnMinion('red', 'bot', 10, 0, -10);
    }

    /**
     * 生成單個小兵
     */
    private spawnMinion(team: 'blue' | 'red', lane: string, x: number, y: number, z: number) {
        const id = `minion_${team}_${lane}_${Date.now()}`;
        const npc: NPCState = {
            id,
            type: 'minion',
            position: { x, y, z },
            health: 100,
            team
        };

        this.npcs.set(id, npc);

        // 建立視覺實體 (簡化版，實際應從 Object Pool 取)
        const entity = new pc.Entity(`Minion_${id}`);
        entity.addComponent('render', {
            type: 'box'
        });
        entity.setLocalScale(0.5, 0.5, 0.5);
        entity.setPosition(x, y, z);

        const material = new pc.StandardMaterial();
        material.diffuse = team === 'blue' ? new pc.Color(0.2, 0.4, 1) : new pc.Color(1, 0.2, 0.2);
        material.update();
        if (entity.render) {
            entity.render.material = material;
        }

        this.app.root.addChild(entity);

        // 建立物理碰撞體
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.25, 0.25, 0.25);
        this.physicsWorld.createCollider(colliderDesc, rigidBody);

        // TODO: 將 entity 與 rigidBody 關聯起來 (需要 Entity-Physics mapping)
    }

    /**
     * 更新所有 NPC (簡化版 AI)
     */
    private updateNPCs(dt: number) {
        this.npcs.forEach((npc) => {
            // 簡單的前進邏輯 (朝敵方基地移動)
            if (npc.type === 'minion') {
                const direction = npc.team === 'blue' ? -1 : 1;
                npc.position.z += direction * 0.5 * dt; // 每秒移動 0.5 單位
            }
        });
    }

    /**
     * 取得所有 NPC 狀態 (用於同步)
     */
    getNPCStates(): NPCState[] {
        return Array.from(this.npcs.values());
    }

    /**
     * 同步 NPC 狀態 (非 Host 接收)
     */
    syncNPCStates(states: NPCState[]) {
        if (this.isHost) return; // Host 不需要同步

        // 更新本地 NPC 狀態
        states.forEach((state) => {
            this.npcs.set(state.id, state);
            // TODO: 更新視覺實體位置
        });
    }
}
