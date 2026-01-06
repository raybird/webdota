import * as pc from 'playcanvas';
import type { CombatEntity } from '../entities/CombatEntity';

export interface AttackHitbox {
    id: string;             // 唯一 ID
    position: pc.Vec3;      // 中心位置
    radius: number;         // 半徑
    damage: number;         // 傷害
    knockback: pc.Vec3;     // 擊退向量
    ownerId: string;        // 攻擊者 ID
    duration: number;       // 剩餘時間 (秒)
    hitTargets: Set<string>; // 已命中的目標 ID

    // 視覺除錯用
    debugEntity?: pc.Entity;
}

export class HitboxManager {
    app: pc.Application;
    activeHitboxes: AttackHitbox[] = [];

    constructor(app: pc.Application) {
        this.app = app;
    }

    /**
     * 建立攻擊判定框
     */
    createHitbox(
        position: pc.Vec3,
        radius: number,
        damage: number,
        knockback: pc.Vec3,
        ownerId: string,
        duration: number = 0.2
    ) {
        const hitbox: AttackHitbox = {
            id: Math.random().toString(36).substr(2, 9),
            position: position.clone(),
            radius: radius,
            damage: damage,
            knockback: knockback.clone(),
            ownerId: ownerId,
            duration: duration,
            hitTargets: new Set()
        };

        // 視覺化 (除錯用)
        // this.createDebugVisual(hitbox);

        this.activeHitboxes.push(hitbox);
    }

    /**
     * 更新所有判定框
     * @param dt Delta time
     * @param targets 所有可攻擊目標 (CombatEntity Map 或陣列)
     * @returns 命中事件列表
     */
    update(dt: number, targets: Map<string, CombatEntity> | CombatEntity[]): Array<{ targetId: string, damage: number, knockback: pc.Vec3 }> {
        const hits: Array<{ targetId: string, damage: number, knockback: pc.Vec3 }> = [];

        // 將目標轉換為統一格式
        const targetEntries: Array<[string, CombatEntity]> = Array.isArray(targets)
            ? targets.map(t => [t.entityId, t] as [string, CombatEntity])
            : Array.from(targets.entries());

        // 過濾過期的 hitbox
        this.activeHitboxes = this.activeHitboxes.filter(hitbox => {
            hitbox.duration -= dt;

            if (hitbox.duration <= 0) {
                if (hitbox.debugEntity) hitbox.debugEntity.destroy();
                return false;
            }

            // 檢測碰撞
            for (const [entityId, entity] of targetEntries) {
                // 忽略攻擊者自己
                if (entityId === hitbox.ownerId) continue;

                // 忽略已命中的目標 (避免同一招打多次)
                if (hitbox.hitTargets.has(entityId)) continue;

                // 忽略已死亡的目標
                if (entity.isDead()) continue;

                // 距離檢測
                const entityPos = entity.getPosition();
                const distance = hitbox.position.distance(entityPos);

                // 假設實體半徑為 0.5
                if (distance <= hitbox.radius + 0.5) {
                    // 命中！
                    hitbox.hitTargets.add(entityId);
                    hits.push({
                        targetId: entityId,
                        damage: hitbox.damage,
                        knockback: hitbox.knockback
                    });

                    // 視覺回饋 (可選)
                    // console.log(`Hit! ${hitbox.ownerId} -> ${entityId} (${hitbox.damage})`);
                }
            }

            return true;
        });

        return hits;
    }
}
