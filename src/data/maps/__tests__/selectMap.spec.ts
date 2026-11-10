import { describe, it, expect } from 'vitest';
import { selectMap } from '..';

describe('selectMap', () => {
    it('預設 arena_v2', () => {
        expect(selectMap('').id).toBe('arena_v2');
    });
    it('?map=demo_arena 換回舊的測試圖', () => {
        expect(selectMap('?debug&map=demo_arena').id).toBe('demo_arena');
    });
    it('不認得的地圖用預設', () => {
        expect(selectMap('?map=nope').id).toBe('arena_v2');
    });
});
