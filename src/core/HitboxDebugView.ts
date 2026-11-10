/**
 * HitboxDebugView - 除錯模式下在地上畫出受擊範圍與技能判定圈
 *
 * 網址加 ?debug 或按 ` 鍵開啟（utils/debugMode）。
 * 判定只在 Host 建立，所以技能判定圈只有 Host 畫面看得到；受擊範圍每一端都看得到。
 */

import * as pc from 'playcanvas';
import { debugMode } from '../utils/debugMode';
import type { CollisionSystem, DebugCircle } from './ecs/systems/CollisionSystem';

const SEGMENTS = 24;
const Y = 0.06;
const COLOR_BY_TEAM: Record<string, pc.Color> = {
    red: new pc.Color(1, 0.35, 0.35),
    blue: new pc.Color(0.35, 0.7, 1),
    neutral: new pc.Color(0.8, 0.8, 0.8)
};
const COLOR_HITBOX = new pc.Color(1, 0.9, 0.2);

export class HitboxDebugView {
    private app: pc.Application;
    private collisionSystem: CollisionSystem;

    constructor(app: pc.Application, collisionSystem: CollisionSystem) {
        this.app = app;
        this.collisionSystem = collisionSystem;
    }

    update(): void {
        if (!debugMode.value) return;
        const { units, hitboxes } = this.collisionSystem.debugShapes();
        for (const unit of units) this.drawCircle(unit, COLOR_BY_TEAM[unit.team] ?? COLOR_BY_TEAM.neutral!);
        for (const hitbox of hitboxes) this.drawCircle(hitbox, COLOR_HITBOX);
    }

    /** 立即模式畫線：每幀重畫，不需要清理 */
    private drawCircle(circle: DebugCircle, color: pc.Color): void {
        const points: pc.Vec3[] = [];
        for (let i = 0; i < SEGMENTS; i++) {
            const a = (i / SEGMENTS) * Math.PI * 2;
            const b = ((i + 1) / SEGMENTS) * Math.PI * 2;
            points.push(
                new pc.Vec3(circle.x + Math.sin(a) * circle.radius, Y, circle.z + Math.cos(a) * circle.radius),
                new pc.Vec3(circle.x + Math.sin(b) * circle.radius, Y, circle.z + Math.cos(b) * circle.radius)
            );
        }
        this.app.drawLines(points, color, false);
    }
}
