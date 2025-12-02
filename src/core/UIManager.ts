import * as pc from 'playcanvas';

/**
 * UI 管理器
 * 統一管理所有玩家的頭頂 UI（血條、名稱等）
 */

export interface PlayerUIConfig {
    playerId: string;
    hpBarEntity: pc.Entity;
    hpBarFillEntity: pc.Entity;
}

export class UIManager {
    private app: pc.Application;
    private playerUIs: Map<string, PlayerUIConfig> = new Map();
    private damageTextScreen!: pc.Entity; // 專門用於傷害數字的 2D Screen

    // UI 配置常數
    private readonly HP_BAR_WIDTH = 150;
    private readonly HP_BAR_HEIGHT = 35;
    private readonly HP_BAR_OFFSET_Y = 2.0; // 血條離角色的高度

    constructor(app: pc.Application) {
        this.app = app;
        this.initDamageTextScreen();
    }

    /**
     * 初始化傷害數字的螢幕層
     */
    private initDamageTextScreen() {
        this.damageTextScreen = new pc.Entity('DamageTextScreen');
        this.damageTextScreen.addComponent('screen', {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            screenSpace: true
        });
        this.app.root.addChild(this.damageTextScreen);
    }

    /**
     * 為玩家建立頭頂 UI
     */
    createPlayerUI(playerId: string): PlayerUIConfig {
        // 建立血條容器
        const hpBarEntity = new pc.Entity(`HPBar_${playerId}`);
        hpBarEntity.setLocalScale(0.01, 0.01, 0.01); // 重要：縮放 UI 以適應 3D 世界

        // 血條背景（灰色）
        const hpBarBg = new pc.Entity('HPBar_Background');
        hpBarBg.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            width: this.HP_BAR_WIDTH,
            height: this.HP_BAR_HEIGHT,
            color: new pc.Color(0.2, 0.2, 0.2),
            opacity: 0.8
        });

        // 血條填充（紅色）
        const hpBarFill = new pc.Entity('HPBar_Fill');
        hpBarFill.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 0.5, 0, 0.5),
            pivot: new pc.Vec2(0, 0.5),
            width: this.HP_BAR_WIDTH,
            height: this.HP_BAR_HEIGHT,
            color: new pc.Color(0.8, 0.2, 0.2),
            opacity: 1.0
        });
        hpBarFill.setLocalPosition(-this.HP_BAR_WIDTH / 2, 0, 0);

        hpBarEntity.addChild(hpBarBg);
        hpBarEntity.addChild(hpBarFill);
        this.app.root.addChild(hpBarEntity);

        const config: PlayerUIConfig = {
            playerId,
            hpBarEntity,
            hpBarFillEntity: hpBarFill
        };

        this.playerUIs.set(playerId, config);
        return config;
    }

    /**
     * 更新玩家血條位置（跟隨角色）
     */
    updatePlayerUIPosition(playerId: string, position: pc.Vec3) {
        const ui = this.playerUIs.get(playerId);
        if (!ui) return;

        // 設定血條位置在角色上方
        ui.hpBarEntity.setPosition(
            position.x,
            position.y + this.HP_BAR_OFFSET_Y,
            position.z
        );

        // 血條永遠平行於地面（不受角色旋轉影響）
        ui.hpBarEntity.setEulerAngles(0, 0, 0);
    }

    /**
     * 更新玩家血條數值
     */
    updatePlayerHP(playerId: string, currentHp: number, maxHp: number) {
        const ui = this.playerUIs.get(playerId);
        if (!ui || !ui.hpBarFillEntity.element) return;

        const hpPercent = Math.max(0, Math.min(1, currentHp / maxHp));
        ui.hpBarFillEntity.element.width = this.HP_BAR_WIDTH * hpPercent;

        // 根據血量改變顏色（綠 -> 黃 -> 紅）
        if (hpPercent > 0.6) {
            ui.hpBarFillEntity.element.color = new pc.Color(0.2, 0.8, 0.2); // 綠色
        } else if (hpPercent > 0.3) {
            ui.hpBarFillEntity.element.color = new pc.Color(0.8, 0.8, 0.2); // 黃色
        } else {
            ui.hpBarFillEntity.element.color = new pc.Color(0.8, 0.2, 0.2); // 紅色
        }
    }

    /**
     * 移除玩家 UI
     */
    removePlayerUI(playerId: string) {
        const ui = this.playerUIs.get(playerId);
        if (!ui) return;

        if (ui.hpBarEntity) {
            ui.hpBarEntity.destroy();
        }

        this.playerUIs.delete(playerId);
    }

    /**
     * 更新所有玩家 UI（在遊戲主循環中呼叫）
     */
    updateAll(players: Map<string, any>) {
        for (const [playerId, player] of players) {
            // 更新位置
            const pos = player.getPosition();
            this.updatePlayerUIPosition(playerId, pos);

            // 更新血量
            if (player.combatStats) {
                this.updatePlayerHP(
                    playerId,
                    player.combatStats.currentHp,
                    player.combatStats.maxHp
                );
            }
        }
    }

    /**
     * 顯示傷害飄字 (3D Billboard + Always On Top)
     */
    showDamageText(position: pc.Vec3, damage: number, isCritical: boolean = false) {
        // 1. 建立 Canvas 並繪製文字
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 256;
        canvas.height = 128;

        // 設定字型樣式
        const fontSize = isCritical ? 80 : 60;
        const color = isCritical ? '#FFFF00' : '#FFFFFF';

        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 陰影/描邊
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'black';

        const text = Math.round(damage).toString();
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.strokeText(text, cx, cy);
        ctx.fillStyle = color;
        ctx.fillText(text, cx, cy);

        // 2. 建立 PlayCanvas Texture
        const texture = new pc.Texture(this.app.graphicsDevice, {
            width: canvas.width,
            height: canvas.height,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            magFilter: pc.FILTER_LINEAR,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR
        });
        texture.setSource(canvas);

        // 3. 建立材質 (StandardMaterial + No Depth Test)
        const material = new pc.StandardMaterial();
        material.diffuseMap = texture;
        material.emissiveMap = texture;
        material.emissive = new pc.Color(1, 1, 1);
        material.opacityMap = texture;
        material.blendType = pc.BLEND_NORMAL;
        material.alphaTest = 0.1;
        material.useLighting = false;
        material.useSkybox = false;
        material.depthTest = false; // 關鍵：關閉深度測試，永遠顯示在最上層
        material.update();

        // 4. 建立實體 (Plane)
        const textEntity = new pc.Entity('DamageText');
        textEntity.addComponent('render', {
            type: 'plane',
            material: material,
            castShadows: false,
            receiveShadows: false
        });

        // 初始位置
        const offsetX = (Math.random() - 0.5) * 0.5;
        textEntity.setPosition(position.x + offsetX, position.y + 2.0, position.z);

        // 縮放與旋轉
        textEntity.setLocalScale(1, 1, 1);

        // Billboard (面向攝影機)
        const camera = this.app.root.findByName('Camera');
        if (camera) {
            textEntity.lookAt(camera.getPosition());
            textEntity.rotateLocal(90, 0, 0); // Plane 需要轉 90 度
        }

        this.app.root.addChild(textEntity);

        // 5. 動畫
        let timer = 0;
        const duration = 1.0;
        const startPos = textEntity.getPosition().clone();
        const baseScale = 1.0;

        const update = (dt: number) => {
            timer += dt;
            if (timer >= duration) {
                textEntity.destroy();
                material.destroy();
                texture.destroy();
                this.app.off('update', update);
                return;
            }

            const progress = timer / duration;

            // 向上移動
            textEntity.setPosition(
                startPos.x,
                startPos.y + progress * 2.0,
                startPos.z
            );

            // 確保始終面向攝影機
            if (camera) {
                textEntity.lookAt(camera.getPosition());
                textEntity.rotateLocal(90, 0, 0);
            }

            // 縮放動畫
            let s = baseScale;
            if (isCritical) {
                if (progress < 0.2) s = baseScale * (1 + progress * 5);
                else s = baseScale * (2 - progress);
            } else {
                s = baseScale * (1 + Math.sin(progress * Math.PI) * 0.2);
            }

            // 淡出
            if (progress > 0.7) {
                s *= (1 - (progress - 0.7) / 0.3);
            }

            textEntity.setLocalScale(s, 1, s);
        };

        this.app.on('update', update);
    }

    /**
     * 清理所有 UI
     */
    cleanup() {
        for (const [playerId] of this.playerUIs) {
            this.removePlayerUI(playerId);
        }
    }
}
