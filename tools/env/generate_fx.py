#!/usr/bin/env python3
"""2026-11-06：離線重製塔頂水晶光彈與命中特效，不重寫既有場景素材。"""

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/env"
TOOLS = Path(__file__).resolve().parent
DATE = "2026-11-06"
NEAREST = Image.Resampling.NEAREST
FONT = ImageFont.load_default()
PALETTES = {
    "blue": {"shade": "#354e8f", "team": "#3b6fd8", "rim": "#7db9ed",
             "core": "#d2f4ef", "white": "#f4fffd", "outline": "#1a1422"},
    "red": {"shade": "#9a3b45", "team": "#d84a3b", "rim": "#f8a47c",
            "core": "#fff0bd", "white": "#fff9ee", "outline": "#1a1422"},
}
SPECS = {
    "bolt": {"size": [32, 16], "count": 4, "fps": 16, "loop": True, "pivot": [22, 8]},
    "impact": {"size": [32, 32], "count": 5, "fps": 18, "loop": False, "pivot": [16, 16]},
}
NOTICE_HEADING = "## 防禦塔光彈與命中特效（2026-11-06）"
NOTICE = f"""{NOTICE_HEADING}

2026-11-06 新增下列原創連續圖，沿用塔頂水晶的隊伍色盤、19px／世界單位的像素密度與既有 JSON 格式，均為單列橫排。發光體不加深色外框；水晶碎片採 `#1a1422` 外框及左上高光。無抗鋸齒、無半透明，每隊最多六個不透明色。

| 檔名（各含 PNG + JSON） | 每格／整張 | 格數 | fps | loop | pivot |
|---|---|---:|---:|---|---|
| tower-bolt-blue、tower-bolt-red | 32×16／128×16 | 4 | 16 | true | [22,8] |
| tower-impact-blue、tower-impact-red | 32×32／160×32 | 5 | 18 | false | [16,16] |

光彈原圖朝右，彈頭為 8×7px，pivot 固定在彈頭發光核心；後方兩段光尾以長度與亮點變化形成循環。遊戲以 pivot 為中心轉向目標。命中依序為閃光、光環與碎片外擴、最大 26×26px 爆開、殘光、全透明結尾；pivot 固定在爆開中心。命中特效第 5 格全透明，非遺漏影格。16／18fps 的 JSON duration 沿用既有取整規則，分別為 62／56ms；精確播放速率以 `meta.pixelfx.fps` 為準。

離線重製只需要 Python 3 + Pillow，不用亂數或外部圖片；從專案根目錄執行：

```sh
python3 tools/env/generate_fx.py
```

若一併重製場景，先執行 `generate.py`，再執行 `generate_fx.py`。後者只寫入上述四組 PNG／JSON、此段 NOTICE、`tools/env/preview-bolt.png` 與 `tools/env/validation.json`；保留其餘既有素材及驗證資料。同一 Pillow 版本重跑產生相同位元組。規格日期固定為 2026-11-06。

`tools/env/preview-bolt.png` 包含所有影格的 nearest 5 倍放大、pivot 標記，以及以既有地面、塔與敵方小兵合成的紅藍攻擊示意（nearest 2 倍，飛行與命中分圖）。灰色虛線僅為預覽的飛行路線輔助線，不屬於素材。驗證報告新增 `tower_fx` 與各檔案紀錄，檢查影格格式、尺寸、fps、loop、pivot、色盤、二值 alpha、彈頭固定、最大範圍、透明結尾、紅藍輪廓一致與 SHA-256。
"""


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bolt(team, frame):
    p = PALETTES[team]
    image = Image.new("RGBA", (32, 16))
    d = ImageDraw.Draw(image)
    rear = [2, 5, 3, 4][frame]
    d.line([(rear, 8), (8, 8)], fill=p["team"])
    d.point((rear + 2, 8), fill=p["rim"])
    d.polygon([(10, 8), (14, 6), (19, 7), (19, 9), (14, 10)], fill=p["team"])
    d.line([(12 + frame % 2, 8), (19, 8)], fill=p["core"])
    d.point((14 + frame, 7 if frame % 2 else 9), fill=p["rim"])
    d.polygon([(18, 8), (20, 5), (23, 5), (25, 7), (25, 9), (23, 11), (20, 11)], fill=p["rim"])
    d.polygon([(19, 8), (21, 6), (23, 6), (24, 8), (23, 10), (21, 10)], fill=p["core"])
    d.line([(21, 8), (24, 8)], fill=p["white"])
    d.point((22, 7), fill=p["white"])
    return image


def shard(d, x, y, p):
    d.polygon([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)],
              fill=p["team"], outline=p["outline"])
    d.point((x, y - 1), fill=p["core"])
    d.point((x - 1, y), fill=p["rim"])
    d.point((x, y + 1), fill=p["shade"])


def impact(team, frame):
    p = PALETTES[team]
    image = Image.new("RGBA", (32, 32))
    d = ImageDraw.Draw(image)
    if frame == 0:
        d.polygon([(16, 10), (18, 14), (22, 16), (18, 18), (16, 22),
                   (14, 18), (10, 16), (14, 14)], fill=p["rim"])
        d.ellipse((13, 13, 19, 19), fill=p["core"])
        d.line([(14, 16), (18, 16)], fill=p["white"])
        d.line([(16, 14), (16, 18)], fill=p["white"])
    elif frame == 1:
        d.ellipse((10, 10, 22, 22), outline=p["rim"])
        d.arc((11, 11, 21, 21), 185, 305, fill=p["core"])
        d.polygon([(16, 12), (19, 16), (16, 20), (13, 16)], fill=p["core"])
        d.point((16, 16), fill=p["white"])
        for x, y in [(16, 8), (23, 12), (22, 22), (11, 24), (7, 16), (10, 9)]:
            shard(d, x, y, p)
    elif frame == 2:
        for start, end in [(0, 55), (78, 133), (158, 220), (245, 310), (328, 350)]:
            d.arc((6, 6, 26, 26), start, end, fill=p["rim"])
        d.arc((7, 7, 25, 25), 190, 235, fill=p["core"])
        for x, y in [(16, 5), (26, 11), (24, 25), (9, 26), (5, 16), (7, 7)]:
            shard(d, x, y, p)
        for x, y in [(14, 14), (18, 17), (16, 19)]:
            d.point((x, y), fill=p["core"])
    elif frame == 3:
        for start, end in [(12, 30), (92, 110), (168, 187), (258, 276)]:
            d.arc((4, 4, 28, 28), start, end, fill=p["team"])
        for x, y in [(16, 3), (28, 10), (25, 27), (8, 28), (3, 16), (6, 5)]:
            d.point((x, y), fill=p["rim"])
        for x, y in [(16, 4), (27, 10), (24, 27), (8, 27)]:
            d.point((x, y), fill=p["team"])
    return image


def save_sheet(name, kind, frames):
    spec = SPECS[kind]
    w, h = spec["size"]
    count = spec["count"]
    sheet = Image.new("RGBA", (w * count, h))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * w, 0))
    sheet.save(OUT / f"{name}.png", optimize=True, compress_level=9)
    metadata = {
        "frames": [{"filename": f"{name} {i}", "frame": {"x": i * w, "y": 0, "w": w, "h": h},
                    "rotated": False, "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
                    "sourceSize": {"w": w, "h": h}, "duration": round(1000 / spec["fps"])} for i in range(count)],
        "meta": {"app": "webdota/tools/env/generate_fx.py", "version": "2", "image": f"{name}.png",
                 "format": "RGBA8888", "size": {"w": w * count, "h": h}, "scale": "1",
                 "frameTags": [{"name": kind, "from": 0, "to": count - 1, "direction": "forward"}],
                 "pixelfx": {"id": f"env/{name}", "name": name.replace("-", " "), "fps": spec["fps"],
                             "loop": spec["loop"], "frames": count, "frameSize": [w, h],
                             "pivot": spec["pivot"], "columns": count}},
    }
    (OUT / f"{name}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def scene(team, frames, hit=False):
    other = "red" if team == "blue" else "blue"
    image = Image.open(OUT / f"ground-{team}.png").convert("RGBA").crop((230, 400, 470, 546))
    tower = Image.open(OUT / f"tower-{team}-idle.png").convert("RGBA").crop((0, 0, 48, 112))
    creep = Image.open(OUT / f"creep-{other}-walk.png").convert("RGBA").crop((0, 0, 32, 32))
    image.alpha_composite(tower, (31, 24))
    image.alpha_composite(creep, (190, 108))
    start, target = (55, 40), (206, 124)
    if hit:
        image.alpha_composite(frames[f"tower-impact-{team}"][2], (target[0] - 16, target[1] - 16))
    else:
        d = ImageDraw.Draw(image)
        for step in range(2, 16, 2):
            t = step / 18
            x = round(start[0] + (target[0] - start[0]) * t)
            y = round(start[1] + (target[1] - start[1]) * t)
            d.line([(x, y), (x + 2, y + 1)], fill="#8e8996")
        anchored = Image.new("RGBA", (64, 64))
        anchored.paste(frames[f"tower-bolt-{team}"][1], (32 - 22, 32 - 8))
        angle = -math.degrees(math.atan2(target[1] - start[1], target[0] - start[0]))
        rotated = anchored.rotate(angle, resample=NEAREST, center=(32, 32))
        x, y = (round((a + b) / 2) for a, b in zip(start, target))
        image.alpha_composite(rotated, (x - 32, y - 32))
    return image.resize((480, 292), NEAREST)


def preview(frames):
    board = Image.new("RGB", (1056, 1520), "#191923")
    d = ImageDraw.Draw(board)
    d.text((24, 18), "WEBDOTA / TOWER CRYSTAL FX / 2026-11-06 / 19 px per world unit", font=FONT, fill="#e2dacb")
    d.text((24, 36), "All frames nearest 5x | crosshair = pivot | binary alpha | final impact frame intentionally empty", font=FONT, fill="#a7abb9")
    y = 72
    for kind in SPECS:
        spec = SPECS[kind]
        w, h = spec["size"]
        for team in PALETTES:
            name = f"tower-{kind}-{team}"
            d.text((24, y), f"{name} / {w}x{h} / {spec['count']} frames / {spec['fps']} fps / loop {spec['loop']} / pivot {spec['pivot']}",
                   font=FONT, fill=PALETTES[team]["rim"])
            for i, frame in enumerate(frames[name]):
                x, top = 24 + i * 200, y + 22
                for cy in range(0, h * 5, 20):
                    for cx in range(0, w * 5, 20):
                        color = "#252735" if (cx // 20 + cy // 20) % 2 else "#20212d"
                        d.rectangle((x + cx, top + cy, x + cx + 19, top + cy + 19), fill=color)
                scaled = frame.resize((w * 5, h * 5), NEAREST)
                board.paste(scaled, (x, top), scaled)
                px, py = x + spec["pivot"][0] * 5, top + spec["pivot"][1] * 5
                d.line((px - 3, py, px + 3, py), fill="#a7abb9")
                d.line((px, py - 3, px, py + 3), fill="#a7abb9")
                d.text((x, top + h * 5 + 5), f"{i + 1:02d}" + (" / clear" if not frame.getbbox() else ""), font=FONT, fill="#a7abb9")
            y += h * 5 + 60
    d.text((24, y), "EXISTING TOWER + ENEMY CREEP / nearest 2x / flight and impact shown separately", font=FONT, fill="#e2dacb")
    y += 30
    for team in PALETTES:
        for j, hit in enumerate((False, True)):
            x = 24 + j * 528
            d.text((x, y), f"{team.upper()} / " + ("IMPACT" if hit else "FLIGHT / grey dotted path is a guide"), font=FONT, fill=PALETTES[team]["rim"])
            board.paste(scene(team, frames, hit).convert("RGB"), (x, y + 22))
        y += 340
    board.crop((0, 0, 1056, y)).save(TOOLS / "preview-bolt.png", optimize=True, compress_level=9)


def validate(frames):
    path = TOOLS / "validation.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    assert report["checks_passed"]
    fx_report = {"date": DATE, "pillow": PILLOW_VERSION, "generator": "tools/env/generate_fx.py",
                 "randomness": "none", "horizontal_px_per_world": 19, "palette": PALETTES,
                 "total_frames": sum(len(cells) for cells in frames.values()),
                 "bolt_direction": "right; pivot at luminous head core", "bolt_head_bounds": [18, 5, 26, 12],
                 "impact_max_extent_px": 26, "impact_final_frame_transparent": True,
                 "preview": {"all_frames_nearest_scale": 5, "scene_nearest_scale": 2,
                             "teams": ["blue", "red"], "separate_flight_and_impact": True}}
    for name, cells in frames.items():
        kind, team = name.split("-")[1:]
        spec = SPECS[kind]
        w, h = spec["size"]
        png = OUT / f"{name}.png"
        metadata = json.loads(png.with_suffix(".json").read_text())
        decoded = Image.open(png).convert("RGBA")
        assert decoded.size == (w * len(cells), h)
        assert metadata["meta"]["image"] == png.name
        assert metadata["meta"]["size"] == {"w": decoded.width, "h": decoded.height}
        fx = metadata["meta"]["pixelfx"]
        assert [fx[k] for k in ("id", "name", "frameSize", "frames", "fps", "loop", "pivot", "columns")] == [
            f"env/{name}", name.replace("-", " "), spec["size"], len(cells), spec["fps"], spec["loop"], spec["pivot"], len(cells)]
        assert len(cells) == len(metadata["frames"]) == spec["count"]
        colors = decoded.getcolors(decoded.width * decoded.height)
        alpha = sorted({color[3] for _, color in colors})
        assert alpha == [0, 255] and len(colors) <= 7
        allowed = {tuple(bytes.fromhex(color[1:])) for color in PALETTES[team].values()}
        assert all(color[:3] in allowed for _, color in colors if color[3])
        bounds, hashes = [], []
        for i, (cell, entry) in enumerate(zip(cells, metadata["frames"])):
            assert entry["frame"] == {"x": i * w, "y": 0, "w": w, "h": h}
            assert entry["duration"] == round(1000 / spec["fps"])
            assert decoded.crop((i * w, 0, (i + 1) * w, h)).tobytes() == cell.tobytes()
            box = cell.getbbox()
            assert box is None or (0 < box[0] < box[2] < w and 0 < box[1] < box[3] < h)
            bounds.append(list(box) if box else None)
            hashes.append(hashlib.sha256(cell.tobytes()).hexdigest())
        assert len(set(hashes)) == len(cells)
        if kind == "bolt":
            assert len({cell.crop((18, 0, 32, 16)).tobytes() for cell in cells}) == 1
            assert all(cell.getpixel((22, 8))[:3] == tuple(bytes.fromhex(PALETTES[team]["white"][1:])) for cell in cells)
            assert all(box[3] - box[1] == 7 and box[2] == 26 for box in bounds)
        else:
            assert cells[-1].getbbox() is None
            assert max(max(box[2] - box[0], box[3] - box[1]) for box in bounds if box) == 26
            assert all(cells[0].getpixel((x, y))[3] == 255 for x, y in [(16, 16), (16, 15), (15, 16)])
        report["files"][str(png.relative_to(ROOT))] = {
            "size": list(decoded.size), "bytes": png.stat().st_size, "sha256": sha(png),
            "colors_including_transparent": len(colors), "alpha_values": alpha, "binary_alpha": True,
            "frames": len(cells), "frame_size": [w, h], "fps": spec["fps"], "loop": spec["loop"],
            "pivot": spec["pivot"], "columns": len(cells), "frame_bounds": bounds, "distinct_frames": len(set(hashes)),
        }
        meta_path = png.with_suffix(".json")
        report["files"][str(meta_path.relative_to(ROOT))] = {"bytes": meta_path.stat().st_size, "sha256": sha(meta_path)}
    for kind in SPECS:
        assert all(blue.getchannel("A").tobytes() == red.getchannel("A").tobytes()
                   for blue, red in zip(frames[f"tower-{kind}-blue"], frames[f"tower-{kind}-red"]))
    fx_report["team_silhouettes_match"] = True
    fx_report["checks_passed"] = True
    for file in (Path(__file__), TOOLS / "preview-bolt.png", OUT / "NOTICE.md"):
        entry = {"bytes": file.stat().st_size, "sha256": sha(file)}
        if file.suffix == ".png":
            entry["size"] = list(Image.open(file).size)
        report["files"][str(file.relative_to(ROOT))] = entry
    for filename, entry in report["files"].items():
        assert sha(ROOT / filename) == entry["sha256"], filename
    report["date"] = DATE
    report["tower_fx"] = fx_report
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checks_passed": True, "sprite_sheets": len(frames), "frames": fx_report["total_frames"],
                      "preview": "tools/env/preview-bolt.png", "report": "tools/env/validation.json"}))


def main():
    frames = {}
    for kind, draw in (("bolt", bolt), ("impact", impact)):
        for team in PALETTES:
            name = f"tower-{kind}-{team}"
            frames[name] = [draw(team, i) for i in range(SPECS[kind]["count"])]
            save_sheet(name, kind, frames[name])
    preview(frames)
    notice_path = OUT / "NOTICE.md"
    original = notice_path.read_text(encoding="utf-8").split(NOTICE_HEADING, 1)[0].rstrip()
    notice_path.write_text(original + "\n\n" + NOTICE, encoding="utf-8")
    validate(frames)


if __name__ == "__main__":
    main()
