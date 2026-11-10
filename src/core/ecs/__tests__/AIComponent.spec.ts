import { describe, it, expect } from 'vitest';
import * as pc from 'playcanvas';
import { AIComponent } from '../components/AIComponent';

describe('AIComponent 路線', () => {
    it('依序走過中繼點，到終點後停在終點', () => {
        const ai = new AIComponent({ aiType: 'creep' });
        ai.setRoute([new pc.Vec3(1, 0, 1), new pc.Vec3(2, 0, 2), new pc.Vec3(3, 0, 3)]);
        expect(ai.targetPosition?.x).toBe(1);
        expect(ai.advanceWaypoint()).toBe(true);
        expect(ai.targetPosition?.x).toBe(2);
        expect(ai.advanceWaypoint()).toBe(true);
        expect(ai.targetPosition?.x).toBe(3);
        expect(ai.advanceWaypoint()).toBe(false);
        expect(ai.targetPosition?.x).toBe(3);
    });
});
