import { describe, it, expect } from 'vitest';
import { RemoteBoltLog } from '../RemoteBoltLog';

describe('RemoteBoltLog', () => {
    it('結果已隨狀態同步的光彈不交給新 Host', () => {
        const log = new RemoteBoltLog();
        log.record('tower', 'hero', 'player', 100, 0.5, 1000);
        log.markState('player', 1600);
        expect(log.takeOver(2000)).toEqual([]);
    });

    it('還在飛的光彈交出剩餘時間，已過命中時間但沒同步的立即結算', () => {
        const log = new RemoteBoltLog();
        log.markState('player', 900);
        log.markState('entity', 900);
        log.record('tower', 'hero', 'player', 100, 0.5, 1000);   // 1500 命中
        log.record('tower', 'creep', 'entity', 80, 0.2, 1000);   // 1200 命中
        const adopted = log.takeOver(1300);
        expect(adopted).toHaveLength(2);
        expect(adopted.find(b => b.targetId === 'hero')!.timeLeft).toBeCloseTo(0.2);
        expect(adopted.find(b => b.targetId === 'creep')!.timeLeft).toBe(0);
    });

    it('玩家與建築小兵的同步各自比對', () => {
        const log = new RemoteBoltLog();
        log.record('tower', 'hero', 'player', 100, 0.2, 1000);   // 1200 命中
        log.markState('entity', 1500);                            // 只有 ENTITY_STATE 到了
        expect(log.takeOver(1600)).toHaveLength(1);
    });
});
