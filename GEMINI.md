# 🎮 WebDota 開發上下文

本檔案為 Gemini CLI 提供 `webdota` 專案的技術背景、架構規範與開發準則。

## 🚀 專案概述

`webdota` 是一款基於 Web 技術的 P2P 多人線上競技遊戲 (MOBA)。
- **核心技術**: Vue 3 (UI), PlayCanvas (3D 渲染), Rapier3D (物理), PeerJS (P2P 網路)。
- **架構模式**: 
  - **遊戲核心**: Entity Component System (ECS)。
  - **網路**: Host 權威同步（Host 處理所有輸入並每 3 幀廣播狀態，Client 本地預測移動）。
  - **UI 層**: 響應式 Vue 3 + Pinia 狀態管理。

## 🏗️ 核心架構規範

### 1. ECS (Entity Component System) - 優先原則
遊戲邏輯**必須**遵循 ECS 模式，避免使用傳統的 OOP 類繼承。
- **Entities**: 僅作為 ID (`string`)，不包含邏輯。
- **Components** (`src/core/ecs/components/`): 純數據容器，不包含邏輯。
- **Systems** (`src/core/ecs/systems/`): 唯一的邏輯處理者，透過 `World.query()` 篩選實體。
- **Managers** (`src/core/managers/`): 負責實體的生命週期管理與外部接口對接。

### 2. 網路同步 (Networking)
- 遊戲邏輯（AI、傷害判定、小兵生成）以 Host 為準；Client 只送輸入並套用 Host 狀態。
- 嚴禁在 System 中使用 `Math.random()` 或 `Date.now()`；應使用遊戲內部的隨機種子或 `fixedUpdate` 提供的時間步長。
- 所有物理操作必須透過 `Rapier3D` 進行，以確保跨平台一致性。

### 3. UI 與 遊戲邏輯分離
- **UI 層 (Vue)**: 僅負責呈現與輸入收集。透過 `EventBus` 或 `Services` 與遊戲核心溝通。
- **Service 層**: 處理非遊戲循環的業務邏輯（如房間管理、角色選擇）。

## 🛠️ 開發常用指令

| 功能 | 指令 | 說明 |
|------|------|------|
| 開發 | `npm run dev` | 啟動 Vite 開發伺服器 |
| 構建 | `npm run build` | 執行類型檢查並構建生產版本 |
| 部署 | `npm run deploy` | 構建並發布至 Cloudflare Pages |
| 預覽 | `npm run preview` | 本地預覽構建結果 |

## 📂 關鍵目錄與檔案

- `src/core/ecs/`: ECS 框架核心 (`World.ts`, `System.ts`, `Entity.ts`)。
- `src/core/ecs/systems/`: 核心遊戲邏輯（如 `MovementSystem`, `CombatSystem`）。
- `src/core/GameEngine.ts`: 協調整體遊戲循環與 ECS 世界。
- `src/core/NetworkManager.ts`: 處理 P2P 連線與輸入廣播。
- `docs/architecture.md`: 完整的技術設計文件。
- `docs/ecs-refactoring-plan.md`: 當前的重構進度與規範。

## 📝 開發慣例

1. **代碼註釋**: 使用**繁體中文**進行註釋。
2. **型別安全**: 嚴格遵守 TypeScript 規範，避免使用 `any`。
3. **實體創建**: 統一透過 `EntityFactory` 或相關 `Manager` 創建實體，確保所有必要組件皆正確掛載。
4. **性能**: 在 `update` 循環中避免分配對象（如 `new Vector3()`），應使用對象池或預分配緩存。

## ⚠️ 已知限制與注意點
- 新功能直接在 ECS 框架下開發；Entity 銷毀一律走 `World.destroyEntity`，外部資源在 Component 的 `dispose()` 釋放。
- 建築與小兵在 Client 是 Host 狀態的鏡像（`EntitySyncManager`），Client 不跑 AI、不判定傷害。
- P2P Mesh 架構下，連線數隨玩家增加呈平方增長，目前建議上限為 8 人。
