/**
 * AnimationComponent.ts - 動畫管理 Component
 * 管理程序化動畫狀態
 */

import { type Component, ComponentType } from '../Component';

export type AnimationType = 'idle' | 'walk' | 'attack' | 'damage' | 'death';

export interface AnimationState {
    name: AnimationType | string;
    duration: number;
    elapsed: number;
    isPlaying: boolean;
}

export class AnimationComponent implements Component {
    readonly type = ComponentType.ANIMATION;

    /** 當前動畫 */
    currentAnimation: AnimationState = {
        name: 'idle',
        duration: 0,
        elapsed: 0,
        isPlaying: false
    };

    /** 動畫回調 */
    onAnimationComplete?: (animName: string) => void;

    /**
     * 播放動畫
     */
    play(name: AnimationType | string, duration: number = 0.3): void {
        this.currentAnimation = {
            name,
            duration,
            elapsed: 0,
            isPlaying: true
        };
    }

    /**
     * 停止動畫
     */
    stop(): void {
        this.currentAnimation.isPlaying = false;
    }

    /**
     * 更新動畫
     */
    update(dt: number): void {
        if (!this.currentAnimation.isPlaying) return;

        this.currentAnimation.elapsed += dt;

        if (this.currentAnimation.elapsed >= this.currentAnimation.duration) {
            this.currentAnimation.isPlaying = false;
            this.onAnimationComplete?.(this.currentAnimation.name);
        }
    }

    /**
     * 取得動畫進度 (0-1)
     */
    getProgress(): number {
        if (this.currentAnimation.duration <= 0) return 1;
        return Math.min(1, this.currentAnimation.elapsed / this.currentAnimation.duration);
    }

    /**
     * 是否正在播放指定動畫
     */
    isPlaying(name?: string): boolean {
        if (!this.currentAnimation.isPlaying) return false;
        if (name) return this.currentAnimation.name === name;
        return true;
    }
}
