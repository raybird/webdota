import { describe, it, expect } from 'vitest';
import { BinarySerializer } from '../BinarySerializer';

describe('BinarySerializer input', () => {
    it('round-trips movement without a skill', () => {
        const buffer = BinarySerializer.serializeInput({ frame: 42, playerId: 'ignored', moveX: 1, moveY: -0.5 });
        const input = BinarySerializer.deserializeInput(buffer, 'PEER-A');

        expect(input).toEqual({ frame: 42, playerId: 'PEER-A', moveX: 1, moveY: -0.5 });
        expect(buffer.byteLength).toBe(22);
    });

    it('carries skill id and direction so the host can execute client skills', () => {
        const buffer = BinarySerializer.serializeInput({
            frame: 7,
            playerId: 'ignored',
            moveX: 0,
            moveY: 0,
            skillUsed: 'mage_q',
            skillDirection: { x: 0.5, z: -0.25 }
        });
        const input = BinarySerializer.deserializeInput(buffer, 'PEER-B');

        expect(input.skillUsed).toBe('mage_q');
        expect(input.skillDirection).toEqual({ x: 0.5, z: -0.25 });
    });
});

describe('BinarySerializer game state', () => {
    it('round-trips players', () => {
        const state = {
            frame: 300,
            timestamp: 0,
            isGameStarted: true,
            players: [{ id: 'ABC', pos: { x: 1, y: 2, z: 3 }, rot: { x: 0, y: 0.5, z: 0, w: 0.5 }, stats: { hp: 900, energy: 40, status: 5 }, kb: 7, xp: 1234 }]
        };
        const decoded = BinarySerializer.deserializeGameState(BinarySerializer.serializeGameState(state));

        expect(decoded.frame).toBe(300);
        expect(decoded.players).toEqual(state.players);
    });
});

describe('BinarySerializer entity state', () => {
    it('round-trips structures and creeps', () => {
        const entities = [
            { netId: 1, kind: 'tower' as const, team: 'blue' as const, pos: { x: -10, y: 0, z: 5 }, yaw: 0, hp: 1992, maxHp: 2000 },
            { netId: 65535, kind: 'creep' as const, team: 'red' as const, pos: { x: 1.5, y: 1, z: -2.25 }, yaw: -1.5, hp: 0, maxHp: 200 }
        ];
        const buffer = BinarySerializer.serializeEntityState(120, entities);
        const decoded = BinarySerializer.deserializeEntityState(buffer);

        expect(buffer.byteLength).toBe(7 + 2 * 28);
        expect(decoded.frame).toBe(120);
        expect(decoded.entities).toEqual(entities);
    });
});
