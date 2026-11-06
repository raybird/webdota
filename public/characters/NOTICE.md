# webdota 原創角色像素素材

設計、產製與檢視日期：2026-11-06。

戰士、刺客與法師的角色設計、立繪、頭像及產生程式均為 webdota 原創，沒有模仿現有遊戲角色，沒有使用第三方角色素材或生成式圖片。
所有形狀直接繪於原始像素網格；不使用抗鋸齒、半透明、羽化、縮小量化或背景陰影。光源位於左上，外框採 `#1a1422`。
每個角色的立繪與頭像合計最多使用 16 種不透明顏色；透明像素不計。

## 重製方式（2026-11-06）

需求：Python 3 與 Pillow。2026-11-06 的產製環境使用 Python 3 與 Pillow 12.2.0，執行不需要網路。
從 repo 根目錄執行：

```sh
python3 tools/portraits/generate.py
```

此指令重製全部六張角色 PNG、三份 JSON、五張預覽 PNG 與 `tools/portraits/validation.json`。
相同版本 Pillow 的輸出可重現，程式不使用亂數、外部字型或外部素材。

## 播放與構圖（2026-11-06）

| 角色 | 立繪 | 頭像 | 每格尺寸 | 格數 | fps | 每格 duration（2026-11-06） | loop | pivot | columns |
|---|---|---|---|---:|---:|---|---|---|---:|
| warrior | `warrior-idle.png` | `warrior-avatar.png` | 96×96 | 8 | 8 | 125 ms | true | [48, 92] | 8 |
| assassin | `assassin-idle.png` | `assassin-avatar.png` | 96×96 | 8 | 8 | 125 ms | true | [48, 92] | 8 |
| mage | `mage-idle.png` | `mage-avatar.png` | 96×96 | 8 | 8 | 125 ms | true | [48, 92] | 8 |

立繪 sheet 為 768×96，影格由左至右排列。pivot 以每格左上角為原點、單位為像素，落在角色雙腳中央的腳底線；最後一列腳底像素為 y=91，下方保留 4px 透明邊界。
頭像為獨立的 32×32 頭肩構圖，沒有把立繪直接縮小。三人的寬肩板甲、低姿勢雙刀與尖帽長袍形成不同剪影。
2026-11-06 的待機循環使用固定腳底、胸腔起伏與衣襬擺動；法師另有水晶分色閃爍與獨立起伏的小魔法球，alpha 始終只有 0 與 255。

## 預覽與檢查（2026-11-06）

- `tools/portraits/preview-overview.png`：深色背景、三人並排，含立繪與獨立頭像，全部以 nearest-neighbor 放大 4 倍。
- `tools/portraits/preview-all-frames.png`：深色背景、三人並排，逐列列出全部八格與頭像，全部放大 4 倍。
- `tools/portraits/preview-warrior.png`、`preview-assassin.png`、`preview-mage.png`：各角色全部八格的 4 倍分頁。
- `tools/portraits/validation.json`：2026-11-06 的尺寸、色數、格數、pivot、每格範圍、實際檔案大小與 SHA-256。

產生程式檢查每個角色合計不超過 16 色、二值 alpha、八格皆有差異、固定腳底、影格尺寸與 JSON 矩形一致，以及每張 PNG 不超過 100000 bytes。
2026-11-06 已目視檢查總覽、三張獨立頭像與三份八格分頁：戰士的寬肩、大劍與盾牌，刺客的半遮臉兜帽、反握雙刀與披風，法師的尖帽、青色水晶與魔法球均可辨識；沒有裁斷、羽化或額外地面陰影。
2026-11-06 重複執行產生指令後，全部 17 個交付與工具檔案的 SHA-256 逐一相同；三個角色各使用 16 色，身高範圍依序為 77～79px、72～74px、78～80px。

## pixelfx 相容性與來源（2026-11-06）

像素語言與既有 `public/fx/` 一致，沿用其 `#1a1422` 外框色及 Aseprite 風格 metadata 契約，包括 `frames[].frame`、`meta.size`、`meta.image` 與 `meta.pixelfx` 欄位。
角色形狀、繪圖工具、動作與頭像皆自行撰寫，沒有複製或沿用 pixelfx 的角色骨架或程式碼。
既有特效來源為 [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)，採 MIT 授權；完整第三方聲明位於 [`../fx/NOTICE.md`](../fx/NOTICE.md)，該授權所涵蓋的特效與本目錄的原創角色素材分別記錄。
