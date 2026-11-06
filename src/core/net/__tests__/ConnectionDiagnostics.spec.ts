import { describe, it, expect } from 'vitest';
import { ConnectionDiagnostics, rateQuality, routeOf, STALL_MS } from '../ConnectionDiagnostics';

describe('ConnectionDiagnostics', () => {
    it('依 ping／pong 算出延遲、平均、最大值與抖動', () => {
        const d = new ConnectionDiagnostics();
        const samples = [40, 60, 50];
        samples.forEach((rtt, i) => {
            d.pingSent('A', i + 1, i * 1000);
            expect(d.pongReceived('A', i + 1, i * 1000 + rtt)).toBe(rtt);
        });
        const [peer] = d.snapshot(3000);
        expect(peer!.rtt).toBe(50);
        expect(peer!.avgRtt).toBeCloseTo(50);
        expect(peer!.maxRtt).toBe(60);
        // 第一個差值 20 當初始值，第二個差值 10：20 + (10 - 20) / 16
        expect(peer!.jitter).toBeCloseTo(20 - 10 / 16);
        expect(peer!.quality).toBe('good');
    });

    it('不認得的序號不記錄；ping 太久沒回來視為卡住', () => {
        const d = new ConnectionDiagnostics();
        expect(d.pongReceived('A', 99, 10)).toBeNull();
        d.pingSent('A', 1, 0);
        const [peer] = d.snapshot(STALL_MS + 1);
        expect(peer!.stalled).toBe(true);
        expect(peer!.quality).toBe('bad');
    });

    it('收到較晚送出的 pong 時，較早的 ping 不再算等待中', () => {
        const d = new ConnectionDiagnostics();
        d.pingSent('A', 1, 0);
        d.pingSent('A', 2, 1000);
        d.pongReceived('A', 2, 1050);
        expect(d.snapshot(5000)[0]!.pendingMs).toBe(0);
    });

    it('同步頻率以最近 2 秒計算', () => {
        const d = new ConnectionDiagnostics();
        for (let t = 0; t <= 2000; t += 50) d.stateMessage('game', t);
        expect(d.stateRate('game', 2000)).toBeCloseTo(20.5);
        expect(d.stateRate('entity', 2000)).toBe(0);
        expect(d.stateAge(2100)).toBe(100);
    });
});

describe('rateQuality', () => {
    it('依平均延遲分級，抖動過大降一級', () => {
        expect(rateQuality(null, null, false)).toBe('unknown');
        expect(rateQuality(30, 5, false)).toBe('good');
        expect(rateQuality(30, 40, false)).toBe('fair');
        expect(rateQuality(100, null, false)).toBe('fair');
        expect(rateQuality(200, null, false)).toBe('poor');
        expect(rateQuality(300, null, false)).toBe('bad');
        expect(rateQuality(300, 80, false)).toBe('bad');
    });
});

describe('routeOf', () => {
    it('判斷區域網路、直連與中繼', () => {
        expect(routeOf('host', 'host')).toBe('lan');
        expect(routeOf('srflx', 'prflx')).toBe('direct');
        expect(routeOf('host', 'relay')).toBe('relay');
        expect(routeOf(null, 'host')).toBe('unknown');
    });
});
