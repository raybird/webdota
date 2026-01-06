/**
 * CreepEntity - 小兵實體
 * 簡單 AI：朝目標移動並攻擊
 */
import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { CombatEntity, type Team } from './CombatEntity';

interface CreepConfig {
    maxHp?: number;
    attackPower?: number;
    moveSpeed?: number;
    attackRange?: number;
    attackCooldown?: number;
}

export class CreepEntity extends CombatEntity {
    private attackRange: number;
    private attackCooldown: number;
    private cooldownTimer: number = 0;
    private targetPosition: pc.Vec3 | null = null;

    constructor(
        entityId: string,
        team: Team,
        app: pc.Application,
        physicsWorld: RAPIER.World,
        position: { x: number; y: number; z: number },
        config: CreepConfig = {}
    ) {
        super(entityId, team, app, physicsWorld, {
            maxHp: config.maxHp ?? 300,
            currentHp: config.maxHp ?? 300,
            attackPower: config.attackPower ?? 20,
            defense: 5,
            moveSpeed: config.moveSpeed ?? 3
        });

        this.attackRange = config.attackRange ?? 1.5;
        this.attackCooldown = config.attackCooldown ?? 1;

        // 建立視覺模型
        this.createVisuals(position);

        // 建立物理碰撞體
        this.createCollider(position);

        app.root.addChild(this.entity);
        console.log(`[CreepEntity] Created creep ${entityId} for team ${team} at (${position.x}, ${position.y}, ${position.z})`);
    }

    private createVisuals(position: { x: number; y: number; z: number }) {
        this.entity.setPosition(position.x, position.y, position.z);

        // 身體 (小方塊)
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'box' });
        body.setLocalScale(0.6, 0.8, 0.6);
        body.setLocalPosition(0, 0.4, 0);
        this.applyMaterial(body, this.getTeamColor(0.6));
        this.entity.addChild(body);

        // 頭部 (小球)
        const head = new pc.Entity('Head');
        head.addComponent('render', { type: 'sphere' });
        head.setLocalScale(0.4, 0.4, 0.4);
        head.setLocalPosition(0, 1, 0);
        this.applyMaterial(head, this.getTeamColor(0.8));
        this.entity.addChild(head);
    }

    private getTeamColor(brightness: number): pc.Color {
        if (this.team === 'red') {
            return new pc.Color(brightness, brightness * 0.3, brightness * 0.3);
        } else if (this.team === 'blue') {
            return new pc.Color(brightness * 0.3, brightness * 0.3, brightness);
        }
        return new pc.Color(brightness * 0.7, brightness * 0.7, brightness * 0.7);
    }

    private applyMaterial(entity: pc.Entity, color: pc.Color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.emissive = new pc.Color(color.r * 0.2, color.g * 0.2, color.b * 0.2);
        material.update();

        if (entity.render) {
            entity.render.meshInstances.forEach(mi => {
                mi.material = material;
            });
        }
    }

    private createCollider(position: { x: number; y: number; z: number }) {
        // Kinematic 剛體 (程式控制移動)
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z);
        this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

        // 方塊碰撞體
        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.3, 0.5, 0.3);
        this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    /**
     * 設定移動目標
     */
    setTargetPosition(target: pc.Vec3) {
        this.targetPosition = target.clone();
    }

    /**
     * 每幀更新：朝目標移動
     */
    update(dt: number): void {
        this.combatStats.update(dt);

        // 冷卻計時
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
        }

        // 移動邏輯
        if (this.targetPosition && this.rigidBody) {
            const currentPos = this.getPosition();
            const direction = this.targetPosition.clone().sub(currentPos);
            const distance = direction.length();

            if (distance > 0.5) { // 還沒到達目標
                direction.normalize();
                const speed = this.combatStats.moveSpeed;
                const newPos = {
                    x: currentPos.x + direction.x * speed * dt,
                    y: currentPos.y,
                    z: currentPos.z + direction.z * speed * dt
                };
                this.rigidBody.setNextKinematicTranslation(newPos);

                // 更新朝向
                const angle = Math.atan2(direction.x, direction.z);
                const q = new pc.Quat().setFromEulerAngles(0, angle * pc.math.RAD_TO_DEG, 0);
                this.rigidBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
            }
        }

        // 同步視覺
        this.syncVisuals();
    }

    /**
     * 嘗試攻擊目標
     */
    tryAttack(target: CombatEntity): boolean {
        if (this.cooldownTimer > 0) return false;
        if (target.team === this.team) return false;
        if (target.isDead()) return false;

        const dist = this.getPosition().distance(target.getPosition());
        if (dist <= this.attackRange) {
            target.takeDamage(this.combatStats.attackPower);
            this.cooldownTimer = this.attackCooldown;
            console.log(`[CreepEntity] ${this.entityId} attacked ${target.entityId}`);
            return true;
        }
        return false;
    }

    /**
     * 同步視覺與物理位置
     */
    private syncVisuals() {
        if (this.rigidBody) {
            const pos = this.rigidBody.translation();
            const rot = this.rigidBody.rotation();
            this.entity.setPosition(pos.x, pos.y, pos.z);
            this.entity.setRotation(rot.x, rot.y, rot.z, rot.w);
        }
    }
}
