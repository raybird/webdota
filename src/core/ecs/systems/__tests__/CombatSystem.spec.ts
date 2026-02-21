import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../World';
import { CombatSystem } from '../CombatSystem';
import { CombatComponent } from '../../components/CombatComponent';

describe('CombatSystem', () => {
    let world: World;
    let combatSystem: CombatSystem;

    beforeEach(() => {
        world = new World();
        combatSystem = new CombatSystem();
        world.addSystem(combatSystem);
    });

    it('should correctly update CombatComponent cooldown timer', () => {
        const entity = world.createEntity();
        const combatComponent = new CombatComponent({ attackCooldown: 2.0 });

        // Simulate attack triggering cooldown
        combatComponent.triggerAttack();
        expect(combatComponent.canAttack()).toBe(false);
        expect(combatComponent.cooldownTimer).toBe(2.0);

        world.addComponent(entity, combatComponent);

        // Step time by 1.0 second
        world.update(1.0);

        expect(combatComponent.cooldownTimer).toBeCloseTo(1.0);
        expect(combatComponent.canAttack()).toBe(false);

        // Step time by another 1.0 second
        world.update(1.0);

        expect(combatComponent.cooldownTimer).toBeLessThanOrEqual(0.0);
        expect(combatComponent.canAttack()).toBe(true);
    });

    it('should not lower cooldown below 0', () => {
        const entity = world.createEntity();
        const combatComponent = new CombatComponent({ attackCooldown: 2.0 });
        world.addComponent(entity, combatComponent);

        // Start from 0 cooldown
        expect(combatComponent.cooldownTimer).toBe(0);

        world.update(5.0);

        expect(combatComponent.cooldownTimer).toBe(0);
    });
});
