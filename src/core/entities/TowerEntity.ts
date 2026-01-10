/**
 * TowerEntity - 防禦塔實體
 * 自動偵測範圍內敵人並發射攻擊
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { CombatEntity, type Team } from './CombatEntity';
import type { ProjectileManager } from '../combat/ProjectileManager';

interface TowerConfig {
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
    colorOverride?: pc.Color;
}

export class TowerEntity extends CombatEntity {
    private attackRange: number;
    private attackCooldown: number;
    private cooldownTimer: number = 0;
    private projectileManager: ProjectileManager | null = null;

    constructor(
        entityId: string,
        team: Team,
        app: pc.Application,
        physicsWorld: RAPIER.World,
        position: { x: number; y: number; z: number },
        config: TowerConfig = {}
    ) {
        super(entityId, team, app, physicsWorld, {
            maxHp: config.maxHp ?? 2000,
            currentHp: config.maxHp ?? 2000,
            attackPower: config.attackPower ?? 80,
            defense: 20,
            moveSpeed: 0 // 塔不會移動
        });

        this.attackRange = config.attackRange ?? 10;
        this.attackCooldown = config.attackCooldown ?? 2;

        // 建立視覺模型
        this.createVisuals(position, config);

        // 建立物理碰撞體 (靜態)
        this.createCollider(position);

        app.root.addChild(this.entity);
        console.log(`[TowerEntity] Created tower ${entityId} for team ${team} at (${position.x}, ${position.y}, ${position.z})`);
    }

    /**
     * 設定 ProjectileManager 參考
     */
    setProjectileManager(pm: ProjectileManager) {
        this.projectileManager = pm;
    }

    private createVisuals(position: { x: number; y: number; z: number }, config: TowerConfig) {
        this.entity.setPosition(position.x, position.y, position.z);

        // 塔底座 (大圓柱)
        const base = new pc.Entity('Base');
        base.addComponent('render', { type: 'cylinder' });
        base.setLocalScale(2, 0.5, 2);
        base.setLocalPosition(0, -0.25, 0);
        this.applyMaterial(base, this.getTeamColor(0.3, config.colorOverride));
        this.entity.addChild(base);

        // 塔身 (細長圓柱)
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'cylinder' });
        body.setLocalScale(1, 3, 1);
        body.setLocalPosition(0, 1.5, 0);
        this.applyMaterial(body, this.getTeamColor(0.5, config.colorOverride));
        this.entity.addChild(body);

        // 塔頂 (球體)
        const top = new pc.Entity('Top');
        top.addComponent('render', { type: 'sphere' });
        top.setLocalScale(1.5, 1.5, 1.5);
        top.setLocalPosition(0, 3.5, 0);
        this.applyMaterial(top, this.getTeamColor(0.8, config.colorOverride));
        this.entity.addChild(top);
    }

    private getTeamColor(brightness: number, override?: pc.Color): pc.Color {
        if (override) {
            return new pc.Color(
                override.r * brightness,
                override.g * brightness,
                override.b * brightness
            );
        }
        if (this.team === 'red') {
            return new pc.Color(brightness, brightness * 0.2, brightness * 0.2);
        } else if (this.team === 'blue') {
            return new pc.Color(brightness * 0.2, brightness * 0.2, brightness);
        }
        return new pc.Color(brightness, brightness, brightness);
    }

    private applyMaterial(entity: pc.Entity, color: pc.Color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.emissive = new pc.Color(color.r * 0.3, color.g * 0.3, color.b * 0.3);
        material.update();

        if (entity.render) {
            entity.render.meshInstances.forEach(mi => {
                mi.material = material;
            });
        }
    }

    private createCollider(position: { x: number; y: number; z: number }) {
        // 靜態剛體
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z);
        this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

        // 圓柱碰撞體
        const colliderDesc = RAPIER.ColliderDesc.cylinder(2, 1);
        this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    /**
     * 每幀更新：偵測敵人並攻擊
     */
    update(dt: number): void {
        this.combatStats.update(dt);

        // 冷卻計時
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
        }
    }

    /**
     * 嘗試攻擊目標
     * @param targets 所有潛在目標
     * @returns 是否成功攻擊
     */
    tryAttack(targets: CombatEntity[]): boolean {
        if (this.cooldownTimer > 0) return false;

        // 找到範圍內的敵人
        const towerPos = this.getPosition();
        let closestTarget: CombatEntity | null = null;
        let closestDist = this.attackRange;

        for (const target of targets) {
            // 跳過同隊或中立
            if (target.team === this.team || target.team === 'neutral') continue;
            if (target.isDead()) continue;

            const targetPos = target.getPosition();
            const dist = towerPos.distance(targetPos);

            if (dist < closestDist) {
                closestDist = dist;
                closestTarget = target;
            }
        }

        if (closestTarget && this.projectileManager) {
            // 發射投射物
            const direction = closestTarget.getPosition().sub(towerPos).normalize();
            this.projectileManager.spawnProjectile(
                towerPos,
                direction,
                20, // 投射物速度
                this.combatStats.attackPower,
                this.entityId,
                this.team === 'red' ? 'blue' : 'red' // 攻擊敵方
            );

            this.cooldownTimer = this.attackCooldown;
            console.log(`[TowerEntity] ${this.entityId} attacked ${closestTarget.entityId}`);
            return true;
        }

        return false;
    }
}
