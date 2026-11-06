/**
 * RemoteBoltLog - Client 記錄 Host 轉播的防禦塔光彈，Host 遷移時交給新 Host 接手結算
 *
 * 光彈的傷害只在 Host 命中時結算。原 Host 斷線時，還在飛、或已命中但結果沒同步出來的光彈
 * 會遺失；新 Host 依這份紀錄補算。
 *
 * 判斷「結果是否已同步」：Client 收到轉播的時間比 Host 發射晚一個延遲，推算的命中時間 landAt
 * 也晚一個延遲；Host 在命中後送出的狀態同樣晚一個延遲到達，所以 landAt ≤ 最後收到狀態的時間
 * 就代表扣血已經在同步裡。玩家血量走 GAME_STATE、建築與小兵走 ENTITY_STATE，各自比對。
 */

import type { EntityId } from './ecs';
import type { PendingBolt } from './ecs/systems/AISystem';

export type BoltTargetKind = 'player' | 'entity';

interface RemoteBolt {
    attackerId: EntityId;
    targetId: EntityId;
    targetKind: BoltTargetKind;
    damage: number;
    /** 推算的命中時間（毫秒，performance.now 的時間軸） */
    landAt: number;
}

export class RemoteBoltLog {
    private bolts: RemoteBolt[] = [];
    private lastStateAt: Record<BoltTargetKind, number> = { player: -Infinity, entity: -Infinity };

    record(attackerId: EntityId, targetId: EntityId, targetKind: BoltTargetKind, damage: number, flightTime: number, now: number): void {
        this.bolts.push({ attackerId, targetId, targetKind, damage, landAt: now + flightTime * 1000 });
    }

    /** 收到 Host 的狀態同步：命中時間在這之前的光彈已結算，不必再記 */
    markState(kind: BoltTargetKind, now: number): void {
        this.lastStateAt[kind] = now;
        this.bolts = this.bolts.filter(bolt => bolt.targetKind !== kind || bolt.landAt > now);
    }

    /** 成為新 Host：交出結果還沒同步的光彈（已過命中時間的立即結算），並清空紀錄 */
    takeOver(now: number): PendingBolt[] {
        const pending = this.bolts
            .filter(bolt => bolt.landAt > this.lastStateAt[bolt.targetKind])
            .map(({ attackerId, targetId, damage, landAt }) => ({
                attackerId, targetId, damage, timeLeft: Math.max(0, (landAt - now) / 1000)
            }));
        this.clear();
        return pending;
    }

    clear(): void {
        this.bolts = [];
        this.lastStateAt = { player: -Infinity, entity: -Infinity };
    }
}
