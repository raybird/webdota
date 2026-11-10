#!/usr/bin/env python3
"""2026-11-10：以整數像素產生原創升級特效及獨立預覽、驗證報告。"""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/env"
TOOLS = Path(__file__).resolve().parent
WIDTH, HEIGHT, COUNT, FPS = 64, 96, 14, 12
PIVOT = [32, 88]
NAME = "level-up"
NEAREST = Image.Resampling.NEAREST
PALETTE = {
    "deep_gold": "#8a5a12",
    "gold": "#d99a1e",
    "bright_gold": "#f5c542",
    "pale_gold": "#ffe58a",
    "white_gold": "#fff8d6",
    "arrow_outline": "#1a1422",
}
PHASES = [
    "Foot halo ignites; two seed sparks.",
    "Halo expands; three short light ribbons emerge.",
    "Ribbons climb; first upward chevron appears.",
    "Two ascending chevrons; ribbons reach above the hero.",
    "Three ascending chevrons; gold column opens fully.",
    "Peak: bright ribbon middles, wide halo, three chevrons.",
    "Peak holds; sparks and chevrons continue upward.",
    "Ribbons narrow; halo thins and begins to break.",
    "Broken halo; contracting ribbons and rising chevrons.",
    "Sparse halo dashes; ribbons separate into streaks.",
    "Two chevrons remain; short elevated light streaks.",
    "Last high chevron and small departing sparks.",
    "Two final high sparks; ground and column are clear.",
    "Fully transparent end frame.",
]


def halo(d, frame):
    radius = [5, 8, 11, 14, 17, 19, 20, 20, 20, 20, 20, 20][frame]
    ry = round(radius * 0.6)
    box = (32 - radius, 82 - ry, 32 + radius, 82 + ry)
    if frame < 7:
        d.ellipse(box, outline=PALETTE["gold"], width=2 if frame < 6 else 1)
        d.arc(box, 15, 165, fill=PALETTE["pale_gold"], width=2 if frame < 6 else 1)
        d.arc(box, 205, 260, fill=PALETTE["bright_gold"])
        if 2 <= frame <= 5:
            inner = (box[0] + 3, box[1] + 2, box[2] - 3, box[3] - 2)
            d.arc(inner, 25, 155, fill=PALETTE["bright_gold"])
    else:
        length = [36, 26, 16, 9, 4][frame - 7]
        for start in (12, 76, 140, 204, 268, 332):
            d.arc(box, start, start + length, fill=PALETTE["gold"])
        if frame < 10:
            d.arc(box, 30, 30 + length, fill=PALETTE["pale_gold"])


def ribbons(d, frame):
    top = [86, 68, 51, 33, 20, 18, 18, 20, 24, 29, 30][frame]
    half = [0, 1, 2, 2, 3, 3, 3, 2, 2, 1, 1][frame]
    if not half:
        return
    for j, x in enumerate((21, 32, 43)):
        tip = top + (5 if j != 1 else 0)
        bottom = 83 if frame < 9 else 72 - (frame - 9) * 13
        mid = (tip + bottom) // 2
        if frame < 9:
            d.polygon([(x, tip), (x + half, mid - 5), (x + 1, bottom),
                       (x - 1, bottom), (x - half, mid + 5)], fill=PALETTE["gold"])
            d.line((x, tip + 6, x, bottom - 4), fill=PALETTE["bright_gold"])
            if 3 <= frame <= 7:
                d.rectangle((x, mid - 9, x + (1 if half == 3 else 0), mid + 9),
                            fill=PALETTE["pale_gold"])
                if frame in (4, 5, 6):
                    d.line((x, mid - 4, x, mid + 4), fill=PALETTE["white_gold"])
        else:
            d.line((x, tip, x, tip + 8), fill=PALETTE["bright_gold"])
            d.line((x, bottom - 7, x, bottom), fill=PALETTE["gold"])


def chevron(d, x, y, thin=False):
    if thin:
        d.line([(x - 5, y + 3), (x, y), (x + 5, y + 3)], fill=PALETTE["bright_gold"])
        d.line([(x - 4, y + 2), (x, y)], fill=PALETTE["pale_gold"])
        return
    d.polygon([(x, y), (x + 7, y + 5), (x + 7, y + 8), (x, y + 4),
               (x - 7, y + 8), (x - 7, y + 5)],
              fill=PALETTE["bright_gold"], outline=PALETTE["arrow_outline"])
    d.line([(x - 5, y + 5), (x, y + 2), (x + 5, y + 5)], fill=PALETTE["pale_gold"])
    d.line([(x - 3, y + 3), (x, y + 1)], fill=PALETTE["white_gold"])


def spark(d, x, y, large):
    d.point((x, y), fill=PALETTE["white_gold"])
    if large:
        d.line((x - 2, y, x + 2, y), fill=PALETTE["pale_gold"])
        d.line((x, y - 2, x, y + 2), fill=PALETTE["bright_gold"])
        d.point((x, y), fill=PALETTE["white_gold"])
    else:
        d.point((x, y + 1), fill=PALETTE["deep_gold"])


def draw_frame(frame):
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    if frame == COUNT - 1:
        return image
    d = ImageDraw.Draw(image)
    if frame < 12:
        halo(d, frame)
    if frame < 11:
        ribbons(d, frame)
    if 2 <= frame <= 9:
        for j in range(min(3, frame - 1)):
            chevron(d, 32, 72 - 3 * (frame - 2) - j * 17)
    elif frame == 10:
        for y in (31, 14):
            chevron(d, 32, y, thin=True)
    elif frame == 11:
        chevron(d, 32, 10, thin=True)
    for j, (x, start, end) in enumerate(((13, 0, 10), (49, 0, 11), (17, 2, 12),
                                        (47, 3, 13), (26, 4, 11), (39, 5, 13))):
        if start <= frame < end:
            age = frame - start
            y = 79 - age * 6 - j * 3
            spark(d, x + (age // 3) * (-1 if x < 32 else 1), y,
                  large=2 <= age <= 5 and frame < 11)
    return image


def metadata():
    return {
        "frames": [{"filename": f"{NAME} {i}",
                    "frame": {"x": i * WIDTH, "y": 0, "w": WIDTH, "h": HEIGHT},
                    "rotated": False, "trimmed": False,
                    "spriteSourceSize": {"x": 0, "y": 0, "w": WIDTH, "h": HEIGHT},
                    "sourceSize": {"w": WIDTH, "h": HEIGHT},
                    "duration": round(1000 / FPS)} for i in range(COUNT)],
        "meta": {"app": "webdota/tools/env/generate_levelup_fx.py", "version": "2",
                 "image": f"{NAME}.png", "format": "RGBA8888",
                 "size": {"w": WIDTH * COUNT, "h": HEIGHT}, "scale": "1",
                 "frameTags": [{"name": NAME, "from": 0, "to": COUNT - 1, "direction": "forward"}],
                 "pixelfx": {"id": f"env/{NAME}", "name": "level up", "fps": FPS,
                             "loop": False, "frames": COUNT, "frameSize": [WIDTH, HEIGHT],
                             "pivot": PIVOT, "columns": COUNT}},
    }


def silhouette(d, x, foot):
    color = "#202831"
    d.rectangle((x - 3, foot - 37, x + 3, foot - 31), fill=color)
    d.polygon([(x - 6, foot - 29), (x + 6, foot - 29), (x + 14, foot - 18),
               (x + 11, foot - 15), (x + 6, foot - 21), (x + 5, foot - 13),
               (x + 8, foot), (x + 2, foot), (x, foot - 11), (x - 2, foot),
               (x - 8, foot), (x - 5, foot - 13), (x - 6, foot - 21),
               (x - 12, foot - 15), (x - 15, foot - 18)], fill=color)


def preview(frames):
    scale, cols, gap, margin, header = 4, 7, 16, 24, 64
    tile_w, tile_h = WIDTH * scale, HEIGHT * scale
    row_h = tile_h + 36
    board = Image.new("RGB", (margin * 2 + cols * tile_w + (cols - 1) * gap, 1544), "#191923")
    d = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    d.text((margin, 16), "WEBDOTA / LEVEL UP / 2026-11-10 / 19 px per world unit", font=font, fill="#ffe58a")
    d.text((margin, 36), "14 frames / 12 fps / one shot / pivot [32,88] / nearest 4x / gold, binary alpha", font=font, fill="#c5c5ce")
    for i, frame in enumerate(frames):
        x = margin + (i % cols) * (tile_w + gap)
        y = header + (i // cols) * row_h
        d.rectangle((x, y, x + tile_w - 1, y + tile_h - 1), fill="#22232f")
        scaled = frame.resize((tile_w, tile_h), NEAREST)
        board.paste(scaled, (x, y), scaled)
        px, py = x + PIVOT[0] * scale, y + PIVOT[1] * scale
        d.line((px - 3, py, px + 3, py), fill="#8e8996")
        d.line((px, py - 3, px, py + 3), fill="#8e8996")
        d.text((x, y + tile_h + 7), f"{i + 1:02d}" + (" / CLEAR" if i == 13 else ""), font=font, fill="#c5c5ce")
    y = header + 2 * row_h + 12
    d.text((margin, y), "GRASS / beside: 30x38 px hero silhouette / same pivot height / nearest 4x", font=font, fill="#ffe58a")
    for k, index in enumerate((2, 5, 8)):
        scene = Image.new("RGBA", (144, 112), "#435d36")
        sd = ImageDraw.Draw(scene)
        sd.line((0, 96, 143, 96), fill="#607645")
        silhouette(sd, 108, 96)
        scene.alpha_composite(frames[index], (8, 8))
        x = margin + k * (144 * scale + 40)
        board.paste(scene.convert("RGB").resize((144 * scale, 112 * scale), NEAREST), (x, y + 26))
        d.text((x, y + 482), f"FRAME {index + 1:02d} / FX + adjacent hero", font=font, fill="#c5c5ce")
    for k, (name, color) in enumerate(PALETTE.items()):
        x = margin + k * 300
        d.rectangle((x, y + 526, x + 24, y + 550), fill=color)
        d.text((x + 32, y + 530), f"{name} {color}", font=font, fill="#c5c5ce")
    board.save(TOOLS / "preview-level-up.png", optimize=True, compress_level=9)


def validate(frames):
    png, atlas = OUT / f"{NAME}.png", OUT / f"{NAME}.json"
    decoded = Image.open(png).convert("RGBA")
    data = json.loads(atlas.read_text(encoding="utf-8"))
    assert decoded.size == (WIDTH * COUNT, HEIGHT)
    assert data == metadata() and len(data["frames"]) == len(frames) == COUNT
    color_counts = decoded.getcolors(WIDTH * HEIGHT * COUNT)
    colors = {c for _, c in color_counts if c[3]}
    allowed = {tuple(bytes.fromhex(c[1:])) + (255,) for c in PALETTE.values()}
    assert colors == allowed and len(colors) <= 6
    assert {c[3] for _, c in color_counts} == {0, 255}
    assert frames[-1].getbbox() is None
    assert len({frame.tobytes() for frame in frames}) == COUNT
    records = []
    for i, frame in enumerate(frames):
        assert decoded.crop((i * WIDTH, 0, (i + 1) * WIDTH, HEIGHT)).tobytes() == frame.tobytes()
        bounds = frame.getbbox()
        assert bounds is None or (0 < bounds[0] < bounds[2] < WIDTH and 0 < bounds[1] < bounds[3] < HEIGHT)
        records.append({"index": i, "description": PHASES[i], "bounds": bounds,
                        "opaque_pixels": frame.getchannel("A").histogram()[255],
                        "opaque_colors": sum(1 for _, c in frame.getcolors(WIDTH * HEIGHT) if c[3])})
    files = [Path(__file__).resolve(), png, atlas, TOOLS / "preview-level-up.png"]
    report = {
        "date": "2026-11-10", "pillow": PILLOW_VERSION, "checks_passed": True,
        "randomness": "none", "sheet_size": list(decoded.size), "frame_size": [WIDTH, HEIGHT],
        "frames": COUNT, "fps": FPS, "duration_seconds": COUNT / FPS,
        "aseprite_duration_ms": round(1000 / FPS), "loop": False, "pivot": PIVOT,
        "columns": COUNT, "px_per_world_unit": 19, "alpha_values": [0, 255],
        "opaque_color_count": len(colors), "palette": PALETTE,
        "halo": {"center": [32, 82], "height_to_width": 0.6, "max_radius": [20, 12]},
        "column_top_y": 18, "height_above_pivot": 70,
        "preview": {"size": list(Image.open(files[-1]).size), "nearest_scale": 4,
                    "reference_hero_size": [30, 38], "grass_frames": [2, 5, 8]},
        "per_frame": records,
        "sha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
        "hash_note": "Report excludes its own SHA-256 to avoid a self-referential hash.",
    }
    (TOOLS / "validation-level-up.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    frames = [draw_frame(i) for i in range(COUNT)]
    sheet = Image.new("RGBA", (WIDTH * COUNT, HEIGHT))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * WIDTH, 0))
    sheet.save(OUT / f"{NAME}.png", optimize=True, compress_level=9)
    (OUT / f"{NAME}.json").write_text(json.dumps(metadata(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    preview(frames)
    validate(frames)
    print(f"{NAME}: {WIDTH * COUNT}x{HEIGHT}, {COUNT} frames, {FPS} fps; validation passed")


if __name__ == "__main__":
    main()
