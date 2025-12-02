import * as pc from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';
import { PlayerEntity } from '../PlayerEntity';
import { UIManager } from '../UIManager';
import { useCharacterStore } from '../../stores/characterStore';
import { getCharacter } from '../../data/characters';

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
        if (this.players.has(playerId)) {
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

        // 獲取角色顏色
        let color = new pc.Color(Math.random(), Math.random(), Math.random());
        const characterId = this.characterStore.getPlayerCharacter(playerId);
        if (characterId) {
            const character = getCharacter(characterId);
            if (character) {
                color = new pc.Color().fromString(character.appearance.color);
            }
        }

        const player = new PlayerEntity(
            playerId,
            this.app,
            this.physicsWorld,
            { x, y: 1, z },
            color
        );

        // 使用 UIManager 建立玩家 UI
        const uiConfig = this.uiManager.createPlayerUI(playerId);
        player.setUIReferences(uiConfig.hpBarEntity, uiConfig.hpBarFillEntity);

        this.players.set(playerId, player);
        console.log(`[PlayerManager] Spawned player ${playerId} at (${x.toFixed(2)}, 1, ${z.toFixed(2)})`);
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
        return this.players.get(playerId);
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
