/**
 * EntityFactory.ts - ECS 實體工廠
 * 提供便捷方法建立各類遊戲實體（玩家、小兵、防禦塔）
 */

import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

import { World } from './World';
import type { EntityId } from './Entity';
import { TransformComponent } from './components/TransformComponent';
import { HealthComponent } from './components/HealthComponent';
import { TeamComponent, type Team } from './components/TeamComponent';
import { CombatComponent } from './components/CombatComponent';
import { RenderComponent } from './components/RenderComponent';
import { PhysicsComponent } from './components/PhysicsComponent';
import { AIComponent } from './components/AIComponent';
import { PlayerInputComponent } from './components/PlayerInputComponent';
import { SkillComponent } from './components/SkillComponent';
import { AnimationComponent } from './components/AnimationComponent';
import { InventoryComponent } from './components/InventoryComponent';
import { CollisionSystem } from './systems/CollisionSystem';
import { getSkill } from '../../data/skills';
import { getCharacter } from '../../data/characters';

/**
 * 玩家建立配置
 */
export interface PlayerConfig {
    playerId: string;
    characterId: string;
    team: Team;
    position: { x: number; y: number; z: number };
    color: pc.Color;
    maxHp?: number;
    attackPower?: number;
    defense?: number;
    moveSpeed?: number;
}

/**
 * 小兵建立配置
 */
export interface CreepConfig {
    team: Team;
    position: { x: number; y: number; z: number };
    targetPosition?: { x: number; y: number; z: number };
    maxHp?: number;
    attackPower?: number;
    moveSpeed?: number;
    attackRange?: number;
    attackCooldown?: number;
    isEnemy?: boolean;
}

/**
 * 防禦塔建立配置
 */
export interface TowerConfig {
    team: Team;
    position: { x: number; y: number; z: number };
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
}

/**
 * 主堡建立配置
 */
export interface BaseConfig {
    team: Team;
    position: { x: number; y: number; z: number };
    maxHp?: number;
    attackPower?: number;
    attackRange?: number;
    attackCooldown?: number;
}

/**
 * EntityFactory - 實體工廠
 */
export class EntityFactory {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private world: World;
    private collisionSystem: CollisionSystem | null = null;

    constructor(app: pc.Application, physicsWorld: RAPIER.World, world: World) {
        this.app = app;
        this.physicsWorld = physicsWorld;
        this.world = world;
    }

    /**
     * 設定 CollisionSystem 參考（用於註冊 Entity Collider）
     */
    setCollisionSystem(collisionSystem: CollisionSystem): void {
        this.collisionSystem = collisionSystem;
    }

    /**
     * 建立玩家 Entity
     */
    createPlayer(config: PlayerConfig): EntityId {
        const entityId = this.world.createEntity();

        // Transform
        this.world.addComponent(entityId, new TransformComponent(config.position));

        // Health
        this.world.addComponent(entityId, new HealthComponent({
            maxHp: config.maxHp ?? 1000,
            defense: config.defense ?? 10
        }));

        // Team
        this.world.addComponent(entityId, new TeamComponent(config.team));

        // Combat
        this.world.addComponent(entityId, new CombatComponent({
            attackPower: config.attackPower ?? 50,
            attackRange: 1.5,
            attackCooldown: 0.5,
            moveSpeed: config.moveSpeed ?? 5.0
        }));

        // PlayerInput
        const playerInput = new PlayerInputComponent({
            playerId: config.playerId,
            characterId: config.characterId
        });
        this.world.addComponent(entityId, playerInput);

        // Skill
        const skillComponent = new SkillComponent({
            maxEnergy: 100,
            currentEnergy: 100,
            energyRegenRate: 5
        });
        // 添加角色技能
        const character = getCharacter(config.characterId);
        const basicAttack = getSkill('basic_attack');
        if (basicAttack) skillComponent.addSkill(basicAttack);
        if (character?.skills) {
            character.skills.forEach(skillId => {
                const skill = getSkill(skillId);
                if (skill) skillComponent.addSkill(skill);
            });
        }
        this.world.addComponent(entityId, skillComponent);

        // Animation
        this.world.addComponent(entityId, new AnimationComponent());

        // Inventory
        this.world.addComponent(entityId, new InventoryComponent(500));

        // Physics
        const physics = this.createKinematicBody(config.position, { halfWidth: 0.3, halfHeight: 0.5, halfDepth: 0.3 });
        this.world.addComponent(entityId, physics);

        // 註冊到 CollisionSystem
        if (this.collisionSystem && physics.collider) {
            this.collisionSystem.registerEntityCollider(physics.collider, entityId, config.team);
        }

        // Render (建立視覺模型)
        const pcEntity = this.createPlayerVisual(config.position, config.color);
        this.world.addComponent(entityId, new RenderComponent(pcEntity));

        console.log(`[EntityFactory] Created player ${config.playerId} (${entityId.substring(0, 8)}) team=${config.team}`);

        return entityId;
    }

    /**
     * 建立小兵 Entity
     */
    createCreep(config: CreepConfig): EntityId {
        const entityId = this.world.createEntity();

        // Transform
        this.world.addComponent(entityId, new TransformComponent(config.position));

        // Health
        this.world.addComponent(entityId, new HealthComponent({
            maxHp: config.maxHp ?? 200,
            defense: 2
        }));

        // Team
        this.world.addComponent(entityId, new TeamComponent(config.team));

        // Combat
        this.world.addComponent(entityId, new CombatComponent({
            attackPower: config.attackPower ?? 5,
            attackRange: config.attackRange ?? 1.5,
            attackCooldown: config.attackCooldown ?? 2.0,
            moveSpeed: config.moveSpeed ?? 2.5
        }));

        // AI
        this.world.addComponent(entityId, new AIComponent({
            aiType: 'creep',
            attackRange: config.attackRange ?? 1.5,
            attackCooldown: config.attackCooldown ?? 2.0
        }));

        // Physics
        const physics = this.createKinematicBody(config.position, { halfWidth: 0.3, halfHeight: 0.5, halfDepth: 0.3 });
        this.world.addComponent(entityId, physics);

        // 註冊到 CollisionSystem
        if (this.collisionSystem && physics.collider) {
            this.collisionSystem.registerEntityCollider(physics.collider, entityId, config.team);
        }

        // Render
        const pcEntity = this.createCreepVisual(config.position, config.team);
        this.world.addComponent(entityId, new RenderComponent(pcEntity));

        console.log(`[EntityFactory] Created creep (${entityId.substring(0, 8)}) team=${config.team}`);

        return entityId;
    }

    /**
     * 建立防禦塔 Entity
     */
    createTower(config: TowerConfig): EntityId {
        const entityId = this.world.createEntity();

        // Transform
        this.world.addComponent(entityId, new TransformComponent(config.position));

        // Health
        this.world.addComponent(entityId, new HealthComponent({
            maxHp: config.maxHp ?? 2000,
            defense: 20
        }));

        // Team
        this.world.addComponent(entityId, new TeamComponent(config.team));

        // Combat
        this.world.addComponent(entityId, new CombatComponent({
            attackPower: config.attackPower ?? 80,
            attackRange: config.attackRange ?? 10,
            attackCooldown: config.attackCooldown ?? 2.0,
            moveSpeed: 0
        }));

        // AI
        this.world.addComponent(entityId, new AIComponent({
            aiType: 'tower',
            attackRange: config.attackRange ?? 10,
            attackCooldown: config.attackCooldown ?? 2.0
        }));

        // Physics (靜態)
        const physics = this.createStaticBody(config.position, 1, 2);
        this.world.addComponent(entityId, physics);

        // 註冊到 CollisionSystem
        if (this.collisionSystem && physics.collider) {
            this.collisionSystem.registerEntityCollider(physics.collider, entityId, config.team);
        }

        // Render
        const pcEntity = this.createTowerVisual(config.position, config.team);
        this.world.addComponent(entityId, new RenderComponent(pcEntity));

        console.log(`[EntityFactory] Created tower (${entityId.substring(0, 8)}) team=${config.team}`);

        return entityId;
    }

    /**
     * 建立主堡 Entity
     */
    createBase(config: BaseConfig): EntityId {
        const entityId = this.world.createEntity();

        // Transform
        this.world.addComponent(entityId, new TransformComponent(config.position));

        // Health
        this.world.addComponent(entityId, new HealthComponent({
            maxHp: config.maxHp ?? 5000,
            defense: 30
        }));

        // Team
        this.world.addComponent(entityId, new TeamComponent(config.team));

        // Combat
        this.world.addComponent(entityId, new CombatComponent({
            attackPower: config.attackPower ?? 50,
            attackRange: config.attackRange ?? 8,
            attackCooldown: config.attackCooldown ?? 3.0,
            moveSpeed: 0
        }));

        // AI (主堡具備基本自衛能力)
        this.world.addComponent(entityId, new AIComponent({
            aiType: 'tower', // 暫用 tower AI 邏輯以尋找目標並攻擊
            attackRange: config.attackRange ?? 8,
            attackCooldown: config.attackCooldown ?? 3.0
        }));

        // Physics (靜態剛體, 體積較大)
        const physics = this.createStaticCuboidBody(config.position, 2.5, 3, 2.5);
        this.world.addComponent(entityId, physics);

        // 註冊到 CollisionSystem
        if (this.collisionSystem && physics.collider) {
            this.collisionSystem.registerEntityCollider(physics.collider, entityId, config.team);
        }

        // Render
        const pcEntity = this.createBaseVisual(config.position, config.team);
        this.world.addComponent(entityId, new RenderComponent(pcEntity));

        console.log(`[EntityFactory] Created base (${entityId.substring(0, 8)}) team=${config.team}`);

        return entityId;
    }

    // ==================== 私有方法：物理建立 ====================

    private createKinematicBody(
        position: { x: number; y: number; z: number },
        size: { halfWidth: number; halfHeight: number; halfDepth: number }
    ): PhysicsComponent {
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.halfWidth, size.halfHeight, size.halfDepth);
        const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody);

        const physics = new PhysicsComponent(rigidBody, this.physicsWorld);
        physics.setCollider(collider);

        return physics;
    }

    private createStaticBody(
        position: { x: number; y: number; z: number },
        radius: number,
        halfHeight: number
    ): PhysicsComponent {
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
        const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody);

        const physics = new PhysicsComponent(rigidBody, this.physicsWorld);
        physics.setCollider(collider);

        return physics;
    }

    private createStaticCuboidBody(
        position: { x: number; y: number; z: number },
        halfWidth: number,
        halfHeight: number,
        halfDepth: number
    ): PhysicsComponent {
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth);
        const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody);

        const physics = new PhysicsComponent(rigidBody, this.physicsWorld);
        physics.setCollider(collider);

        return physics;
    }

    // ==================== 私有方法：視覺建立 ====================

    private createPlayerVisual(position: { x: number; y: number; z: number }, color: pc.Color): pc.Entity {
        const entity = new pc.Entity('Player');
        entity.setPosition(position.x, position.y, position.z);

        // 身體
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'box' });
        body.setLocalScale(0.6, 1.0, 0.6);
        body.setLocalPosition(0, 0.5, 0);
        this.applyMaterial(body, color);
        entity.addChild(body);

        // 頭部
        const head = new pc.Entity('Head');
        head.addComponent('render', { type: 'sphere' });
        head.setLocalScale(0.5, 0.5, 0.5);
        head.setLocalPosition(0, 1.25, 0);
        this.applyMaterial(head, new pc.Color(color.r * 1.2, color.g * 1.2, color.b * 1.2));
        entity.addChild(head);

        this.app.root.addChild(entity);
        return entity;
    }

    private createCreepVisual(position: { x: number; y: number; z: number }, team: Team): pc.Entity {
        const entity = new pc.Entity('Creep');
        entity.setPosition(position.x, position.y, position.z);

        const color = this.getTeamColor(team, 0.6);

        // 身體
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'box' });
        body.setLocalScale(0.6, 0.8, 0.6);
        body.setLocalPosition(0, 0.4, 0);
        this.applyMaterial(body, color);
        entity.addChild(body);

        // 頭部
        const head = new pc.Entity('Head');
        head.addComponent('render', { type: 'sphere' });
        head.setLocalScale(0.4, 0.4, 0.4);
        head.setLocalPosition(0, 1, 0);
        this.applyMaterial(head, this.getTeamColor(team, 0.8));
        entity.addChild(head);

        this.app.root.addChild(entity);
        return entity;
    }

    private createTowerVisual(position: { x: number; y: number; z: number }, team: Team): pc.Entity {
        const entity = new pc.Entity('Tower');
        entity.setPosition(position.x, position.y, position.z);

        // 底座
        const base = new pc.Entity('Base');
        base.addComponent('render', { type: 'cylinder' });
        base.setLocalScale(2, 0.5, 2);
        base.setLocalPosition(0, -0.25, 0);
        this.applyMaterial(base, this.getTeamColor(team, 0.3));
        entity.addChild(base);

        // 塔身
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'cylinder' });
        body.setLocalScale(1, 3, 1);
        body.setLocalPosition(0, 1.5, 0);
        this.applyMaterial(body, this.getTeamColor(team, 0.5));
        entity.addChild(body);

        // 塔頂
        const top = new pc.Entity('Top');
        top.addComponent('render', { type: 'sphere' });
        top.setLocalScale(1.5, 1.5, 1.5);
        top.setLocalPosition(0, 3.5, 0);
        this.applyMaterial(top, this.getTeamColor(team, 0.8));
        entity.addChild(top);

        this.app.root.addChild(entity);
        return entity;
    }

    private createBaseVisual(position: { x: number; y: number; z: number }, team: Team): pc.Entity {
        const entity = new pc.Entity('Base');
        entity.setPosition(position.x, position.y, position.z);

        // 主堡底座
        const base = new pc.Entity('Base_Bottom');
        base.addComponent('render', { type: 'cylinder' });
        base.setLocalScale(5, 0.8, 5);
        base.setLocalPosition(0, 0.4, 0);
        this.applyMaterial(base, this.getTeamColor(team, 0.3));
        entity.addChild(base);

        // 主堡主體
        const body = new pc.Entity('Body');
        body.addComponent('render', { type: 'box' });
        body.setLocalScale(3, 4, 3);
        body.setLocalPosition(0, 2.8, 0);
        this.applyMaterial(body, this.getTeamColor(team, 0.5));
        entity.addChild(body);

        // 主堡塔尖
        const top = new pc.Entity('Top');
        top.addComponent('render', { type: 'cone' });
        top.setLocalScale(3.5, 2.5, 3.5);
        top.setLocalPosition(0, 6, 0);
        this.applyMaterial(top, this.getTeamColor(team, 0.7));
        entity.addChild(top);

        // 發光核心
        const core = new pc.Entity('Core');
        core.addComponent('render', { type: 'sphere' });
        core.setLocalScale(1.2, 1.2, 1.2);
        core.setLocalPosition(0, 3.5, 0);
        const coreMaterial = new pc.StandardMaterial();
        const coreColor = this.getTeamColor(team, 1.0);
        coreMaterial.diffuse = coreColor;
        coreMaterial.emissive = coreColor;
        coreMaterial.update();
        if (core.render) {
            core.render.meshInstances.forEach(mi => mi.material = coreMaterial);
        }
        entity.addChild(core);

        this.app.root.addChild(entity);
        return entity;
    }

    private getTeamColor(team: Team, brightness: number): pc.Color {
        if (team === 'red') {
            return new pc.Color(brightness, brightness * 0.3, brightness * 0.3);
        } else if (team === 'blue') {
            return new pc.Color(brightness * 0.3, brightness * 0.3, brightness);
        }
        return new pc.Color(brightness * 0.7, brightness * 0.7, brightness * 0.7);
    }

    private applyMaterial(entity: pc.Entity, color: pc.Color): void {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.emissive = new pc.Color(color.r * 0.2, color.g * 0.2, color.b * 0.2);
        material.update();

        if (entity.render) {
            entity.render.meshInstances.forEach(mi => {
                mi.material = material;
            });
        }
    }
}
