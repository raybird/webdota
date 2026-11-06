/**
 * StatusComponent.ts - 狀態效果（無敵、隱身、緩速）
 *
 * Host 權威：只有 Host 會施加、倒數並移除狀態，再以位元旗標隨 GAME_STATE 同步給 Client。
 * Client 只用 setFlags() 套用 Host 的結果，沒有自己的倒數。
 */

import { type Component, ComponentType } from '../Component';

export type StatusKind = 'invincible' | 'invisible' | 'slow';

/** 同步用的位元旗標 */
export const STATUS_FLAG: Record<StatusKind, number> = {
    invincible: 1 << 0,
    invisible: 1 << 1,
    slow: 1 << 2,
};

const KINDS = Object.keys(STATUS_FLAG) as StatusKind[];

/** 緩速沒有指定倍率時的移動速度倍率 */
const DEFAULT_SLOW = 0.5;

interface ActiveStatus {
    /** 剩餘秒數；Client 由旗標套用的狀態為 Infinity，等 Host 清掉旗標才移除 */
    remaining: number;
    /** 效果數值（緩速為移動速度倍率） */
    value: number;
}

export class StatusComponent implements Component {
    readonly type = ComponentType.STATUS;

    private active = new Map<StatusKind, ActiveStatus>();

    /**
     * 施加狀態；已有同種狀態時延長到較長的剩餘時間，數值取效果較強的一方
     */
    apply(kind: StatusKind, duration: number, value?: number): void {
        const current = this.active.get(kind);
        const nextValue = value ?? (kind === 'slow' ? DEFAULT_SLOW : 1);
        if (!current) {
            this.active.set(kind, { remaining: duration, value: nextValue });
            return;
        }
        current.remaining = Math.max(current.remaining, duration);
        // 緩速倍率越小越強
        current.value = kind === 'slow' ? Math.min(current.value, nextValue) : nextValue;
    }

    remove(kind: StatusKind): void {
        this.active.delete(kind);
    }

    has(kind: StatusKind): boolean {
        return this.active.has(kind);
    }

    clear(): void {
        this.active.clear();
    }

    /** 倒數並移除到期的狀態（只在 Host 呼叫） */
    tick(dt: number): void {
        for (const [kind, status] of this.active) {
            status.remaining -= dt;
            if (status.remaining <= 0) this.active.delete(kind);
        }
    }

    /** 移動速度倍率 */
    get speedMultiplier(): number {
        return this.active.get('slow')?.value ?? 1;
    }

    get flags(): number {
        let flags = 0;
        for (const kind of this.active.keys()) flags |= STATUS_FLAG[kind];
        return flags;
    }

    /**
     * Host 遷移：Client 由旗標套用的狀態沒有剩餘時間（Infinity），成為 Host 後改為 seconds 秒後到期，
     * 否則會永遠不消失（原 Host 的剩餘時間沒有同步，取短一點的值寧可提早結束）
     */
    adoptAsHost(seconds: number): void {
        for (const status of this.active.values()) {
            if (status.remaining === Infinity) status.remaining = seconds;
        }
    }

    /** Client 套用 Host 同步的旗標 */
    setFlags(flags: number): void {
        for (const kind of KINDS) {
            const on = (flags & STATUS_FLAG[kind]) !== 0;
            if (!on) this.active.delete(kind);
            else if (!this.active.has(kind)) this.active.set(kind, { remaining: Infinity, value: kind === 'slow' ? DEFAULT_SLOW : 1 });
        }
    }
}
