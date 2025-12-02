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
        const ultMat = new pc.StandardMaterial();
        ultMat.diffuse = new pc.Color(1, 0, 0);
        ultMat.emissive = new pc.Color(1, 0.2, 0.2);
        ultMat.opacity = 0.9;
        ultMat.blendType = pc.BLEND_ADDITIVE;
        ultMat.update();
        this.materials.set('ultimate', ultMat);
    }

    /**
     * 播放技能特效
     */
    playSkillEffect(skillId: string, position: pc.Vec3, direction: pc.Vec3) {
        switch (skillId) {
            case 'basic': // 籃板/普攻
                this.createSlashEffect(position, direction);
                break;
            case 'skill1': // 加速
                this.createDashEffect(position, direction);
                break;
            case 'skill2': // 檔拆/震地
                this.createShockwaveEffect(position, 2.0);
                break;
            case 'skill3': // 卡位/護盾
                this.createShieldEffect(position);
                break;
            case 'ultimate': // 決勝三分
                this.createExplosionEffect(position, 4.0);
                break;
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
}
