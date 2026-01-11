# WebDota 模組化架構重構心路歷程

> 記錄時間: 2025-12-02 ~ 2025-12-03  
> 重構分支: `refactor/modular-architecture`

## 📖 前言

這是一次從單體架構到模組化架構的完整重構之旅。本文記錄了整個過程中的思考、決策、挑戰與解決方案。

## 🎯 重構動機

### 原始架構的痛點

1. **巨大的單體文件**
   - `App.vue`: 1274 行,包含所有 UI 邏輯
   - `GameApp.ts`: 544 行,混雜了玩家管理、輸入處理、網路同步等多種職責

2. **狀態管理混亂**
   - 狀態散落在各個組件的 `ref` 中
   - 沒有統一的狀態管理方案
   - 組件間通信依賴事件回調,難以追蹤

3. **高度耦合**
   - UI 層直接操作核心遊戲邏輯
   - 網路層與遊戲邏輯緊密綁定
   - 難以單獨測試或替換某個模組

4. **可維護性差**
   - 新增功能需要修改多個文件
   - 代碼重複,缺乏抽象
   - 難以理解整體架構

### 重構目標

✅ **清晰的分層架構**: Presentation → Application → Domain → Infrastructure  
✅ **集中的狀態管理**: 使用 Pinia 管理所有狀態  
✅ **解耦的通信機制**: EventBus 實現模組間通信  
✅ **單一職責原則**: 每個類/組件只做一件事  
✅ **可測試性**: 各模組可獨立測試  

## 🗺️ 重構路線圖

### Phase 1: 準備工作 (30 分鐘)

**目標**: 確保重構過程可回溯,建立安全網

**執行內容**:
```bash
# 1. 提交當前狀態
git add .
git commit -m "feat: 完成角色選擇系統"

# 2. 創建重構分支
git checkout -b refactor/modular-architecture

# 3. 安裝 Pinia
npm install pinia

# 4. 備份關鍵文件
cp src/App.vue src/App.vue.backup
cp src/core/GameApp.ts src/core/GameApp.ts.backup
```

**心得**:
- 重構前的備份非常重要,給了我「大膽嘗試」的信心
- 獨立分支讓我可以隨時回到穩定版本
- 這個階段看似簡單,但為後續工作奠定了基礎

---

### Phase 2: 建立基礎設施 (2-3 小時)

**目標**: 建立新架構的基礎 - Stores 和 EventBus

#### 2.1 設計 Store 結構

**思考過程**:
> 如何劃分 Store?按功能?按數據類型?

最終決策:
- `roomStore`: 房間相關狀態 (是否在房間、玩家列表、倒數)
- `characterStore`: 角色選擇狀態
- `gameStore`: 遊戲核心狀態 (血量、法力、幀數)

**為什麼這樣劃分?**
- 遵循「關注點分離」原則
- 每個 Store 對應一個業務領域
- 便於未來擴展 (例如新增 `inventoryStore`)

#### 2.2 實現 EventBus

**挑戰**: 如何實現類型安全的事件系統?

**解決方案**:
```typescript
// 定義所有事件類型
type GameEvent = 
  | { type: 'ROOM_CREATED', roomId: string }
  | { type: 'PLAYER_JOINED', playerId: string }
  | { type: 'GAME_STARTED' }
  // ...

// EventBus 使用泛型確保類型安全
class EventBus<T extends { type: string }> {
  on<K extends T['type']>(
    type: K,
    handler: (event: Extract<T, { type: K }>) => void
  ): void
}
```

**心得**:
- TypeScript 的類型系統在這裡發揮了巨大作用
- 類型安全的事件系統避免了很多潛在 bug
- 一開始花時間設計好類型,後續開發效率大增

#### 2.3 整合 Pinia

**遇到的問題**:
在 `main.ts` 中整合 Pinia 時,發現舊的 `GameApp` 初始化會與新架構衝突。

**解決方案**:
暫時保留舊代碼,計劃在 Phase 6 統一清理。

---

### Phase 3: 重構 Service 層 (2-3 小時)

**目標**: 封裝業務邏輯,作為 UI 和 Core 之間的橋樑

#### 3.1 設計 Service 架構

**思考**:
> Service 應該做什麼?不應該做什麼?

**原則**:
- ✅ 應該: 協調 Store、NetworkManager、EventBus
- ✅ 應該: 處理業務邏輯 (例如「準備」狀態的驗證)
- ❌ 不應該: 直接操作 DOM
- ❌ 不應該: 包含遊戲引擎邏輯

#### 3.2 RoomService 的設計

**初版設計問題**:
```typescript
// 錯誤: RoomService 依賴 HostManager
constructor(networkManager: NetworkManager, hostManager: HostManager)
```

**問題分析**:
- `HostManager` 與遊戲引擎緊密耦合 (需要 `pc.Application`)
- `RoomService` 不應該依賴遊戲引擎
- Host 狀態應該由 `RoomStore` 管理

**重構後**:
```typescript
// 正確: 只依賴 NetworkManager
constructor(networkManager: NetworkManager)

// Host 狀態由 Store 管理
this.roomStore.setHost(true)
```

**心得**:
- 依賴注入要謹慎,避免引入不必要的耦合
- Store 是狀態的唯一來源,Service 不應該持有狀態
- 重構過程中要不斷反思:「這個依賴真的必要嗎?」

#### 3.3 CharacterService 的類型問題

**遇到的錯誤**:
```
Property 'CharacterData' does not exist
```

**原因**:
錯誤地導入了不存在的類型 `CharacterData`,應該使用 `Character`。

**解決**:
```typescript
// 錯誤
import type { CharacterData } from '../types/Character'

// 正確
import type { Character } from '../types/Character'
```

**教訓**:
- TypeScript 的錯誤訊息要仔細閱讀
- 重構時要確保導入的類型名稱正確
- 使用 IDE 的自動導入功能可以避免這類錯誤

---

### Phase 4: 重構核心層 (4-5 小時)

**目標**: 將 `GameApp.ts` 拆分為 `GameEngine` + 多個 Manager

#### 4.1 設計 Manager 架構

**原始 GameApp 的職責**:
- ✅ 玩家生成/移除
- ✅ 輸入收集
- ✅ 視覺同步
- ✅ 物理模擬
- ✅ 網路同步
- ✅ 遊戲循環

**拆分策略**:
```
GameApp (544 行)
    ↓
GameEngine (協調器) + 
PlayerManager (玩家管理) +
InputManager (輸入處理) +
RenderManager (渲染同步)
```

#### 4.2 PlayerManager 的實現

**設計亮點**:
```typescript
class PlayerManager {
  constructor(
    private app: pc.Application,
    private physicsWorld: RAPIER.World,
    private uiManager: UIManager
  ) {}
  
  spawnPlayer(playerId: string) {
    // 1. 從 CharacterStore 獲取角色
    const characterId = this.characterStore.getPlayerCharacter(playerId)
    const character = getCharacter(characterId)
    
    // 2. 使用角色顏色
    const color = new pc.Color().fromString(character.appearance.color)
    
    // 3. 創建玩家實體
    const player = new PlayerEntity(...)
    
    // 4. 整合 UIManager
    const uiConfig = this.uiManager.createPlayerUI(playerId)
    player.setUIReferences(...)
  }
}
```

**心得**:
- Manager 模式讓職責更清晰
- 依賴注入讓測試更容易
- 整合 Store 讓數據流向更明確

#### 4.3 GameEngine 的協調角色

**核心思想**:
> GameEngine 不做具體工作,只負責協調各個 Manager

```typescript
class GameEngine {
  gameLoop(dt: number) {
    // 1. 收集輸入 (委託給 InputManager)
    const input = this.inputManager.collectInput(this.currentFrame)
    
    // 2. 處理輸入 (委託給 PlayerManager)
    this.processInputs([input], dt)
    
    // 3. 物理模擬 (自己負責)
    this.physicsWorld.step()
    
    // 4. 視覺同步 (委託給 RenderManager)
    this.renderManager.syncVisuals(this.playerManager.getAllPlayers())
  }
}
```

**挑戰**: NetworkManager 的方法缺失

**問題**:
```
Property 'sendInput' does not exist on type 'NetworkManager'
```

**解決**:
在 `NetworkManager` 中添加缺失的方法:
```typescript
sendInput(input: PlayerInput) {
  const message = { type: 'input', input }
  this.connections.forEach(conn => conn.send(message))
}
```

**反思**:
- 重構時要同步更新所有相關模組
- 編譯錯誤是最好的提醒
- 不要害怕修改底層代碼

---

### Phase 5: 重構 UI 層 (3-4 小時)

**目標**: 將 `App.vue` 拆分為多個視圖和組件

#### 5.1 視圖設計

**思考**:
> 如何劃分視圖?按頁面?按功能?

**決策**:
- `LobbyView`: 大廳 (創建/加入房間)
- `RoomView`: 等待室 (角色選擇、準備)
- `GameView`: 遊戲畫面 (Canvas + HUD)

**為什麼不用 Vue Router?**
- 當前只有 3 個視圖,用 `v-if` 切換更簡單
- 未來如果視圖增多,可以輕鬆遷移到 Router
- 保持簡單,避免過度設計

#### 5.2 組件拆分

**WaitingRoom 的設計**:
```vue
<template>
  <div class="waiting-room">
    <!-- 左側: 角色選擇 -->
    <CharacterSelector />
    
    <!-- 右側: 玩家列表 + 控制 -->
    <PlayerList />
    <RoomControls />
  </div>
</template>
```

**設計原則**:
- 組件要「啞」(Dumb): 只負責顯示,不處理邏輯
- 邏輯放在 Service 中
- 通過 props 傳遞數據,通過 emit 傳遞事件

#### 5.3 CharacterSelector 的重構

**原版**: 模態框 (Overlay)
**新版**: 內嵌組件

**為什麼改?**
- 等待室需要持續顯示角色選擇器
- 模態框會遮擋其他信息
- 內嵌設計更符合 MOBA 遊戲的 UX

**挑戰**: 如何注入 CharacterService?

**解決方案**:
```typescript
// App.vue
provide('characterService', characterService)

// CharacterSelector.vue
const characterService = inject<CharacterService>('characterService')
```

**心得**:
- Vue 的 provide/inject 非常適合依賴注入
- 避免 prop drilling (層層傳遞 props)
- 保持組件的獨立性

#### 5.4 App.vue 的簡化

**重構前**: 1274 行
**重構後**: ~100 行

**新的 App.vue**:
```vue
<script setup>
// 1. 創建 Services
const networkManager = new NetworkManager()
const roomService = new RoomService(networkManager)
const characterService = new CharacterService(networkManager)
const gameService = new GameService(networkManager)

// 2. Provide Services
provide('roomService', roomService)
provide('characterService', characterService)
provide('gameService', gameService)

// 3. 視圖切換邏輯
const currentView = computed(() => {
  if (gameStore.isGameStarted) return 'game'
  if (roomStore.isInRoom) return 'room'
  return 'lobby'
})
</script>

<template>
  <LobbyView v-if="currentView === 'lobby'" />
  <RoomView v-else-if="currentView === 'room'" />
  <GameView v-else-if="currentView === 'game'" />
</template>
```

**成就感**:
- 從 1274 行到 100 行,減少了 92%!
- 邏輯清晰,一目了然
- 這就是重構的魅力

---

### Phase 6: 整合與測試 (2-3 小時)
... (保留原文) ...

---

### Phase 7: ECS 架構遷移 (ECS Migration)

**背景**:
隨著遊戲開發進行，需要支援大量單位（如小兵海 Creep Waves）和複雜技能系統。傳統的物件導向（OOP）繼承方式（`PlayerEntity`, `CreepEntity`）導致邏輯分散且難以擴展。

**目標**:
將遊戲核心重構為 Entity-Component-System (ECS) 架構，以提升性能和可維護性。

#### 7.1 架構設計

**思考**:
> 如何在不破壞現有功能的前提下引入 ECS?

**決策**:
- 採用混合模式：`GameEngine` 保留，但將邏輯核心轉交給 ECS World。
- 漸進式遷移：先從小兵 (Creep) 開始，再到塔 (Tower)，最後是玩家 (Player)。

#### 7.2 實作 ECS 核心

**組件設計 (Components)**:
- 純數據容器，例如 `HealthComponent` 只存 HP，`PhysicsComponent` 只存剛體引用。

**系統設計 (Systems)**:
- `MovementSystem`: 統一處理所有實體移動。
- `CombatSystem`: 統一處理所有傷害判定。
- `SkillSystem`: 處理冷卻與技能狀態。

#### 7.3 遷移過程 (Creep -> Tower -> Player)

1. **Creep**: 成功將 `CreepManager` 重構為 `ECSCreepManager`，與 ECS 系統對接。
2. **Tower**: 建立 `ECSTowerManager`，將防禦塔納入 ECS。
3. **Player (最具挑戰性)**:
   - 移除 `PlayerEntity` class。
   - 將輸入處理 (`InputManager`) 對接到 `ECSPlayerManager`。
   - 技能執行器 (`SkillExecutor`) 重寫為 `ECSSkillExecutor`，完全依賴 ECS 組件。

**遇到的挑戰**:
- **初始化順序**: ECS World 必須在所有 Managers 之前初始化，否則 World 為 undefined。
- **類型依賴**: 舊的 `RenderManager` 依賴 `PlayerEntity` 類別，需徹底解耦。

**成果**:
- 成功移除所有 Legacy Entity 類別。
- 遊戲核心邏輯更加統一，易於測試。
- 為未來功能（如狀態效果、複雜技能）奠定堅實基礎。

---

### Phase 8: 整合與測試 (Ongoing)

**目標**: 修復所有編譯錯誤,確保功能正常

#### 6.1 編譯錯誤修復

**錯誤 1**: RoomService 構造函數參數不匹配
```
Expected 2 arguments, but got 1
```

**原因**: 之前設計時 RoomService 需要 HostManager,但後來移除了

**解決**: 更新 App.vue 的調用

---

**錯誤 2**: 未使用變數警告
```
'characterStore' is declared but its value is never read
```

**處理策略**:
- 真正未使用的: 刪除
- 未來可能用到的: 加 `_` 前綴 (例如 `_app`)
- 參數必須保留的: 加 `_` 前綴

**心得**:
- 零警告是代碼品質的體現
- TypeScript 的嚴格模式幫助我們寫出更好的代碼
- 不要忽視警告,它們可能隱藏著 bug

#### 6.2 main.ts 的清理

**發現的問題**:
```typescript
// main.ts 還在初始化舊的 GameApp
const game = new GameApp()
await game.init(canvas)
```

**衝突**:
- 舊架構: main.ts 直接初始化 GameApp
- 新架構: GameEngine 由 GameService 在需要時初始化

**解決**:
```typescript
// 新的 main.ts (只有 15 行!)
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

**反思**:
- 重構要徹底,不能留下「遺跡」
- 舊代碼的存在會造成混淆
- 簡潔就是美

#### 6.3 功能驗證

**測試流程**:
1. ✅ 啟動開發伺服器 (`npm run dev`)
2. ✅ 打開 http://localhost:5173/
3. ✅ 點擊「建立房間」
4. ✅ 選擇角色
5. ✅ 點擊「準備」
6. ✅ 檢查控制台無錯誤

**測試結果**:
- 所有功能正常運作
- 視圖切換流暢
- 狀態同步正確
- 無控制台錯誤

**成就解鎖**: 🎉 零錯誤構建!

```
✓ 1180 modules transformed
✓ built in 9.52s
Exit code: 0
```

---

## 💡 關鍵決策與權衡

### 1. 為什麼選擇 Pinia 而不是 Vuex?

**理由**:
- ✅ 更好的 TypeScript 支持
- ✅ 更簡潔的 API (無需 mutations)
- ✅ 更好的 DevTools 整合
- ✅ Vue 3 官方推薦

### 2. 為什麼不使用 Vue Router?

**理由**:
- 當前只有 3 個視圖,用 `v-if` 足夠
- 避免過度設計
- 未來需要時可以輕鬆遷移

### 3. 為什麼保留 GameApp.ts?

**理由**:
- 作為參考,避免遺漏功能
- 未來可能需要遷移更多邏輯
- 確認所有功能都已遷移後再刪除

### 4. EventBus vs Pinia Actions?

**決策**: 兩者並用
- **Pinia Actions**: 狀態變更
- **EventBus**: 跨模組通知 (例如 Service → UI)

**理由**:
- Pinia 適合狀態管理
- EventBus 適合事件通知
- 兩者互補,各司其職

---

## 🎓 經驗教訓

### 成功經驗

1. **分階段重構**
   - 不要一次改太多
   - 每個 Phase 都有明確目標
   - 隨時可以回退

2. **類型先行**
   - 先定義好 TypeScript 類型
   - 讓編譯器幫助你重構
   - 類型錯誤是最好的提醒

3. **測試驅動**
   - 每完成一個 Phase 就測試
   - 不要等到最後才測試
   - 早發現,早修復

4. **文檔同步**
   - 邊重構邊記錄
   - task.md 隨時更新
   - walkthrough.md 記錄成果

### 踩過的坑

1. **依賴循環**
   - GameService 引用 GameEngine
   - GameEngine 可能需要 GameService
   - 解決: 動態導入 + 依賴注入

2. **狀態同步**
   - Store 更新了,但 UI 沒反應
   - 原因: 忘記使用 computed
   - 解決: 使用 Pinia 的 reactive getters

3. **類型不匹配**
   - CharacterData vs Character
   - 解決: 統一使用 Character 類型

4. **未清理舊代碼**
   - main.ts 還在初始化 GameApp
   - 造成衝突和困惑
   - 解決: 徹底清理舊代碼

---

## 📊 重構成果

### 代碼量對比

| 文件 | 重構前 | 重構後 | 變化 |
|------|--------|--------|------|
| App.vue | 1274 行 | ~100 行 | -92% |
| main.ts | 56 行 | 15 行 | -73% |
| GameApp.ts | 544 行 | 保留 (未來移除) | - |
| 新增 Stores | 0 | 3 個文件 | +300 行 |
| 新增 Services | 0 | 3 個文件 | +250 行 |
| 新增 Managers | 0 | 3 個文件 | +350 行 |
| 新增 Views | 0 | 3 個文件 | +200 行 |

### 架構改進

**重構前**:
```
App.vue (1274 行)
  ├─ UI 邏輯
  ├─ 狀態管理
  ├─ 網路同步
  └─ 遊戲邏輯

GameApp.ts (544 行)
  ├─ 玩家管理
  ├─ 輸入處理
  ├─ 物理模擬
  └─ 渲染同步
```

**重構後**:
```
Presentation Layer
  ├─ LobbyView
  ├─ RoomView
  └─ GameView

Application Layer
  ├─ RoomService
  ├─ CharacterService
  └─ GameService

Domain Layer
  ├─ roomStore
  ├─ characterStore
  ├─ gameStore
  └─ EventBus

Infrastructure Layer
  ├─ GameEngine
  ├─ PlayerManager
  ├─ InputManager
  ├─ RenderManager
  └─ NetworkManager
```

### 品質指標

- ✅ **編譯錯誤**: 0
- ✅ **TypeScript 警告**: 0
- ✅ **構建時間**: 9.52s
- ✅ **Bundle 大小**: 4.5MB (待優化)
- ✅ **測試覆蓋率**: 待添加

---

## 🔮 未來展望

### 短期計劃 (1-2 週)

1. **添加單元測試**
   - Services 的測試
   - Stores 的測試
   - 目標: 80% 覆蓋率

2. **性能優化**
   - 代碼分割 (Code Splitting)
   - 懶加載 (Lazy Loading)
   - 目標: Bundle 大小減少 50%

3. **清理舊代碼**
   - 移除 GameApp.ts
   - 移除備份文件
   - 整理目錄結構

### 中期計劃 (1-2 月)

1. **完善遊戲功能**
   - 技能系統整合
   - 戰鬥系統優化
   - 多人同步測試

2. **UI/UX 改進**
   - 添加動畫效果
   - 優化移動端體驗
   - 添加音效

3. **文檔完善**
   - API 文檔
   - 架構圖
   - 開發指南

### 長期計劃 (3-6 月)

1. **微服務化**
   - 獨立的房間服務
   - 獨立的匹配服務
   - WebSocket 替代 PeerJS

2. **可觀測性**
   - 日誌系統
   - 性能監控
   - 錯誤追蹤

3. **CI/CD**
   - 自動化測試
   - 自動化部署
   - 版本管理

---

## 🙏 致謝

這次重構的成功,要感謝:

- **TypeScript**: 強大的類型系統讓重構更安全
- **Vue 3**: 優雅的 Composition API
- **Pinia**: 簡潔的狀態管理
- **Vite**: 快速的構建工具

以及最重要的:
- **耐心**: 重構是一個漫長的過程
- **細心**: 每個細節都很重要
- **決心**: 不要半途而廢

---

## 📝 總結

這次重構是一次成功的架構升級:

✅ **從混亂到清晰**: 清晰的分層架構  
✅ **從耦合到解耦**: 模組間低耦合  
✅ **從難測到易測**: 可測試的代碼  
✅ **從難維護到易維護**: 單一職責原則  

**最重要的收穫**:
> 好的架構不是一蹴而就的,而是通過不斷重構、優化、改進而來的。

**給未來的自己**:
> 當你再次面對混亂的代碼時,不要害怕重構。記住這次的經驗,一步一步來,你一定可以做到。

---

**重構完成日期**: 2025-12-03  
**總耗時**: 約 15 小時  
**代碼行數**: 從 1830 行重構為模組化架構 (~1500 行,但更清晰)  
**成就感**: ⭐⭐⭐⭐⭐

🎉 **重構成功!**
