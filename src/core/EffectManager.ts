import type { Skill } from '../types/Skill';
import type { SpriteFxManager } from './SpriteFxManager';

type Vec3Like = { x: number; y: number; z: number };

/** 隕石落地（命中）距離特效開始的秒數，見 fire/meteor 的 HIT */
const METEOR_IMPACT_SECONDS = 0.62;
/** 幻影殺陣在範圍內播放的刀光數量與間隔 */
const PHANTOM_STRIKES = 5;
const PHANTOM_INTERVAL = 0.12;

/**
 * 特效管理器：把技能施放對應到像素連續圖特效（SpriteFxManager）
 *
 * 位置以施法者的地面座標為準，判定中心的算法與 ECSSkillExecutor 相同，特效才會落在實際造成傷害的地方。
 * 火球的飛行與命中由 ProjectileManager 依實際投射物播放。
 */
export class EffectManager {
    private fx: SpriteFxManager;

    constructor(fx: SpriteFxManager) {
        this.fx = fx;
    }

    /**
     * 播放技能特效
     * @param follow 施法者目前位置，用於跟著施法者移動的持續效果
     * @param visible 本地玩家看不看得到施法者；跟著施法者的效果在看不到時隱藏（迷霧、隱身）
     */
    playSkillEffect(skill: Skill, position: Vec3Like, direction: { x: number; z: number }, follow?: () => Vec3Like, visible?: () => boolean) {
        const feet = { x: position.x, y: 0, z: position.z };
        const ahead = (distance: number) => ({ x: feet.x + direction.x * distance, y: 0, z: feet.z + direction.z * distance });
        const facing = { direction, facing: 'mirror' as const };

        switch (skill.id) {
            // --- 戰士 ---
            case 'warrior_q': // 衝鋒斬
            case 'assassin_q': // 瞬步
                this.fx.play('dash-thrust', feet, { direction, facing: 'rotate' });
                break;
            case 'warrior_w': // 震地猛擊
                this.fx.play('ground-slam', ahead(1));
                break;
            case 'warrior_e': // 鋼鐵意志
                this.fx.play('divine-shield', feet, {
                    duration: skill.duration ?? 2,
                    follow: follow && (() => ({ ...follow(), y: 0 })),
                    visible
                });
                break;
            case 'warrior_r': // 旋風斬
                this.fx.play('spin-slash', ahead(1));
                break;
            // --- 刺客 ---
            case 'assassin_w': // 致命一擊
                this.fx.play('crit-hit', ahead(1), facing);
                break;
            case 'assassin_e': // 煙霧彈
                this.fx.play('smoke-bomb', feet);
                break;
            case 'assassin_r': // 幻影殺陣：範圍內多處刀光
                this.playPhantomStrikes(ahead(1), (skill.aoe ?? 6) * 0.6);
                break;
            // --- 法師 ---
            case 'mage_w': // 冰霜新星
                this.fx.play('frost-nova', ahead(1));
                break;
            case 'mage_e': // 閃現
                this.fx.play('blink-out', feet);
                this.fx.play('blink-in', ahead(skill.range || 6), { delay: 0.15 });
                break;
            case 'mage_r': // 隕石術：讓隕石落地的那一格對上延遲傷害
                this.fx.play('meteor', ahead(skill.targetDistance ?? 3), {
                    delay: Math.max(0, (skill.delay ?? 1) - METEOR_IMPACT_SECONDS)
                });
                break;
            default:
                if (skill.type === 'basic') this.fx.play('skill-slash', feet, facing);
        }
    }

    private playPhantomStrikes(center: Vec3Like, radius: number) {
        for (let i = 0; i < PHANTOM_STRIKES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            this.fx.play('dagger-flurry', { x: center.x + Math.cos(angle) * r, y: 0, z: center.z + Math.sin(angle) * r }, {
                delay: i * PHANTOM_INTERVAL,
                direction: { x: Math.random() < 0.5 ? -1 : 1, z: 0 },
                facing: 'mirror'
            });
        }
    }
}
