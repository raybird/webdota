import * as pc from 'playcanvas';

/**
 * 特效管理器
 * 負責生成與管理遊戲中的視覺特效
 */
export class EffectManager {
    private app: pc.Application;

    // 預載材質
    private materials: Map<string, pc.StandardMaterial> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
        this.initMaterials();
    }

    /**
     * 初始化特效材質
     */
    private initMaterials() {
        // 1. 攻擊特效材質（黃色半透明）
        const attackMat = new pc.StandardMaterial();
        attackMat.diffuse = new pc.Color(1, 1, 0);
        attackMat.emissive = new pc.Color(1, 1, 0);
        attackMat.opacity = 0.6;
        attackMat.blendType = pc.BLEND_NORMAL;
        attackMat.update();
        this.materials.set('attack', attackMat);

        // 2. 衝刺特效材質（青色半透明）
        const dashMat = new pc.StandardMaterial();
        dashMat.diffuse = new pc.Color(0, 1, 1);
        dashMat.emissive = new pc.Color(0, 1, 1);
        dashMat.opacity = 0.4;
        dashMat.blendType = pc.BLEND_ADDITIVE;
        dashMat.update();
        this.materials.set('dash', dashMat);

        // 3. 震波特效材質（白色環狀）
        const shockwaveMat = new pc.StandardMaterial();
        shockwaveMat.diffuse = new pc.Color(1, 1, 1);
        shockwaveMat.emissive = new pc.Color(1, 1, 1);
        shockwaveMat.opacity = 0.8;
        shockwaveMat.blendType = pc.BLEND_ADDITIVE;
        shockwaveMat.update();
        this.materials.set('shockwave', shockwaveMat);

        // 4. 大招特效材質（紅色高亮）
        // 4. 大招特效材質（紅色高亮）
        const ultMat = new pc.StandardMaterial();
        ultMat.diffuse = new pc.Color(1, 0, 0);
        ultMat.emissive = new pc.Color(1, 0.2, 0.2);
        ultMat.opacity = 0.9;
        ultMat.blendType = pc.BLEND_ADDITIVE;
        ultMat.update();
        this.materials.set('ultimate', ultMat);

        // 5. 火球特效材質
        const fireMat = new pc.StandardMaterial();
        fireMat.diffuse = new pc.Color(1, 0.5, 0);
        fireMat.emissive = new pc.Color(1, 0.5, 0);
        fireMat.opacity = 0.8;
        fireMat.blendType = pc.BLEND_ADDITIVE;
        fireMat.update();
        this.materials.set('fire', fireMat);

        // 6. 冰霜特效材質
        const iceMat = new pc.StandardMaterial();
        iceMat.diffuse = new pc.Color(0.5, 0.8, 1);
        iceMat.emissive = new pc.Color(0.5, 0.8, 1);
        iceMat.opacity = 0.7;
        iceMat.blendType = pc.BLEND_ADDITIVE;
        iceMat.update();
        this.materials.set('ice', iceMat);
    }

    /**
     * 播放技能特效
     */
    playSkillEffect(skillId: string, position: pc.Vec3, direction: pc.Vec3) {
        // --- 戰士技能 ---
        if (skillId === 'warrior_q') {
            this.createDashEffect(position, direction); // 衝鋒
        } else if (skillId === 'warrior_w') {
            this.createShockwaveEffect(position, 3.0); // 震地
        } else if (skillId === 'warrior_e') {
            this.createShieldEffect(position); // 鋼鐵意志
        } else if (skillId === 'warrior_r') {
            this.createWhirlwindEffect(position, 4.0); // 旋風斬
        }
        // --- 刺客技能 ---
        else if (skillId === 'assassin_q') {
            this.createDashEffect(position, direction); // 瞬步
        } else if (skillId === 'assassin_w') {
            this.createSlashEffect(position, direction); // 致命一擊
        } else if (skillId === 'assassin_e') {
            this.createSmokeEffect(position); // 煙霧彈
        } else if (skillId === 'assassin_r') {
            this.createPhantomEffect(position); // 幻影殺陣 (初始特效)
        }
        // --- 法師技能 ---
        else if (skillId === 'mage_q') {
            this.createFireballEffect(position, direction); // 火球術
        } else if (skillId === 'mage_w') {
            this.createFrostNovaEffect(position, 4.0); // 冰霜新星
        } else if (skillId === 'mage_e') {
            this.createBlinkEffect(position, direction); // 閃現
        } else if (skillId === 'mage_r') {
            this.createMeteorEffect(position, 5.0); // 隕石術 (預警)
        }
        // --- 通用/舊技能 ---
        else {
            // Fallback for old skills or basic attacks
            if (skillId.includes('basic') || skillId === 'basic_attack') {
                this.createSlashEffect(position, direction);
            }
        }
    }

    /**
     * 建立揮擊特效（圓錐體）
     */
    private createSlashEffect(pos: pc.Vec3, dir: pc.Vec3) {
        const entity = new pc.Entity('SlashEffect');
        entity.addComponent('render', {
            type: 'cone',
            material: this.materials.get('attack')
        });

        // 設定位置與方向
        entity.setPosition(pos.x + dir.x * 0.5, pos.y + 0.5, pos.z + dir.z * 0.5);

        // 讓圓錐倒下並指向攻擊方向
        // 預設圓錐尖端朝上 (Y)，我們需要讓它朝向 dir
        const target = new pc.Vec3(pos.x + dir.x, pos.y + 0.5, pos.z + dir.z);
        entity.lookAt(target);
        entity.rotateLocal(90, 0, 0); // 修正圓錐朝向

        entity.setLocalScale(0.5, 1.5, 0.5); // 變長條狀

        this.app.root.addChild(entity);

        // 動畫：快速消失
        let timer = 0;
        const duration = 0.2;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            // 變大並變透明
            const scale = 0.5 + (timer / duration) * 0.5;
            entity.setLocalScale(scale, 1.5, scale);

            // 這裡無法直接修改共享材質的 opacity，若要漸變需要 clone material
            // 簡單起見，只做縮放
        };

        this.app.on('update', update);
    }

    /**
     * 建立衝刺殘影
     */
    private createDashEffect(pos: pc.Vec3, dir: pc.Vec3) {
        const count = 3;
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const entity = new pc.Entity('DashGhost');
                entity.addComponent('render', {
                    type: 'box', // 假設玩家是方塊
                    material: this.materials.get('dash')
                });

                // 在路徑上生成
                entity.setPosition(
                    pos.x + dir.x * i * 0.5,
                    pos.y + 0.5,
                    pos.z + dir.z * i * 0.5
                );

                this.app.root.addChild(entity);

                // 快速消失
                setTimeout(() => entity.destroy(), 200);
            }, i * 50);
        }
    }

    /**
     * 建立震波特效（擴散的圓柱）
     */
    private createShockwaveEffect(pos: pc.Vec3, radius: number) {
        const entity = new pc.Entity('Shockwave');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('shockwave')
        });

        entity.setPosition(pos.x, pos.y + 0.1, pos.z);
        entity.setLocalScale(0.1, 0.1, 0.1); // 初始很小

        this.app.root.addChild(entity);

        let timer = 0;
        const duration = 0.4;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            // 擴散
            const progress = timer / duration;
            const currentRadius = progress * radius * 2;
            entity.setLocalScale(currentRadius, 0.1, currentRadius);
        };

        this.app.on('update', update);
    }

    /**
     * 建立護盾特效
     */
    private createShieldEffect(pos: pc.Vec3) {
        const entity = new pc.Entity('Shield');
        entity.addComponent('render', {
            type: 'sphere',
            material: this.materials.get('dash') // 重用青色材質
        });

        entity.setPosition(pos.x, pos.y + 0.5, pos.z);
        entity.setLocalScale(1.2, 1.2, 1.2);

        this.app.root.addChild(entity);

        // 持續 0.5 秒
        setTimeout(() => entity.destroy(), 500);
    }

    /**
     * 建立爆炸特效
     */
    private createExplosionEffect(pos: pc.Vec3, radius: number) {
        const entity = new pc.Entity('Explosion');
        entity.addComponent('render', {
            type: 'sphere',
            material: this.materials.get('ultimate')
        });

        entity.setPosition(pos.x, pos.y + 0.5, pos.z);
        entity.setLocalScale(0.1, 0.1, 0.1);

        this.app.root.addChild(entity);

        let timer = 0;
        const duration = 0.5;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            // 劇烈膨脹
            const progress = timer / duration;
            const scale = Math.sin(progress * Math.PI) * radius * 2;
            entity.setLocalScale(scale, scale, scale);
        };

        this.app.on('update', update);
    }

    /**
     * 建立受擊特效（火花）
     */
    createHitEffect(pos: pc.Vec3) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const entity = new pc.Entity('HitSpark');
            entity.addComponent('render', {
                type: 'box',
                material: this.materials.get('attack') // 重用黃色材質
            });

            entity.setPosition(pos.x, pos.y + 0.5, pos.z);
            entity.setLocalScale(0.1, 0.1, 0.1);

            // 隨機噴射方向
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 2;
            const velocity = new pc.Vec3(
                Math.cos(angle) * speed,
                3 + Math.random() * 2, // 向上噴
                Math.sin(angle) * speed
            );

            this.app.root.addChild(entity);

            // 物理模擬（簡單拋物線）
            let timer = 0;
            const duration = 0.3;

            const update = (dt: number) => {
                timer += dt;
                if (timer >= duration) {
                    entity.destroy();
                    this.app.off('update', update);
                    return;
                }

                // 移動
                const p = entity.getPosition();
                entity.setPosition(
                    p.x + velocity.x * dt,
                    p.y + velocity.y * dt,
                    p.z + velocity.z * dt
                );

                // 重力
                velocity.y -= 9.8 * dt;

                // 旋轉
                entity.rotate(10, 10, 10);
            };

            this.app.on('update', update);
        }
    }

    /**
     * 旋風斬特效 (持續旋轉的紅色圓柱)
     */
    private createWhirlwindEffect(pos: pc.Vec3, radius: number) {
        const entity = new pc.Entity('Whirlwind');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('ultimate')
        });

        entity.setPosition(pos.x, pos.y + 1.0, pos.z);
        entity.setLocalScale(radius * 0.1, 0.1, radius * 0.1); // Start small

        this.app.root.addChild(entity);

        let timer = 0;
        const duration = 1.0;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            // 旋轉與擴大
            entity.rotate(0, 720 * dt, 0);
            const scale = Math.min(radius * 2, (radius * 2) * (timer / 0.2));
            entity.setLocalScale(scale, 0.2 + (Math.sin(timer * 10) * 0.1), scale);
        };

        this.app.on('update', update);
    }

    /**
     * 煙霧彈特效 (多個灰色球體)
     */
    private createSmokeEffect(pos: pc.Vec3) {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const entity = new pc.Entity('Smoke');
            entity.addComponent('render', {
                type: 'sphere',
                material: this.materials.get('shockwave') // 用白色代替煙霧
            });

            const angle = (i / count) * Math.PI * 2;
            const radius = 1.5;
            const x = pos.x + Math.cos(angle) * radius * Math.random();
            const z = pos.z + Math.sin(angle) * radius * Math.random();

            entity.setPosition(x, pos.y + 0.5 + Math.random(), z);
            entity.setLocalScale(0.1, 0.1, 0.1);

            this.app.root.addChild(entity);

            let timer = 0;
            const duration = 2.0;

            const update = (dt: number) => {
                timer += dt;
                if (timer >= duration) {
                    entity.destroy();
                    this.app.off('update', update);
                    return;
                }

                const progress = timer / duration;
                const scale = 1.0 + progress * 0.5;
                entity.setLocalScale(scale, scale, scale);
                // 向上飄
                entity.translate(0, 0.5 * dt, 0);
            };
            this.app.on('update', update);
        }
    }

    /**
     * 幻影特效
     */
    private createPhantomEffect(pos: pc.Vec3) {
        // 簡單的紫色殘影
        const entity = new pc.Entity('Phantom');
        entity.addComponent('render', {
            type: 'capsule',
            material: this.materials.get('dash')
        });
        entity.setPosition(pos.x, pos.y + 1, pos.z);
        this.app.root.addChild(entity);
        setTimeout(() => entity.destroy(), 500);
    }

    /**
     * 火球特效
     */
    private createFireballEffect(pos: pc.Vec3, dir: pc.Vec3) {
        const entity = new pc.Entity('Fireball');
        entity.addComponent('render', {
            type: 'sphere',
            material: this.materials.get('fire')
        });

        entity.setPosition(pos.x, pos.y + 1, pos.z);
        entity.setLocalScale(0.5, 0.5, 0.5);

        this.app.root.addChild(entity);

        // 火球飛行 (純視覺，邏輯在 SkillExecutor)
        let timer = 0;
        const duration = 0.5;
        const speed = 15;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                this.createExplosionEffect(entity.getPosition(), 2.0); // 結尾爆炸
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            entity.translate(dir.x * speed * dt, 0, dir.z * speed * dt);
        };
        this.app.on('update', update);
    }

    /**
     * 冰霜新星
     */
    private createFrostNovaEffect(pos: pc.Vec3, radius: number) {
        const entity = new pc.Entity('FrostNova');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('ice')
        });

        entity.setPosition(pos.x, pos.y + 0.1, pos.z);
        entity.setLocalScale(0.1, 0.1, 0.1);

        this.app.root.addChild(entity);

        let timer = 0;
        const duration = 0.5;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            const scale = (timer / duration) * radius * 2;
            entity.setLocalScale(scale, 0.1, scale);
        };
        this.app.on('update', update);
    }

    /**
     * 閃現特效 (起點消失)
     */
    private createBlinkEffect(pos: pc.Vec3, _dir: pc.Vec3) {
        const entity = new pc.Entity('Blink');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('ice') // 用冰材質代表魔法
        });
        entity.setPosition(pos.x, pos.y + 1, pos.z);
        entity.setLocalScale(0.5, 2.0, 0.5);
        this.app.root.addChild(entity);

        // 快速縮小消失
        let timer = 0;
        const duration = 0.2;
        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }
            const scale = 0.5 * (1 - timer / duration);
            entity.setLocalScale(scale, 2.0, scale);
        };
        this.app.on('update', update);
    }

    /**
     * 隕石特效 (預警圈 + 落下)
     */
    private createMeteorEffect(pos: pc.Vec3, radius: number) {
        // 1. 地面預警圈
        const indicator = new pc.Entity('MeteorIndicator');
        indicator.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('fire')
        });
        indicator.setPosition(pos.x, pos.y + 0.1, pos.z);
        indicator.setLocalScale(radius * 2, 0.05, radius * 2);
        this.app.root.addChild(indicator);

        // 2. 隕石本體 (從天而降)
        const meteor = new pc.Entity('Meteor');
        meteor.addComponent('render', {
            type: 'sphere',
            material: this.materials.get('ultimate')
        });
        const startHeight = 20;
        meteor.setPosition(pos.x, startHeight, pos.z);
        meteor.setLocalScale(2, 2, 2);
        this.app.root.addChild(meteor);

        let timer = 0;
        const fallDuration = 1.0; // 1秒落地

        const update = (dt: number) => {
            timer += dt;
            if (timer >= fallDuration) {
                // 落地爆炸
                this.createExplosionEffect(pos, radius);
                indicator.destroy();
                meteor.destroy();
                this.app.off('update', update);
                return;
            }

            // 落下邏輯
            const progress = timer / fallDuration;
            const currentY = startHeight * (1 - progress * progress); // 加速落下
            meteor.setPosition(pos.x, currentY, pos.z);
        };
        this.app.on('update', update);
    }
}
