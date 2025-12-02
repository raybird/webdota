import type { GameEvent } from './GameEvents'

/**
 * 全局事件總線
 * 用於解耦組件和模組之間的通信
 */
class EventBus {
    private listeners: Map<string, Set<(event: any) => void>> = new Map()

    /**
     * 發送事件
     */
    emit<T extends GameEvent>(event: T): void {
        const eventType = event.type
        const handlers = this.listeners.get(eventType)

        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event)
                } catch (error) {
                    console.error(`[EventBus] Error handling event ${eventType}:`, error)
                }
            })
        }

        // Debug 日誌
        console.log(`[EventBus] Emitted: ${eventType}`, event)
    }

    /**
     * 訂閱事件
     */
    on<T extends GameEvent['type']>(
        eventType: T,
        handler: (event: Extract<GameEvent, { type: T }>) => void
    ): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set())
        }

        this.listeners.get(eventType)!.add(handler)

        // 返回取消訂閱函數
        return () => this.off(eventType, handler)
    }

    /**
     * 取消訂閱事件
     */
    off(eventType: string, handler: (event: any) => void): void {
        const handlers = this.listeners.get(eventType)
        if (handlers) {
            handlers.delete(handler)
            if (handlers.size === 0) {
                this.listeners.delete(eventType)
            }
        }
    }

    /**
     * 取消所有訂閱
     */
    clear(): void {
        this.listeners.clear()
    }

    /**
     * 獲取所有事件類型的訂閱數量（用於除錯）
     */
    getStats(): Record<string, number> {
        const stats: Record<string, number> = {}
        this.listeners.forEach((handlers, eventType) => {
            stats[eventType] = handlers.size
        })
        return stats
    }
}

// 創建全局單例
export const eventBus = new EventBus()

// 開發環境下暴露到 window
if (import.meta.env.DEV) {
    (window as any).eventBus = eventBus
}
