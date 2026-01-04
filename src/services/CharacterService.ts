import { useCharacterStore } from '../stores/characterStore'
import { useRoomStore } from '../stores/roomStore'
import { eventBus } from '../events/EventBus'
import { NetworkManager } from '../core/NetworkManager'
import { getAllCharacters, getCharacter } from '../data/characters'
import type { Character } from '../types/Character'

/**
 * 角色服務
 * 負責處理角色選擇與資料獲取
 */
export class CharacterService {
    private characterStore = useCharacterStore()
    private roomStore = useRoomStore()
    private networkManager: NetworkManager

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager
        this.initListeners()
    }

    private initListeners() {
        // 監聯網路事件 - 同時更新 characterStore 和 roomStore
        this.networkManager.onCharacterSelected = (peerId, characterId) => {
            console.log(`[CharacterService] Player ${peerId} selected character ${characterId}`)

            // 更新 CharacterStore
            this.characterStore.setPlayerCharacter(peerId, characterId)

            // 同時更新 RoomStore 的 connectedPlayers
            this.roomStore.updatePlayerCharacter(peerId, characterId)

            // 發送事件
            eventBus.emit({ type: 'CHARACTER_SELECTED', playerId: peerId, characterId })
        }
    }

    /**
     * 獲取所有角色資料
     */
    getAllCharacters(): Character[] {
        return getAllCharacters()
    }

    /**
     * 獲取單一角色資料
     */
    getCharacter(id: string): Character | undefined {
        return getCharacter(id)
    }

    /**
     * 選擇角色
     */
    selectCharacter(characterId: string) {
        const myPeerId = this.networkManager.peerId;
        if (!myPeerId) {
            console.error('[CharacterService] Cannot select character: No peerId');
            return;
        }

        console.log(`[CharacterService] Selecting character ${characterId} for local player ${myPeerId}`);

        // 1. 更新本地 CharacterStore
        this.characterStore.selectCharacter(characterId)
        this.characterStore.setPlayerCharacter(myPeerId, characterId)

        // 2. 更新本地 RoomStore (確保 Host 的 connectedPlayers 有正確資料)
        this.roomStore.updatePlayerCharacter(myPeerId, characterId)

        // 3. 發送網路訊息通知其他人
        this.networkManager.sendCharacterSelected(characterId)

        // 4. 發送本地事件
        eventBus.emit({
            type: 'CHARACTER_SELECTED',
            playerId: myPeerId,
            characterId
        })
    }

    /**
     * 獲取玩家選擇的角色
     */
    getPlayerCharacter(playerId: string): string | undefined {
        return this.characterStore.getPlayerCharacter(playerId)
    }
}
