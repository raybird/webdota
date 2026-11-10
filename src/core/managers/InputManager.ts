import { eventBus } from '../../events/EventBus';
import type { PlayerInput } from '../NetworkManager';

/** 技能鍵 → 技能欄位（0～3 為技能 1～4，4 為普攻） */
const SKILL_KEYS: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, ' ': 4, '0': 4 };

function isTypingTarget(target: EventTarget | null | undefined): boolean {
    return target instanceof HTMLElement
        && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable);
}

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

    // 技能鍵是否按住中（按住不連發）
    private skillKeys: { [key: string]: boolean } = {};

    // 技能 ID 映射表 (由 GameEngine 設定)
    private skillSlotIds: string[] = []; // [1, 2, 3, 4, 普攻]

    private onKeyDown = (e: KeyboardEvent) => this.handleKey(e.key, true, e);
    private onKeyUp = (e: KeyboardEvent) => this.handleKey(e.key, false, e);

    constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    destroy() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }

    private handleKey(key: string, isPressed: boolean, event?: KeyboardEvent) {
        // 在輸入框打字時不當成遊戲操作（放開仍要處理，避免按鍵卡住）
        if (isPressed && isTypingTarget(event?.target)) return;
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
        // 數字鍵 1～4 放技能 1～4，空白鍵（或 0）普攻；WASD 用於移動，所以 Q／W／E／R 不綁技能
        const skillIndex = SKILL_KEYS[key] ?? -1;

        if (skillIndex >= 0 && skillIndex < this.skillSlotIds.length) {
            const skillId = this.skillSlotIds[skillIndex];
            if (skillId) {
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
     * @param skillIds 技能 ID 陣列 [1, 2, 3, 4, 普攻]
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
        this.localInput.moveX = moveX; // 移除 X 軸反轉
        this.localInput.moveY = moveY;

        // Return a copy
        return { ...this.localInput };
    }
}
