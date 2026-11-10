import { describe, it, expect } from 'vitest';
import { VisionGrid, BrushMap, isUnitVisible } from '../vision';

const SIZE = { w: 96, h: 96 };

describe('視野格子', () => {
    it('半徑內看得到、半徑外看不到', () => {
        const grid = new VisionGrid(SIZE);
        grid.compute([{ x: 0, z: 0, radius: 9 }]);
        expect(grid.isVisible(0, 0)).toBe(true);
        expect(grid.isVisible(8.4, 0)).toBe(true);
        expect(grid.isVisible(10, 0)).toBe(false);
        expect(grid.isVisible(7, 7)).toBe(false);
    });

    it('隊伍視野是聯集', () => {
        const grid = new VisionGrid(SIZE);
        grid.compute([{ x: -20, z: 0, radius: 6 }, { x: 20, z: 0, radius: 6 }]);
        expect(grid.isVisible(-20, 4)).toBe(true);
        expect(grid.isVisible(20, -4)).toBe(true);
        expect(grid.isVisible(0, 0)).toBe(false);
    });

    it('重新計算會清掉舊的視野；地圖外看不到', () => {
        const grid = new VisionGrid(SIZE);
        grid.compute([{ x: 0, z: 0, radius: 9 }]);
        grid.compute([{ x: 40, z: 40, radius: 9 }]);
        expect(grid.isVisible(0, 0)).toBe(false);
        expect(grid.isVisible(40, 40)).toBe(true);
        expect(grid.isVisible(60, 0)).toBe(false);
    });

    it('靠近地圖邊緣的視野不會越界', () => {
        const grid = new VisionGrid(SIZE);
        grid.compute([{ x: -47, z: 47, radius: 12 }]);
        expect(grid.isVisible(-47.5, 47.5)).toBe(true);
    });
});

describe('草叢', () => {
    const brushes = new BrushMap([{ x: 0, z: 0, w: 4, d: 4 }, { x: 10, z: 0, w: 5, d: 4 }]);
    const grid = new VisionGrid(SIZE);
    grid.compute([{ x: 5, z: 0, radius: 9 }]);

    it('判斷所在草叢，邊界算在內', () => {
        expect(brushes.brushAt(0, 0)).toBe(0);
        expect(brushes.brushAt(2, 2)).toBe(0);
        expect(brushes.brushAt(12.5, 0)).toBe(1);
        expect(brushes.brushAt(5, 0)).toBe(-1);
    });

    it('草叢外的敵人在視野內就看得到', () => {
        expect(isUnitVisible('blue', { team: 'red', x: 5, z: 3 }, grid, brushes, new Set())).toBe(true);
    });

    it('草叢內的敵人，同一叢沒有我方單位就看不到', () => {
        expect(isUnitVisible('blue', { team: 'red', x: 0, z: 0 }, grid, brushes, new Set())).toBe(false);
        expect(isUnitVisible('blue', { team: 'red', x: 0, z: 0 }, grid, brushes, new Set([1]))).toBe(false);
    });

    it('同一叢草有我方單位就看得到', () => {
        expect(isUnitVisible('blue', { team: 'red', x: 0, z: 0 }, grid, brushes, new Set([0]))).toBe(true);
    });

    it('草叢內出手暴露時看得到，但仍要在視野內', () => {
        expect(isUnitVisible('blue', { team: 'red', x: 0, z: 0, revealed: true }, grid, brushes, new Set())).toBe(true);
        const far = new VisionGrid(SIZE);
        far.compute([{ x: 40, z: 40, radius: 9 }]);
        expect(isUnitVisible('blue', { team: 'red', x: 0, z: 0, revealed: true }, far, brushes, new Set())).toBe(false);
    });

    it('自己隊伍的單位永遠看得到', () => {
        const none = new VisionGrid(SIZE);
        expect(isUnitVisible('blue', { team: 'blue', x: 0, z: 0 }, none, brushes, new Set())).toBe(true);
    });
});
