import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../World';
import { AISystem } from '../AISystem';
import { AIComponent } from '../../components/AIComponent';
import { CombatComponent } from '../../components/CombatComponent';
import { HealthComponent } from '../../components/HealthComponent';
import { TeamComponent } from '../../components/TeamComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { ComponentType } from '../../Component';
import { eventBus } from '../../../../events/EventBus';
import type { TowerAttackEvent } from '../../../../events/GameEvents';

describe('AISystem 防禦塔光彈', () => {
    let world: World;
    let attacks: TowerAttackEvent[];
    let unsubscribe: () => void;

    const spawnTower = () => {
        const id = world.createEntity();
        world.addComponent(id, new TransformComponent({ x: 0, y: 0, z: 0 }));
        world.addComponent(id, new TeamComponent('red'));
        world.addComponent(id, new CombatComponent({ attackPower: 100, attackRange: 12, attackCooldown: 2 }));
        world.addComponent(id, new AIComponent({ aiType: 'tower', attackRange: 12, attackCooldown: 2 }));
        return id;
    };
    const spawnTarget = (x: number) => {
        const id = world.createEntity();
        world.addComponent(id, new TransformComponent({ x, y: 0, z: 0 }));
        world.addComponent(id, new TeamComponent('blue'));
        world.addComponent(id, new HealthComponent({ maxHp: 500, defense: 0 }));
        return id;
    };
    const hpOf = (id: string) => world.getComponent<HealthComponent>(id, ComponentType.HEALTH)!.currentHp;

    beforeEach(() => {
        world = new World();
        world.addSystem(new AISystem());
        attacks = [];
        unsubscribe = eventBus.on('TOWER_ATTACK', (event) => attacks.push(event));
    });
    afterEach(() => unsubscribe());

    it('發射時只發出事件，光彈飛行時間到了才扣血', () => {
        spawnTower();
        const target = spawnTarget(8);

        world.update(0.01);
        expect(attacks).toHaveLength(1);
        expect(attacks[0]!.flightTime).toBeCloseTo(8 / 16);
        expect(hpOf(target)).toBe(500);

        world.update(0.4);
        expect(hpOf(target)).toBe(500);

        world.update(0.2);
        expect(hpOf(target)).toBe(400);
    });

    it('目標在飛行途中被移除時光彈落空，不會出錯', () => {
        spawnTower();
        const target = spawnTarget(8);

        world.update(0.01);
        world.destroyEntity(target);
        expect(() => world.update(1)).not.toThrow();
    });
});
