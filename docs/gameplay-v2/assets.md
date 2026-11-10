# 素材製作

需要圖片素材時，由 Claude 呼叫 Codex CLI（`codex exec`，本機 2026-11-10 為 codex-cli 0.167.0）協助製作，Claude 負責交代規格、檢查成果與整合進遊戲（決策 D12）。

## 製作流程

1. **列需求**：在下方「素材清單」寫明用途、尺寸、動畫格數、要放的目錄。
2. **交給 Codex**：用 `codex exec` 執行，提示詞附上：
   - 本檔的「共用規格」。
   - 要擴充或新增的產生腳本路徑，以及參考用的既有素材。
   - 輸出目錄與檔名。
3. **產生方式沿用現有流程**：用 Python（Pillow）腳本產生像素圖，腳本放在 `tools/` 下，固定亂數種子，可重複執行。不直接提交沒有產生腳本的圖檔。
   - 場景、建築、小兵、特效：`tools/env/generate.py`、`tools/env/generate_fx.py` → `public/env/`
   - 角色：`tools/portraits/generate.py`、`tools/portraits/generate_battle.py` → `public/characters/`
4. **輸出內容**：素材 PNG＋對應 JSON（`meta.pixelfx`：frameSize、pivot、fps、frames 等）、預覽圖（`tools/**/preview-*.png`）、更新 `validation.json`。
5. **檢查**：Claude 看預覽圖，再進遊戲截圖（844×390、1280×720）確認比例、光源、遮擋都正確；不合格就把問題回饋給 Codex 重做。
6. **記錄**：在本檔的「製作紀錄」寫下日期、素材、腳本與 commit。

## 共用規格

細節以 [architecture.md](../architecture.md) 的「像素連續圖特效」與場景風格段落為準。

- **原創設計**：不得模仿或重製任何既有遊戲的角色、美術或介面。
- **比例**：每單位 19 素材像素；以原始解析度輸出，不預先縮小。
- **鏡頭**：正交斜俯視，俯角 36.87°（水平每單位 19px、地面縱深每單位 11.4px、垂直面每單位 15.2px）。
- **光源**：畫面左上方；投影由遊戲執行時產生，素材本身不畫地面陰影。
- **風格**：HD-2D 像素風；外框色 `#1a1422`；與現有 `public/env`、`public/characters` 的調色盤一致。
- **隊伍色**：藍方、紅方各一版（需要分隊的素材）。
- **透明背景**：PNG 含 alpha；遊戲材質 alphaTest 為 0.1，半透明效果要高於這個門檻。

## 素材清單

| 功能 | 素材 | 說明 | 必要性 | 狀態 |
|---|---|---|---|---|
| F3 | 面向箭頭 | 腳下的方向指示 | 可用程式繪製，不一定需要素材 | 未開始 |
| F3 | 除錯圈 | 受擊範圍與判定圈 | 程式繪製 | — |
| F4 | 回血特效 | 頭上小幅綠色效果，循環 | 需要 | 未開始 |
| F4 | 泉水地面標記 | 自家主堡周圍的回血範圍 | 需要 | 未開始 |
| F5 | 地圖 v2 地面 | 約 96×96 的地面，含主路與野區地面變化 | 需要 | 未開始 |
| F5 | 野區牆面與障礙物 | 隔出野區入口的牆、岩石等 | 需要 | 未開始 |
| F5 | 三種塔的外觀區別 | 外塔、內塔、主堡前塔（可共用造型、以細節區分） | 選用 | 未開始 |
| F6 | 升級特效 | 角色腳下或周圍的一次性特效 | 需要 | 未開始 |
| F6 | 等級徽章與大招鎖頭 | HUD 介面用 | 可先用 CSS 或文字 | 未開始 |
| F7 | 草叢 | 2.5D 草叢，含「自己隊伍在裡面時的半透明版」 | 需要 | 未開始 |
| F7 | 迷霧遮罩 | 視野外變暗 | 程式繪製 | — |

## 製作紀錄

| 日期 | 素材 | 腳本 | commit | 備註 |
|---|---|---|---|---|
| 2026-11-10 | 草叢（`public/env/brush-top.png` 95×57、`brush-side.png` 95×24） | `tools/env/generate_brush.py`（無亂數，驗證檔 `tools/env/validation-brush.json`，預覽 `tools/env/preview-brush.png`） | 待提交（`feat/m5-vision`） | Codex CLI 製作；7 色深綠，頂面上下左右可平鋪，正面左右可平鋪、上方 5px 葉尖（alpha 0／255）。Claude 檢查：遊戲內 10 叢草的位置、英雄在草裡只露出上半身、本地英雄所在草叢半透明 |
| 2026-11-10 | 升級特效（`public/env/level-up.png`，每格 64×96、14 格、12fps、pivot [32,88]） | `tools/env/generate_levelup_fx.py`（無亂數，驗證檔 `tools/env/validation-level-up.json`，預覽 `tools/env/preview-level-up.png`） | 792119a（合併 dc8851b） | Codex CLI 製作；金色 6 色，腳下扁橢圓光環、三道光帶與向上箭形，與重生光柱（藍白）區分。Claude 檢查：遊戲內升級時罩住英雄、跟著移動，約 1.2 秒 |
| 2026-11-10 | arena_v2 地面（`public/env/arena_v2/ground-{blue,red}.png`，1824×1094） | `tools/maps/bake_ground.py`（種子 20261110，驗證檔 `tools/maps/validation-arena_v2.json`，預覽 `tools/maps/preview-arena_v2.png`） | 911b243（合併 98b593f） | Codex CLI 製作；沿用 `tools/env/generate.py` 的調色盤與畫法。主路 7 單位泥路、主堡鋪石、塔底鋪石環、野區苔草、空地、封閉區裂岩。兩隊只差主堡點綴。Claude 檢查：在遊戲裡逐點對照主堡、塔、空地與封閉區位置 |
