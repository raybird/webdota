import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

export interface PlayerStats {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    attack: number;
    defense: number;
    moveSpeed: number;
}

export class PlayerEntity {
    playerId: string;
    entity: pc.Entity;
    rigidBody: RAPIER.RigidBody;

    // 玩家屬性
    stats: PlayerStats;

    // UI 實體
    hpBarEntity: pc.Entity;
    hpBarFillEntity: pc.Entity;

    constructor(
        playerId: string,
        app: pc.Application,
        physicsWorld: RAPIER.World,
        position: { x: number; y: number; z: number },
        color: pc.Color
    ) {
        this.playerId = playerId;

        // 初始化屬性
        this.stats = {
            hp: 100,
            maxHp: 100,
            mp: 100,
            maxMp: 100,
            attack: 10,
            defense: 5,
            moveSpeed: 5.0
        };

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

        // 建立頭頂血條 (World Space UI)
        // 1. Screen Entity
        // 2. HP Bar Container (Root)
        // 改用單純的 Entity 作為容器，不使用 Screen Component
        // 這樣可以避免 Screen 的解析度縮放邏輯影響位置
        this.hpBarEntity = new pc.Entity('HPBar_Root');
        this.hpBarEntity.setLocalScale(0.01, 0.01, 0.01); // 縮放比例
        app.root.addChild(this.hpBarEntity);

        // 3. Background Bar
        const bgEntity = new pc.Entity('HPBar_BG');
        bgEntity.addComponent('element', {
            type: pc.ELEMENTTYPE_IMAGE,
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            width: 150,  // 寬度改為 150
            height: 35,  // 高度改為 35
            color: new pc.Color(0.1, 0.1, 0.1, 1),
            opacity: 0.8
        });
        this.hpBarEntity.addChild(bgEntity);

        // 4. Fill Bar
        this.hpBarFillEntity = new pc.Entity('HPBar_Fill');
        this.hpBarFillEntity.addComponent('element', {
            type: pc.ELEMENTTYPE_IMAGE,
            anchor: new pc.Vec4(0, 0.5, 0, 0.5), // 左對齊
            pivot: new pc.Vec2(0, 0.5),         // 左對齊
            width: 150,  // 初始寬度 (滿血)
            height: 35,
            color: new pc.Color(1, 0.2, 0.2, 1) // 鮮紅色
        });
        // 將 Fill 放在 BG 內部，向左平移一半寬度以對齊左邊緣
        this.hpBarFillEntity.setLocalPosition(-75, 0, 0); // -150/2 = -75
        this.hpBarEntity.addChild(this.hpBarFillEntity);

        // 確保 UI 面向攝影機 (Billboard)
        // 這需要在 update loop 中處理，或者使用 script component
        // 暫時簡化：因為是 3D 遊戲，UI 應該始終面向攝影機
        // 這裡我們先讓它固定角度，後續可以加入 lookAt 邏輯

        // 建立物理剛體
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z);
        this.rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
        physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    /**
     * 移動角色
     */
    move(moveX: number, moveY: number, dt: number) {
        // 計算移動向量 (moveY 對應 Z 軸，moveX 對應 X 軸)
        const velocity = {
            x: moveX * this.stats.moveSpeed * dt,
            y: 0,
            z: moveY * this.stats.moveSpeed * dt
        };

        // Debug: 只在有移動時輸出
        if (moveX !== 0 || moveY !== 0) {
            const currentPos = this.rigidBody.translation();
            console.log(`[PlayerEntity] ${this.playerId.substring(0, 8)} moving from (${currentPos.x.toFixed(2)}, ${currentPos.z.toFixed(2)}) by (${velocity.x.toFixed(2)}, ${velocity.z.toFixed(2)})`);
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
        const actualDamage = Math.max(1, amount - this.stats.defense);
        this.stats.hp = Math.max(0, this.stats.hp - actualDamage);
        console.log(`[PlayerEntity] ${this.playerId.substring(0, 8)} took ${actualDamage} damage. HP: ${this.stats.hp}/${this.stats.maxHp}`);

        // 更新頭頂血條
        if (this.hpBarFillEntity.element) {
            const hpPercent = this.stats.hp / this.stats.maxHp;
            this.hpBarFillEntity.element.width = 150 * hpPercent; // 寬度改為 150
        }

        // 視覺回饋：受傷時閃爍紅色
        if (this.entity.render) {
            const originalColor = (this.entity.render.material as pc.StandardMaterial).diffuse.clone();
            (this.entity.render.material as pc.StandardMaterial).diffuse.set(1, 0, 0);
            (this.entity.render.material as pc.StandardMaterial).update();

            setTimeout(() => {
                if (this.entity.render) {
                    (this.entity.render.material as pc.StandardMaterial).diffuse = originalColor;
                    (this.entity.render.material as pc.StandardMaterial).update();
                }
            }, 100);
        }
    }

    /**
     * 同步視覺與物理
     */
    syncVisuals() {
        const pos = this.rigidBody.translation();
        this.entity.setPosition(pos.x, pos.y, pos.z);

        // 更新血條位置 (手動跟隨，不透過 Parent-Child)
        if (this.hpBarEntity) {
            this.hpBarEntity.setPosition(pos.x, pos.y + 2.0, pos.z);

            // 血條永遠平放在角色正上方，平行於地面（XZ 平面）
            // X=0 (不俯仰), Y=0 (不左右轉), Z=0 (不翻滾)
            // 這樣血條會像是貼在地面上一樣，從上往下看是水平的
            this.hpBarEntity.setEulerAngles(0, 0, 0);
        }
    }

    /**
     * 清理資源
     */
    destroy(app: pc.Application, physicsWorld: RAPIER.World) {
        if (this.hpBarEntity) {
            this.hpBarEntity.destroy();
        }
        app.root.removeChild(this.entity);
        this.entity.destroy();
        physicsWorld.removeRigidBody(this.rigidBody);
    }
}
