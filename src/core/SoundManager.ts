/**
 * SoundManager - 音效管理器
 * 使用 Web Audio API 與 PlayCanvas 音訊系統管理遊戲音效
 */
import * as pc from 'playcanvas';
import { eventBus } from '../events/EventBus';

export type SoundCategory = 'sfx' | 'bgm' | 'ui';

interface SoundConfig {
    volume?: number;
    loop?: boolean;
    pitch?: number;
}

export class SoundManager {
    private app: pc.Application;
    private sounds: Map<string, pc.Sound> = new Map();
    private slots: Map<string, pc.SoundSlot> = new Map();
    private soundEntity: pc.Entity;

    // 音量設定
    private volumes: Record<SoundCategory, number> = {
        sfx: 0.7,
        bgm: 0.4,
        ui: 0.8
    };

    private muted: boolean = false;
    private boundOnDamage: (e: any) => void;

    constructor(app: pc.Application) {
        this.app = app;

        // 建立專用音效實體
        this.soundEntity = new pc.Entity('SoundManager');
        this.soundEntity.addComponent('sound');
        this.app.root.addChild(this.soundEntity);

        this.preloadSounds();

        this.boundOnDamage = this.onDamage.bind(this);
        eventBus.on('ENTITY_TOOK_DAMAGE', this.boundOnDamage);
    }

    private onDamage(event: any) {
        if (event.type !== 'ENTITY_TOOK_DAMAGE') return;
        if (event.damage > 0) {
            this.playHitSound();
        }
    }

    /**
     * 預載常用音效 (使用程式產生的音效)
     */
    private preloadSounds(): void {
        // Attack: Punchy noise + low square
        this.createSynthSound('attack', 'sfx', { frequency: 150, duration: 0.12, type: 'square', decay: 15 });

        // Fire: Noisy wind with frequency drop
        this.createSynthSound('skill_fire', 'sfx', { frequency: 400, duration: 0.4, type: 'noise', decay: 4 });

        // Ice: FM Crystal sound
        this.createSynthSound('skill_ice', 'sfx', { frequency: 800, duration: 0.5, type: 'sine', decay: 5, fm: { freq: 1200, amount: 400 } });

        // Dash: Fast noise sweep
        this.createSynthSound('skill_dash', 'sfx', { frequency: 100, duration: 0.2, type: 'noise', decay: 10 });

        // Hit: Intense noise burst (short)
        this.createSynthSound('hit', 'sfx', { frequency: 60, duration: 0.1, type: 'noise', decay: 20 });

        // Death: Low sawtooth fall
        this.createSynthSound('death', 'sfx', { frequency: 150, duration: 0.8, type: 'sawtooth', decay: 2 });

        // UI: Clean sine clicks
        this.createSynthSound('button_click', 'ui', { frequency: 880, duration: 0.08, type: 'sine', decay: 20 });
        this.createSynthSound('game_over', 'ui', { frequency: 440, duration: 1.5, type: 'triangle', decay: 1 });

        console.log('[SoundManager] High-quality synthetic sounds initialized');
    }

    /**
     * 使用 Web Audio API 創建合成音效
     */
    private createSynthSound(
        name: string,
        _category: SoundCategory,
        config: {
            frequency: number;
            duration: number;
            type: OscillatorType | 'noise';
            decay?: number;
            fm?: { freq: number; amount: number };
        }
    ): void {
        const audioContext = (this.app.systems.sound as any)?.context as AudioContext;
        if (!audioContext) {
            console.warn('[SoundManager] AudioContext not available');
            return;
        }

        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * config.duration;
        const buffer = audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        const decay = config.decay || 8;

        // FM Synthesis parameters (optional)
        const fmFreq = config.fm?.freq || 0;
        const fmAmount = config.fm?.amount || 0;

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * decay);
            let wave = 0;

            if (config.type === 'noise') {
                wave = Math.random() * 2 - 1;
            } else {
                // Modulator for FM
                const mod = fmAmount > 0 ? Math.sin(2 * Math.PI * fmFreq * t) * fmAmount : 0;
                const freq = config.frequency + mod;

                switch (config.type) {
                    case 'sine': wave = Math.sin(2 * Math.PI * freq * t); break;
                    case 'square': wave = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
                    case 'sawtooth': wave = 2 * ((t * freq) % 1) - 1; break;
                    case 'triangle': wave = Math.abs(4 * ((t * freq) % 1) - 2) - 1; break;
                }
            }

            data[i] = wave * envelope * 0.3;
        }

        const sound = new pc.Sound(buffer);
        this.sounds.set(name, sound);

        if (this.soundEntity.sound) {
            this.soundEntity.sound.addSlot(name, {
                volume: 1.0,
                loop: false,
                overlap: true
            });
            const slot = this.soundEntity.sound.slot(name);
            if (slot) {
                slot.asset = null;
                (slot as any)._sound = sound;
                this.slots.set(name, slot);
            }
        }
    }

    /**
     * 播放音效
     */
    play(name: string, category: SoundCategory = 'sfx', config?: SoundConfig): void {
        if (this.muted) return;

        const audioContext = (this.app.systems.sound as any)?.context as AudioContext;
        const sound = this.sounds.get(name);

        if (!audioContext || !sound) {
            // console.warn(`[SoundManager] Sound not found: ${name}`);
            return;
        }

        // 直接使用 Web Audio API 播放
        const source = audioContext.createBufferSource();
        source.buffer = sound.buffer as AudioBuffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = this.volumes[category] * (config?.volume ?? 1.0);

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (config?.pitch) {
            source.playbackRate.value = config.pitch;
        }

        source.loop = config?.loop ?? false;
        source.start(0);
    }

    /**
     * 根據技能 ID 播放對應音效
     */
    playSkillSound(skillId: string): void {
        if (skillId.includes('fire') || skillId === 'mage_q') {
            this.play('skill_fire', 'sfx');
        } else if (skillId.includes('ice') || skillId === 'mage_w') {
            this.play('skill_ice', 'sfx');
        } else if (skillId.includes('dash') || skillId.includes('assassin_q') || skillId.includes('warrior_q')) {
            this.play('skill_dash', 'sfx');
        } else {
            this.play('attack', 'sfx');
        }
    }

    /**
     * 播放攻擊音效
     */
    playAttackSound(): void {
        this.play('attack', 'sfx');
    }

    /**
     * 播放受擊音效
     */
    playHitSound(): void {
        this.play('hit', 'sfx');
    }

    /**
     * 播放死亡音效
     */
    playDeathSound(): void {
        this.play('death', 'sfx');
    }

    /**
     * 播放遊戲結束音效
     */
    playGameOverSound(): void {
        this.play('game_over', 'ui');
    }

    /**
     * 播放 UI 點擊音效
     */
    playClickSound(): void {
        this.play('button_click', 'ui');
    }

    /**
     * 設定音量
     */
    setVolume(category: SoundCategory, volume: number): void {
        this.volumes[category] = Math.max(0, Math.min(1, volume));
    }

    /**
     * 靜音切換
     */
    toggleMute(): boolean {
        this.muted = !this.muted;
        return this.muted;
    }

    /**
     * 取得靜音狀態
     */
    isMuted(): boolean {
        return this.muted;
    }

    destroy(): void {
        eventBus.off('ENTITY_TOOK_DAMAGE', this.boundOnDamage);
        if (this.soundEntity) {
            this.soundEntity.destroy();
        }
    }
}
