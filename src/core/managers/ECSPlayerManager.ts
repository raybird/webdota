/**
 * ECSPlayerManager - ECS 版玩家管理器
 * 使用 EntityFactory 與 ECS World 取代 PlayerEntity class
 */

import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Skill } from '../../types/Skill';
import type { UIManager } from '../UIManager';
import { useCharacterStore } from '../../stores/characterStore';
import { useRoomStore } from '../../stores/roomStore';
import { getCharacter } from '../../data/characters';
import { eventBus } from '../../events/EventBus';

import {
    World,
    EntityFactory,
    ComponentType,
    HealthComponent,
    RenderComponent,
    SkillComponent,
    CombatComponent,
    InventoryComponent,
    PhysicsComponent,
    TeamComponent,
    type EntityId,
    type Team,
    HealthSystem,
} from '../ecs';

/** 玩家陣亡後幾秒重生 */
export const RESPAWN_SECONDS = 5;

type Vec3Like = { x: number; y: number; z: number };

export class ECSPlayerManager {
    private world: World;
    private entityFactory: EntityFactory;
    private uiManager: UIManager;
    private characterStore = useCharacterStore();

    /** 所有玩家 EntityId，以 playerId 為 key */
    private players: Map<string, EntityId> = new Map();

    /** 陣亡中的玩家與剩餘重生秒數 */
    private respawnTimers: Map<string, number> = new Map();

    constructor(
        world: World,
        entityFactory: EntityFactory,
        uiManager: UIManager
    ) {
        this.world = world;
        this.entityFactory = entityFactory;
        this.uiManager = uiManager;

        console.log('[ECSPlayerManager] Initialized');
    }

    /**
     * 生成玩家實體
     */
    spawnPlayer(playerId: string, initialPos?: { x: number; y: number; z: number }): EntityId | null {
        // 強制 ID 大寫
        const normalizedId = playerId.toUpperCase();

        if (this.players.has(normalizedId)) {
            console.warn(`[ECSPlayerManager] Player ${normalizedId} already exists`);
            return this.players.get(normalizedId) || null;
        }

        // 計算位置
        let x: number, z: number;
        if (initialPos) {
            x = initialPos.x;
            z = initialPos.z;
        } else {
            // Deterministic Spawn Position based on PeerID
            let hash = 0;
            for (let i = 0; i < playerId.length; i++) {
                hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
            }
            const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
            const radius = 3 + (Math.abs(hash) % 5);
            x = Math.cos(angle) * radius;
            z = Math.sin(angle) * radius;
        }

        // 從 roomStore 取得角色資訊
        const roomStore = useRoomStore();
        const playerInfo = roomStore.connectedPlayers.find(p => p.id.toUpperCase() === normalizedId);

        let characterId = playerInfo?.characterId;
        const playerTeam = (playerInfo?.team || 'neutral') as Team;

        // 如果沒有 characterId，嘗試從 characterStore 取得
        if (!characterId) {
            characterId = this.characterStore.getPlayerCharacter(normalizedId);
        }

        if (!characterId) {
            console.error(`[ECSPlayerManager] Player ${normalizedId} has no characterId! Using default warrior.`);
            characterId = 'warrior';
        }

        // 根據隊伍設定顏色
        let color: pc.Color;
        const myTeam = roomStore.myPlayer?.team;
        const isEnemy = (myTeam === 'red' || myTeam === 'blue') &&
            (playerTeam === 'red' || playerTeam === 'blue') &&
            playerTeam !== myTeam;

        if (isEnemy) {
            color = new pc.Color(0.5, 0.5, 0.5); // 敵方灰色
        } else if (playerTeam === 'red') {
            color = new pc.Color(0.9, 0.3, 0.3);
        } else if (playerTeam === 'blue') {
            color = new pc.Color(0.3, 0.3, 0.9);
        } else {
            // 中立或未分配隊伍使用角色顏色
            const character = getCharacter(characterId);
            if (character) {
                color = new pc.Color().fromString(character.appearance.color);
            } else {
                color = new pc.Color(0.7, 0.7, 0.7);
            }
        }

        // 使用 EntityFactory 建立玩家
        const entityId = this.entityFactory.createPlayer({
            playerId: normalizedId,
            characterId,
            team: playerTeam,
            position: { x, y: 1, z },
            color
        });

        this.players.set(normalizedId, entityId);

        // 建立 UI
        const displayName = normalizedId.substring(0, 8);
        const render = this.world.getComponent<RenderComponent>(entityId, ComponentType.RENDER);
        render?.setHpBar(this.uiManager.createPlayerUI(normalizedId, displayName), 2);

        console.log(`[ECSPlayerManager] Spawned player ${normalizedId} (${entityId.substring(0, 8)}) team=${playerTeam} at (${x.toFixed(2)}, ${z.toFixed(2)})`);

        return entityId;
    }

    /**
     * 移除玩家
     */
    removePlayer(playerId: string): void {
        const normalizedId = playerId.toUpperCase();
        const entityId = this.players.get(normalizedId);

        if (!entityId) return;

        this.world.destroyEntity(entityId);
        this.players.delete(normalizedId);
        this.respawnTimers.delete(normalizedId);

        console.log(`[ECSPlayerManager] Removed player ${normalizedId}`);
    }

    /**
     * 取得玩家 EntityId
     */
    getPlayer(playerId: string): EntityId | undefined {
        return this.players.get(playerId.toUpperCase());
    }

    /**
     * 取得所有玩家 playerId -> EntityId 的 Map
     */
    getAllPlayers(): Map<string, EntityId> {
        return this.players;
    }

    /**
     * 清除所有玩家
     */
    clearAll(): void {
        for (const entityId of this.players.values()) {
            this.world.destroyEntity(entityId);
        }
        this.players.clear();
        this.respawnTimers.clear();
        console.log('[ECSPlayerManager] Cleared all players');
    }

    /**
     * 每幀更新：偵測陣亡並隱藏玩家、停用碰撞；權威端倒數結束後在 respawnAt 回傳的位置重生
     * Client 不自行重生，等 Host 的血量恢復後才顯示
     */
    update(dt: number, authoritative: boolean, respawnAt: (team: Team) => Vec3Like): void {
        for (const [playerId, entityId] of this.players) {
            const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
            if (!health) continue;

            const remaining = this.respawnTimers.get(playerId);
            if (remaining === undefined) {
                if (!health.isDead()) continue;
                this.respawnTimers.set(playerId, RESPAWN_SECONDS);
                this.setAlive(entityId, false);
                eventBus.emit({ type: 'ENTITY_DIED', entityId, killerId: health.lastAttackerId });
                continue;
            }

            if (!health.isDead()) {
                // Client：Host 已讓玩家重生
                this.respawnTimers.delete(playerId);
                this.setAlive(entityId, true);
                continue;
            }

            const left = Math.max(0, remaining - dt);
            if (left > 0 || !authoritative) {
                this.respawnTimers.set(playerId, left);
                continue;
            }

            const team = this.world.getComponent<TeamComponent>(entityId, ComponentType.TEAM)?.team ?? 'neutral';
            this.respawn(entityId, respawnAt(team));
            this.respawnTimers.delete(playerId);
        }
    }

    private respawn(entityId: EntityId, position: Vec3Like): void {
        const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
        if (health) {
            health.currentHp = health.maxHp;
            health.lastAttackerId = null;
        }
        const skill = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (skill) skill.currentEnergy = skill.maxEnergy;

        const rb = this.world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS)?.rigidBody;
        rb?.setTranslation(position, true);
        rb?.setNextKinematicTranslation(position);
        this.setAlive(entityId, true);
    }

    private setAlive(entityId: EntityId, alive: boolean): void {
        this.world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS)?.rigidBody.setEnabled(alive);
        this.world.getComponent<RenderComponent>(entityId, ComponentType.RENDER)?.setVisible(alive);
    }

    isDead(playerId: string): boolean {
        return this.respawnTimers.has(playerId.toUpperCase());
    }

    /**
     * 陣亡玩家的剩餘重生秒數；存活時為 null
     */
    getRespawnRemaining(playerId: string): number | null {
        return this.respawnTimers.get(playerId.toUpperCase()) ?? null;
    }

    /**
     * 使用技能 (委託給 SkillComponent)
     */
    useSkill(playerId: string, skillId: string): Skill | null {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return null;

        const skillComp = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (!skillComp) return null;

        return skillComp.useSkill(skillId);
    }

    /**
     * 取得玩家位置 (透過物理組件)
     */
    getPlayerPosition(playerId: string): pc.Vec3 | null {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return null;

        const physics = this.world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        if (physics?.rigidBody) {
            const pos = physics.rigidBody.translation();
            return new pc.Vec3(pos.x, pos.y, pos.z);
        }
        return null;
    }

    // ========== GameEngine 兼容性方法 ==========

    /**
     * 取得玩家的 RigidBody
     */
    getInventory(playerId: string): InventoryComponent | undefined {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return undefined;
        return this.world.getComponent<InventoryComponent>(entityId, ComponentType.INVENTORY);
    }

    getPlayerRigidBody(playerId: string): RAPIER.RigidBody | null {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return null;

        const physics = this.world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        return physics?.rigidBody || null;
    }

    /**
     * 取得玩家的移動速度
     */
    getPlayerMoveSpeed(playerId: string): number {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return 5.0;

        const combat = this.world.getComponent<CombatComponent>(entityId, ComponentType.COMBAT);
        return combat?.moveSpeed ?? 5.0;
    }

    /**
     * 取得玩家的 HP
     */
    getPlayerHp(playerId: string): { current: number; max: number } | null {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return null;

        const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
        if (!health) return null;

        return { current: health.currentHp, max: health.maxHp };
    }

    /**
     * 設定玩家的 HP
     */
    setPlayerHp(playerId: string, current: number): void {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return;

        HealthSystem.syncHp(this.world, entityId, current);
    }

    /**
     * 取得玩家的能量
     */
    getPlayerEnergy(playerId: string): { current: number; max: number } | null {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return null;

        const skill = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (!skill) return null;

        return { current: skill.currentEnergy, max: skill.maxEnergy };
    }

    /**
     * 設定玩家的能量
     */
    setPlayerEnergy(playerId: string, current: number): void {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return;

        const skill = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (skill) {
            skill.currentEnergy = current;
        }
    }

    /**
     * 取得玩家的技能列表
     */
    getPlayerSkills(playerId: string): Skill[] {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return [];

        const skillComp = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (!skillComp) return [];

        // 使用公開的 getSkillIds() 和 getSkill()
        return skillComp.getSkillIds()
            .map(id => skillComp.getSkill(id))
            .filter((s): s is Skill => s !== undefined);
    }

    /**
     * 取得玩家技能冷卻時間
     */
    getPlayerSkillCooldowns(playerId: string): Map<string, { current: number; max: number }> {
        const result = new Map<string, { current: number; max: number }>();
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return result;

        const skillComp = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (!skillComp) return result;

        // 使用公開的 getCooldowns() 方法
        const cooldowns = skillComp.getCooldowns();
        for (const skillId of skillComp.getSkillIds()) {
            const skill = skillComp.getSkill(skillId);
            const cdRemaining = cooldowns.get(skillId) || 0;
            result.set(skillId, {
                current: cdRemaining,
                max: skill?.cooldown ?? 0
            });
        }

        return result;
    }

    /**
     * 取得玩家朝向方向
     */
    getPlayerFacingDirection(playerId: string): pc.Vec3 | null {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return null;

        const rb = this.world.getComponent<PhysicsComponent>(entityId, ComponentType.PHYSICS);
        if (!rb?.rigidBody) return null;

        const rot = rb.rigidBody.rotation();
        const q = new pc.Quat(rot.x, rot.y, rot.z, rot.w);
        const forward = new pc.Vec3(0, 0, 1);
        q.transformVector(forward, forward);
        return forward;
    }
}
