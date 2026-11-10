/**
 * FogOfWar - 把視野計算套用到畫面（docs/gameplay-v2/features/f7-vision.md）
 *
 * 只改畫面（決策 D3）：每一端依本地隊伍計算，資料照常同步與模擬。
 * - 每 0.1 秒以友方英雄、小兵、建築的視野算出格子，敵方英雄與小兵在視野外、或躲在草叢裡時隱藏
 *   （RenderComponent.setFogHidden，模型與血條一起；小地圖、傷害數字、特效由 isVisible 判斷）。
 * - 建築永遠可見。我方單位在草叢內時半透明，表示敵人看不到。
 * - 視野外的地面變暗：算出每個格點的亮度交給地面網格的頂點色（PixelMapSkin.setGroundShade），
 *   格點之間線性內插，邊緣柔和；每幀往目標值淡入淡出。不另外畫一層半透明平面（M5 實測全畫面混色在手機模擬下掉幀約 30%）。
 */

import { VISION } from '../../data/balance';
import { BrushMap, VisionGrid, isUnitVisible, type VisionSource } from './vision';
import { ComponentType, RenderComponent, TeamComponent, TransformComponent, type EntityId, type Team, type World } from '../ecs';
import type { MapConfig } from '../map/MapData';

/** 視野外地面的亮度（R、G、B 各自乘上，偏藍一點） */
const FOG_SHADE = [0.42, 0.44, 0.55] as const;
/** 每秒淡入淡出的量（0～1，約 0.25 秒完成） */
const FADE_PER_SECOND = 4;
/** 地面頂點色最快多久更新一次（秒） */
const SHADE_INTERVAL = 0.05;

/** 收到地面每個格點的顏色（RGBA；格點每 VISION.shadeStep 單位一個，row 沿 z、col 沿 x） */
export type GroundShadeSink = (colors: Uint8Array) => void;

export interface FogContext {
    localTeam: Team | null;
    players: ReadonlyMap<string, EntityId>;
    isDead(playerId: string): boolean;
    creeps: ReadonlySet<EntityId>;
    structures: ReadonlyMap<EntityId, { kind: string; team: Team }>;
}

export class FogOfWar {
    private world: World;
    private grid: VisionGrid | null = null;
    private brushes = new BrushMap([]);
    /** 每格目前的迷霧量（0 看得到～1 看不到），逐格淡入淡出 */
    private fogAmount: Float32Array = new Float32Array(0);
    private shadeColors: Uint8Array = new Uint8Array(0);
    private shadeDirty = false;
    private shadeElapsed = 0;
    private shadeSink: GroundShadeSink | null = null;
    private shadeCols = 0;
    private shadeRows = 0;
    private elapsed = Infinity;
    private time = 0;
    /** 在草叢內出手的單位與暴露到的時間 */
    private revealUntil = new Map<EntityId, number>();
    private hidden = new Set<EntityId>();
    private active = false;

    constructor(world: World) {
        this.world = world;
    }

    /** 地面頂點色的接收者（地圖的像素圖層）；沒有像素地面時不畫迷霧，只隱藏單位 */
    setGroundShadeSink(sink: GroundShadeSink | null): void {
        this.shadeSink = sink;
        this.shadeDirty = true;
    }

    /** 換地圖或開局：建立格子與草叢 */
    setMap(config: MapConfig): void {
        this.grid = new VisionGrid(config.size, VISION.cellSize);
        this.brushes = new BrushMap(config.brush ?? []);
        this.fogAmount = new Float32Array(this.grid.cols * this.grid.rows).fill(1);
        this.shadeCols = Math.ceil(config.size.w / VISION.shadeStep) + 1;
        this.shadeRows = Math.ceil(config.size.h / VISION.shadeStep) + 1;
        this.shadeColors = new Uint8Array(this.shadeCols * this.shadeRows * 4);
        this.shadeDirty = true;
        this.revealUntil.clear();
        this.hidden.clear();
        this.elapsed = Infinity;
        this.active = false;
    }

    /** 單位出手：在草叢內的話暴露一段時間（各端都會呼叫） */
    reveal(entityId: EntityId, seconds: number = VISION.revealSeconds): void {
        this.revealUntil.set(entityId, this.time + seconds);
    }

    /** 本地玩家看不看得到這個單位（建築與沒有隊伍的實體永遠看得到） */
    isVisible(entityId: EntityId): boolean {
        return !this.hidden.has(entityId);
    }

    /** 位置所在的草叢編號（不在草叢為 -1） */
    brushAt(x: number, z: number): number {
        return this.brushes.brushAt(x, z);
    }

    update(dt: number, ctx: FogContext): void {
        this.time += dt;
        if (!this.grid) return;
        if (!ctx.localTeam) {
            this.setActive(false, ctx);
            return;
        }
        this.setActive(true, ctx);

        this.elapsed += dt;
        if (this.elapsed >= VISION.updateInterval) {
            this.elapsed = 0;
            this.recompute(ctx.localTeam, ctx);
        }
        this.fade(dt);
        this.shadeElapsed += dt;
        // 地圖圖層重建（視角確定）後地面會回到全亮，所以沒有變化時也每 0.5 秒送一次
        if ((this.shadeDirty && this.shadeElapsed >= SHADE_INTERVAL) || this.shadeElapsed >= 0.5) {
            this.shadeElapsed = 0;
            this.shadeDirty = false;
            this.pushShade();
        }
    }

    destroy(): void {
        this.grid = null;
        this.shadeSink = null;
    }

    private recompute(team: Team, ctx: FogContext): void {
        const grid = this.grid!;
        for (const [id, until] of this.revealUntil) if (until <= this.time) this.revealUntil.delete(id);

        // 視野來源與我方佔住的草叢
        const sources: VisionSource[] = [];
        const occupied = new Set<number>();
        const units: { id: EntityId; team: Team; x: number; z: number }[] = [];
        const addUnit = (id: EntityId, radius: number) => {
            const pos = this.world.getComponent<TransformComponent>(id, ComponentType.TRANSFORM)?.position;
            const unitTeam = this.teamOf(id);
            if (!pos || !unitTeam) return;
            units.push({ id, team: unitTeam, x: pos.x, z: pos.z });
            if (unitTeam !== team) return;
            sources.push({ x: pos.x, z: pos.z, radius });
            const brush = this.brushes.brushAt(pos.x, pos.z);
            if (brush >= 0) occupied.add(brush);
        };
        for (const [playerId, id] of ctx.players) if (!ctx.isDead(playerId)) addUnit(id, VISION.heroRadius);
        for (const id of ctx.creeps) addUnit(id, VISION.creepRadius);
        for (const [id, s] of ctx.structures) {
            if (s.team !== team) continue;
            const pos = this.world.getComponent<TransformComponent>(id, ComponentType.TRANSFORM)?.position;
            if (pos) sources.push({ x: pos.x, z: pos.z, radius: s.kind === 'base' ? VISION.baseRadius : VISION.towerRadius });
        }
        grid.compute(sources);

        this.hidden.clear();
        for (const unit of units) {
            const render = this.world.getComponent<RenderComponent>(unit.id, ComponentType.RENDER);
            const revealed = this.revealUntil.has(unit.id);
            if (unit.team === team) {
                render?.setFogHidden(false);
                render?.setConcealed(!revealed && this.brushes.brushAt(unit.x, unit.z) >= 0);
                continue;
            }
            const visible = isUnitVisible(team, { ...unit, revealed }, grid, this.brushes, occupied);
            render?.setFogHidden(!visible);
            render?.setConcealed(false);
            if (!visible) this.hidden.add(unit.id);
        }
    }

    /** 沒有本地隊伍（觀戰、尚未分隊）時全部顯示、不畫遮罩 */
    private setActive(active: boolean, ctx: FogContext): void {
        if (this.active === active) return;
        this.active = active;
        if (active) return;
        // 地面回到原本的亮度
        this.fogAmount.fill(0);
        this.pushShade();
        const all = [...ctx.players.values(), ...ctx.creeps];
        for (const id of all) {
            const render = this.world.getComponent<RenderComponent>(id, ComponentType.RENDER);
            render?.setFogHidden(false);
            render?.setConcealed(false);
        }
        this.hidden.clear();
    }

    private fade(dt: number): void {
        if (!this.grid) return;
        const step = FADE_PER_SECOND * dt;
        const visible = this.grid.visible;
        const fog = this.fogAmount;
        for (let i = 0; i < fog.length; i++) {
            const target = visible[i] ? 0 : 1;
            const f = fog[i]!;
            if (f === target) continue;
            fog[i] = f < target ? Math.min(target, f + step) : Math.max(target, f - step);
            this.shadeDirty = true;
        }
    }

    /** 每個格點取周圍格子（格點間距內）的平均迷霧量，換成地面顏色 */
    private pushShade(): void {
        if (!this.grid || !this.shadeSink) return;
        const { cols, rows } = this.grid;
        const fog = this.fogAmount;
        const colors = this.shadeColors;
        // 格點間距換算成視野格子數（間距 2、格子 1 → 格點周圍 2×2 格）
        const k = Math.max(1, Math.round(VISION.shadeStep / this.grid.cellSize));
        const half = Math.max(1, Math.floor(k / 2));
        for (let vr = 0; vr < this.shadeRows; vr++) {
            for (let vc = 0; vc < this.shadeCols; vc++) {
                let sum = 0, n = 0;
                for (let r = vr * k - half; r <= vr * k + half - 1; r++) {
                    if (r < 0 || r >= rows) continue;
                    for (let c = vc * k - half; c <= vc * k + half - 1; c++) {
                        if (c < 0 || c >= cols) continue;
                        sum += fog[r * cols + c]!;
                        n++;
                    }
                }
                const f = n ? sum / n : 0;
                const o = (vr * this.shadeCols + vc) * 4;
                colors[o] = 255 * (1 - f * (1 - FOG_SHADE[0]));
                colors[o + 1] = 255 * (1 - f * (1 - FOG_SHADE[1]));
                colors[o + 2] = 255 * (1 - f * (1 - FOG_SHADE[2]));
                colors[o + 3] = 255;
            }
        }
        this.shadeSink(colors);
    }

    private teamOf(id: EntityId): Team | undefined {
        return this.world.getComponent<TeamComponent>(id, ComponentType.TEAM)?.team;
    }
}
