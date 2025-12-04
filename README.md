# 🎮 WebDota

> 一款基於 Web 技術的多人線上競技遊戲 (MOBA)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Vue](https://img.shields.io/badge/Vue-3.4-green.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-purple.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 特色

- 🌐 **純 Web 技術**: 無需安裝,瀏覽器即可遊玩
- 🔗 **P2P 連線**: 基於 PeerJS 的點對點網路架構
- 🎨 **3D 渲染**: 使用 PlayCanvas 引擎
- ⚡ **物理模擬**: Rapier 3D 物理引擎
- 🎯 **模組化架構**: 清晰的分層設計,易於維護和擴展
- 📱 **跨平台**: 支援桌面與移動裝置

## 🚀 快速開始

### 環境需求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安裝

```bash
# 克隆專案
git clone https://github.com/yourusername/webdota.git
cd webdota

# 安裝依賴
npm install
```

### 開發

```bash
# 啟動開發伺服器
npm run dev

# 打開瀏覽器訪問
# http://localhost:5173
```

### 構建

```bash
# 構建生產版本
npm run build

# 預覽生產版本
npm run preview
```

## 🎮 遊戲玩法

### 創建房間

1. 打開遊戲,點擊「建立房間」
2. 選擇你的角色
3. 等待其他玩家加入
4. 所有玩家準備後,Host 可以開始遊戲

### 加入房間

1. 獲取房間 ID (由 Host 提供)
2. 點擊「加入遊戲」
3. 輸入房間 ID
4. 選擇角色並準備

### 操作方式

**桌面端**:
- `W/A/S/D` 或 `方向鍵`: 移動
- `Q/E/R/F`: 技能
- `空白鍵`: 普通攻擊

**移動端**:
- 虛擬搖桿: 移動
- 技能按鈕: 釋放技能

## 🏗️ 架構設計

WebDota 採用清晰的分層架構:

```
┌─────────────────────────────────┐
│    Presentation Layer           │  ← Views & Components
├─────────────────────────────────┤
│    Application Layer            │  ← Services (業務邏輯)
├─────────────────────────────────┤
│    Domain Layer                 │  ← Stores & EventBus
├─────────────────────────────────┤
│    Infrastructure Layer         │  ← Core Engine & Managers
└─────────────────────────────────┘
```

詳細架構說明請參考 [docs/architecture.md](./docs/architecture.md)

## 📁 專案結構

```
webdota/
├── docs/                    # 📚 文檔
│   ├── architecture.md      # 架構設計
│   ├── refactoring-journey.md  # 重構歷程
│   └── game_ideas.md        # 遊戲設計
├── src/
│   ├── components/          # UI 組件
│   ├── views/               # 視圖頁面
│   ├── services/            # 業務邏輯服務
│   ├── stores/              # Pinia 狀態管理
│   ├── events/              # 事件系統
│   ├── core/                # 核心引擎
│   │   ├── GameEngine.ts    # 遊戲引擎
│   │   ├── NetworkManager.ts # 網路管理
│   │   └── managers/        # 各種管理器
│   ├── types/               # TypeScript 類型
│   └── data/                # 靜態數據
├── public/                  # 靜態資源
└── package.json
```

## 🛠️ 技術棧

### 核心框架

- **Vue 3**: 前端框架
- **TypeScript**: 類型安全
- **Vite**: 構建工具
- **Pinia**: 狀態管理

### 遊戲引擎

- **PlayCanvas**: 3D 渲染引擎
- **Rapier**: 物理引擎
- **PeerJS**: P2P 網路

### 開發工具

- **ESLint**: 代碼檢查
- **Prettier**: 代碼格式化
- **TypeScript**: 類型檢查

## 📖 文檔

- [架構設計](./docs/architecture.md) - 完整的架構說明
- [重構歷程](./docs/refactoring-journey.md) - 模組化重構的心路歷程
- [遊戲設計](./docs/game_ideas.md) - 遊戲創意與設計

## 🎯 開發路線圖

### ✅ 已完成

- [x] 基礎遊戲引擎
- [x] P2P 網路連線
- [x] 角色選擇系統
- [x] 模組化架構重構
- [x] 房間管理系統
- [x] 基礎移動與物理

### 🚧 進行中

- [ ] 技能系統完善
- [ ] 戰鬥系統優化
- [ ] UI/UX 改進

### 📋 計劃中

- [ ] 更多角色
- [ ] 地圖系統
- [ ] 排位系統
- [ ] 觀戰模式
- [ ] 回放系統

## 🤝 貢獻指南

歡迎貢獻!請遵循以下步驟:

1. Fork 本專案
2. 創建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 代碼規範

- 使用 TypeScript
- 遵循 ESLint 規則
- 編寫清晰的註釋 (繁體中文)
- 保持代碼簡潔

## 🐛 問題回報

發現 Bug? 請到 [Issues](https://github.com/yourusername/webdota/issues) 回報

回報時請包含:
- 問題描述
- 重現步驟
- 預期行為
- 實際行為
- 截圖 (如果適用)
- 環境資訊 (瀏覽器、作業系統)

## 📊 效能指標

- **構建時間**: ~9.5s
- **Bundle 大小**: 4.5MB (待優化)
- **首次載入**: ~2s
- **遊戲幀率**: 60 FPS

## 🔧 調試技巧

### 開發者工具

在瀏覽器控制台中:

```javascript
// 訪問 Services
window.services.room      // RoomService
window.services.character // CharacterService
window.services.game      // GameService
window.services.network   // NetworkManager

// 查看 Peer ID
window.services.network.peerId

// 查看連接數
window.services.network.connections.size
```

### Vue DevTools

安裝 [Vue DevTools](https://devtools.vuejs.org/) 可以:
- 查看組件層級
- 監控 Pinia Stores
- 追蹤事件

## 📝 更新日誌

### v0.2.0 (2025-12-03)

- ✨ 完成模組化架構重構
- ✨ 新增 Pinia 狀態管理
- ✨ 新增 EventBus 事件系統
- ✨ 重構 UI 層為 Views + Components
- ✨ 創建 Service 層
- 🐛 修復多個網路同步問題
- 📝 完善文檔

### v0.1.0 (2025-12-02)

- ✨ 基礎遊戲引擎
- ✨ P2P 網路連線
- ✨ 角色選擇系統
- ✨ 基礎移動與物理

## 📄 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 文件

## 🙏 致謝

- [Vue.js](https://vuejs.org/) - 優秀的前端框架
- [PlayCanvas](https://playcanvas.com/) - 強大的 3D 引擎
- [PeerJS](https://peerjs.com/) - 簡單的 P2P 解決方案
- [Rapier](https://rapier.rs/) - 高效的物理引擎

## 📞 聯繫方式

- 📧 Email: (待補充)
- 💬 Discord: (待補充)
- 🐦 Twitter: (待補充)

---

**Made with ❤️ by WebDota Team**

⭐ 如果這個專案對你有幫助,請給我們一個 Star!
