import * as pc from 'playcanvas';

/**
 * 輸入映射配置
 * 統一管理所有輸入設備的按鍵映射
 */

export interface InputMapping {
    moveUp: string[];      // 向上移動的按鍵
    moveDown: string[];    // 向下移動的按鍵
    moveLeft: string[];    // 向左移動的按鍵
    moveRight: string[];   // 向右移動的按鍵

    // 未來可擴展
    jump?: string[];
    dash?: string[];
    interact?: string[];
}

export class InputMapper {
    // 預設鍵盤映射（WASD）
    private static readonly DEFAULT_KEYBOARD_MAPPING: InputMapping = {
        moveUp: ['KeyW'],
        moveDown: ['KeyS'],
        moveLeft: ['KeyA'],
        moveRight: ['KeyD']
    };

    private currentMapping: InputMapping;

    constructor(mapping?: InputMapping) {
        this.currentMapping = mapping || InputMapper.DEFAULT_KEYBOARD_MAPPING;
    }

    /**
     * 將鍵盤輸入映射為遊戲方向
     * @param keyboard PlayCanvas Keyboard
     * @returns {x, y} 移動向量 (-1 到 1)
     */
    getMoveVector(keyboard: any): { x: number, y: number } {
        if (!keyboard) return { x: 0, y: 0 };

        let x = 0;
        let y = 0;

        // Check for moveUp keys
        for (const key of this.currentMapping.moveUp) {
            if (this._isKeyPressed(keyboard, key)) {
                y = -1;
                break;
            }
        }

        // Check for moveDown keys
        for (const key of this.currentMapping.moveDown) {
            if (this._isKeyPressed(keyboard, key)) {
                y = 1;
                break;
            }
        }

        // Check for moveLeft keys
        for (const key of this.currentMapping.moveLeft) {
            if (this._isKeyPressed(keyboard, key)) {
                x = -1;
                break;
            }
        }

        // Check for moveRight keys
        for (const key of this.currentMapping.moveRight) {
            if (this._isKeyPressed(keyboard, key)) {
                x = 1;
                break;
            }
        }

        return { x, y };
    }

    /**
     * 檢查單個按鍵是否被按下
     * @param keyboard PlayCanvas Keyboard
     * @param key 鍵碼字串，例如 'KeyW' 或 'ArrowUp'
     * @returns {boolean} 如果按鍵被按下則為 true
     */
    private _isKeyPressed(keyboard: any, key: string): boolean {
        if (!keyboard) return false;

        // PlayCanvas key codes are numbers, but we store them as strings like 'KeyW' or 'ArrowUp'
        // We need to convert these string representations to their corresponding pc.KEY_ constants.
        let pcKey: number | undefined;

        // Handle 'KeyX' format (e.g., 'KeyW', 'KeyA')
        if (key.startsWith('Key')) {
            const letter = key.replace('Key', '');
            // Dynamically get pc.KEY_W, pc.KEY_A, etc.
            pcKey = (pc as any)[`KEY_${letter.toUpperCase()}`];
        }
        // Handle 'ArrowX' format (e.g., 'ArrowUp', 'ArrowLeft')
        else if (key.startsWith('Arrow')) {
            const direction = key.replace('Arrow', '').toUpperCase();
            // Dynamically get pc.KEY_UP, pc.KEY_LEFT, etc.
            pcKey = (pc as any)[`KEY_${direction}`];
        }
        // If the key string is already a direct PlayCanvas key code name (e.g., 'SPACE')
        else {
            pcKey = (pc as any)[`KEY_${key.toUpperCase()}`];
        }

        if (pcKey !== undefined) {
            return keyboard.isPressed(pcKey);
        }

        // Fallback for unrecognized key formats or if pcKey is not found
        console.warn(`Unrecognized key format or PlayCanvas key code not found for: ${key}`);
        return false;
    }

    /**
     * 設定自訂映射
     */
    setMapping(mapping: InputMapping) {
        this.currentMapping = mapping;
    }

    /**
     * 獲取當前映射
     */
    getMapping(): InputMapping {
        return { ...this.currentMapping };
    }

    /**
     * 重置為預設映射
     */
    resetToDefault() {
        this.currentMapping = { ...InputMapper.DEFAULT_KEYBOARD_MAPPING };
    }
}
