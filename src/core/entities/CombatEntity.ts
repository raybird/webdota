/**
 * CombatEntity - 戰鬥實體基底類別
 * 為所有可戰鬥的實體 (Player, Tower, Creep) 提供通用介面
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { CombatStats } from '../combat/CombatStats';

export type Team = 'red' | 'blue' | 'neutral';

export abstract class CombatEntity {
    readonly entityId: string;
    readonly team: Team;

    entity: pc.Entity;
    rigidBody: RAPIER.RigidBody | null = null;
    combatStats: CombatStats;

    protected app: pc.Application;
    protected physicsWorld: RAPIER.World;

    // UI 實體 (血條)
    hpBarEntity: pc.Entity | null = null;
    hpBarFillEntity: pc.Entity | null = null;

    // 最後攻擊者 ID (用於擊殺獎勵)
    lastAttackerId: string | null = null;

    constructor(
        entityId: string,
        team: Team,
        app: pc.Application,
        physicsWorld: RAPIER.World,
        stats: Partial<CombatStats>
    ) {
        this.entityId = entityId;
        this.team = team;
        this.app = app;
        this.physicsWorld = physicsWorld;
        this.combatStats = new CombatStats(stats);

        // 子類別需要初始化 entity
        this.entity = new pc.Entity(`Entity_${entityId}`);
    }

    /**
     * 設定 UI 參考
     */
    setUIReferences(hpBarEntity: pc.Entity, hpBarFillEntity: pc.Entity) {
        this.hpBarEntity = hpBarEntity;
        this.hpBarFillEntity = hpBarFillEntity;
    }

    /**
     * 受到傷害
     */
    takeDamage(amount: number, attackerId?: string): number {
        const actualDamage = this.combatStats.takeDamage(amount);

        if (attackerId) {
            this.lastAttackerId = attackerId;
        }

        console.log(`[CombatEntity] ${this.entityId.substring(0, 8)} took ${actualDamage} damage from ${attackerId || 'unknown'}. HP: ${this.combatStats.currentHp}/${this.combatStats.maxHp}`);
        this.updateHpBar();
        return actualDamage;
    }

    /**
     * 檢查是否已死亡
     */
    isDead(): boolean {
        return this.combatStats.currentHp <= 0;
    }

    /**
     * 取得當前位置
     */
    getPosition(): pc.Vec3 {
        if (this.rigidBody) {
            const pos = this.rigidBody.translation();
            return new pc.Vec3(pos.x, pos.y, pos.z);
        }
        return this.entity.getPosition();
    }

    /**
     * 更新血條
     */
    updateHpBar() {
        // 由 UIManager 處理具體 UI 更新
        // 這裡處理受傷閃爍效果
        const children = this.entity.children.filter(c => (c as pc.Entity).render) as pc.Entity[];
        if (children.length > 0) {
            children.forEach(child => {
                if (child.render) {
                    const material = child.render.material as pc.StandardMaterial | undefined;
                    if (material && material.emissive) {
                        const originalEmissive = material.emissive.clone();
                        material.emissive = new pc.Color(1, 1, 1);
                        material.update();
                        setTimeout(() => {
                            material.emissive = originalEmissive;
                            material.update();
                        }, 100);
                    }
                }
            });
        }
    }

    /**
     * 每幀更新 (子類別覆寫)
     */
    abstract update(dt: number): void;

    /**
     * 清理資源
     */
    destroy() {
        if (this.entity) {
            this.entity.destroy();
        }
        if (this.hpBarEntity) {
            this.hpBarEntity.destroy();
        }
        if (this.rigidBody) {
            this.physicsWorld.removeRigidBody(this.rigidBody);
        }
    }
}
