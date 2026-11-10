#!/usr/bin/env python3
"""2026-11-10：以 Pillow 烘焙 arena_v2 地面；直接執行即可重製素材與檢核資料。"""

import hashlib
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "tools/env"))
from generate import DIRT, FONT, GRASS, NEAREST, O, PAVING, STONE, TEAMS, save_png

TOOLS = Path(__file__).resolve().parent
SOURCE = ROOT / "src/data/maps/arena_v2.json"
OUT = ROOT / "public/env/arena_v2"
SEED = 20261110
PPU, DEPTH = 19, 11.4
SIZE = (1824, 1094)
HALF = 48
CLEARINGS = ((18, -18), (-18, 18))


def project(x, z):
    return round((HALF + z) * PPU), round((HALF - x) * DEPTH)


def world(px, py):
    return HALF - py / DEPTH, px / PPU - HALF


def circle(draw, x, z, radius, fill):
    px, py = project(x, z)
    rx, ry = round(radius * PPU), round(radius * DEPTH)
    draw.ellipse((px - rx, py - ry, px + rx, py + ry), fill=fill)


def path_routes(data):
    # 2026-11-10：沿用 generate.path_routes 的密集取樣，改讀中繼點且不加彎曲支路。
    bases = {e["team"]: e for e in data["entities"] if e["type"] == "base"}
    points = [bases["blue"]["position"][::2], *data["lanes"]["blue"],
              bases["red"]["position"][::2]]
    route = []
    for start, end in zip(points, points[1:]):
        steps = math.ceil(math.dist(start, end) / .3)
        for i in range(steps):
            t = i / steps
            route.append(tuple(a + (b - a) * t for a, b in zip(start, end)))
    return [*route, tuple(points[-1])]


def grass(rng):
    image = Image.new("RGB", SIZE, GRASS[2])
    d = ImageDraw.Draw(image)
    for _ in range(9000):
        px, py = rng.randrange(SIZE[0]), rng.randrange(SIZE[1])
        x, z = world(px, py)
        colors = GRASS[:4] if abs(x - z) > 13 else GRASS[1:6]
        w, h = rng.randrange(7, 55), rng.randrange(3, 19)
        d.polygon([(px, py + 2), (px + w // 3, py), (px + w - 4, py + 1),
                   (px + w, py + h // 2), (px + w - 3, py + h),
                   (px + 2, py + h - 1)], fill=rng.choice(colors))
    return image


def soil_and_grass(image, route, rng):
    mask = Image.new("L", SIZE)
    md = ImageDraw.Draw(mask)
    for x, z in route:
        circle(md, x, z, 3.5, 255)
    for x, z in CLEARINGS:
        circle(md, x, z, 4, 255)
    soil = Image.new("RGB", SIZE, DIRT[2])
    sd = ImageDraw.Draw(soil)
    for _ in range(38000):
        px, py = rng.randrange(SIZE[0]), rng.randrange(SIZE[1])
        if mask.getpixel((px, py)):
            sd.rectangle((px, py, px + rng.randrange(2, 12), py + rng.randrange(0, 3)),
                         fill=rng.choice(DIRT))
    # 2026-11-10：車轍在世界座標求法線，避免縱深壓縮造成偏移。
    for side in (-1, 1):
        rut = []
        for i, (x, z) in enumerate(route):
            prev, nxt = route[max(0, i - 1)], route[min(len(route) - 1, i + 1)]
            dx, dz = nxt[0] - prev[0], nxt[1] - prev[1]
            length = math.hypot(dx, dz)
            rut.append(project(x - dz / length * 1.2 * side, z + dx / length * 1.2 * side))
        sd.line(rut, fill=DIRT[1], width=2)
        for i in range(0, len(rut) - 2, 13):
            sd.line(rut[i:i + 3], fill=DIRT[0])
    image.paste(soil, (0, 0), mask)
    d = ImageDraw.Draw(image)
    for _ in range(65000):
        px, py = rng.randrange(5, SIZE[0] - 5), rng.randrange(5, SIZE[1] - 5)
        on_path = mask.getpixel((px, py))
        near = any(mask.getpixel((px + dx, py + dy)) != on_path
                   for dx, dy in ((4, 0), (-4, 0), (0, 3), (0, -3)))
        if on_path and not near:
            if rng.randrange(9) == 0:
                d.rectangle((px, py, px + 1, py), fill=rng.choice(DIRT))
            continue
        x, z = world(px, py)
        jungle = abs(x - z) > 13
        if near or rng.randrange(3) == 0:
            color = rng.choice(GRASS[1:5] if jungle else GRASS[1:])
            d.line([(px - 2, py), (px - 1, py - 2), (px, py), (px + 2, py - 3)], fill=color)
            if rng.randrange(4) == 0:
                d.point((px - 1, py - 3), fill=GRASS[4 if jungle else 5])
        elif rng.randrange(30) == 0:
            d.ellipse((px, py, px + 3, py + 1), fill=PAVING[1])
            d.point((px, py), fill=PAVING[3])
        elif rng.randrange(44) == 0:
            d.line([(px, py), (px + 1, py - 2)], fill=GRASS[1])
            d.point((px + 1, py - 2), fill=rng.choice(["#d6c58c", "#bca7ae", "#d6d0b0"]))


def dead_ground(image, data, rng):
    mask = Image.new("L", SIZE)
    md = ImageDraw.Draw(mask)
    for rect in data["deadZones"]:
        x, z, w, depth = (rect[k] for k in ("x", "z", "w", "d"))
        md.rectangle((*project(x + w / 2, z - depth / 2),
                      *project(x - w / 2, z + depth / 2)), fill=255)
    rock = Image.new("RGB", SIZE, STONE["ao"])
    d = ImageDraw.Draw(rock)
    for _ in range(15000):
        px, py = rng.randrange(SIZE[0]), rng.randrange(SIZE[1])
        if not mask.getpixel((px, py)):
            continue
        w, h = rng.randrange(5, 27), rng.randrange(3, 12)
        pts = [(px, py + 2), (px + 4, py), (px + w - 2, py + 1),
               (px + w, py + h - 2), (px + w - 5, py + h), (px + 1, py + h - 1)]
        d.polygon(pts, fill=rng.choice([STONE["dark"], STONE["ao"], GRASS[0], STONE["moss_d"]]), outline=O)
        if rng.randrange(3) == 0:
            d.line([(px + 2, py + 2), (px + 5, py + 1), (px + w - 4, py + 2)], fill=STONE["shade"])
        if rng.randrange(5) == 0:
            d.line([(px + 8, py), (px + 6, py + 4), (px + 10, py + 7),
                    (px + 8, py + h + 3)], fill=O)
    image.paste(rock, (0, 0), mask)
    # 2026-11-10：聯集遮罩只勾外緣，矩形相接處不留下分隔線；不是烘焙陰影。
    rim = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3)))
    image.paste(O, (0, 0), rim)
    return mask


def paving_texture(rng):
    image = Image.new("RGB", SIZE, PAVING[0])
    d = ImageDraw.Draw(image)
    for row, py in enumerate(range(-6, SIZE[1], 11)):
        for px in range(-20 + (9 if row % 2 else 0), SIZE[0], 19):
            d.rectangle((px + 1, py + 1, px + 17, py + 9), fill=rng.choice(PAVING[1:5]))
            d.line([(px + 2, py + 7), (px + 2, py + 2), (px + 14, py + 2)], fill=PAVING[4])
            d.line([(px + 17, py + 3), (px + 17, py + 9), (px + 4, py + 9)], fill=PAVING[1])
            if rng.randrange(7) == 0:
                d.line([(px + 10, py + 1), (px + 9, py + 4), (px + 11, py + 6)], fill=PAVING[0])
            if rng.randrange(9) == 0:
                d.line([(px + 2, py + 9), (px + 4, py + 8)], fill=GRASS[3])
    return image


def platforms(image, data, rng):
    paving = paving_texture(rng)
    mask, accents = Image.new("L", SIZE), Image.new("L", SIZE)
    md, ad = ImageDraw.Draw(mask), ImageDraw.Draw(accents)
    platforms = []
    for e in data["entities"]:
        if e["type"] not in ("base", "tower"):
            continue
        x, _, z = e["position"]
        cx, cy = project(x, z)
        is_base = e["type"] == "base"
        rx, ry = (85, 51) if is_base else (28, 17)
        box = (cx - rx, cy - ry, cx + rx, cy + ry)
        if is_base:
            md.rectangle(box, fill=255)
            team_id = 1 if e["team"] == "blue" else 2
            ad.rectangle((cx - 81, cy - 47, cx + 81, cy + 47), outline=team_id, width=2)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    px, py = cx + sx * 74, cy + sy * 40
                    ad.polygon([(px, py - 3), (px + 5, py), (px, py + 3), (px - 5, py)], fill=team_id + 2)
        else:
            md.ellipse(box, fill=255)
            md.ellipse((cx - 20, cy - 12, cx + 20, cy + 12), fill=0)
        platforms.append({"type": e["type"], "team": e["team"], "world_xz": [x, z],
                          "center_px": [cx, cy], "bbox_px_exclusive": [box[0], box[1], box[2] + 1, box[3] + 1]})
    for x, z in CLEARINGS:
        for _ in range(22):
            angle, radius = rng.uniform(0, math.tau), rng.uniform(4.1, 4.9)
            px, py = project(x + math.cos(angle) * radius, z + math.sin(angle) * radius)
            w, h = rng.randrange(5, 13), rng.randrange(3, 7)
            md.polygon([(px - w // 2, py), (px - w // 2 + 2, py - h // 2),
                        (px + w // 2, py - h // 2), (px + w // 2 - 1, py + h // 2),
                        (px - w // 2 + 1, py + h // 2)], fill=255)
    image.paste(paving, (0, 0), mask)
    d = ImageDraw.Draw(image)
    for p in platforms:
        cx, cy = p["center_px"]
        left, top, right, bottom = p["bbox_px_exclusive"]
        box = (left, top, right - 1, bottom - 1)
        if p["type"] == "base":
            d.rectangle(box, outline=PAVING[0])
        else:
            d.ellipse(box, outline=PAVING[0])
            d.arc((cx - 26, cy - 15, cx + 26, cy + 15), 185, 310, fill=PAVING[5])
            d.ellipse((cx - 20, cy - 12, cx + 20, cy + 12), outline=PAVING[0])
    return accents, platforms


def ground(data):
    rng = random.Random(SEED)
    route = path_routes(data)
    image = grass(rng)
    soil_and_grass(image, route, rng)
    dead_mask = dead_ground(image, data, rng)
    accents, pads = platforms(image, data, rng)
    images = {}
    for view in TEAMS:
        im = image.copy()
        for n in (1, 2, 3, 4):
            team = "blue" if n in (1, 3) else "red"
            if view == "red":
                team = "red" if team == "blue" else "blue"
            color = TEAMS[team]["team_l" if n > 2 else "team"]
            im.paste(color, (0, 0), accents.point(lambda v: 255 if v == n else 0))
        images[view] = im
    return images, accents, pads, dead_mask


def preview(images, pads, data):
    board = Image.new("RGB", (1920, 1100), O)
    d = ImageDraw.Draw(board)
    d.text((24, 16), "ARENA V2 / 2026-11-10 / GROUND ONLY / UPPER-LEFT LIGHT / NO CAST SHADOWS", font=FONT, fill=PAVING[5])
    for i, team in enumerate(TEAMS):
        left = 24 + i * 960
        d.text((left, 46), f"{team.upper()} / 1824 x 1094 RGB / NEAREST 1:2", font=FONT, fill=PAVING[4])
        board.paste(images[team].resize((912, 547), NEAREST), (left, 70))
    base = next(p for p in pads if p["type"] == "base" and p["team"] == "blue")
    tower = next(p for p in pads if p["type"] == "tower" and p["team"] == "blue")
    edge = data["deadZones"][2]
    details = [("BASE PLAZA / (-38, -38)", base["center_px"]),
               ("OUTER TOWER / (-12, -12)", tower["center_px"]),
               ("JUNGLE CLEARING / (18, -18)", project(*CLEARINGS[0])),
               ("CLOSED GROUND / STAIR BOUNDARY", project(edge["x"] - edge["w"] / 2, edge["z"] + edge["d"] / 2))]
    crops = []
    for i, (label, (cx, cy)) in enumerate(details):
        left, top = 24 + i * 474, 680
        box = (cx - 112, cy - 80, cx + 112, cy + 80)
        crop = images["blue"].crop(box).resize((448, 320), NEAREST)
        board.paste(crop, (left, top))
        d.text((left, top - 35), label, font=FONT, fill=PAVING[5])
        d.text((left, top - 19), "224 x 160 CROP / NEAREST 2x", font=FONT, fill=PAVING[3])
        crops.append({"label": label, "source_bbox_px_exclusive": list(box), "scale": 2})
    d.text((24, 1034), "7-UNIT DIRT ROAD / MOSSY JUNGLE / FRACTURED CLOSED GROUND / TEAM INLAYS ONLY SWAPPED", font=FONT, fill=PAVING[4])
    return board, crops


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert data["size"] == {"w": 96, "h": 96}
    assert SIZE == (round(data["size"]["w"] * PPU), round(data["size"]["h"] * DEPTH))
    images, accents, pads, dead_mask = ground(data)
    blue, red = images["blue"], images["red"]
    channels = ImageChops.difference(blue, red).split()
    changed = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2]).point(lambda v: 255 if v else 0)
    allowed = accents.point(lambda v: 255 if v else 0)
    assert changed.tobytes() == allowed.tobytes(), "兩隊版本的差異必須恰好等於主堡點綴遮罩"
    assert ImageChops.multiply(allowed, dead_mask).getbbox() is None
    OUT.mkdir(parents=True, exist_ok=True)
    paths = []
    for team, image in images.items():
        assert image.size == SIZE and image.mode == "RGB"
        path = OUT / f"ground-{team}.png"
        save_png(image, path)
        paths.append(path)
    board, crops = preview(images, pads, data)
    preview_path = TOOLS / "preview-arena_v2.png"
    save_png(board, preview_path)
    paths.append(preview_path)
    regions = []
    for p in pads:
        if p["type"] != "base":
            continue
        left, top, right, bottom = p["bbox_px_exclusive"]
        region = changed.crop((left, top, right, bottom))
        x0, y0, x1, y1 = region.getbbox()
        regions.append({"team_at_blue_view": p["team"], "pixel_count": region.histogram()[255],
                        "bbox_px_exclusive": [left + x0, top + y0, left + x1, top + y1]})
    report = {
        "seed": SEED, "pillow_version": PILLOW_VERSION,
        "source": {"path": str(SOURCE.relative_to(ROOT)), "sha256": sha(SOURCE)},
        "generator": {"path": str(Path(__file__).relative_to(ROOT)), "sha256": sha(Path(__file__)),
                      "reference_sha256": sha(ROOT / "tools/env/generate.py")},
        "projection": {"ppu": PPU, "depth": DEPTH, "world_size": [96, 96],
                       "formula": ["px = round((48 + z) * 19)", "py = round((48 - x) * 11.4)"]},
        "outputs": {str(path.relative_to(ROOT)): {"size_px": list(Image.open(path).size),
                                                 "mode": "RGB", "sha256": sha(path)} for path in paths},
        "difference": {"pixel_count": changed.histogram()[255], "bbox_px_exclusive": list(changed.getbbox()),
                       "outside_base_accents": 0, "equals_base_accents_mask": True,
                       "regions": regions},
        "platforms": pads, "preview_details": crops,
        "validation_report_hash": "本報告不列自身 SHA-256，以免產生自我參照；outputs 列出所有 PNG。",
    }
    (TOOLS / "validation-arena_v2.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"arena_v2: {SIZE[0]} x {SIZE[1]} RGB; seed={SEED}; Pillow={PILLOW_VERSION}")
    print(f"兩隊差異：{report['difference']['pixel_count']} px，全部位於主堡隊伍色點綴。")


if __name__ == "__main__":
    main()
