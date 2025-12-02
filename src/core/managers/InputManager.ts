import type { PlayerInput } from '../NetworkManager';

/**
 * 輸入管理器
 * 負責收集本地輸入與處理輸入緩衝
 */
export class InputManager {
    // 本地玩家輸入
    private localInput: PlayerInput = {
        frame: 0,
        playerId: '',
        moveX: 0,
        moveY: 0
    };

    // 行動裝置輸入（虛擬搖桿）
    private mobileInput = { moveX: 0, moveY: 0 };

    // 按鍵映射 (WASD)
    private keys = {
        w: false, a: false, s: false, d: false,
        up: false, left: false, down: false, right: false
    };

    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        window.addEventListener('keydown', (e) => this.handleKey(e.key, true));
        window.addEventListener('keyup', (e) => this.handleKey(e.key, false));
    }

    private handleKey(key: string, isPressed: boolean) {
        const k = key.toLowerCase();
        if (k === 'w') this.keys.w = isPressed;
        if (k === 'a') this.keys.a = isPressed;
        if (k === 's') this.keys.s = isPressed;
        if (k === 'd') this.keys.d = isPressed;
        if (k === 'arrowup') this.keys.up = isPressed;
        if (k === 'arrowleft') this.keys.left = isPressed;
        if (k === 'arrowdown') this.keys.down = isPressed;
        if (k === 'arrowright') this.keys.right = isPressed;
    }

    setPlayerId(id: string) {
        this.localInput.playerId = id;
    }

    setMobileInput(x: number, y: number) {
        this.mobileInput.moveX = x;
        this.mobileInput.moveY = y;
    }

    /**
     * 收集當前 Frame 的輸入
     */
    collectInput(frame: number): PlayerInput {
        let moveX = 0;
        let moveY = 0;

        // Keyboard Input
        if (this.keys.w || this.keys.up) moveY += 1;
        if (this.keys.s || this.keys.down) moveY -= 1;
        if (this.keys.a || this.keys.left) moveX -= 1;
        if (this.keys.d || this.keys.right) moveX += 1;

        // Mobile Input Override
        if (this.mobileInput.moveX !== 0 || this.mobileInput.moveY !== 0) {
            moveX = this.mobileInput.moveX;
            moveY = this.mobileInput.moveY;
        }

        // Normalize
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        if (length > 1) {
            moveX /= length;
            moveY /= length;
        }

        this.localInput.frame = frame;
        this.localInput.moveX = moveX;
        this.localInput.moveY = moveY;

        // Return a copy
        return { ...this.localInput };
    }
}
