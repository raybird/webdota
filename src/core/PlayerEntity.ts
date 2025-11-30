import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

import { CombatStats } from './combat/CombatStats';
import { SkillManager, DEFAULT_SKILLS } from './combat/SkillManager';

export class PlayerEntity {
    playerId: string;
    entity: pc.Entity;
    rigidBody: RAPIER.RigidBody;

    // 戰鬥系統
    combatStats: CombatStats;
    skillManager: SkillManager;

    // UI 實體
    hpBarEntity!: pc.Entity;
    hpBarFillEntity!: pc.Entity;

    // 移動方向追蹤（用於攻擊方向）
    private lastMoveDirection: pc.Vec3 = new pc.Vec3(0, 0, 1); // 預設向前

    constructor(
        playerId: string,
        app: pc.Application,
        physicsWorld: RAPIER.World,
        position: { x: number; y: number; z: number },
        color: pc.Color
    ) {
        this.playerId = playerId;

        // 初始化戰鬥屬性
        this.combatStats = new CombatStats({
            maxHp: 1000,
            currentHp: 1000,
            maxEnergy: 100,
            currentEnergy: 0,
            moveSpeed: 5.0
        });

        // 初始化技能管理器
        this.skillManager = new SkillManager(DEFAULT_SKILLS);

        // 建立視覺實體
        this.entity = new pc.Entity(`Player_${playerId}`);
        this.entity.addComponent('render', {
            type: 'box'
        });
        this.entity.setLocalScale(1, 1, 1);
        this.entity.setPosition(position.x, position.y, position.z);

        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.update();
        if (this.entity.render) {
            this.entity.render.material = material;
        }

        app.root.addChild(this.entity);

        // 建立物理剛體
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z);
        this.rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
        physicsWorld.createCollider(colliderDesc, this.rigidBody);

        // UI 會由 UIManager 建立，稍後透過 setUIReferences 設定
    }

    /**
     * 設定 UI 參考（由 GameApp 在建立玩家後呼叫）
     */
    setUIReferences(hpBarEntity: pc.Entity, hpBarFillEntity: pc.Entity) {
        this.hpBarEntity = hpBarEntity;
        this.hpBarFillEntity = hpBarFillEntity;
    }

    /**
     * 移動角色
     */
    move(moveX: number, moveY: number, dt: number) {
        // 計算移動向量 (moveY 對應 Z 軸，moveX 對應 X 軸)
        const velocity = {
            x: moveX * this.combatStats.moveSpeed * dt,
            y: 0,
            z: moveY * this.combatStats.moveSpeed * dt
        };

        // 更新最後移動方向（用於攻擊方向）
        if (moveX !== 0 || moveY !== 0) {
            this.lastMoveDirection.set(moveX, 0, moveY);
            this.lastMoveDirection.normalize();
        }

        // 更新物理位置
        const currentPos = this.rigidBody.translation();
        this.rigidBody.setNextKinematicTranslation({
            x: currentPos.x + velocity.x,
            y: currentPos.y + velocity.y,
            z: currentPos.z + velocity.z
        });
    }

    /**
     * 受到傷害
     */
    takeDamage(amount: number) {
        const actualDamage = this.combatStats.takeDamage(amount);
        console.log(`[PlayerEntity] ${this.playerId.substring(0, 8)} took ${actualDamage} damage. HP: ${this.combatStats.currentHp}/${this.combatStats.maxHp}`);

        this.updateHpBar();
    }

    /**
     * 使用技能
     * @returns 使用的技能資料，如果失敗則返回 null
     */
    useSkill(skillId: string): { skill: any, direction: pc.Vec3 } | null {
        // 檢查是否可用
        if (!this.skillManager.canUseSkill(skillId, this.combatStats.currentEnergy)) {
            console.log(`[PlayerEntity] Cannot use skill ${skillId} - on cooldown or insufficient energy`);
            return null;
        }

        // 使用技能
        const skill = this.skillManager.useSkill(skillId);
        if (!skill) return null;

        // 消耗能量
        if (skill.energyCost) {
            this.combatStats.consumeEnergy(skill.energyCost);
        }

        // 使用最後移動方向作為攻擊方向
        const direction = this.lastMoveDirection.clone();

        console.log(`[PlayerEntity] ${this.playerId.substring(0, 8)} used skill: ${skill.name} towards (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)})`);

        return { skill, direction };
    }

    /**
     * 獲取當前朝向方向（用於技能發動）
     */
    getFacingDirection(): pc.Vec3 {
        return this.lastMoveDirection.clone();
    }

    /**
     * 獲取當前位置
     */
    getPosition(): pc.Vec3 {
        const pos = this.rigidBody.translation();
        return new pc.Vec3(pos.x, pos.y, pos.z);
    }

    /**
     * 施加擊退
     */
    applyKnockback(knockback: pc.Vec3) {
        const currentPos = this.rigidBody.translation();
        this.rigidBody.setNextKinematicTranslation({
            x: currentPos.x + knockback.x,
            y: currentPos.y,
            z: currentPos.z + knockback.z
        });
    }

    /**
     * 更新頭頂血條（視覺回饋）
     */
    updateHpBar() {
        // 數值更新已由 UIManager 處理
        // 這裡只處理視覺回饋：受傷時閃爍紅色
        if (this.entity.render) {
            const material = this.entity.render.material as pc.StandardMaterial;
            const originalColor = material.diffuse.clone();
            material.diffuse.set(1, 0, 0);
            material.update();

            setTimeout(() => {
                if (this.entity.render) {
                    const mat = this.entity.render.material as pc.StandardMaterial;
                    mat.diffuse = originalColor;
                    mat.update();
                }
            }, 100);
        }
    }

    /**
     * 同步視覺與物理
     */
    syncVisuals() {
        const pos = this.rigidBody.translation();
        const rot = this.rigidBody.rotation();

        this.entity.setPosition(pos.x, pos.y, pos.z);
        this.entity.setRotation(rot.x, rot.y, rot.z, rot.w);

        // HP Bar 的位置更新已由 UIManager 統一處理
    }

    /**
     * 清理資源
     */
    destroy(app: pc.Application, physicsWorld: RAPIER.World) {
        if (this.entity) {
            this.entity.destroy();
        }
        if (this.hpBarEntity) {
            this.hpBarEntity.destroy();
        }
        if (this.rigidBody) {
            physicsWorld.removeRigidBody(this.rigidBody);
        }
    }
}
