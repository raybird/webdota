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

    // UI 配置常數
    private readonly HP_BAR_WIDTH = 150;
    private readonly HP_BAR_HEIGHT = 35;
    private readonly HP_BAR_OFFSET_Y = 2.0; // 血條離角色的高度

    constructor(app: pc.Application) {
        this.app = app;
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
     * 清理所有 UI
     */
    cleanup() {
        for (const [playerId] of this.playerUIs) {
            this.removePlayerUI(playerId);
        }
    }
}
