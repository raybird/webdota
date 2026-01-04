import * as pc from 'playcanvas';

/**
 * UI 管理器
 * 統一管理所有玩家的頭頂 UI（血條、名稱等）
 */

export interface PlayerUIConfig {
    playerId: string;
    playerName: string;          // 玩家顯示名稱
    hpBarEntity: pc.Entity;
    hpBarFillEntity: pc.Entity;
    energyBarFillEntity: pc.Entity;  // 新增能量條
    nameTextEntity: pc.Entity;   // 名稱文字實體
}

export class UIManager {
    private app: pc.Application;
    private playerUIs: Map<string, PlayerUIConfig> = new Map();
    private damageTextScreen!: pc.Entity; // 專門用於傷害數字的 2D Screen

    // UI 配置常數
    private readonly HP_BAR_WIDTH = 150;
    private readonly HP_BAR_HEIGHT = 20;
    private readonly ENERGY_BAR_HEIGHT = 10; // 能量條比血條矮
    private readonly HP_BAR_OFFSET_Y = 2.0; // 血條離角色的高度
    // private readonly NAME_TEXT_OFFSET_Y = 20; // 已改用固定數值

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
     * @param playerId 玩家 ID
     * @param playerName 玩家顯示名稱（角色名稱或暱稱）
     */
    createPlayerUI(playerId: string, playerName: string = 'Player'): PlayerUIConfig {
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

        // 能量條背景（深藍）
        const energyBarBg = new pc.Entity('EnergyBar_Background');
        energyBarBg.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            width: this.HP_BAR_WIDTH,
            height: this.ENERGY_BAR_HEIGHT,
            color: new pc.Color(0.1, 0.1, 0.3),
            opacity: 0.8
        });
        energyBarBg.setLocalPosition(0, -this.HP_BAR_HEIGHT, 0); // 在血條下方

        // 能量條填充（藍色）
        const energyBarFill = new pc.Entity('EnergyBar_Fill');
        energyBarFill.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 0.5, 0, 0.5),
            pivot: new pc.Vec2(0, 0.5),
            width: this.HP_BAR_WIDTH,
            height: this.ENERGY_BAR_HEIGHT,
            color: new pc.Color(0.2, 0.6, 1.0),
            opacity: 1.0
        });
        energyBarFill.setLocalPosition(-this.HP_BAR_WIDTH / 2, -this.HP_BAR_HEIGHT, 0);

        // 名稱文字（在血條上方）- 使用 Canvas 繪製確保顯示
        const nameText = new pc.Entity('NameText');

        // 使用 Canvas 繪製名稱文字
        const nameCanvas = document.createElement('canvas');
        const nameCtx = nameCanvas.getContext('2d');
        nameCanvas.width = 512;   // 加大解析度
        nameCanvas.height = 128;  // 加大解析度

        if (nameCtx) {
            nameCtx.font = 'bold 64px Arial, sans-serif'; // 加大字體
            nameCtx.textAlign = 'center';
            nameCtx.textBaseline = 'middle';

            // 黑色描邊
            nameCtx.strokeStyle = 'black';
            nameCtx.lineWidth = 8; // 加粗描邊
            nameCtx.strokeText(playerName, nameCanvas.width / 2, nameCanvas.height / 2);

            // 白色文字
            nameCtx.fillStyle = 'white';
            nameCtx.fillText(playerName, nameCanvas.width / 2, nameCanvas.height / 2);
        }

        // 建立紋理
        const nameTexture = new pc.Texture(this.app.graphicsDevice, {
            width: nameCanvas.width,
            height: nameCanvas.height,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            magFilter: pc.FILTER_LINEAR,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR
        });
        nameTexture.setSource(nameCanvas);

        // 建立材質
        const nameMaterial = new pc.StandardMaterial();
        nameMaterial.diffuseMap = nameTexture;
        nameMaterial.emissiveMap = nameTexture;
        nameMaterial.emissive = new pc.Color(1, 1, 1);
        nameMaterial.opacityMap = nameTexture;
        nameMaterial.blendType = pc.BLEND_NORMAL;
        nameMaterial.alphaTest = 0.1;
        nameMaterial.useLighting = false;
        nameMaterial.depthTest = true; // 開啟深度測試
        nameMaterial.depthWrite = false; // 但不寫入深度（避免遮擋血條）
        nameMaterial.update();

        // 使用 Plane 顯示名稱
        nameText.addComponent('render', {
            type: 'plane',
            material: nameMaterial,
            castShadows: false,
            receiveShadows: false
        });

        // 縮放與位置
        // 父層 scale 為 0.01
        // Element 寬度 150
        // 調整比例讓字體看起來更大：(300, 1, 100)
        nameText.setLocalScale(300, 1, 100);

        // Element 在 Y=0. HP Bar 高度 25. 文字要在上方.
        // 因為高度增加到 100 (visual scale)，需要把位置拉高避免重疊
        nameText.setLocalPosition(0, 80, 0);

        // Plane 原本是 XZ 平面，繞 X 軸轉 90 度變成 XY 平面（面向 Z+）
        // hpBarEntity 會 LookAt Camera，所以 Z 軸指向 Camera
        nameText.setLocalEulerAngles(90, 0, 0);

        hpBarEntity.addChild(hpBarBg);
        hpBarEntity.addChild(hpBarFill);
        hpBarEntity.addChild(energyBarBg);
        hpBarEntity.addChild(energyBarFill);
        hpBarEntity.addChild(nameText);
        this.app.root.addChild(hpBarEntity);

        const config: PlayerUIConfig = {
            playerId,
            playerName,
            hpBarEntity,
            hpBarFillEntity: hpBarFill,
            energyBarFillEntity: energyBarFill,
            nameTextEntity: nameText
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

        // 血條永遠平行於地面，且面向攝影機 (Billboard)
        const camera = this.app.root.findByName('Camera');
        if (camera) {
            ui.hpBarEntity.lookAt(camera.getPosition());
            // 修正旋轉，使 UI 垂直且面向攝影機
            const rot = ui.hpBarEntity.getEulerAngles();
            ui.hpBarEntity.setEulerAngles(0, rot.y, 0);
        } else {
            ui.hpBarEntity.setEulerAngles(0, 0, 0);
        }
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
     * 更新玩家能量條數值
     */
    updatePlayerEnergy(playerId: string, currentEnergy: number, maxEnergy: number) {
        const ui = this.playerUIs.get(playerId);
        if (!ui || !ui.energyBarFillEntity.element) return;

        const energyPercent = Math.max(0, Math.min(1, currentEnergy / maxEnergy));
        ui.energyBarFillEntity.element.width = this.HP_BAR_WIDTH * energyPercent;
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
                this.updatePlayerEnergy(
                    playerId,
                    player.combatStats.currentEnergy,
                    player.combatStats.maxEnergy
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
