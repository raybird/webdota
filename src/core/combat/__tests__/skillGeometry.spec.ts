import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { instantHitboxCenter, instantHitboxRadius, projectileTouches } from '../skillGeometry';
import { colliderRadius } from '../hurtRadius';
import { HURTBOX, PROJECTILE_RADIUS } from '../../../data/balance';
import { SKILLS } from '../../../data/skills';
import type { Skill } from '../../../types/Skill';

const SELF_SKILLS = ['warrior_w', 'warrior_r', 'assassin_r', 'mage_w'];
const origin = { x: 0, y: 1, z: 0 };
const facingPlusZ = { x: 0, z: 1 };

describe('instantHitboxCenter', () => {
    it.each(SELF_SKILLS)('%s 以施法者為中心', (id) => {
        expect(instantHitboxCenter(SKILLS[id]!, origin, facingPlusZ)).toEqual(origin);
    });

    it('front 技能的圓心在前方 1 單位', () => {
        expect(instantHitboxCenter(SKILLS.basic_attack!, origin, facingPlusZ)).toEqual({ x: 0, y: 1, z: 1 });
    });
});

describe('instantHitboxRadius', () => {
    it('有 aoe 用 aoe，否則為射程 × 0.75', () => {
        expect(instantHitboxRadius(SKILLS.warrior_w!)).toBe(3.6);
        expect(instantHitboxRadius(SKILLS.basic_attack!)).toBeCloseTo(2.25);
    });
});

describe('projectileTouches', () => {
    it('水平距離小於投射物半徑加目標半徑才算碰到', () => {
        const edge = PROJECTILE_RADIUS + HURTBOX.hero.radius;
        expect(projectileTouches({ x: 0, z: 0 }, { x: edge - 0.01, z: 0 }, HURTBOX.hero.radius)).toBe(true);
        expect(projectileTouches({ x: 0, z: 0 }, { x: edge + 0.01, z: 0 }, HURTBOX.hero.radius)).toBe(false);
    });
});

/** 用 Rapier 實際做相交測試，與遊戲內 CollisionSystem 相同 */
describe('受擊範圍與判定相交', () => {
    let world: RAPIER.World;

    beforeAll(async () => {
        await RAPIER.init();
        world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    });

    function hero(x: number, z: number, yaw = 0): RAPIER.Collider {
        const body = world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
                .setTranslation(x, 1, z)
                .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        );
        return world.createCollider(RAPIER.ColliderDesc.cylinder(HURTBOX.hero.halfHeight, HURTBOX.hero.radius), body);
    }

    function hitbox(skill: Skill, direction = facingPlusZ): RAPIER.Collider {
        const center = instantHitboxCenter(skill, origin, direction);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z));
        // 與 CollisionSystem.createHitbox 相同的感測器設定
        const desc = RAPIER.ColliderDesc.ball(instantHitboxRadius(skill))
            .setSensor(true)
            .setActiveCollisionTypes(
                RAPIER.ActiveCollisionTypes.DEFAULT |
                RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED |
                RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC
            );
        return world.createCollider(desc, body);
    }

    function intersects(a: RAPIER.Collider, b: RAPIER.Collider): boolean {
        world.step();
        const hit = world.intersectionPair(a, b);
        world.removeCollider(a, false);
        world.removeCollider(b, false);
        return hit;
    }

    it('英雄受擊範圍是半徑 0.65 的圓柱', () => {
        const collider = hero(0, 0);
        expect(colliderRadius(collider)).toBeCloseTo(HURTBOX.hero.radius);
        world.removeCollider(collider, false);
    });

    it.each(SELF_SKILLS)('%s 打得到身後貼近判定邊緣的敵人', (id) => {
        const skill = SKILLS[id]!;
        const behind = -(instantHitboxRadius(skill) + HURTBOX.hero.radius - 0.1);
        expect(intersects(hitbox(skill), hero(0, behind))).toBe(true);
    });

    it('前方判定打不到身後的敵人', () => {
        expect(intersects(hitbox(SKILLS.basic_attack!), hero(0, -2.5))).toBe(false);
    });

    it('角色轉向不影響命中結果', () => {
        const skill = SKILLS.basic_attack!;
        // 斜前方、剛好在判定邊緣內側的敵人
        const reach = instantHitboxRadius(skill) + HURTBOX.hero.radius - 0.05;
        const target = { x: Math.SQRT1_2 * reach, z: 1 + Math.SQRT1_2 * reach };
        for (const yaw of [0, Math.PI / 4, Math.PI / 2, 2]) {
            expect(intersects(hitbox(skill), hero(target.x, target.z, yaw))).toBe(true);
        }
    });
});
