# WebDota ECS 與 Rapier Sensor 重構計畫

日期: 2026-01-11

## 目標

1. **ECS 架構**: 將現有 OOP 實體系統改為 Entity-Component-System
2. **Rapier Sensor**: 取代自製 HitboxManager，使用 Rapier 原生碰撞事件
3. **維持 P2P**: 網路架構不變

---

## Phase 1: ECS 核心架構 [COMPLETED]
## Phase 2: Rapier Sensor 整合 [COMPLETED]
## Phase 3: 遷移現有實體 [COMPLETED]
## Phase 4: 性能規訓與優化 [COMPLETED]
## Phase 5: 網路協議規訓 [COMPLETED]

## Phase 6: 環境主權與 UI 規訓 [COMPLETED]

### 6.1 畫面視口修復 - FULLY HARDENED
### 6.2～6.4、Phase 7 - REMOVED (2026-11-06)
- 環境預檢、檢查點回溯、狀態指紋裁判（RefereeManager）與事件存證（ProvenanceManager）實際上沒有接通：
  裁判比對的是同一份遠端雜湊、坍縮事件沒有監聽者、物理快照經 JSON 序列化後無法還原。
  連同動態降頻一併移除；Client 的狀態一致性由 Host 每 3 幀的權威廣播維持。

## Phase 8: 核心修正與精簡 [COMPLETED] (2026-11-06)
- 輸入封包加入技能 ID 與方向，Client 技能會在 Host 執行
- 技能執行器改用 ECS Entity ID 查詢施放者（ECS 遷移後所有技能都找不到施放者而不生效）
- `World.destroyEntity` 冪等並呼叫 Component `dispose()`，修正死亡實體殘留剛體、ID 被重複回收
- 血條統一由 `RenderSystem` 更新；移除 `EntityStatus.vue` 與 UIManager 的重複更新路徑
- 防禦塔與主堡合併為 `ECSStructureManager`；移除 HostManager、PlayerInputSystem、PoolableComponent、
  EntityPool、SkillManager、CombatStats、InventoryManager 等未使用的模組
- 投射物帶隊伍資訊，不再命中隊友；延遲傷害改用遊戲時間倒數
- HUD 更新改為 10Hz；傷害數字改用 CSS 動畫；GameEngine 離開遊戲時釋放所有資源

---

## 檔案變更總覽

| 操作 | 路徑 | 說明 |
|------|------|------|
| [NEW] | `src/core/managers/ECSStructureManager.ts` | 防禦塔與主堡 |
| [MODIFY] | `src/core/GameEngine.ts` | 移除裁判、檢查點與降頻；Host 權威迴圈 |
| [MODIFY] | `src/utils/BinarySerializer.ts` | 輸入封包含技能 |
| [MODIFY] | `src/core/ecs/World.ts` | 冪等銷毀與 dispose |

**最後更新**: 2026-11-06
