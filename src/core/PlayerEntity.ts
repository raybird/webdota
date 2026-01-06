import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

import { CombatStats } from './combat/CombatStats';
import { SkillManager } from './combat/SkillManager';
import { getCharacter } from '../data/characters';
import { getSkill } from '../data/skills';

export class PlayerEntity {
    playerId: string;
    entity: pc.Entity;
    rigidBody: RAPIER.RigidBody;

    // 戰鬥系統
    combatStats: CombatStats;
    skillManager: SkillManager;
    private app: pc.Application; // 保存 App 引用以存取 Updated Loop

    // UI 實體
    hpBarEntity!: pc.Entity;
    hpBarFillEntity!: pc.Entity;

    // 移動方向追蹤（用於攻擊方向）
    private lastMoveDirection: pc.Vec3 = new pc.Vec3(0, 0, 1); // 預設向前

    constructor(
        playerId: string,
        characterId: string, // 新增 characterId
        app: pc.Application,
        physicsWorld: RAPIER.World,
        position: { x: number; y: number; z: number },
        color: pc.Color
    ) {
        this.app = app; // 儲存 App 引用
        this.playerId = playerId;

        // 獲取角色資料
        const character = getCharacter(characterId);
        if (!character) {
            console.error(`[PlayerEntity] Character not found: ${characterId}`);
        }

        // 初始化戰鬥屬性 (使用角色基礎屬性)
        this.combatStats = new CombatStats({
            maxHp: character?.baseStats.maxHp || 1000,
            currentHp: character?.baseStats.maxHp || 1000,
            maxEnergy: 100,
            currentEnergy: 100, // 初始滿能量讓玩家可以立即使用技能
            moveSpeed: character?.baseStats.moveSpeed || 5.0,
            attackPower: character?.baseStats.attackPower || 10
        });

        // 初始化技能管理器
        const skills = [];
        // 添加通用技能
        const basicAttack = getSkill('basic_attack');
        if (basicAttack) skills.push(basicAttack);

        // 添加角色專屬技能
        if (character && character.skills) {
            character.skills.forEach(skillId => {
                const skill = getSkill(skillId);
                if (skill) {
                    skills.push(skill);
                } else {
                    console.warn(`[PlayerEntity] Skill not found: ${skillId}`);
                }
            });
        }

        this.skillManager = new SkillManager(skills);

        // 建立根實體（不包含渲染組件，只作為容器）
        this.entity = new pc.Entity(`Player_${playerId}`);
        this.entity.setPosition(position.x, position.y, position.z);

        // 先將 Entity 加入場景圖
        app.root.addChild(this.entity);

        // 根據 modelConfig 建立複合模型，或使用預設方塊
        if (character?.modelConfig) {
            this.createModelFromConfig(app, character.modelConfig, color);
        } else {
            // Fallback: 建立預設方塊
            const fallbackPart = new pc.Entity('Body');
            fallbackPart.addComponent('render', { type: 'box' });
            fallbackPart.setLocalScale(1, 1, 1);

            const material = new pc.StandardMaterial();
            material.diffuse = color.clone();
            material.emissive = color.clone();
            material.useLighting = true;
            material.update();

            if (fallbackPart.render) {
                fallbackPart.render.meshInstances.forEach(mi => {
                    mi.material = material;
                });
            }

            this.entity.addChild(fallbackPart);
        }

        // 建立物理剛體
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z);
        this.rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
        physicsWorld.createCollider(colliderDesc, this.rigidBody);

        // UI 會由 UIManager 建立，稍後透過 setUIReferences 設定
    }

    /**
     * 根據 ModelConfig 建立複合模型
     * 將多個基本幾何體組合成 Low Poly 風格角色
     */
    private createModelFromConfig(
        _app: pc.Application,
        config: import('../types/Character').ModelConfig,
        baseColor: pc.Color
    ) {
        config.bodyParts.forEach((part, index) => {
            const partEntity = new pc.Entity(`Part_${index}_${part.type}`);

            // 根據類型建立渲染組件
            partEntity.addComponent('render', { type: part.type });

            // 設定縮放
            partEntity.setLocalScale(part.scale.x, part.scale.y, part.scale.z);

            // 設定位置
            partEntity.setLocalPosition(part.position.x, part.position.y, part.position.z);

            // 設定旋轉 (如果有)
            if (part.rotation) {
                partEntity.setLocalEulerAngles(part.rotation.x, part.rotation.y, part.rotation.z);
            }

            // 建立材質
            const material = new pc.StandardMaterial();

            // 使用部件指定顏色或繼承基礎顏色
            if (part.color) {
                const hexColor = part.color;
                const r = parseInt(hexColor.slice(1, 3), 16) / 255;
                const g = parseInt(hexColor.slice(3, 5), 16) / 255;
                const b = parseInt(hexColor.slice(5, 7), 16) / 255;
                material.diffuse = new pc.Color(r, g, b);
                material.emissive = new pc.Color(r * 0.3, g * 0.3, b * 0.3);
            } else {
                material.diffuse = baseColor.clone();
                material.emissive = new pc.Color(baseColor.r * 0.3, baseColor.g * 0.3, baseColor.b * 0.3);
            }

            material.useLighting = true;
            material.update();

            // 套用材質
            if (partEntity.render && partEntity.render.meshInstances) {
                partEntity.render.meshInstances.forEach(mi => {
                    mi.material = material;
                });
            }

            // 加入為子實體
            this.entity.addChild(partEntity);
        });

        console.log(`[PlayerEntity] Created Low Poly model with ${config.bodyParts.length} parts`);
    }

    /**
     * 設定 UI 參考（由 GameApp 在建立玩家後呼叫）
     */
    setUIReferences(hpBarEntity: pc.Entity, hpBarFillEntity: pc.Entity) {
        this.hpBarEntity = hpBarEntity;
        this.hpBarFillEntity = hpBarFillEntity;
    }

    /**
     * 更新邏輯 (由 GameEngine 呼叫)
     */
    update(dt: number) {
        // 更新屬性 (能量回復、狀態檢查)
        this.combatStats.update(dt);

        // 更新技能 (冷卻時間)
        this.skillManager.update(dt);
    }

    /**
     * 移動角色
     */
    move(moveX: number, moveY: number, dt: number) {
        // 計算移動向量 (moveY 對應 Z 軸，moveX 對應 X 軸)
        const speed = this.combatStats.getMoveSpeed();
        const velocity = {
            x: moveX * speed * dt,
            y: 0,
            z: moveY * speed * dt
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

        // 播放動畫
        if (skill.animation) {
            this.playAnimation(skill.animation);
        } else {
            // 預設攻擊動作
            this.playAnimation('attack_normal');
        }

        console.log(`[PlayerEntity] ${this.playerId.substring(0, 8)} used skill: ${skill.name} towards (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)})`);

        return { skill, direction };
    }

    /**
     * 播放程序化動畫
     */
    playAnimation(animName: string) {
        // 找到模型容器 (所有非 UI 子節點)
        const parts = this.entity.children.filter(c => c.name !== 'HPBar' && c.name !== 'HPBarFill');

        if (parts.length === 0) {
            console.warn('[PlayerEntity] No parts found for animation');
            return;
        }

        console.log(`[PlayerEntity] Playing animation: ${animName}`);

        // 根據動畫名稱決定動作類型
        const animLower = animName.toLowerCase();

        if (animLower.includes('ultimate') || animLower.includes('whirlwind')) {
            // 旋轉一圈 (大招/旋風)
            let timer = 0;
            const duration = 0.5;
            const updateAnim = (dt: number) => {
                timer += dt;
                if (timer >= duration) {
                    this.app.off('update', updateAnim);
                    return;
                }
                parts.forEach(p => p.rotateLocal(0, 720 * dt, 0)); // 快速旋轉
            };
            this.app.on('update', updateAnim);
        } else if (animLower.includes('dash') || animLower.includes('blink')) {
            // 身體前傾 (衝刺/閃現)
            parts.forEach(p => {
                const originalRot = p.getLocalRotation().clone();
                p.rotateLocal(20, 0, 0);
                setTimeout(() => p.setLocalRotation(originalRot), 250);
            });
        } else if (animLower.includes('stomp') || animLower.includes('nova')) {
            // 向下砸 (震地/冰環)
            parts.forEach(p => {
                const originalPos = p.getLocalPosition().clone();
                p.translateLocal(0, 0.3, 0); // 先提起
                setTimeout(() => {
                    p.setLocalPosition(originalPos.x, originalPos.y - 0.2, originalPos.z); // 然後砸下
                    setTimeout(() => p.setLocalPosition(originalPos), 150); // 回復
                }, 100);
            });
        } else if (animLower.includes('smoke') || animLower.includes('buff')) {
            // 縮放閃爍 (煙霧/buff)
            parts.forEach(p => {
                const originalScale = p.getLocalScale().clone();
                p.setLocalScale(originalScale.x * 1.2, originalScale.y * 1.2, originalScale.z * 1.2);
                setTimeout(() => p.setLocalScale(originalScale), 200);
            });
        } else {
            // 預設：前衝 + 回彈 (攻擊/施法)
            const forward = this.lastMoveDirection.clone().mulScalar(0.5);
            parts.forEach(p => {
                const originalPos = p.getLocalPosition().clone();
                let timer = 0;
                const duration = 0.2;
                const updateAnim = (dt: number) => {
                    timer += dt;
                    if (timer >= duration) {
                        p.setLocalPosition(originalPos);
                        this.app.off('update', updateAnim);
                        return;
                    }
                    const progress = timer / duration;
                    const offset = Math.sin(progress * Math.PI);
                    p.setLocalPosition(
                        originalPos.x + forward.x * offset,
                        originalPos.y,
                        originalPos.z + forward.z * offset
                    );
                };
                this.app.on('update', updateAnim);
            });
        }
    }

    /**
     * 獲取當前朝向方向（用於技能發動）
     * 使用實體的實際旋轉角度計算前方向量，而非依靠移動歷史
     */
    getFacingDirection(): pc.Vec3 {
        // 從 rigidBody 獲取當前旋轉 (Quaternion)
        const rotation = this.rigidBody.rotation();
        const quat = new pc.Quat(rotation.x, rotation.y, rotation.z, rotation.w);

        // 計算前方向量 (Z+ 是預設前方)
        const forward = new pc.Vec3(0, 0, 1);
        quat.transformVector(forward, forward);

        // 確保只在水平面上移動
        forward.y = 0;
        forward.normalize();

        // 如果向量為零（極端情況），使用備用方向
        if (forward.length() < 0.01) {
            return this.lastMoveDirection.clone();
        }

        return forward;
    }

    /**
     * 維查是否已死亡
     */
    isDead(): boolean {
        return this.combatStats.currentHp <= 0;
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
        // 這裡只處理視覺回饋：受傷時閃爍白色
        if (this.entity.render) {
            const material = this.entity.render.material as pc.StandardMaterial;
            const originalEmissive = material.emissive.clone();

            // 變白閃爍 (使用 emissive 自發光)
            material.emissive = new pc.Color(1, 1, 1);
            material.update();

            setTimeout(() => {
                if (this.entity.render) {
                    const mat = this.entity.render.material as pc.StandardMaterial;
                    mat.emissive = originalEmissive;
                    mat.update();
                }
            }, 100);
        }
    }

    /**
     * 更新 UI 位置 (由 RenderManager 呼叫)
     */
    updateUIPosition() {
        if (this.hpBarEntity && this.entity) {
            const pos = this.entity.getPosition();
            // 血條在頭頂上方
            this.hpBarEntity.setPosition(pos.x, pos.y + 1.5, pos.z);
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
    destroy(_app: pc.Application, physicsWorld: RAPIER.World) {
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
