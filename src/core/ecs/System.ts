/**
 * System.ts - ECS System 基底類別
 * System 包含遊戲邏輯，對擁有特定 Components 的 Entity 進行操作
 */

import type { World } from './World';

/**
 * System 基底抽象類別
 */
export abstract class System {
    /** System 名稱（用於除錯） */
    abstract readonly name: string;

    /** 此 System 需要的 Component 類型 */
    abstract readonly requiredComponents: readonly string[];

    /** System 優先順序（數字越小越先執行） */
    priority: number = 0;

    /** 是否啟用 */
    enabled: boolean = true;

    /**
     * 每幀更新
     * @param world ECS World 參考
     * @param dt Delta time (秒)
     */
    abstract update(world: World, dt: number): void;

    /**
     * System 初始化（可選覆寫）
     */
    init(_world: World): void { }

    /**
     * System 銷毀（可選覆寫）
     */
    destroy(_world: World): void { }
}
