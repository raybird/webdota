import { useGameStore } from '../stores/gameStore'
import { eventBus } from '../events/EventBus'
import { NetworkManager } from '../core/NetworkManager'

/**
 * 遊戲服務
 * 負責遊戲控制邏輯
 */
export class GameService {
    private gameStore = useGameStore()
    private networkManager: NetworkManager
    // 改為 public 以供 UI (如 GameView) 存取引擎管理器
    public gameEngine: any

    constructor(networkManager: NetworkManager) {
        this.networkManager = networkManager
        this.initListeners()
    }

    setGameEngine(engine: any) {
        this.gameEngine = engine
    }

    private initListeners() {
        this.networkManager.onGameStarted = () => {
            this.gameStore.startGame()
            eventBus.emit({ type: 'GAME_STARTED' })
        }
    }

    /**
     * 開始遊戲 (Host Only)
     */
    startGame() {
        console.log('[GameService] startGame called')
        this.gameStore.startGame()
        eventBus.emit({ type: 'GAME_STARTED' })
    }

    /**
     * 使用技能
     */
    useSkill(skillId: string) {
        if (this.gameEngine) {
            this.gameEngine.useSkill(skillId)
            eventBus.emit({
                type: 'SKILL_USED',
                playerId: this.networkManager.peerId,
                skillId
            })
        }
    }

    /**
     * 獲取本地玩家技能
     */
    getPlayerSkills() {
        if (this.gameEngine) {
            return this.gameEngine.getLocalPlayerSkills()
        }
        return []
    }

    /**
     * 獲取本地玩家技能冷卻
     */
    getCooldowns(): Map<string, number> {
        if (this.gameEngine) {
            return this.gameEngine.getLocalPlayerCooldowns()
        }
        return new Map()
    }

    /**
     * 更新遊戲狀態 (每幀調用)
     */
    updateState(frame: number) {
        this.gameStore.setFrame(frame)
    }

    /**
     * 更新玩家屬性
     */
    updatePlayerStats(health: number, maxHealth: number, mana: number, maxMana: number) {
        this.gameStore.setHealth(health)
        this.gameStore.setMaxHealth(maxHealth)
        this.gameStore.setMana(mana)
        this.gameStore.setMaxMana(maxMana)
    }
    /**
     * 初始化遊戲引擎
     */
    async init(canvas: HTMLCanvasElement) {
        // 動態導入 GameEngine 以避免循環依賴
        const { GameEngine } = await import('../core/GameEngine')

        // 傳入 NetworkManager 給 GameEngine
        this.gameEngine = new GameEngine(this.networkManager)

        // 初始化引擎
        await this.gameEngine.init(canvas)

        console.log('[GameService] GameEngine initialized with shared NetworkManager')
    }

    /**
     * 清理資源
     */
    destroy() {
        if (this.gameEngine) {
            // this.gameEngine.destroy() // 假設 GameEngine 有 destroy 方法
            this.gameEngine = null
        }
    }

    /**
     * 設置行動裝置輸入
     */
    setMobileInput(x: number, y: number) {
        if (this.gameEngine && this.gameEngine.inputManager) {
            this.gameEngine.inputManager.setMobileInput(x, y)
        }
    }

    /**
     * 離開房間
     */
    leaveRoom() {
        if (this.gameEngine) {
            this.gameEngine.app?.destroy()
            this.gameEngine = null
        }
        const roomStore = (window as any).roomStore // 或使用 EventBus 通知 RoomView
        if (roomStore && roomStore.leaveRoom) {
            roomStore.leaveRoom()
        } else {
            // 回落機制：透過事件總線通知
            eventBus.emit({ type: 'ROOM_LEFT' })
        }
    }
}
