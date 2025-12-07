import { eventBus } from '../../events/EventBus';
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

    // 按鍵映射 (WASD 與方向鍵)
    private keys = {
        w: false, a: false, s: false, d: false,
        up: false, left: false, down: false, right: false
    };

    // 技能按鍵映射 (Q, W, E, R 和數字鍵 1, 2, 3, 4, 0, Space)
    private skillKeys: { [key: string]: boolean } = {};

    // 技能 ID 映射表 (由 GameEngine 設定)
    private skillSlotIds: string[] = []; // [Q/1, W/2, E/3, R/4, Basic/0]

    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        window.addEventListener('keydown', (e) => this.handleKey(e.key, true, e));
        window.addEventListener('keyup', (e) => this.handleKey(e.key, false, e));
    }

    private handleKey(key: string, isPressed: boolean, event?: KeyboardEvent) {
        const k = key.toLowerCase();

        // 移動鍵
        if (k === 'w') this.keys.w = isPressed;
        if (k === 'a') this.keys.a = isPressed;
        if (k === 's') this.keys.s = isPressed;
        if (k === 'd') this.keys.d = isPressed;
        if (k === 'arrowup') this.keys.up = isPressed;
        if (k === 'arrowleft') this.keys.left = isPressed;
        if (k === 'arrowdown') this.keys.down = isPressed;
        if (k === 'arrowright') this.keys.right = isPressed;

        // 技能鍵 (只在按下時觸發，不是持續按住)
        if (isPressed && !this.skillKeys[k]) {
            this.skillKeys[k] = true;
            this.handleSkillKey(k);
        }
        if (!isPressed) {
            this.skillKeys[k] = false;
        }

        // 防止空白鍵滾動頁面
        if (k === ' ' && event) {
            event.preventDefault();
        }
    }

    private handleSkillKey(key: string) {
        // 技能按鍵映射
        // Q / 1 -> 技能 0 (第一個普通技能)
        // W / 2 -> 技能 1 (第二個普通技能) - 注意：W 用於移動，所以只用數字鍵
        // E / 3 -> 技能 2 (第三個普通技能)
        // R / 4 -> 技能 3 (大招)
        // Space / 0 -> 基本攻擊

        let skillIndex = -1;

        // 數字鍵優先
        if (key === '1') skillIndex = 0;
        if (key === '2') skillIndex = 1;
        if (key === '3') skillIndex = 2;
        if (key === '4') skillIndex = 3;
        if (key === '0' || key === ' ') skillIndex = 4; // 基本攻擊

        // QWER 鍵 (避開 WASD 移動)
        // 注意: Q, E, R 可用於技能，W 不行因為用於移動
        if (key === 'q') skillIndex = 0;
        if (key === 'e') skillIndex = 2;
        if (key === 'r') skillIndex = 3;

        if (skillIndex >= 0 && skillIndex < this.skillSlotIds.length) {
            const skillId = this.skillSlotIds[skillIndex];
            if (skillId) {
                console.log(`[InputManager] Skill key pressed: ${key} -> ${skillId}`);
                eventBus.emit({
                    type: 'SKILL_USED',
                    playerId: this.localInput.playerId,
                    skillId: skillId
                });
            }
        }
    }

    /**
     * 設定技能 ID 映射 (由 GameEngine 呼叫)
     * @param skillIds 技能 ID 陣列 [Q/1, W/2, E/3, R/4, Basic/0]
     */
    setSkillSlots(skillIds: string[]) {
        this.skillSlotIds = skillIds;
        console.log('[InputManager] Skill slots set:', skillIds);
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
        this.localInput.moveX = -moveX; // 反轉 X 軸以修復左右相反問題
        this.localInput.moveY = moveY;

        // Return a copy
        return { ...this.localInput };
    }
}
