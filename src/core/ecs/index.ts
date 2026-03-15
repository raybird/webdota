/**
 * ECS 模組入口
 * 匯出所有 ECS 核心類別與工具
 */

// Core
export { type EntityId, createEntityId, isValidEntityId } from './Entity';
export { type Component, ComponentType, type ComponentTypeName } from './Component';
export { System } from './System';
export { World } from './World';
export { colliderRegistry, ColliderRegistry, type ColliderMetadata, type ColliderType } from './ColliderMetadata';

// Components
export { TransformComponent } from './components/TransformComponent';
export { HealthComponent } from './components/HealthComponent';
export { TeamComponent, type Team } from './components/TeamComponent';
export { CombatComponent } from './components/CombatComponent';
export { RenderComponent } from './components/RenderComponent';
export { PhysicsComponent } from './components/PhysicsComponent';
export { AIComponent, type AIType } from './components/AIComponent';
export { PlayerInputComponent } from './components/PlayerInputComponent';
export { SkillComponent, type SkillState } from './components/SkillComponent';
export { AnimationComponent, type AnimationType, type AnimationState } from './components/AnimationComponent';
export { InventoryComponent, type ItemStats } from './components/InventoryComponent';
export { PoolableComponent } from './components/PoolableComponent';

// Systems
export { MovementSystem } from './systems/MovementSystem';
export { RenderSystem } from './systems/RenderSystem';
export { HealthSystem } from './systems/HealthSystem';
export { CombatSystem } from './systems/CombatSystem';
export { CollisionSystem, type HitEvent } from './systems/CollisionSystem';
export { AISystem } from './systems/AISystem';
export { PlayerInputSystem } from './systems/PlayerInputSystem';
export { SkillSystem } from './systems/SkillSystem';

// Factory
export { EntityFactory, type PlayerConfig, type CreepConfig, type TowerConfig } from './EntityFactory';
export * from './systems/SpatialSystem';
export * from './MaterialCache';
