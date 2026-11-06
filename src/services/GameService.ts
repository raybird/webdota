import { useGameStore } from '../stores/gameStore'
import { eventBus } from '../events/EventBus'
import { NetworkManager } from '../core/NetworkManager'
import type { GameEngine } from '../core/GameEngine'
import { getItem } from '../data/items'

/**
 * 遊戲服務
 * 負責遊戲控制邏輯，是 UI 與 GameEngine 之間的介面
 */
export class GameService {
    private gameStore = useGameStore()
    private networkManager: NetworkManager
    // public 以供 UI (如 GameView) 存取引擎
    public gameEngine: GameEngine | null = null

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager
    }

    /**
     * 開始遊戲：引擎透過 GAME_STARTED 事件重置場景並生成玩家
     */
    startGame() {
        this.gameStore.startGame()
        eventBus.emit({ type: 'GAME_STARTED' })
    }

    /**
     * 使用技能（技能按鈕）；鍵盤由 InputManager 發出同一個事件
     */
    useSkill(skillId: string) {
        eventBus.emit({
            type: 'SKILL_USED',
            playerId: this.networkManager.peerId,
            skillId
        })
    }

    getPlayerSkills() {
        return this.gameEngine?.getLocalPlayerSkills() ?? []
    }

    getCooldowns(): Map<string, number> {
        return this.gameEngine?.getLocalPlayerCooldowns() ?? new Map()
    }

    /**
     * 購買物品（目前只在本地背包生效，尚未同步給 Host）
     */
    buyItem(itemId: string): boolean {
        const item = getItem(itemId)
        const inventory = this.getLocalInventory()
        if (!item || !inventory) return false

        const success = inventory.buyItem(item)
        if (success) this.syncInventory()
        return success
    }

    sellItem(slotIndex: number): boolean {
        const inventory = this.getLocalInventory()
        if (!inventory) return false

        const success = inventory.sellItem(slotIndex)
        if (success) this.syncInventory()
        return success
    }

    /**
     * 同步本地玩家的金幣與物品欄到 Store
     */
    syncInventory() {
        const inventory = this.getLocalInventory()
        if (!inventory) return

        if (this.gameStore.gold !== inventory.gold) this.gameStore.setGold(inventory.gold)
        const storeItems = this.gameStore.inventory
        if (inventory.slots.some((item, i) => item !== storeItems[i])) {
            this.gameStore.setInventory([...inventory.slots])
        }
    }

    private getLocalInventory() {
        return this.gameEngine?.playerManager.getInventory(this.networkManager.peerId)
    }

    async init(canvas: HTMLCanvasElement) {
        // 動態導入 GameEngine，讓 PlayCanvas 與 Rapier 只在進入遊戲時載入
        const { GameEngine } = await import('../core/GameEngine')

        this.destroy()
        const engine = new GameEngine(this.networkManager)
        await engine.init(canvas)
        this.gameEngine = engine
    }

    setMobileInput(x: number, y: number) {
        this.gameEngine?.inputManager.setMobileInput(x, y)
    }

    /**
     * 釋放遊戲引擎
     */
    destroy() {
        this.gameEngine?.destroy()
        this.gameEngine = null
    }

    /**
     * 結束遊戲回到大廳；房間連線由呼叫端交給 RoomService 關閉
     */
    leaveGame() {
        this.destroy()
        this.gameStore.reset()
    }
}
