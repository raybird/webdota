import { describe, expect, it } from 'vitest';
import { StatusComponent, STATUS_FLAG } from '../components/StatusComponent';

describe('StatusComponent', () => {
    it('expires after its duration', () => {
        const status = new StatusComponent();
        status.apply('invincible', 2);
        status.tick(1.5);
        expect(status.has('invincible')).toBe(true);
        status.tick(0.6);
        expect(status.has('invincible')).toBe(false);
    });

    it('refreshes to the longer duration and keeps the stronger slow', () => {
        const status = new StatusComponent();
        status.apply('slow', 3, 0.5);
        status.apply('slow', 1, 0.8);
        expect(status.speedMultiplier).toBe(0.5);
        status.tick(2);
        expect(status.has('slow')).toBe(true);
    });

    it('round-trips through flags for clients', () => {
        const host = new StatusComponent();
        host.apply('invisible', 3);
        host.apply('slow', 3, 0.5);
        expect(host.flags).toBe(STATUS_FLAG.invisible | STATUS_FLAG.slow);

        const client = new StatusComponent();
        client.setFlags(host.flags);
        expect(client.has('invisible')).toBe(true);
        expect(client.speedMultiplier).toBe(0.5);
        client.setFlags(0);
        expect(client.has('invisible')).toBe(false);
        expect(client.speedMultiplier).toBe(1);
    });
});
