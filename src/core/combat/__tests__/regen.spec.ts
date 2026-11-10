import { describe, it, expect, afterEach } from 'vitest';
import { regenPerSecond, isInFountain } from '../regen';
import { REGEN } from '../../../data/balance';
import { World } from '../../ecs/World';
import { HealthComponent } from '../../ecs/components/HealthComponent';
import { HealthSystem } from '../../ecs/systems/HealthSystem';
import { RegenFeedback, OUT_OF_COMBAT_LABEL } from '../../RegenFeedback';
import { eventBus } from '../../../events/EventBus';

const base = { maxHp: 1000, itemRegen: 0, outOfCombatSeconds: 0, inFountain: false };

describe('regenPerSecond', () => {
    it('交戰中只有基礎回血加裝備', () => {
        expect(regenPerSecond(base)).toBeCloseTo(2);
        expect(regenPerSecond({ ...base, itemRegen: 10 })).toBeCloseTo(12);
    });

    it('5 秒沒交戰後加上脫戰回血', () => {
        expect(regenPerSecond({ ...base, outOfCombatSeconds: 4.9 })).toBeCloseTo(2);
        expect(regenPerSecond({ ...base, outOfCombatSeconds: 5 })).toBeCloseTo(17);
    });

    it('自家泉水約 7 秒內回滿', () => {
        const inFountain = regenPerSecond({ ...base, inFountain: true, outOfCombatSeconds: 10 });
        expect(1000 / inFountain).toBeLessThan(7);
        // 剛進泉水、還在交戰中也一樣快
        expect(1000 / regenPerSecond({ ...base, inFountain: true })).toBeLessThan(7);
    });
});

describe('isInFountain', () => {
    it('只看水平距離，主堡被摧毀時沒有泉水', () => {
        const fountain = { x: -22, z: -22 };
        expect(isInFountain({ x: -22 + REGEN.fountainRadius - 0.01, z: -22 }, fountain)).toBe(true);
        expect(isInFountain({ x: -22 + REGEN.fountainRadius + 0.01, z: -22 }, fountain)).toBe(false);
        expect(isInFountain({ x: -22, z: -22 }, null)).toBe(false);
    });
});

describe('脫戰計時', () => {
    it('受傷與造成傷害的一方都歸零', () => {
        const world = new World();
        const attacker = world.createEntity();
        const target = world.createEntity();
        const a = new HealthComponent();
        const t = new HealthComponent();
        world.addComponent(attacker, a);
        world.addComponent(target, t);
        a.outOfCombatSeconds = 8;
        t.outOfCombatSeconds = 8;

        HealthSystem.dealDamage(world, target, 50, attacker);

        expect(t.outOfCombatSeconds).toBe(0);
        expect(a.outOfCombatSeconds).toBe(0);
    });
});

describe('RegenFeedback', () => {
    const offs: Array<() => void> = [];
    afterEach(() => offs.splice(0).forEach(off => off()));

    function setup() {
        const world = new World();
        const entity = world.createEntity();
        const health = new HealthComponent({ maxHp: 1000, currentHp: 500 });
        world.addComponent(entity, health);
        const feedback = new RegenFeedback(world);
        const events: Array<{ amount: number; label?: string }> = [];
        offs.push(eventBus.on('ENTITY_HEALED', e => events.push({ amount: e.amount, label: e.label })));
        const ctx = (position = { x: 0, z: 0 }) => ({
            players: new Map([['ME', entity]]),
            localPlayerId: 'me',
            localPosition: position,
            fountain: { x: -22, z: -22 }
        });
        /** 以 perSecond 的速度回血 seconds 秒 */
        const run = (perSecond: number, seconds: number, position?: { x: number; z: number }) => {
            for (let i = 0; i < seconds * 10; i++) {
                health.currentHp = Math.min(health.maxHp, health.currentHp + perSecond / 10);
                feedback.update(0.1, ctx(position));
            }
        };
        feedback.update(0, ctx());
        return { health, events, run };
    }

    it('基礎回血不跳數字', () => {
        const { events, run } = setup();
        run(2, 3);
        expect(events).toHaveLength(0);
    });

    it('脫戰回血每秒跳綠色數字，第一次帶提示', () => {
        const { events, run } = setup();
        run(2, 2);
        run(17, 3);
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events[0]!.label).toBe(OUT_OF_COMBAT_LABEL);
        expect(events[0]!.amount).toBeGreaterThan(10);
        expect(events.slice(1).every(e => e.label === undefined)).toBe(true);
    });

    it('在泉水回血不顯示脫戰提示', () => {
        const { events, run } = setup();
        run(152, 2, { x: -20, z: -20 });
        expect(events.length).toBeGreaterThan(0);
        expect(events.every(e => e.label === undefined)).toBe(true);
    });

    it('陣亡後重生的血量跳升不算回血', () => {
        const { health, events, run } = setup();
        health.currentHp = 0;
        run(0, 0.2);
        health.currentHp = 1000;
        run(0, 2);
        expect(events).toHaveLength(0);
    });
});
