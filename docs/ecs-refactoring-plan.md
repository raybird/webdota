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
### 6.2 邊緣主權預演 - DONE
### 6.3 戰局自癒與持久化 - DONE
### 6.4 共識主權與裁判規訓 - FULLY HARDENED
- **實作**: 
    - 建立 `RefereeManager.ts` 執行狀態指紋 (Hashing) 與分層校驗。
    - **延遲因果校準**：引入 `COLLAPSE_THRESHOLD` 容忍瞬時網路抖動。
    - **狀態坍縮**：當分歧持續時自動觸發 `WEBDOTA_STATE_COLLAPSE` 事件回溯狀態。

## Phase 7: 主權存封與邊緣演化 [IN PROGRESS]
- **目標**: 將戰局中的「重大決策」與「因果分歧處理」標註 C2PA 指紋。
- **對焦**: 整合 Curiosity Engine 關於 JUMBF 段落雜湊的研究成果。
- **實作**:
    - **[NEW] ProvenanceManager.ts**：模擬 C2PA JUMBF 結構，為戰局事件產生數位指紋。
    - **[NEW] 因果存證集成**：在 `RefereeManager` 觸發坍縮時自動呼叫 `ProvenanceManager` 進行持久化存證。

---

## 檔案變更總覽

| 操作 | 路徑 | 說明 |
|------|------|------|
| [NEW] | `src/core/managers/ProvenanceManager.ts` | C2PA 數位指紋存證 |
| [MODIFY] | `src/core/managers/RefereeManager.ts` | 整合存證邏輯 |
| [MODIFY] | `docs/ecs-refactoring-plan.md` | 同步演化進度 |

**版本號對齊**: v26.0325.0400 (CST)
