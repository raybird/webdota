import { StatusSystem } from './StatusSystem';
import { SpatialSystem } from './SpatialSystem';
/**
 * AISystem.ts - AI 行為系統
 * 處理小兵與防禦塔的自動行為
 */

import * as pc from 'playcanvas';
import { System } from '../System';
import { World } from '../World';
import { ComponentType } from '../Component';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { HealthComponent } from '../components/HealthComponent';
import { TeamComponent } from '../components/TeamComponent';
import { CombatComponent } from '../components/CombatComponent';
import { AIComponent } from '../components/AIComponent';
import { HealthSystem } from './HealthSystem';
import { eventBus } from '../../../events/EventBus';

/** 防禦塔光彈的飛行速度（單位／秒）；射程 12 約 0.75 秒命中 */
const TOWER_BOLT_SPEED = 16;

/** 飛行中的防禦塔光彈：命中時才扣血，讓畫面上看得到誰打了誰 */
export interface PendingBolt {
    attackerId: string;
    targetId: string;
    damage: number;
    timeLeft: number;
}

export class AISystem extends System {
    readonly name = 'AISystem';
    readonly requiredComponents = [ComponentType.AI, ComponentType.TRANSFORM] as const;

    priority = 25; // 在 Movement 和 Collision 之間

    private bolts: PendingBolt[] = [];

    update(world: World, dt: number): void {
        this.updateBolts(world, dt);

        const entities = world.query(ComponentType.AI, ComponentType.TRANSFORM);

        for (const entityId of entities) {
            const ai = world.getComponent<AIComponent>(entityId, ComponentType.AI);
            const transform = world.getComponent<TransformComponent>(entityId, ComponentType.TRANSFORM);

            if (!ai || !transform) continue;

            // 更新冷卻
            ai.update(dt);

            // 根據 AI 類型執行行為
            switch (ai.aiType) {
                case 'creep':
                    this.updateCreepAI(world, entityId, ai, transform, dt);
                    break;
                case 'tower':
                    this.updateTowerAI(world, entityId, ai, transform);
                    break;
            }
        }
    }

    /**
     * 小兵 AI：朝目標移動，攻擊範圍內敵人
     */
    private updateCreepAI(
        world: World,
        entityId: string,
        ai: AIComponent,
        transform: TransformComponent,
        dt: number
    ): void {
        const physics = world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        const combat = world.getComponent<CombatComponent>(entityId, ComponentType.COMBAT);
        const team = world.getComponent<TeamComponent>(entityId, ComponentType.TEAM);

        if (!physics || !combat || !team) return;

        // 移動向目標
        if (ai.targetPosition) {
            const direction = ai.targetPosition.clone().sub(transform.position);
            const distance = direction.length();

            if (distance > 0.5) {
                direction.normalize();
                const speed = combat.moveSpeed * StatusSystem.speedMultiplier(world, entityId);
                const newPos = {
                    x: transform.position.x + direction.x * speed * dt,
                    y: transform.position.y,
                    z: transform.position.z + direction.z * speed * dt
                };
                physics.setKinematicPosition(newPos.x, newPos.y, newPos.z);

                // 更新朝向
                const angle = Math.atan2(direction.x, direction.z);
                const halfAngle = angle / 2;
                physics.setKinematicRotation(0, Math.sin(halfAngle), 0, Math.cos(halfAngle));
            }
        }

        // 嘗試攻擊範圍內的敵人
        if (ai.canAttack()) {
            const target = this.findNearestEnemy(world, entityId, transform.position, ai.attackRange, team.team);
            if (target) {
                HealthSystem.dealDamage(world, target.entityId, combat.attackPower, entityId);
                ai.triggerAttack();
            }
        }
    }

    /**
     * 防禦塔 AI：攻擊範圍內敵人
     */
    private updateTowerAI(
        world: World,
        entityId: string,
        ai: AIComponent,
        transform: TransformComponent
    ): void {
        const combat = world.getComponent<CombatComponent>(entityId, ComponentType.COMBAT);
        const team = world.getComponent<TeamComponent>(entityId, ComponentType.TEAM);

        if (!combat || !team) return;

        // 對範圍內最近的敵人發射光彈，命中時才扣血
        if (ai.canAttack()) {
            const target = this.findNearestEnemy(world, entityId, transform.position, ai.attackRange, team.team);
            if (target) {
                const flightTime = target.distance / TOWER_BOLT_SPEED;
                this.bolts.push({ attackerId: entityId, targetId: target.entityId, damage: combat.attackPower, timeLeft: flightTime });
                eventBus.emit({ type: 'TOWER_ATTACK', attackerId: entityId, targetId: target.entityId, flightTime, damage: combat.attackPower });
                ai.triggerAttack();
            }
        }
    }

    /** Host 遷移：新 Host 接手原 Host 還在飛的光彈（由 Client 端記錄的轉播訊息換算） */
    adoptBolts(bolts: PendingBolt[]): void {
        this.bolts.push(...bolts);
    }

    /** 推進飛行中的光彈；目標在飛行途中死亡或移除時光彈落空 */
    private updateBolts(world: World, dt: number): void {
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const bolt = this.bolts[i]!;
            bolt.timeLeft -= dt;
            if (bolt.timeLeft > 0) continue;
            this.bolts.splice(i, 1);
            if (world.hasEntity(bolt.targetId)) {
                HealthSystem.dealDamage(world, bolt.targetId, bolt.damage, bolt.attackerId);
            }
        }
    }

    /**
     * 尋找最近的敵人
     */
    private findNearestEnemy(
        world: World,
        selfId: string,
        position: pc.Vec3,
        range: number,
        selfTeam: string
    ): { entityId: string; distance: number } | null {
        const spatialSystem = world.getSystem<SpatialSystem>('SpatialSystem');
        
        // 如果空間系統可用，則進行優化查詢，否則降級為全量查詢
        const candidateIds = spatialSystem 
            ? spatialSystem.queryNearby(position.x, position.z, range)
            : world.query(ComponentType.TRANSFORM, ComponentType.TEAM, ComponentType.HEALTH);

        let nearest: { entityId: string; distance: number } | null = null;

        for (const candidateId of candidateIds) {
            if (candidateId === selfId) continue;

            const candidateTeam = world.getComponent<TeamComponent>(candidateId, ComponentType.TEAM);
            const candidateHealth = world.getComponent<HealthComponent>(candidateId, ComponentType.HEALTH);
            const candidateTransform = world.getComponent<TransformComponent>(candidateId, ComponentType.TRANSFORM);

            if (!candidateTeam || !candidateHealth || !candidateTransform) continue;

            // 跳過同隊、中立、已死亡
            if (candidateTeam.team === selfTeam || candidateTeam.team === 'neutral') continue;
            if (candidateHealth.isDead()) continue;
            // 隱身的單位不會被小兵與防禦塔鎖定（範圍技能仍打得到）
            if (StatusSystem.has(world, candidateId, 'invisible')) continue;

            const dist = position.distance(candidateTransform.position);
            if (dist <= range) {
                if (!nearest || dist < nearest.distance) {
                    nearest = { entityId: candidateId, distance: dist };
                }
            }
        }

        return nearest;
    }
}
