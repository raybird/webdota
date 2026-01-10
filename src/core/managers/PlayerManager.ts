import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { PlayerEntity } from '../PlayerEntity';
import { UIManager } from '../UIManager';
import { useCharacterStore } from '../../stores/characterStore';
import { useRoomStore } from '../../stores/roomStore';
import { getCharacter } from '../../data/characters';
import type { Team } from '../entities/CombatEntity';

/**
 * 玩家管理器
 * 負責玩家實體的生成、移除與管理
 */
export class PlayerManager {
    private app: pc.Application;
    private physicsWorld: RAPIER.World;
    private uiManager: UIManager;
    private players: Map<string, PlayerEntity> = new Map();
    private characterStore = useCharacterStore();

    constructor(app: pc.Application, physicsWorld: RAPIER.World, uiManager: UIManager) {
        this.app = app;
        this.physicsWorld = physicsWorld;
        this.uiManager = uiManager;
    }

    /**
     * 生成玩家實體
     */
    spawnPlayer(playerId: string, initialPos?: { x: number, y: number, z: number }) {
        // 強制 ID 大寫
        const normalizedId = playerId.toUpperCase();

        if (this.players.has(normalizedId)) {
            return;
        }

        let x, z;

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

        // 獲取角色顏色和名稱 - 優先從 roomStore 讀取以確保同步
        let characterName = 'Player'; // 預設名稱

        // 從 roomStore 取得角色資訊（確保同步）- 使用大寫比較
        const roomStore = useRoomStore();
        const playerInfo = roomStore.connectedPlayers.find(p => p.id.toUpperCase() === normalizedId);

        let characterId = playerInfo?.characterId;
        const playerTeam = playerInfo?.team || 'neutral';

        // 如果 roomStore 沒資料（可能是比賽剛開始同步延遲），嘗試從 characterStore 補救
        if (!characterId) {
            characterId = this.characterStore.getPlayerCharacter(normalizedId);
            console.warn(`[PlayerManager] Player ${normalizedId} characterId not found in roomStore, falling back to characterStore: ${characterId}`);
        }

        // 根據隊伍設定顏色 (強制與敵我識別)
        let color: pc.Color;
        const myTeam = roomStore.myPlayer?.team;

        // 判斷是否為敵方：自己有隊伍、對方有隊伍、且隊伍不同
        const isEnemy = (myTeam === 'red' || myTeam === 'blue') &&
            (playerTeam === 'red' || playerTeam === 'blue') &&
            playerTeam !== myTeam;

        if (isEnemy) {
            color = new pc.Color(0.5, 0.5, 0.5); // 敵方顯示為灰色
            console.log(`[PlayerManager] Player ${normalizedId} is ENEMY (Local: ${myTeam}, Remote: ${playerTeam}), setting color to GRAY`);
        } else if (playerTeam === 'red') {
            color = new pc.Color(0.9, 0.3, 0.3); // 紅隊 - 鮮明紅色
        } else if (playerTeam === 'blue') {
            color = new pc.Color(0.3, 0.3, 0.9); // 藍隊 - 鮮明藍色
        } else {
            // Neutral 或未分配隊伍時使用角色顏色
            if (characterId) {
                const character = getCharacter(characterId);
                if (character) {
                    color = new pc.Color().fromString(character.appearance.color);
                } else {
                    color = new pc.Color(0.7, 0.7, 0.7);
                }
            } else {
                color = new pc.Color(0.7, 0.7, 0.7);
            }
        }

        if (!characterId) {
            console.error(`[PlayerManager] Player ${playerId} has no characterId! Using default warrior.`);
            characterId = 'warrior';
        }

        console.log(`[PlayerManager] Spawning player ${normalizedId} Team=${playerTeam} CharacterID: ${characterId}, Color: r=${color.r.toFixed(2)}, g=${color.g.toFixed(2)}, b=${color.b.toFixed(2)}`);

        const player = new PlayerEntity(
            normalizedId, // 使用大寫 ID
            characterId || 'warrior', // Pass characterId
            playerTeam as Team, // Pass team
            this.app,
            this.physicsWorld,
            { x, y: 1, z },
            color
        );

        // 使用 UIManager 建立玩家 UI（顯示 Player ID 前 8 碼）
        const displayName = normalizedId.substring(0, 8);
        const uiConfig = this.uiManager.createPlayerUI(normalizedId, displayName);
        player.setUIReferences(uiConfig.hpBarEntity, uiConfig.hpBarFillEntity);

        this.players.set(normalizedId, player);
        console.log(`[PlayerManager] Spawned player ${normalizedId} (${characterName}) at (${x.toFixed(2)}, 1, ${z.toFixed(2)})`);
    }

    /**
     * 移除玩家實體
     */
    removePlayer(playerId: string) {
        const player = this.players.get(playerId);
        if (player) {
            player.destroy(this.app, this.physicsWorld);
            this.players.delete(playerId);

            // 移除 UI
            this.uiManager.removePlayerUI(playerId);

            console.log(`[PlayerManager] Removed player ${playerId}`);
        }
    }

    /**
     * 獲取玩家實體
     */
    getPlayer(playerId: string): PlayerEntity | undefined {
        return this.players.get(playerId.toUpperCase());
    }

    /**
     * 獲取所有玩家實體
     */
    getAllPlayers(): Map<string, PlayerEntity> {
        return this.players;
    }

    /**
     * 清除所有玩家
     */
    clearAll() {
        this.players.forEach((_, id) => this.removePlayer(id));
    }
}
