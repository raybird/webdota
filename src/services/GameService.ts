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
    // 這裡未來會引用 GameEngine，但為了避免循環依賴，我們暫時不直接引用
    private gameEngine: any

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
        this.networkManager.broadcastGameStarted()
        // 本地狀態更新由 onGameStarted 回調處理
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
        this.gameEngine = new GameEngine()

        // 設置依賴
        this.gameEngine.networkManager = this.networkManager

        // 初始化引擎
        await this.gameEngine.init(canvas)

        // 設置 GameEngine 的引用回 GameService (如果需要)
        // this.gameEngine.gameService = this
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
}
