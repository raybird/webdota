/**
 * BaseEntity - 主堡實體
 * 作為遊戲勝利目標，當主堡被摧毀時遊戲結束
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { CombatEntity, type Team } from './CombatEntity';
import { eventBus } from '../../events/EventBus';

interface BaseConfig {
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
}

export class BaseEntity extends CombatEntity {
    private attackRange: number;
    private attackCooldown: number;
    private cooldownTimer: number = 0;

    constructor(
        entityId: string,
        team: Team,
        app: pc.Application,
        physicsWorld: RAPIER.World,
        position: { x: number; y: number; z: number },
        config: BaseConfig = {}
    ) {
        super(entityId, team, app, physicsWorld, {
            maxHp: config.maxHp ?? 5000,
            currentHp: config.maxHp ?? 5000,
            attackPower: config.attackPower ?? 50,
            defense: 30,
            moveSpeed: 0 // 主堡不會移動
        });

        this.attackRange = config.attackRange ?? 8;
        this.attackCooldown = config.attackCooldown ?? 3;

        // 建立視覺模型
        this.createVisuals(position);

        // 建立物理碰撞體 (靜態)
        this.createCollider(position);

        app.root.addChild(this.entity);
        console.log(`[BaseEntity] Created base ${entityId} for team ${team} at (${position.x}, ${position.y}, ${position.z})`);
    }

    private createVisuals(position: { x: number; y: number; z: number }) {
        this.entity.setPosition(position.x, position.y, position.z);

        // 主堡底座 (大型六邊形底座 - 使用圓柱模擬)
        const base = new pc.Entity('Base');
        base.addComponent('render', { type: 'cylinder' });
        base.setLocalScale(5, 0.8, 5);
        base.setLocalPosition(0, 0.4, 0);
        this.applyMaterial(base, this.getTeamColor(0.3), true);
        this.entity.addChild(base);

        // 主堡主體 (大型建築物 - 組合多個幾何體)
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'box' });
        body.setLocalScale(3, 4, 3);
        body.setLocalPosition(0, 2.8, 0);
        this.applyMaterial(body, this.getTeamColor(0.5), true);
        this.entity.addChild(body);

        // 主堡塔尖 (金字塔形狀 - 使用 cone)
        const top = new pc.Entity('Top');
        top.addComponent('render', { type: 'cone' });
        top.setLocalScale(3.5, 2.5, 3.5);
        top.setLocalPosition(0, 6, 0);
        this.applyMaterial(top, this.getTeamColor(0.7), true);
        this.entity.addChild(top);

        // 發光核心 (中央球體)
        const core = new pc.Entity('Core');
        core.addComponent('render', { type: 'sphere' });
        core.setLocalScale(1.2, 1.2, 1.2);
        core.setLocalPosition(0, 3.5, 0);
        this.applyCoreEffect(core);
        this.entity.addChild(core);

        // 四角裝飾柱
        const pillarPositions = [
            { x: 1.8, z: 1.8 },
            { x: -1.8, z: 1.8 },
            { x: 1.8, z: -1.8 },
            { x: -1.8, z: -1.8 }
        ];
        pillarPositions.forEach((pos, i) => {
            const pillar = new pc.Entity(`Pillar_${i}`);
            pillar.addComponent('render', { type: 'cylinder' });
            pillar.setLocalScale(0.4, 2.5, 0.4);
            pillar.setLocalPosition(pos.x, 1.25, pos.z);
            this.applyMaterial(pillar, this.getTeamColor(0.6), false);
            this.entity.addChild(pillar);
        });
    }

    private getTeamColor(brightness: number): pc.Color {
        if (this.team === 'red') {
            return new pc.Color(brightness, brightness * 0.15, brightness * 0.15);
        } else if (this.team === 'blue') {
            return new pc.Color(brightness * 0.15, brightness * 0.15, brightness);
        }
        return new pc.Color(brightness, brightness, brightness);
    }

    private applyMaterial(entity: pc.Entity, color: pc.Color, addEmissive: boolean) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        if (addEmissive) {
            material.emissive = new pc.Color(color.r * 0.2, color.g * 0.2, color.b * 0.2);
        }
        material.update();

        if (entity.render) {
            entity.render.meshInstances.forEach(mi => {
                mi.material = material;
            });
        }
    }

    private applyCoreEffect(entity: pc.Entity) {
        const material = new pc.StandardMaterial();
        // 發光核心使用明亮的團隊顏色
        if (this.team === 'red') {
            material.diffuse = new pc.Color(1, 0.3, 0.3);
            material.emissive = new pc.Color(1, 0.2, 0.2);
        } else if (this.team === 'blue') {
            material.diffuse = new pc.Color(0.3, 0.3, 1);
            material.emissive = new pc.Color(0.2, 0.2, 1);
        } else {
            material.diffuse = new pc.Color(1, 1, 0.5);
            material.emissive = new pc.Color(0.8, 0.8, 0.3);
        }
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

        // 大型方塊碰撞體
        const colliderDesc = RAPIER.ColliderDesc.cuboid(2.5, 3, 2.5);
        this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    /**
     * 覆寫 takeDamage 以檢測是否被摧毀
     */
    takeDamage(amount: number): number {
        const actualDamage = super.takeDamage(amount);

        // 檢查是否被摧毀
        if (this.isDead()) {
            console.log(`[BaseEntity] ${this.entityId} has been destroyed! Team ${this.team} loses!`);
            eventBus.emit({
                type: 'GAME_OVER',
                winnerTeam: this.team === 'red' ? 'blue' : 'red',
                reason: 'base_destroyed'
            });
        }

        return actualDamage;
    }

    /**
     * 每幀更新
     */
    update(dt: number): void {
        this.combatStats.update(dt);

        // 冷卻計時
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
        }
    }

    /**
     * 嘗試攻擊目標（主堡具備微弱的自衛能力）
     */
    tryAttack(targets: CombatEntity[]): boolean {
        if (this.cooldownTimer > 0) return false;

        const basePos = this.getPosition();
        let closestTarget: CombatEntity | null = null;
        let closestDist = this.attackRange;

        for (const target of targets) {
            if (target.team === this.team || target.team === 'neutral') continue;
            if (target.isDead()) continue;

            const targetPos = target.getPosition();
            const dist = basePos.distance(targetPos);

            if (dist < closestDist) {
                closestDist = dist;
                closestTarget = target;
            }
        }

        if (closestTarget) {
            closestTarget.takeDamage(this.combatStats.attackPower);
            this.cooldownTimer = this.attackCooldown;
            console.log(`[BaseEntity] ${this.entityId} attacked ${closestTarget.entityId}`);
            return true;
        }

        return false;
    }
}
