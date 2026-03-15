import * as pc from 'playcanvas';
import { ObjectPool } from '../utils/ObjectPool';

/**
 * 特效管理器
 * 負責生成與管理遊戲中的視覺特效
 */
export class EffectManager {
    private app: pc.Application;

    // 預載材質
    private materials: Map<string, pc.StandardMaterial> = new Map();

    // 特效物件池
    private pools: Map<string, ObjectPool<pc.Entity>> = new Map();

    constructor(app: pc.Application) {
        this.app = app;
        this.initMaterials();
        this.initPools();
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
     * 初始化特效池
     */
    private initPools() {
        // 1. 揮擊特效池
        this.pools.set('slash', new ObjectPool<pc.Entity>(
            () => {
                const entity = new pc.Entity('SlashEffect');
                entity.addComponent('render', {
                    type: 'cone',
                    material: this.materials.get('attack')
                });
                return entity;
            },
            (entity) => {
                entity.enabled = false;
                if (entity.parent) entity.parent.removeChild(entity);
            }
        ));

        // 2. 受擊火花池
        this.pools.set('spark', new ObjectPool<pc.Entity>(
            () => {
                const entity = new pc.Entity('HitSpark');
                entity.addComponent('render', {
                    type: 'box',
                    material: this.materials.get('attack')
                });
                return entity;
            },
            (entity) => {
                entity.enabled = false;
                if (entity.parent) entity.parent.removeChild(entity);
            }
        ));
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
            if (skillId.includes('basic') || skillId === 'basic_attack') {
                this.createSlashEffect(position, direction);
            }
        }
    }

    /**
     * 建立揮擊特效（圓錐體）
     */
    private createSlashEffect(pos: pc.Vec3, dir: pc.Vec3) {
        const pool = this.pools.get('slash')!;
        const entity = pool.acquire();
        
        entity.enabled = true;
        entity.setPosition(pos.x + dir.x * 0.5, pos.y + 0.5, pos.z + dir.z * 0.5);

        const target = new pc.Vec3(pos.x + dir.x, pos.y + 0.5, pos.z + dir.z);
        entity.lookAt(target);
        entity.rotateLocal(90, 0, 0);

        entity.setLocalScale(0.1, 0.5, 0.1);

        this.app.root.addChild(entity);

        let timer = 0;
        const duration = 0.25;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                pool.release(entity);
                this.app.off('update', update);
                return;
            }

            const t = timer / duration;
            const easeOutQuart = 1 - Math.pow(1 - t, 4);
            const scaleX = 0.2 + easeOutQuart * 1.5;
            const scaleY = 0.5 + easeOutQuart * 2.5;

            entity.setLocalScale(scaleX, scaleY, scaleX);
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
                    type: 'box',
                    material: this.materials.get('dash')
                });

                entity.setPosition(
                    pos.x + dir.x * i * 0.5,
                    pos.y + 0.5,
                    pos.z + dir.z * i * 0.5
                );

                this.app.root.addChild(entity);
                setTimeout(() => entity.destroy(), 200);
            }, i * 50);
        }
    }

    /**
     * 建立震波特效
     */
    private createShockwaveEffect(pos: pc.Vec3, radius: number) {
        const entity = new pc.Entity('Shockwave');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('shockwave')
        });

        entity.setPosition(pos.x, pos.y + 0.1, pos.z);
        entity.setLocalScale(0.1, 0.1, 0.1);

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
            material: this.materials.get('dash')
        });

        entity.setPosition(pos.x, pos.y + 0.5, pos.z);
        entity.setLocalScale(1.2, 1.2, 1.2);

        this.app.root.addChild(entity);
        setTimeout(() => entity.destroy(), 500);
    }

    /**
     * 建立爆炸特效
     */
    private createExplosionEffect(pos: pc.Vec3, radius: number) {
        const flash = new pc.Entity('ExplosionFlash');
        flash.addComponent('render', {
            type: 'sphere',
            material: this.materials.get('ultimate')
        });
        flash.setPosition(pos.x, pos.y + 0.5, pos.z);
        flash.setLocalScale(radius * 2, radius * 2, radius * 2);
        this.app.root.addChild(flash);
        setTimeout(() => flash.destroy(), 80);

        const entity = new pc.Entity('ExplosionLayer');
        entity.addComponent('render', {
            type: 'sphere',
            material: this.materials.get('fire')
        });
        entity.setPosition(pos.x, pos.y + 0.5, pos.z);
        entity.setLocalScale(0.1, 0.1, 0.1);
        this.app.root.addChild(entity);

        let timer = 0;
        const duration = 0.6;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                entity.destroy();
                this.app.off('update', update);
                return;
            }

            const t = timer / duration;
            const easeOutExpo = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            const scale = easeOutExpo * radius * 2.5;
            entity.setLocalScale(scale, scale, scale);
        };

        this.app.on('update', update);
    }

    /**
     * 建立受擊特效（火花）
     */
    createHitEffect(pos: pc.Vec3) {
        const pool = this.pools.get('spark')!;
        const count = 8;
        for (let i = 0; i < count; i++) {
            const entity = pool.acquire();
            entity.enabled = true;

            entity.setPosition(pos.x, pos.y + 1.0, pos.z);
            entity.setLocalScale(0.15, 0.15, 0.15);

            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 5;
            const velocity = new pc.Vec3(
                Math.cos(angle) * speed,
                2 + Math.random() * 6,
                Math.sin(angle) * speed
            );

            this.app.root.addChild(entity);

            let timer = 0;
            const duration = 0.4 + Math.random() * 0.2;

            const update = (dt: number) => {
                timer += dt;
                if (timer >= duration) {
                    pool.release(entity);
                    this.app.off('update', update);
                    return;
                }

                const p = entity.getPosition();
                entity.setPosition(
                    p.x + velocity.x * dt,
                    p.y + velocity.y * dt,
                    p.z + velocity.z * dt
                );

                velocity.y -= 15 * dt;
                entity.rotate(200 * dt, 150 * dt, 100 * dt);
                const scale = 0.15 * (1 - (timer / duration));
                entity.setLocalScale(scale, scale, scale);
            };

            this.app.on('update', update);
        }
    }

    /**
     * 旋風斬特效
     */
    private createWhirlwindEffect(pos: pc.Vec3, radius: number) {
        const entity = new pc.Entity('Whirlwind');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('ultimate')
        });

        entity.setPosition(pos.x, pos.y + 1.0, pos.z);
        entity.setLocalScale(radius * 0.1, 0.1, radius * 0.1);

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

            entity.rotate(0, 720 * dt, 0);
            const scale = Math.min(radius * 2, (radius * 2) * (timer / 0.2));
            entity.setLocalScale(scale, 0.2 + (Math.sin(timer * 10) * 0.1), scale);
        };

        this.app.on('update', update);
    }

    /**
     * 煙霧彈特效
     */
    private createSmokeEffect(pos: pc.Vec3) {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const entity = new pc.Entity('Smoke');
            entity.addComponent('render', {
                type: 'sphere',
                material: this.materials.get('shockwave')
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
                entity.translate(0, 0.5 * dt, 0);
            };
            this.app.on('update', update);
        }
    }

    /**
     * 幻影特效
     */
    private createPhantomEffect(pos: pc.Vec3) {
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

        let timer = 0;
        const duration = 0.5;
        const speed = 15;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                this.createExplosionEffect(entity.getPosition(), 2.0);
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
     * 閃現特效
     */
    private createBlinkEffect(pos: pc.Vec3, _dir: pc.Vec3) {
        const entity = new pc.Entity('Blink');
        entity.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('ice')
        });
        entity.setPosition(pos.x, pos.y + 1, pos.z);
        entity.setLocalScale(0.5, 2.0, 0.5);
        this.app.root.addChild(entity);

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
     * 隕石特效
     */
    private createMeteorEffect(pos: pc.Vec3, radius: number) {
        const indicator = new pc.Entity('MeteorIndicator');
        indicator.addComponent('render', {
            type: 'cylinder',
            material: this.materials.get('fire')
        });
        indicator.setPosition(pos.x, pos.y + 0.1, pos.z);
        indicator.setLocalScale(radius * 2, 0.05, radius * 2);
        this.app.root.addChild(indicator);

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
        const fallDuration = 1.0;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= fallDuration) {
                this.createExplosionEffect(pos, radius);
                indicator.destroy();
                meteor.destroy();
                this.app.off('update', update);
                return;
            }

            const progress = timer / fallDuration;
            const currentY = startHeight * (1 - progress * progress);
            meteor.setPosition(pos.x, currentY, pos.z);
        };
        this.app.on('update', update);
    }
}
