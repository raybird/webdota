import * as pc from 'playcanvas';
import { PlayerEntity } from '../PlayerEntity';
import type { Skill } from './SkillManager';
import { HitboxManager } from './HitboxManager';
import { EffectManager } from '../EffectManager';
import { ProjectileManager } from './ProjectileManager';

/**
 * 技能執行器
 * 負責處理各種技能類型的具體執行邏輯 (位移、投射物、延遲傷害等)
 */
export class SkillExecutor {

    /**
     * 執行技能
     */
    executeSkill(
        skill: Skill,
        caster: PlayerEntity,
        direction: pc.Vec3,
        hitboxManager: HitboxManager,
        effectManager: EffectManager,
        projectileManager?: ProjectileManager
    ) {
        // 1. 播放特效
        effectManager.playSkillEffect(skill.id, caster.getPosition(), direction);

        // 2. 處理位移技能
        if (skill.dashDistance && skill.dashDistance > 0) {
            this.handleDash(skill, caster, direction);
        } else if (skill.teleport) {
            this.handleTeleport(skill, caster, direction);
        }

        // 3. 處理隱身狀態
        if (skill.effect === 'invisible') {
            this.handleInvisibility(skill, caster);
        }

        // 4. 處理無敵狀態
        if (skill.effect === 'invincible') {
            caster.combatStats.addState('invincible', skill.duration || 1.0);
        }

        // 5. 處理傷害/判定 (考慮投射物與延遲)
        if (skill.projectile) {
            this.handleProjectile(skill, caster, direction, hitboxManager, effectManager, projectileManager);
        } else if (skill.delay && skill.delay > 0) {
            this.handleDelayedHitbox(skill, caster, direction, hitboxManager);
        } else if (skill.multiHit && skill.multiHit > 0) {
            this.handleMultiHit(skill, caster, direction, hitboxManager);
        } else {
            // 立即造成傷害 (近戰/一般)
            this.createInstantHitbox(skill, caster, direction, hitboxManager);
        }
    }

    /**
     * 處理衝刺
     */
    private handleDash(skill: Skill, caster: PlayerEntity, direction: pc.Vec3) {
        const dashDistance = skill.dashDistance || 5;
        // const duration = 0.2; // 衝刺時間固定 0.2秒

        // 簡單位移邏輯：直接設置速度或使用 Tween (這裡簡化為直接設置物理位置)
        // 為了平滑體驗，我們應該施加一個持續的力或速度，但這裡先用瞬間位移模擬
        // 更好的做法是修改 PlayerEntity 的狀態為 "DASHING" 並給予高速移動

        // 這裡我們簡單計算目標位置並嘗試移動 (不穿牆需要物理引擎支持)
        // 由於我們使用的是 Kinematic Character Controller (PlayerEntity.move)，
        // 我們可以在接下來的幾幀中強制移動玩家

        // 但為了 MVP，我們直接計算目標點並設置 (忽略碰撞)
        const currentPos = caster.getPosition();
        const targetPos = currentPos.clone().add(direction.clone().mulScalar(dashDistance));

        // 使用物理瞬移
        caster.rigidBody.setNextKinematicTranslation({
            x: targetPos.x,
            y: currentPos.y,
            z: targetPos.z
        });
    }

    /**
     * 處理瞬移 (Blink)
     */
    private handleTeleport(skill: Skill, caster: PlayerEntity, direction: pc.Vec3) {
        const range = skill.range || 6;
        const currentPos = caster.getPosition();
        const targetPos = currentPos.clone().add(direction.clone().mulScalar(range));

        caster.rigidBody.setNextKinematicTranslation({
            x: targetPos.x,
            y: currentPos.y,
            z: targetPos.z
        });
    }

    /**
     * 處理隱身
     */
    private handleInvisibility(skill: Skill, caster: PlayerEntity) {
        caster.combatStats.addState('invisible', skill.duration || 3.0);

        // 視覺上的半透明由 RenderManager 處理 (需要檢查狀態)
        // 這裡暫時手動設置透明度作為回饋
        if (caster.entity.render) {
            const meshes = caster.entity.render.meshInstances;
            meshes.forEach(mi => {
                mi.setParameter('material_opacity', 0.2);
            });

            // 設定計時器恢復 (這是不嚴謹的，應該在 Update Loop 統一處理)
            setTimeout(() => {
                meshes.forEach(mi => {
                    mi.setParameter('material_opacity', 1.0);
                });
            }, (skill.duration || 3.0) * 1000);
        }
    }

    /**
     * 處理投射物 (火球)
     * 現在使用 ProjectileManager 來管理真實飛行的投射物
     */
    private handleProjectile(
        skill: Skill,
        caster: PlayerEntity,
        direction: pc.Vec3,
        hitboxManager: HitboxManager,
        _effectManager: EffectManager,
        projectileManager?: ProjectileManager
    ) {
        // 如果有 ProjectileManager，使用真實投射物系統
        if (projectileManager) {
            const startPos = caster.getPosition().clone();
            // 稍微往前偏移，避免投射物從角色中心發射
            startPos.add(direction.clone().mulScalar(1.0));

            projectileManager.createProjectile(
                caster.playerId,
                skill,
                startPos,
                direction
            );
            console.log(`[SkillExecutor] Created real projectile for ${skill.name}`);
            return;
        }

        // 備用：使用舊的 setTimeout 邏輯（向後兼容）
        const speed = skill.projectileSpeed || 15;
        const range = skill.range || 8;
        const travelTime = range / speed;

        setTimeout(() => {
            const origin = caster.getPosition();
            const target = origin.add(direction.clone().mulScalar(range));

            hitboxManager.createHitbox(
                target,
                skill.aoe || 1.0,
                skill.damage,
                direction.clone().mulScalar(skill.knockback || 0),
                caster.playerId,
                0.2
            );
        }, travelTime * 1000);
    }

    /**
     * 處理延遲傷害 (隕石)
     */
    private handleDelayedHitbox(skill: Skill, caster: PlayerEntity, direction: pc.Vec3, hitboxManager: HitboxManager) {
        const delay = skill.delay || 1.0;
        // const range = skill.range || 10; // Unused

        // 計算落點 (前方)
        const origin = caster.getPosition();
        const target = origin.add(direction.clone().mulScalar(skill.range ? 3.0 : 0)); // 如果有 range 則往前方 3 單位，否則原地
        if (skill.id === 'mage_r') {
            // 隕石術通常打遠一點
            target.add(direction.clone().mulScalar(4.0));
        }

        setTimeout(() => {
            hitboxManager.createHitbox(
                target,
                skill.aoe || 3.0,
                skill.damage,
                direction.clone().mulScalar(skill.knockback || 0),
                caster.playerId,
                0.2
            );
        }, delay * 1000);
    }

    /**
     * 處理多段攻擊 (尚未實作詳細邏輯，暫用單次代替)
     */
    private handleMultiHit(skill: Skill, caster: PlayerEntity, direction: pc.Vec3, hitboxManager: HitboxManager) {
        this.createInstantHitbox(skill, caster, direction, hitboxManager);
    }

    /**
     * 創建立即判定
     */
    private createInstantHitbox(skill: Skill, caster: PlayerEntity, direction: pc.Vec3, hitboxManager: HitboxManager) {
        const position = caster.getPosition();
        // 根據技能範圍調整 Hitbox 位置 (稍微前方)
        position.add(direction.clone().mulScalar(1.0));

        hitboxManager.createHitbox(
            position,
            skill.aoe || skill.range * 0.5,
            skill.damage,
            direction.clone().mulScalar(skill.knockback || 0),
            caster.playerId,
            0.2
        );
    }
}
