# 技術架構說明
Web MOBA 遊戲技術文件

---

## 📋 目錄

1. [整體架構](#整體架構)
2. [技術選型](#技術選型)
3. [核心模組](#核心模組)
4. [網路架構](#網路架構)
5. [同步機制](#同步機制)
6. [資料流](#資料流)
7. [目錄結構](#目錄結構)
8. [部署架構](#部署架構)

---

## 🏗️ 整體架構

```
┌─────────────────────────────────────────────────────────┐
│                     用戶端 (Browser)                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   UI Layer   │  │  Game Logic  │  │   Renderer   │  │
│  │   (Vue 3)    │  │  (GameApp)   │  │ (PlayCanvas) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│  ┌─────────────────────────┴────────────────────────┐   │
│  │        Network Manager (WebRTC P2P)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ PeerJS   │  │  Input   │  │    State     │  │   │
│  │  │Connection│  │Broadcast │  │Synchronize   │  │   │
│  │  └──────────┘  └──────────┘  └──────────────┘  │   │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │          Physics Engine (Rapier3D)                   ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                            │
                            │ WebRTC P2P
                            │
                    ┌───────┴────────┐
                    │  PeerJS Server │ (STUN/TURN)
                    └────────────────┘
```

---

## 🛠️ 技術選型

### 前端框架
- **Vue 3** (Composition API)
  - 輕量級、響應式 UI
  - 用於遊戲外殼（大廳、HUD）
  - 原因：熟悉度高、生態系完整

### 3D 渲染引擎
- **PlayCanvas Engine**
  - WebGL 渲染
  - 核心渲染引擎
  - 原因：性能優異、社群活躍
- **自研 ECS 架構**
  - Entity-Component-System
  - 原因：解耦邏輯與數據、高性能大量單位（Creeps）處理、易於測試與擴展

### 物理引擎
- **Rapier3D**
  - Rust 編寫，編譯為 WASM
  - 高性能 3D 物理模擬
  - 原因：確定性模擬、跨平台一致性

### 網路層
- **PeerJS** (wrapper for WebRTC)
  - P2P 連線建立
  - DataChannel 通訊
  - 原因：簡化 WebRTC API、自動處理 STUN/TURN

### 建置工具
- **Vite**
  - 快速開發伺服器
  - 原生 ESM 支援
  - 原因：快速熱更新、TypeScript 原生支援

### 語言
- **TypeScript**
  - 型別安全
  - 原因：大型專案維護性、IDE 支援

---

## 🧩 核心模組

### 1. ECS (Entity Component System) 核心
**架構核心：**
遊戲邏輯完全由 ECS 驅動。GameEngine 僅作為協調器，初始化 World 並驅動 update loop。

**組成：**
- **World**: 實體與系統的容器，負責調度 Systems 更新。
- **Entities**: 純 ID (string)，無邏輯，僅作為組件的鍵值。
- **Components**: 純數據容器
  - `PhysicsComponent`: 剛體與碰撞體
  - `HealthComponent`: 生命值與狀態
  - `SkillComponent`: 技能冷卻與能量
  - `InputComponent`: 輸入緩存
  - `RenderComponent`: 模型引用
- **Systems**: 邏輯處理者
  - `MovementSystem`: 處理物理移動
  - `CombatSystem`: 處理傷害判定
  - `SkillSystem`: 處理技能執行與冷卻
  - `RenderSystem`: 同步物理位置到渲染模型

**GameEngine 職責變更：**
- 初始化 ECS World
- 註冊 Systems
- 在 `fixedUpdate` 中呼叫 `world.update(dt)`

**資料流：**
```
User Input → ECSPlayerManager (InputComponent)
→ PlayerInputSystem (Update Velocity)
→ MovementSystem (Apply Physics)
→ Physics Engine (Step)
→ ECSRenderSystem (Sync to Visuals)
```

---

### 2. NetworkManager.ts (網路管理)
**職責：**
- WebRTC 連線建立與維護
- 輸入廣播與接收
- 遊戲狀態同步
- Frame 同步

**關鍵功能：**
- `createRoom()` - 建立房間（成為 Host）
- `joinRoom(id)` - 加入房間
- `broadcastInput()` - 廣播玩家輸入
- `sendGameState()` - 發送完整遊戲狀態（新玩家加入時）

**訊息類型：**
```typescript
{
  type: 'input' | 'sync_frame' | 'player_ready' | 
        'game_start_countdown' | 'game_started' | 'game_state'
}
```

---

### 3. ECS Entities (實體)
**所有遊戲物件皆為 ECS Entity：**
- **Player**: 由 `ECSPlayerManager` 管理。包含 Input, Skill, Stats, Physics 組件。
- **Creep**: 由 `ECSCreepManager` 管理。大量生成的 AI 單位。
- **Tower**: 由 `ECSTowerManager` 管理。防禦塔。

**ECS Managers 職責：**
- 負責 Entity 的生命週期 (Create/Destroy)
- 提供對外的查詢 API (例如 `getPlayer(id)`)
- 作為 GameEngine 與 ECS World 之間的橋樑

**不再使用傳統 OOP Entity 類別 (如 PlayerEntity, CreepEntity)。**

---

### 4. HostManager.ts (Host 管理)
**職責：**
- 判定當前 Host
- Host 切換邏輯
- Host 專屬權限（遊戲開始、Frame 同步）

**機制：**
- 最早加入的玩家為 Host
- Host 離開時自動轉移（按加入順序）

---

### 5. App.vue (UI Shell)
**職責：**
- 大廳 UI（建立/加入房間）
- 等待室（玩家列表、準備狀態）
- 遊戲中 HUD（血條、MP、小地圖）
- Debug 面板

---

## 🌐 網路架構

### P2P Mesh 架構
```
Player A ←──────→ Player B
   ↑                 ↑
   │                 │
   ↓                 ↓
Player C ←──────→ Player D
```

**特點：**
- 全連接（Full Mesh）
- 每個玩家直接連接所有其他玩家
- 無中央伺服器（除了信令）

**優點：**
- ✅ 低延遲（無伺服器中介）
- ✅ 無伺服器成本
- ✅ 天然去中心化

**缺點：**
- ⚠️ 連線數隨玩家數平方增長（N*(N-1)/2）
- ⚠️ 受限於最慢玩家網速
- ⚠️ 欠缺伺服器端驗證（容易作弊）

**適用場景：**
- 2-8 人小型遊戲
- 信任環境（朋友間遊玩）
- 快節奏對戰

---

### 連線建立流程

```
Host                          PeerJS Server              Client
 │                                  │                       │
 │──── createRoom() ───────────────→│                       │
 │                                  │                       │
 │←──── Room ID ───────────────────│                       │
 │                                  │                       │
 │                                  │←── joinRoom(ID) ─────│
 │                                  │                       │
 │←──────────────── Offer ──────────────────────────────────│
 │                                                          │
 │──────────────── Answer ──────────────────────────────────→│
 │                                                          │
 │←══════════════ WebRTC P2P Connection ═══════════════════→│
 │                                                          │
 │──── onPeerJoined(Client) ─────────────────────────────→ │
 │                                                          │
 │──── sendGameState() ───────────────────────────────────→ │
 │                                                          │
 │←──── onGameState() ─────────────────────────────────────│
```

---

## ⚙️ 同步機制

### Deterministic Lockstep (確定性鎖步)

**核心概念：**
所有客戶端執行相同的輸入序列，得到相同的遊戲狀態。

**實作流程：**
```
Frame N:
1. 收集本地輸入 → Input_A
2. 廣播 Input_A 給所有玩家
3. 等待接收所有玩家的 Input (A, B, C, D)
4. 排序輸入（按 PlayerId）
5. 依序處理所有輸入
6. 執行物理模擬
7. 同步視覺
8. Frame N+1
```

**關鍵要素：**
1. **確定性**：相同輸入 → 相同輸出
   - 使用固定時間步長（16.67ms）
   - Rapier 物理引擎確保一致性
   
2. **輸入排序**：確保所有客戶端處理順序一致
   ```typescript
   allInputs.sort((a, b) => a.playerId.localeCompare(b.playerId))
   ```

3. **Frame 同步**：Host 定期廣播標準 Frame
   ```typescript
   if (isHost && currentFrame % 60 === 0) {
     broadcastFrameSync(currentFrame)
   }
   ```

4. **容錯機制**：允許 N 幀內的輸入
   ```typescript
   // 尋找最近 10 幀內的輸入
   for (let offset = 0; offset <= 10; offset++) {
     const checkFrame = currentFrame - offset
     if (inputBuffer.has(checkFrame)) return input
   }
   ```

---

### 狀態同步

**新玩家加入時：**
Host 發送完整遊戲狀態：
```typescript
{
  isGameStarted: boolean,
  currentFrame: number,
  players: [
    { id, pos: {x, y, z}, stats: {...} }
  ]
}
```

**優點：**
- 新玩家立即同步到當前狀態
- 避免重放所有歷史輸入

---

## 🔄 資料流

### 輸入流
```
Keyboard/Touch Input
       ↓
collectInput() (GameApp)
       ↓
broadcastInput() (NetworkManager)
       ↓
WebRTC DataChannel → All Peers
       ↓
onInputReceived() (NetworkManager)
       ↓
inputBuffer.set(frame, input)
       ↓
fixedUpdate() reads inputBuffer
       ↓
processInputs() applies inputs
       ↓
player.move(moveX, moveY, dt)
       ↓
rigidBody.setNextKinematicTranslation()
       ↓
physicsWorld.step()
       ↓
player.syncVisuals()
```

### 渲染流
```
app.on('update', gameLoop)
       ↓
timer > FIXED_TIME_STEP?
       ↓ Yes
fixedUpdate(dt) × N times
       ↓
players.forEach(p => p.syncVisuals())
       ↓
PlayCanvas renders frame
```

---

## 📁 目錄結構

```
webdota/
├── docs/                    # 📚 文件
│   ├── architecture.md      # 技術架構
│   └── game_ideas.md        # 遊戲建議
│
├── public/                  # 靜態資源
│   └── vite.svg
│
├── src/
│   ├── core/                # 🎮 遊戲核心模組
│   │   ├── GameApp.ts       # 遊戲主程式
│   │   ├── NetworkManager.ts# 網路管理
│   │   ├── PlayerEntity.ts  # 玩家實體
│   │   └── HostManager.ts   # Host 管理
│   │
│   ├── components/          # Vue 元件
│   │   └── HelloWorld.vue
│   │
│   ├── assets/              # 資源檔案
│   │   └── vue.svg
│   │
│   ├── App.vue              # 主要 UI Shell
│   ├── main.ts              # 應用入口
│   └── style.css            # 全域樣式
│
├── index.html               # HTML 入口
├── package.json             # 專案設定
├── tsconfig.json            # TypeScript 設定
├── vite.config.ts           # Vite 設定
└── .gitignore
```

---

## 🚀 部署架構

### 目前架構（開發階段）
```
┌─────────────────────────────────────┐
│         Vercel / Netlify            │
│  ┌───────────────────────────────┐  │
│  │   靜態檔案 (HTML/JS/CSS)      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓ CDN
┌─────────────────────────────────────┐
│         玩家瀏覽器                   │
│  ┌───────────────────────────────┐  │
│  │     Game Client               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓ WebRTC
      PeerJS Cloud Server
    (peerjs.com 提供的免費服務)
```

**優點：**
- ✅ 零伺服器成本（僅靜態託管）
- ✅ 全球 CDN 分發
- ✅ HTTPS 自動化

**缺點：**
- ⚠️ 依賴第三方 PeerJS 服務
- ⚠️ 連線穩定性受限

---

### 未來架構（生產環境）

```
┌─────────────────────────────────────┐
│         雲端伺服器 (VPS/Cloud)       │
│  ┌───────────────────────────────┐  │
│  │   自建 PeerJS Server          │  │
│  │   (STUN/TURN 伺服器)          │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │   API Server (Optional)       │  │
│  │   - 匹配系統                   │  │
│  │   - 戰績記錄                   │  │
│  │   - 排行榜                     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**建議服務商：**
- **DigitalOcean** - 穩定、便宜
- **AWS EC2** - 彈性、全球節點
- **Linode** - 性價比高

**TURN 伺服器（NAT 穿透）：**
- **Coturn** - 開源 TURN 伺服器
- **Twilio STUN/TURN** - 按量計費

---

## 🔒 安全性考量

### 目前限制
⚠️ **無伺服器驗證** - P2P 架構容易被修改客戶端作弊

### 可能作弊方式
1. 修改本地速度
2. 發送虛假輸入
3. 修改傷害數值

### 緩解措施
1. **客戶端驗證**：玩家互相驗證對方狀態
   ```typescript
   // 每個玩家檢查其他玩家的移動距離是否合理
   if (distance > MAX_SPEED * dt) {
     reportCheat(playerId)
   }
   ```

2. **Replay 系統**：記錄所有輸入，事後檢測
   
3. **信任環境**：限定為朋友間遊玩

### 長期方案
- 引入 **權威伺服器**（Authoritative Server）
- 客戶端僅發送輸入，伺服器計算結果
- 需要後端開發與伺服器成本

---

## 📊 性能指標

### 目標性能
- **幀率**：60 FPS (16.67ms/frame)
- **網路延遲**：< 100ms (區域網路)
- **輸入延遲**：< 2 frames (33ms)
- **最大玩家數**：8 人

### 效能瓶頸
1. **物理模擬**：Rapier 計算（主執行緒）
2. **渲染**：PlayCanvas WebGL（GPU）
3. **網路**：受限於最慢玩家

### 優化方向
1. 使用 Web Worker 處理物理
2. LOD 系統（遠處降低細節）
3. 實作 Client-Side Prediction（減少延遲感）

---

## 🔮 未來擴展

### 短期（1-2 個月）
- [ ] 虛擬搖桿（手機支援）
- [ ] 技能系統
- [ ] 裝備系統
- [ ] AI 敵人

### 中期（3-6 個月）
- [ ] 匹配系統（隨機配對）
- [ ] 排行榜（雲端儲存）
- [ ] 重播系統
- [ ] 語音聊天（WebRTC Audio）

### 長期（6-12 個月）
- [ ] 權威伺服器架構
- [ ] 多地圖支援
- [ ] 觀戰模式
- [ ] 錦標賽系統

---

## 📚 參考資源

### 文件
- [PlayCanvas Engine Docs](https://developer.playcanvas.com/)
- [Rapier3D Documentation](https://rapier.rs/)
- [PeerJS Documentation](https://peerjs.com/docs/)
- [WebRTC MDN Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

### 相關技術文章
- [Deterministic Lockstep in Multiplayer Games](https://gafferongames.com/post/deterministic_lockstep/)
- [Fast-Paced Multiplayer (Gabriel Gambetta)](https://www.gabrielgambetta.com/client-server-game-architecture.html)

---

**文件版本：** v1.0  
**最後更新：** 2025-11-30  
**維護者：** [Your Name]
