import * as pc from 'playcanvas';

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
     * @param players 所有玩家實體 (用於碰撞檢測)
     * @returns 命中事件列表
     */
    update(dt: number, players: Map<string, any>): Array<{ targetId: string, damage: number, knockback: pc.Vec3 }> {
        const hits: Array<{ targetId: string, damage: number, knockback: pc.Vec3 }> = [];

        // 過濾過期的 hitbox
        this.activeHitboxes = this.activeHitboxes.filter(hitbox => {
            hitbox.duration -= dt;

            if (hitbox.duration <= 0) {
                if (hitbox.debugEntity) hitbox.debugEntity.destroy();
                return false;
            }

            // 檢測碰撞
            for (const [playerId, player] of players) {
                // 忽略攻擊者自己
                if (playerId === hitbox.ownerId) continue;

                // 忽略已命中的目標 (避免同一招打多次)
                if (hitbox.hitTargets.has(playerId)) continue;

                // 距離檢測
                const playerPos = player.getPosition();
                const distance = hitbox.position.distance(playerPos);

                // 假設玩家半徑為 0.5
                if (distance <= hitbox.radius + 0.5) {
                    // 命中！
                    hitbox.hitTargets.add(playerId);
                    hits.push({
                        targetId: playerId,
                        damage: hitbox.damage,
                        knockback: hitbox.knockback
                    });

                    // 視覺回饋 (可選)
                    // console.log(`Hit! ${hitbox.ownerId} -> ${playerId} (${hitbox.damage})`);
                }
            }

            return true;
        });

        return hits;
    }
}
