# WebDota 文檔中心

歡迎來到 WebDota 的文檔中心!這裡包含了專案的所有重要文檔。

## 📚 文檔索引

### 🏗️ 架構文檔

**[architecture.md](./architecture.md)** - 完整的架構設計文檔
- 分層架構說明
- 各層職責定義
- 數據流向圖
- 目錄結構
- 類型定義
- 測試策略
- 性能優化
- 調試技巧

**適合閱讀對象**: 新加入的開發者、想要了解整體架構的人

---

### 📖 重構歷程

**[refactoring-journey.md](./refactoring-journey.md)** - 模組化架構重構心路歷程
- 重構動機與目標
- 6 個 Phase 的詳細過程
- 遇到的挑戰與解決方案
- 關鍵決策與權衡
- 經驗教訓
- 未來展望

**適合閱讀對象**: 想要了解重構過程、學習架構設計的人

---

### 💡 遊戲設計

**[game_ideas.md](./game_ideas.md)** - 遊戲創意與設計文檔
- 遊戲概念
- 角色設計
- 技能系統
- 地圖設計
- 遊戲模式

**適合閱讀對象**: 遊戲設計師、想要了解遊戲玩法的人

---

## 🚀 快速開始

### 新開發者入門

1. **了解架構** → 閱讀 [architecture.md](./architecture.md)
2. **了解歷史** → 閱讀 [refactoring-journey.md](./refactoring-journey.md)
3. **了解遊戲** → 閱讀 [game_ideas.md](./game_ideas.md)
4. **開始開發** → 查看根目錄的 README.md

### 想要貢獻代碼?

1. Fork 專案
2. 閱讀 [architecture.md](./architecture.md) 了解架構
3. 創建 feature 分支
4. 提交 Pull Request

---

## 📁 專案結構

```
webdota/
├── docs/                    # 📚 文檔目錄 (你在這裡)
│   ├── README.md           # 文檔索引
│   ├── architecture.md     # 架構文檔
│   ├── refactoring-journey.md  # 重構歷程
│   └── game_ideas.md       # 遊戲設計
├── src/                    # 源代碼
│   ├── components/         # UI 組件
│   ├── views/              # 視圖頁面
│   ├── services/           # 業務邏輯
│   ├── stores/             # 狀態管理
│   ├── events/             # 事件系統
│   ├── core/               # 核心引擎 (ECS)
│   │   ├── ecs/            # ECS 核心與 Systems
│   │   ├── managers/       # ECS Managers
│   │   ├── GameEngine.ts   # 遊戲主程式
│   │   └── NetworkManager.ts # 網路管理
│   ├── types/              # 類型定義
│   └── data/               # 靜態數據
└── README.md               # 專案 README
```

---

## 🎯 文檔維護

### 更新原則

- **架構變更** → 更新 `architecture.md`
- **重大重構** → 記錄到 `refactoring-journey.md`
- **新功能設計** → 更新 `game_ideas.md`
- **文檔索引** → 更新 `docs/README.md`

### 文檔風格

- 使用繁體中文
- 使用 Markdown 格式
- 添加圖表和代碼示例
- 保持簡潔清晰

---

## 📞 聯繫方式

有任何問題或建議?

- 📧 Email: (待補充)
- 💬 Discord: (待補充)
- 🐛 Issues: [GitHub Issues](待補充)

---

**最後更新**: 2026-01-11  
**維護者**: WebDota Team

🎮 **Happy Coding!**
