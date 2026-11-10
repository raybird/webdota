/**
 * 視野計算（docs/gameplay-v2/features/f7-vision.md）
 *
 * 只決定畫面上要不要畫（決策 D3）：所有狀態照常同步，每一端依本地隊伍各自計算。
 * - 視野：每個友方單位有視野半徑，隊伍視野是聯集；以格子計算，格子中心在半徑內就算看得到。
 * - 草叢：草叢內的敵方單位，只有同一叢草裡有我方單位、或它剛在草叢內出手時才看得到。
 * 這裡沒有 PlayCanvas 與 ECS 的依賴，方便單元測試；畫面套用在 FogOfWar.ts。
 */

export interface VisionSource {
    x: number;
    z: number;
    radius: number;
}

export interface GroundRect {
    x: number;
    z: number;
    w: number;
    d: number;
}

export class VisionGrid {
    readonly cols: number;
    readonly rows: number;
    readonly cellSize: number;
    readonly originX: number;
    readonly originZ: number;
    /** 每格是否在視野內（1 = 看得到），索引 row × cols + col，col 沿 x、row 沿 z */
    readonly visible: Uint8Array;

    constructor(size: { w: number; h: number }, cellSize = 1) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(size.w / cellSize);
        this.rows = Math.ceil(size.h / cellSize);
        this.originX = -size.w / 2;
        this.originZ = -size.h / 2;
        this.visible = new Uint8Array(this.cols * this.rows);
    }

    /** 重新計算：清空後把每個視野來源半徑內的格子設為看得到 */
    compute(sources: readonly VisionSource[]): void {
        this.visible.fill(0);
        const cs = this.cellSize;
        for (const s of sources) {
            const r2 = s.radius * s.radius;
            const c0 = Math.max(0, Math.floor((s.x - s.radius - this.originX) / cs));
            const c1 = Math.min(this.cols - 1, Math.floor((s.x + s.radius - this.originX) / cs));
            const r0 = Math.max(0, Math.floor((s.z - s.radius - this.originZ) / cs));
            const r1 = Math.min(this.rows - 1, Math.floor((s.z + s.radius - this.originZ) / cs));
            for (let row = r0; row <= r1; row++) {
                const dz = this.originZ + (row + 0.5) * cs - s.z;
                const base = row * this.cols;
                for (let col = c0; col <= c1; col++) {
                    const dx = this.originX + (col + 0.5) * cs - s.x;
                    if (dx * dx + dz * dz <= r2) this.visible[base + col] = 1;
                }
            }
        }
    }

    /** 這個位置所在的格子是否看得到；地圖外看不到 */
    isVisible(x: number, z: number): boolean {
        const col = Math.floor((x - this.originX) / this.cellSize);
        const row = Math.floor((z - this.originZ) / this.cellSize);
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
        return this.visible[row * this.cols + col] === 1;
    }
}

export class BrushMap {
    private rects: readonly GroundRect[];

    constructor(rects: readonly GroundRect[]) {
        this.rects = rects;
    }

    /** 位置所在的草叢編號；不在草叢內為 -1（邊界算在草叢內） */
    brushAt(x: number, z: number): number {
        for (let i = 0; i < this.rects.length; i++) {
            const r = this.rects[i]!;
            if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return i;
        }
        return -1;
    }
}

export interface ViewedUnit {
    team: string;
    x: number;
    z: number;
    /** 在草叢內出手、暴露中 */
    revealed?: boolean;
}

/**
 * 本地隊伍看不看得到這個單位
 * @param occupiedBrushes 本地隊伍存活單位所在的草叢編號
 */
export function isUnitVisible(
    viewerTeam: string,
    unit: ViewedUnit,
    grid: VisionGrid,
    brushes: BrushMap,
    occupiedBrushes: ReadonlySet<number>
): boolean {
    if (unit.team === viewerTeam) return true;
    if (!grid.isVisible(unit.x, unit.z)) return false;
    const brush = brushes.brushAt(unit.x, unit.z);
    return brush < 0 || occupiedBrushes.has(brush) || unit.revealed === true;
}
