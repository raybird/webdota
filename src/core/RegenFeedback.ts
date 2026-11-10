/**
 * RegenFeedback - 英雄回血的畫面回饋（docs/gameplay-v2/features/f4-regen.md）
 *
 * 依血量變化判斷，不需要額外同步：Host 看自己算出的血量，Client 看 Host 同步來的血量。
 * 每 WINDOW 秒結算一次回復量，超過基礎回血才發 ENTITY_HEALED（頭上綠色 +N），
 * 基礎回血太小，一直跳數字只會干擾。
 * 本地玩家不在泉水、回血速度升到脫戰回血的程度時，第一次的數字帶「脫戰回復」提示
 * （裝備回血每秒 1% 以下，不會被誤判）。
 */

import { eventBus } from '../events/EventBus';
import { REGEN } from '../data/balance';
import { isInFountain } from './combat/regen';
import { ComponentType, HealthComponent, type EntityId, type World } from './ecs';

/** 結算間隔（秒） */
const WINDOW = 1;
/** 每秒回復超過最大生命的這個比例才顯示（基礎回血 0.2% 不顯示，裝備、脫戰、泉水會顯示） */
export const SHOW_RATIO = 0.005;

export const OUT_OF_COMBAT_LABEL = '脫戰回復';

interface Track {
    lastHp: number;
    lastMaxHp: number;
    healed: number;
    /** 上一個結算區間是否已達脫戰回血速度 */
    boosted: boolean;
}

export interface RegenFeedbackContext {
    /** 玩家 ID → 實體 */
    players: ReadonlyMap<string, EntityId>;
    localPlayerId: string;
    localPosition: { x: number; z: number } | null;
    fountain: { x: number; z: number } | null;
}

export class RegenFeedback {
    private world: World;
    private tracks = new Map<EntityId, Track>();
    private elapsed = 0;

    constructor(world: World) {
        this.world = world;
    }

    update(dt: number, ctx: RegenFeedbackContext): void {
        for (const entityId of ctx.players.values()) {
            const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            if (!health) continue;
            const track = this.tracks.get(entityId);
            if (!track) {
                this.tracks.set(entityId, { lastHp: health.currentHp, lastMaxHp: health.maxHp, healed: 0, boosted: false });
                continue;
            }
            // 陣亡到重生的血量跳升不算回血；升級、買裝備讓最大生命增加時，目前生命跟著增加的量也不算
            const maxGain = Math.max(0, health.maxHp - track.lastMaxHp);
            const gain = health.currentHp - track.lastHp - maxGain;
            if (track.lastHp > 0 && gain > 0) track.healed += gain;
            track.lastHp = health.currentHp;
            track.lastMaxHp = health.maxHp;
        }

        this.elapsed += dt;
        if (this.elapsed < WINDOW) return;
        const seconds = this.elapsed;
        this.elapsed = 0;

        const localEntity = ctx.players.get(ctx.localPlayerId.toUpperCase()) ?? ctx.players.get(ctx.localPlayerId);
        const localInFountain = !!ctx.localPosition && isInFountain(ctx.localPosition, ctx.fountain);
        for (const [entityId, track] of this.tracks) {
            const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            const healed = track.healed;
            track.healed = 0;
            if (!health) {
                this.tracks.delete(entityId);
                continue;
            }
            const perSecond = healed / seconds;
            const boosted = perSecond >= health.maxHp * REGEN.outOfCombatRatio;
            if (perSecond >= health.maxHp * SHOW_RATIO) {
                const label = entityId === localEntity && boosted && !track.boosted && !localInFountain
                    ? OUT_OF_COMBAT_LABEL
                    : undefined;
                eventBus.emit({ type: 'ENTITY_HEALED', targetId: entityId, amount: healed, label });
            }
            track.boosted = boosted;
        }
    }

    reset(): void {
        this.tracks.clear();
        this.elapsed = 0;
    }
}
