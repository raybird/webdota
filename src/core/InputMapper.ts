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

    // 預設鍵盤映射（方向鍵）
    private static readonly ARROW_KEYS_MAPPING: InputMapping = {
        moveUp: ['ArrowUp'],
        moveDown: ['ArrowDown'],
        moveLeft: ['ArrowLeft'],
        moveRight: ['ArrowRight']
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

        // 檢查向上 (W)
        if (keyboard.isPressed(pc.KEY_W)) {
            y = -1; // 向上 (Z軸負向)
        }

        // 檢查向下 (S)
        if (keyboard.isPressed(pc.KEY_S)) {
            y = 1; // 向下 (Z軸正向)
        }

        // 檢查向左 (A)
        if (keyboard.isPressed(pc.KEY_A)) {
            x = -1;
        }

        // 檢查向右 (D)
        if (keyboard.isPressed(pc.KEY_D)) {
            x = 1;
        }

        return { x, y };
    }

    /**
     * 檢查任意一個按鍵是否被按下
     */
    private isAnyKeyPressed(keyboard: any, keys: string[]): boolean {
        if (!keyboard) return false;

        return keys.some(key => {
            // 支援兩種格式：'KeyW' 或直接用 pc.KEY_W
            if (key.startsWith('Key')) {
                const letter = key.replace('Key', '');
                const pcKey = (window as any).pc[`KEY_${letter} `];
                return keyboard.isPressed(pcKey);
            } else if (key.startsWith('Arrow')) {
                const direction = key.replace('Arrow', '').toUpperCase();
                const pcKey = (window as any).pc[`KEY_${direction} `];
                return keyboard.isPressed(pcKey);
            }
            return false;
        });
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
