# F6 等級與成長

| 項目 | 內容 |
|---|---|
| 里程碑 | M4 等級 |
| 狀態 | 已實作，待合併（2026-11-10，分支 `feat/m4-leveling`） |
| 相關決策 | D1、D2、D6、D16、D23～D26 |
| 數值 | [balance.md](../balance.md#等級與成長f6) |

## 改版前（2026-11-10）

- 沒有等級與經驗；成長只靠最後一擊的金幣（`GameEngine` 的 `KILL_GOLD`）買裝備。
- Q、W、E、R 開局全部可用。
- 復活固定 5 秒（`ECSPlayerManager.RESPAWN_SECONDS`）。
- GAME_STATE 每位玩家的 stats 只有 hp、energy、status（`src/utils/BinarySerializer.ts`）。

## 需求

由 Host 計算，等級與經驗隨 GAME_STATE 同步。

1. **經驗來源**：被動經驗、小兵（附近友方英雄平分，不需最後一擊）、擊殺英雄（擊殺者與助攻隊友平分）、摧毀建築（全隊）。
2. **等級**：1～10，升級門檻見 balance.md。
3. **成長**：每升一級提高最大生命與技能傷害；升級時目前生命同步增加升級量。
4. **大招解鎖**：未達解鎖等級時大招按鈕顯示鎖頭與所需等級，按下無作用；Host 也拒絕未解鎖的大招。
5. **復活時間**隨等級增加。
6. **介面**：狀態列加等級；頭上血條旁顯示等級；經驗條放在技能面板附近；升級時有特效與提示。
7. **同步**：GAME_STATE 每位玩家新增 xp（Uint16，累計經驗），等級由經驗推得、不另外傳（D23）；加入房間時檢查版本（D16、D24）；Host 遷移後沿用最後收到的值。

## 實作重點

- **計算**：`src/core/progression/leveling.ts`（門檻、等級進度、復活時間、成長、經驗平分），數值在 `src/data/balance.ts` 的 `LEVELING`。
- **經驗來源**：`src/core/progression/ExperienceAwards.ts`，只在 Host 執行。被動經驗每個模擬幀加，陣亡中也有；死亡事件（`ENTITY_DIED`，此時實體還在）依死者種類分配（D25）。
- **存放**：`ECSPlayerManager` 存每位玩家的累計經驗（`getXp`／`addXp`／`setXp`），Client 由 GAME_STATE 套用；等級改變時重算最大生命（基礎 × 8% × (等級 − 1)，裝備另加）與 `CombatComponent.damageMultiplier`，升級時發 `PLAYER_LEVEL_UP`。
- **技能傷害**：`ECSSkillExecutor` 用 `scaledDamage`：(基礎 + 裝備攻擊力) × 等級倍率；沒有傷害的技能維持 0。
- **大招鎖**：`GameEngine.canUseSkill`，本地 `useSkill` 與 Host 的 `applySkill` 都檢查。按鈕（`SkillButton` 的 `lockedLevel`）顯示鎖頭與「Lv4」，按下只播冷卻音。
- **介面**：狀態列 `Lv N`；頭上名稱改成「Lv3 暱稱」（`UIManager.createPlayerUI` 的 `setLabel` 重畫）；畫面下方中央經驗條（本級進度，滿級顯示 MAX）；升級時金色光柱特效（`public/env/level-up.png`）與「升級！LvN」，本地玩家到 4 級另有「大招已解鎖」通知。
- **回血跳字**：`RegenFeedback` 扣掉最大生命的增加量，升級或買裝備時目前生命跟著上升不會顯示成「脫戰回復」。
- **第一波小兵**：Host 在 `startGame` 生成建築後立刻出第一波，之後每 30 秒一波（D26）。
- **版本檢查**：見 D24。建置時把 commit 前 12 碼寫進 `__BUILD_ID__`（`vite.config.ts`、`src/buildInfo.ts`），開發伺服器一律是 `dev`。

## 驗收

- [x] 經驗平分、等級門檻、復活時間的計算有單元測試（`src/core/progression/__tests__/leveling.spec.ts`）。
- [x] 1v1 實測約 2 分鐘內解鎖大招：原本約 2 分 20 秒（第一波小兵 30 秒才出），改成開局就出第一波（D26）後約 1 分 50 秒。
- [x] Client 看到的等級、經驗與 Host 一致；Host 遷移後等級與經驗保留。
- [x] 升級後最大生命與技能傷害正確增加。
- [x] 未解鎖時按大招沒有作用，按鈕有鎖頭提示。

## 實作紀錄

| 日期 | 分支／commit | 內容 | 驗證結果 |
|---|---|---|---|
| 2026-11-10 | `feat/m4-leveling` | 等級、經驗、成長、大招鎖、介面、升級特效、版本檢查 | 單元測試 78 項通過。單頁：1 級按大招冷卻維持 0、鎖頭顯示；設定 600 經驗升 4 級，最大生命 1000→1240、傷害倍率 1.15、大招可放；10 級 1720、1.45，陣亡復活 11.75 秒；殺死英雄旁的敵方小兵得 30 經驗。雙分頁：Host 設定的經驗與等級在 Client 一致（含 HUD 與升級提示）；Host 離開後 Client 接手，經驗 904 保留並繼續累加被動經驗。正式建置（版本 commit 編號）加入開發伺服器（dev）的房間被拒絕，顯示「版本不同」。升級速度：英雄站在主路中段、清掉 6 單位內的敵方小兵，141 秒 646 經驗到 4 級（120 秒時 496）；只站著不打則 140 秒 494。改成開局就出第一波小兵（D26）後重測：100 秒 552、120 秒 672，約 1 分 50 秒到 4 級 |
