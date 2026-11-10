import * as pc from 'playcanvas';

/**
 * UI 管理器
 * 建立實體頭頂的 3D 血條；建立後交給 RenderComponent 管理位置、數值與銷毀
 */

export interface EntityBarUI {
    hpBarEntity: pc.Entity;
    hpBarFillEntity: pc.Entity;
    energyBarFillEntity?: pc.Entity;
    /** 重畫頭上的名稱（只有玩家有） */
    setLabel?: (text: string) => void;
}

export class UIManager {
    private app: pc.Application;

    // UI 配置常數
    private readonly HP_BAR_WIDTH = 150;
    private readonly HP_BAR_HEIGHT = 20;
    private readonly ENERGY_BAR_HEIGHT = 10; // 能量條比血條矮

    constructor(app: pc.Application) {
        this.app = app;
    }

    /**
     * 為玩家建立頭頂 UI
     * @param playerId 玩家 ID
     * @param playerName 玩家顯示名稱（角色名稱或暱稱）
     */
    createPlayerUI(playerId: string, playerName: string = 'Player'): EntityBarUI {
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

        // 使用 Canvas 繪製名稱文字；setLabel 重畫（等級改變時）
        const nameCanvas = document.createElement('canvas');
        const nameCtx = nameCanvas.getContext('2d');
        nameCanvas.width = 512;   // 加大解析度
        nameCanvas.height = 128;  // 加大解析度

        const drawLabel = (text: string) => {
            if (!nameCtx) return;
            nameCtx.clearRect(0, 0, nameCanvas.width, nameCanvas.height);
            nameCtx.font = 'bold 64px Arial, sans-serif'; // 加大字體
            // 太長（加上等級後）就縮小字體，不要被畫布切掉
            const width = nameCtx.measureText(text).width;
            const maxWidth = nameCanvas.width - 24;
            if (width > maxWidth) nameCtx.font = `bold ${Math.floor(64 * maxWidth / width)}px Arial, sans-serif`;
            nameCtx.textAlign = 'center';
            nameCtx.textBaseline = 'middle';

            // 黑色描邊
            nameCtx.strokeStyle = 'black';
            nameCtx.lineWidth = 8; // 加粗描邊
            nameCtx.strokeText(text, nameCanvas.width / 2, nameCanvas.height / 2);

            // 白色文字
            nameCtx.fillStyle = 'white';
            nameCtx.fillText(text, nameCanvas.width / 2, nameCanvas.height / 2);
        };
        drawLabel(playerName);

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

        const setLabel = (text: string) => {
            drawLabel(text);
            nameTexture.upload();
        };

        return { hpBarEntity, hpBarFillEntity: hpBarFill, energyBarFillEntity: energyBarFill, setLabel };
    }

    /**
     * 為非玩家實體建立簡化 UI（僅血條）
     * @param entityId 實體 ID
     * @param team 隊伍 (用於顏色)
     * @param size 血條大小（UI 像素，實際大小再乘 0.01 世界單位）；預設是小兵用的 80×10
     */
    createEntityUI(entityId: string, team: 'red' | 'blue' | 'neutral', size: { width: number; height: number } = { width: 80, height: 10 }): EntityBarUI {
        const ENTITY_HP_BAR_WIDTH = size.width;
        const ENTITY_HP_BAR_HEIGHT = size.height;

        const hpBarEntity = new pc.Entity(`HPBar_${entityId}`);
        hpBarEntity.setLocalScale(0.01, 0.01, 0.01);

        // 背景
        const hpBarBg = new pc.Entity('HPBar_Background');
        hpBarBg.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            width: ENTITY_HP_BAR_WIDTH,
            height: ENTITY_HP_BAR_HEIGHT,
            color: new pc.Color(0.2, 0.2, 0.2),
            opacity: 0.7
        });

        // 填充 (根據隊伍染色)
        const fillColor = team === 'red' ? new pc.Color(0.9, 0.3, 0.3)
            : team === 'blue' ? new pc.Color(0.3, 0.3, 0.9)
                : new pc.Color(0.7, 0.7, 0.7);

        const hpBarFill = new pc.Entity('HPBar_Fill');
        hpBarFill.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 0.5, 0, 0.5),
            pivot: new pc.Vec2(0, 0.5),
            width: ENTITY_HP_BAR_WIDTH,
            height: ENTITY_HP_BAR_HEIGHT,
            color: fillColor,
            opacity: 1.0
        });
        hpBarFill.setLocalPosition(-ENTITY_HP_BAR_WIDTH / 2, 0, 0);

        hpBarEntity.addChild(hpBarBg);
        hpBarEntity.addChild(hpBarFill);
        this.app.root.addChild(hpBarEntity);

        return { hpBarEntity, hpBarFillEntity: hpBarFill };
    }
}
