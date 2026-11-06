# pixelfx 素材來源與授權

產製與檢視日期：2026-11-06。

來源：[patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)，版本 0.3.0，固定提交 `a84159688af3ca37a4be05a0d422b94451b2e24e`。
本目錄只包含產出的透明 PNG、Aseprite 風格 JSON 與本說明；未包含 pixelfx 原始碼、node_modules 或 Patch Pixel 字型。

## 素材與輸出參數（2026-11-06）

| 素材檔名 | pixelfx 效果 id | 原效果時長（2026-11-06） | 格數 | 每格尺寸 | fps | 每格 duration | loop | pivot（像素） | columns | PNG bytes |
|---|---|---|---:|---|---:|---|---|---|---:|---:|
| fireball-impact | `explosions/plasma-explosion` | 1.7 秒 | 21 | 204×194 | 12 | 83 ms（2026-11-06） | false | [105, 97] | 5 | 180410 |
| hit-spark | `impacts/hit-spark` | 0.5 秒 | 7 | 125×74 | 12 | 83 ms（2026-11-06） | false | [36, 58] | 3 | 11291 |
| respawn-beam | `spawn/respawn-beam` | 2.5 秒 | 31 | 128×150 | 12 | 83 ms（2026-11-06） | false | [64, 136] | 7 | 157765 |
| death-poof | `spawn/poof` | 1.6 秒 | 20 | 95×79 | 12 | 83 ms（2026-11-06） | false | [45, 67] | 5 | 46986 |

PNG 合計 396452 bytes；每張不超過 600000 bytes，合計不超過 1500000 bytes。
2026-11-06 正式採用原始解析度版本，移除每格 128×128 的限制；後處理只裁除透明邊，不做縮放。

2026-11-06 經協調者確認，保留原效果時長，放寬原先 1.2 秒的上限；沒有加速或刪除時間軸上的影格。
2026-11-06 的取樣保留 render 工具原有規則：`round(duration * fps) + 1` 格、每格 `round(1000 / fps)` ms，因此總播放長度含結束格且略有取整差異；JSON 中的 12 fps 與 83 ms 完全沿用 render 輸出。
JSON 保留 `frames` 陣列、矩形、`duration`、`sourceSize`、`spriteSourceSize`、`meta.pixelfx` 與其他原有欄位結構；只有檔名、裁切相關的矩形、尺寸及 pivot 同步更新。
pivot 以每格左上角為原點，單位為像素，延續原效果的命中原點或腳底原點；裁切後 pivot 只減去左上角偏移，保持原始像素座標。

## 實際 render 指令（2026-11-06）

環境：Node.js v22.20.0、Python 3、Pillow 12.2.0；render 的 PNG 路徑不需安裝 canvas 或 ffmpeg。
pixelfx clone、render 輸出與後處理腳本均位於 `/tmp`，未放進 webdota。

```sh
git clone --depth 1 https://github.com/patch-gg/pixelfx.git /tmp/webdota-pixelfx-task_f052e6dfbcc7
cd /tmp/webdota-pixelfx-task_f052e6dfbcc7

node tools/render.mjs explosions/plasma-explosion --sheet --no-actor --bg none --fps 12 --seed 7 --opts '{"palette":["#2d0802","#6e1606","#c0350d","#f0641b","#ff9e3d","#ffe4a3","#ffffff"],"accent":["#300408","#8c1910","#e04816","#ffae59","#ffe3b5"]}' --out /tmp/webdota-pixelfx-render-8e7d3bf99e5b

node tools/render.mjs impacts/hit-spark --sheet --no-actor --bg none --fps 12 --seed 4 --out /tmp/webdota-pixelfx-render-8e7d3bf99e5b

node tools/render.mjs spawn/respawn-beam --sheet --no-actor --bg none --fps 12 --seed 12 --opts '{"palette":["#271102","#62350a","#a26816","#d99a2b","#ffcc63","#fff0bf","#ffffff"],"actor":{"x":100000,"y":-36,"mask":{"w":1,"h":36,"data":[1]}}}' --out /tmp/webdota-pixelfx-render-8e7d3bf99e5b

node tools/render.mjs spawn/poof --sheet --no-actor --bg none --fps 12 --seed 21 --out /tmp/webdota-pixelfx-render-8e7d3bf99e5b
```

`fireball-impact` 的 palette 與 accent 均改為橘紅，`respawn-beam` 的 palette 改為金白。
`respawn-beam` 的效果程式會自行畫入角色，`--no-actor` 只會隱藏預覽用角色；因此另透過原有 `actor` 選項指定畫布外的最小遮罩，保留光柱、掃描線及粒子，移除角色身體與角色輪廓粒子。
沒有修改任何效果程式，也沒有使用稻草人目標。

## 透明邊裁切，保留原始解析度（2026-11-06）

取所有影格 alpha 非零像素的聯集，保留最多 2 像素的透明邊界並包含原 pivot；不刪除任何原圖中 alpha 非零的像素。
每格保持原始像素密度，只裁切透明邊並重新排格，不做任何縮放；PNG 保持 RGBA，不做調色盤量化。
原始 sheet 的 columns 與影格順序保留，重新排入固定尺寸格子；每格矩形、sourceSize、spriteSourceSize、meta.size、meta.pixelfx.frameSize 與 pivot 一併更新。

裁切框採 Pillow `(left, top, right, bottom)`，右與下界不包含：

| 素材 | 原始每格尺寸 | 裁切框 | 輸出每格尺寸 |
|---|---|---|---|
| fireball-impact | 224×200 | (7, 3, 211, 197) | 204×194 |
| hit-spark | 136×80 | (8, 6, 133, 80) | 125×74 |
| respawn-beam | 128×150 | (0, 0, 128, 150) | 128×150 |
| death-poof | 112×92 | (11, 13, 106, 92) | 95×79 |

將下方腳本存為 `/tmp/webdota-pixelfx-pack-8e7d3bf99e5b.py` 後執行以下實際使用的指令；若在其他機器重製，調整腳本的 DEST 目錄。

```sh
python3 /tmp/webdota-pixelfx-pack-8e7d3bf99e5b.py
```

```python
import json
import math
from pathlib import Path

from PIL import Image

SOURCE = Path('/tmp/webdota-pixelfx-render-8e7d3bf99e5b')
DEST = Path('public/fx')  # 在 webdota repo 根目錄執行
EFFECTS = {
    'fireball-impact': 'explosions/plasma-explosion',
    'hit-spark': 'impacts/hit-spark',
    'respawn-beam': 'spawn/respawn-beam',
    'death-poof': 'spawn/poof',
}

DEST.mkdir(parents=True, exist_ok=True)
summary = []
for name, effect_id in EFFECTS.items():
    stem = effect_id.split('/')[1]
    folder = SOURCE / effect_id
    data = json.loads((folder / f'{stem}.json').read_text())
    source = Image.open(folder / f'{stem}.png').convert('RGBA')
    frames = []
    bounds = []
    for frame in data['frames']:
        r = frame['frame']
        image = source.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        frames.append(image)
        if bbox := image.getchannel('A').getbbox():
            bounds.append(bbox)

    old_w, old_h = data['meta']['pixelfx']['frameSize']
    old_pivot = data['meta']['pixelfx']['pivot']
    left = max(0, min(min(b[0] for b in bounds) - 2, math.floor(old_pivot[0])))
    top = max(0, min(min(b[1] for b in bounds) - 2, math.floor(old_pivot[1])))
    right = min(old_w, max(max(b[2] for b in bounds) + 2, math.floor(old_pivot[0]) + 1))
    bottom = min(old_h, max(max(b[3] for b in bounds) + 2, math.floor(old_pivot[1]) + 1))
    crop = (left, top, right, bottom)
    crop_w, crop_h = right - left, bottom - top
    w, h = crop_w, crop_h
    pivot = [old_pivot[0] - left, old_pivot[1] - top]
    columns = data['meta']['pixelfx']['columns']
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new('RGBA', (columns * w, rows * h))
    for i, (frame, image) in enumerate(zip(data['frames'], frames)):
        image = image.crop(crop)
        x, y = (i % columns) * w, (i // columns) * h
        sheet.paste(image, (x, y))
        frame['filename'] = f'{name} {i}'
        frame['frame'] = dict(x=x, y=y, w=w, h=h)
        frame['spriteSourceSize'] = dict(x=0, y=0, w=w, h=h)
        frame['sourceSize'] = dict(w=w, h=h)

    data['meta']['image'] = f'{name}.png'
    data['meta']['size'] = dict(w=sheet.width, h=sheet.height)
    data['meta']['frameTags'][0]['name'] = name
    data['meta']['pixelfx']['frameSize'] = [w, h]
    data['meta']['pixelfx']['pivot'] = pivot
    sheet.save(DEST / f'{name}.png', optimize=True)
    (DEST / f'{name}.json').write_text(json.dumps(data, indent=1) + '\n')
    summary.append(dict(name=name, source=effect_id, crop=crop, originalFrameSize=[old_w, old_h],
                        frameSize=[w, h], pivot=pivot, columns=columns, frames=len(frames),
                        fps=data['meta']['pixelfx']['fps'], loop=data['meta']['pixelfx']['loop'],
                        durationMs=data['frames'][0]['duration'],
                        bytes=(DEST / f'{name}.png').stat().st_size))

Path('/tmp/webdota-pixelfx-summary-8e7d3bf99e5b.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
```

## 圖面檢視（2026-11-06）

四張最終 PNG 均已逐張開啟檢視；全部只有效果，背景透明。

- fireball-impact：橘紅爆心、擴張光環與碎光清楚，未新增截斷，尾段空白格沿用原效果消退終點。
- hit-spark：白金十字命中閃光與飛散火花清楚，已裁去透明邊緣，沒有額外截斷。
- respawn-beam：金白直立光柱與上升掃描線清楚，沒有角色；頂端延伸至格子上緣是原效果構圖，未額外裁切。
- death-poof：淡紫煙團與金白星點清楚，透明空白已收斂，沒有額外截斷。

爆裂與煙團為立體擴散的視覺構圖，光柱主要為直立構圖；附屬小環光保留原效果設計。
2026-11-06 只檢視素材圖片與 metadata，未修改或啟動 3D 場景整合；面向鏡頭平面的實際顯示由播放器處理。

## Hugo Duprez／Sprite Fusion 來源

四個效果檔頭均標示改編或沿用 Hugo Duprez 的 MIT 素材技法與程式：

| pixelfx 效果 id | 檔頭標示的 Sprite Fusion 來源 | 聲明 |
|---|---|---|
| explosions/plasma-explosion | [energy](https://www.spritefusion.com/pixel-art-vfx/energy)：釋放閃光、光環、flare、光照及電弧 | Copyright (c) 2026 Hugo Duprez，MIT License |
| impacts/hit-spark | [impact](https://www.spritefusion.com/pixel-art-vfx/impact)：雙色火花與閃光 | Copyright (c) 2026 Hugo Duprez，MIT License |
| spawn/respawn-beam | [holy-light](https://www.spritefusion.com/pixel-art-vfx/holy-light)：光柱落點、光束、環光與火花 | Copyright (c) 2026 Hugo Duprez，MIT License |
| spawn/poof | [explosion](https://www.spritefusion.com/pixel-art-vfx/explosion)：柔和、頂部受光的煙團 | Copyright (c) 2026 Hugo Duprez，MIT License |

共用的 `src/core/sim.js` 也標示改編自 [Sprite Fusion pixel art VFX](https://www.spritefusion.com/pixel-art-vfx)，Copyright (c) 2026 Hugo Duprez，MIT License。
以下完整保留 pixelfx 根目錄 LICENSE 的 Patch 與 Hugo Duprez 著作權及 MIT 授權聲明，涵蓋本目錄四組衍生素材。

```text
MIT License

Copyright (c) 2026 Patch
Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
