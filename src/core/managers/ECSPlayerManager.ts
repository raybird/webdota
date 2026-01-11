/**
 * ECSPlayerManager - ECS 版玩家管理器
 * 使用 EntityFactory 與 ECS World 取代 PlayerEntity class
 */

import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import type { UIManager } from '../UIManager';
import { useCharacterStore } from '../../stores/characterStore';
import { useRoomStore } from '../../stores/roomStore';
import { getCharacter } from '../../data/characters';

import {
    World,
    EntityFactory,
    ComponentType,
    HealthComponent,
    TeamComponent,
    RenderComponent,
    PlayerInputComponent,
    SkillComponent,
    CombatComponent,
    InventoryComponent,
    PhysicsComponent,
    type EntityId,
    type Team,
} from '../ecs';

export class ECSPlayerManager {
    private world: World;
    private entityFactory: EntityFactory;
    private uiManager: UIManager;
    private characterStore = useCharacterStore();

    /** 所有玩家 EntityId，以 playerId 為 key */
    private players: Map<string, EntityId> = new Map();

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
        const ui = this.uiManager.createPlayerUI(normalizedId, displayName);

        const render = this.world.getComponent<RenderComponent>(entityId, ComponentType.RENDER);
        if (render && ui.hpBarEntity) {
            render.pcEntity.addChild(ui.hpBarEntity);
        }

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
        this.uiManager.removePlayerUI(normalizedId);
        this.players.delete(normalizedId);

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
     * 取得所有玩家 EntityId
     */
    getAllPlayerIds(): EntityId[] {
        return Array.from(this.players.values());
    }

    /**
     * 取得指定隊伍的玩家
     */
    getPlayersByTeam(team: Team): EntityId[] {
        return Array.from(this.players.values()).filter(id => {
            const teamComp = this.world.getComponent<TeamComponent>(id, ComponentType.TEAM);
            return teamComp?.team === team;
        });
    }

    /**
     * 清除所有玩家
     */
    clearAll(): void {
        for (const [playerId, entityId] of this.players) {
            this.world.destroyEntity(entityId);
            this.uiManager.removePlayerUI(playerId);
        }
        this.players.clear();
        console.log('[ECSPlayerManager] Cleared all players');
    }

    /**
     * 處理玩家移動輸入
     */
    handlePlayerInput(playerId: string, moveX: number, moveZ: number): void {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return;

        const playerInput = this.world.getComponent<PlayerInputComponent>(entityId, ComponentType.PLAYER_INPUT);
        if (playerInput) {
            playerInput.setMoveInput(moveX, moveZ);
        }
    }

    /**
     * 使用技能 (委託給 SkillComponent)
     */
    useSkill(playerId: string, skillId: string): boolean {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return false;

        const skillComp = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (!skillComp) return false;

        const skill = skillComp.useSkill(skillId);
        return skill !== null;
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

    /**
     * 更新邏輯 (由 GameEngine 呼叫)
     * 注意：大部分邏輯由 ECS Systems 處理
     */
    update(dt: number): void {
        void dt; // ECS systems handle player logic

        // 檢查死亡的玩家 (選擇性 - 玩家死亡可能有其他處理邏輯)
        // 這裡先不自動移除，讓 GameEngine 決定如何處理
    }

    // ========== GameEngine 兼容性方法 ==========

    /**
     * 取得玩家的 RigidBody
     */
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

        const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
        if (health) {
            health.currentHp = current;
        }
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
     * 讓玩家受傷
     */
    damagePlayer(playerId: string, damage: number, attackerId?: string): void {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return;

        const health = this.world.getComponent<HealthComponent>(entityId, ComponentType.HEALTH);
        if (health) {
            health.takeDamage(damage, attackerId);
        }
    }

    /**
     * 取得玩家的金幣
     */
    getPlayerGold(playerId: string): number {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return 0;

        const inv = this.world.getComponent<InventoryComponent>(entityId, ComponentType.INVENTORY);
        return inv?.gold ?? 0;
    }

    /**
     * 給予玩家金幣
     */
    givePlayerGold(playerId: string, amount: number): void {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return;

        const inv = this.world.getComponent<InventoryComponent>(entityId, ComponentType.INVENTORY);
        if (inv) {
            inv.earnGold(amount);
        }
    }

    /**
     * 取得玩家的技能列表
     */
    getPlayerSkills(playerId: string): import('../combat/SkillManager').Skill[] {
        const entityId = this.players.get(playerId.toUpperCase());
        if (!entityId) return [];

        const skillComp = this.world.getComponent<SkillComponent>(entityId, ComponentType.SKILL);
        if (!skillComp) return [];

        // 使用公開的 getSkillIds() 和 getSkill()
        return skillComp.getSkillIds()
            .map(id => skillComp.getSkill(id))
            .filter((s): s is import('../combat/SkillManager').Skill => s !== undefined);
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
