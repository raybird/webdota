import { describe, it, expect, vi } from 'vitest';
import { World } from '../World';
import type { Component } from '../Component';

const makeComponent = (type: string) => {
    const dispose = vi.fn<() => void>();
    const component: Component = { type, dispose };
    return { ...component, dispose };
};

describe('World.destroyEntity', () => {
    it('disposes each component exactly once even when destroyed twice', () => {
        const world = new World();
        const entity = world.createEntity();
        const physics = makeComponent('Physics');
        world.addComponent(entity, physics);

        // HealthSystem 的延遲刪除與 Manager 可能各自要求銷毀同一個 Entity
        world.removeEntity(entity);
        world.destroyEntity(entity);
        world.update(0);

        expect(physics.dispose).toHaveBeenCalledTimes(1);
        expect(world.hasEntity(entity)).toBe(false);
        expect(world.getComponent(entity, 'Physics')).toBeUndefined();
    });

    it('never hands out the id of a destroyed entity again', () => {
        const world = new World();
        const first = world.createEntity();
        world.destroyEntity(first);
        world.destroyEntity(first);

        const a = world.createEntity();
        const b = world.createEntity();

        expect(a).not.toBe(first);
        expect(b).not.toBe(a);
    });

    it('clear disposes every remaining entity', () => {
        const world = new World();
        const render = makeComponent('Render');
        world.addComponent(world.createEntity(), render);

        world.clear();

        expect(render.dispose).toHaveBeenCalledTimes(1);
    });
});

describe('World.query', () => {
    it('returns only entities that have every requested component', () => {
        const world = new World();
        const both = world.createEntity();
        const onlyA = world.createEntity();
        world.addComponent(both, { type: 'A' });
        world.addComponent(both, { type: 'B' });
        world.addComponent(onlyA, { type: 'A' });

        expect(world.query('A', 'B')).toEqual([both]);
        expect(world.query('A', 'Missing')).toEqual([]);
    });
});
