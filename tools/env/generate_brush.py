#!/usr/bin/env python3
"""2026-11-10：以 Pillow 原創繪製草叢；只輸出兩張材質、預覽與驗證報告。"""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).resolve().parent
TOP = ROOT / "public/env/brush-top.png"
SIDE = ROOT / "public/env/brush-side.png"
PREVIEW = TOOLS / "preview-brush.png"
REPORT = TOOLS / "validation-brush.json"
GROUND = ROOT / "public/env/arena_v2/ground-blue.png"
DATE = "2026-11-10"
PALETTE = {
    "shadow": "#173331",
    "root": "#1d3526",
    "dark": "#23432a",
    "green": "#28562f",
    "leaf": "#346b36",
    "light": "#4d853f",
    "tip": "#94b154",
}
NEAREST = Image.Resampling.NEAREST
FONT = ImageFont.load_default()


def save_png(image, path):
    image.save(path, optimize=True, compress_level=9)


def brush_top():
    # 2026-11-10：所有葉叢跨邊界繪製，以 94×56 週期補上重合邊界。
    image = Image.new("RGB", (95, 57), PALETTE["dark"])
    d = ImageDraw.Draw(image)
    for row in range(8):
        for col in range(12):
            n = row * 12 + col
            x = (col * 8 + row * 3 + (n * 7 % 5)) % 94
            y = (row * 7 + (n * 11 % 5)) % 56
            height = 5 + n * 7 % 4
            lean = (-2, 1, -1, 2, 0)[n % 5]
            for dx in (-94, 0, 94):
                for dy in (-56, 0, 56):
                    cx, cy = x + dx, y + dy
                    d.polygon([(cx - 5, cy), (cx - 2, cy - 3),
                               (cx + 5, cy - 2), (cx + 7, cy + 2),
                               (cx + 1, cy + 4), (cx - 4, cy + 2)],
                              fill=PALETTE["shadow"])
                    d.polygon([(cx - 3, cy + 2), (cx - 6, cy - 4),
                               (cx - 2, cy - 2), (cx, cy - height),
                               (cx + 2, cy - 2), (cx + 6, cy - 5),
                               (cx + 4, cy + 2), (cx, cy + 3)],
                              fill=PALETTE["green"])
                    d.polygon([(cx - 3, cy + 1), (cx - 6, cy - 4),
                               (cx - 3, cy - 3), (cx, cy + 2)],
                              fill=PALETTE["leaf"])
                    d.polygon([(cx, cy + 2), (cx + lean, cy - height),
                               (cx + 2, cy - 3), (cx + 2, cy + 1)],
                              fill=PALETTE["leaf"])
                    d.line([(cx + lean, cy - height), (cx, cy - 3)],
                           fill=PALETTE["light"])
                    d.polygon([(cx + 2, cy + 2), (cx + 6, cy - 5),
                               (cx + 5, cy), (cx + 3, cy + 3)],
                              fill=PALETTE["green"])
                    if n % 5 == 0:
                        d.point((cx + lean, cy - height), fill=PALETTE["tip"])
    image.paste(image.crop((0, 0, 1, 56)), (94, 0))
    image.paste(image.crop((0, 0, 95, 1)), (0, 56))
    return image


def brush_side(top):
    image = Image.new("RGBA", (95, 24))
    d = ImageDraw.Draw(image)
    d.rectangle((0, 5, 94, 23), fill=PALETTE["green"])
    for n in range(15):
        x = (n * 7 + n * 3 % 5) % 94
        peak = (0, 3, 1, 5, 2, 4, 1)[n % 7]
        lean = (-3, 1, -1, 2)[n % 4]
        for dx in (-94, 0, 94):
            cx = x + dx
            d.polygon([(cx - 5, 22), (cx - 7, 4 + n % 3),
                       (cx - 3, 8), (cx + lean, peak),
                       (cx + 2, 9), (cx + 6, 3 + n % 4),
                       (cx + 4, 21)], fill=PALETTE["dark"])
            d.polygon([(cx - 3, 20), (cx + lean, peak),
                       (cx + 1, peak + 4), (cx + 1, 18)],
                      fill=PALETTE["leaf"])
            d.line([(cx + lean, peak), (cx - 1, 9)], fill=PALETTE["light"])
            d.polygon([(cx + 1, 19), (cx + 6, 3 + n % 4),
                       (cx + 4, 13), (cx + 3, 21)], fill=PALETTE["green"])
    # 2026-11-10：下半部使用同一色盤降階，保留直立葉脈，底部兩列固定暗綠。
    rgb = {name: Image.new("RGB", (1, 1), color).getpixel((0, 0))
           for name, color in PALETTE.items()}
    lower = {"light": "leaf", "leaf": "green", "green": "dark", "dark": "root"}
    lower_rgb = {rgb[a]: rgb[b] for a, b in lower.items()}
    for y in range(12, 24):
        for x in range(95):
            color = image.getpixel((x, y))[:3]
            for _ in range(1 + (y >= 17)):
                color = lower_rgb.get(color, color)
            image.putpixel((x, y), (*color, 255))
    d.rectangle((0, 22, 94, 23), fill=PALETTE["root"])
    # 2026-11-10：葉尖最上緣及實體頂列對應頂面前緣色，避免異色接縫。
    for x in range(94):
        edge_color = (*top.getpixel((x, 56)), 255)
        first = next(y for y in range(6) if image.getpixel((x, y))[3])
        image.putpixel((x, first), edge_color)
        image.putpixel((x, 5), edge_color)
    image.paste(image.crop((0, 0, 1, 24)), (94, 0))
    return image


def repeat(image, size, wrap_y=True):
    """使用與牆面相同的重合邊界週期；裁切而不縮放葉片。"""
    period_x = image.width - 1
    period_y = image.height - 1
    output = Image.new(image.mode, size)
    for y in range(size[1]):
        for x in range(size[0]):
            output.putpixel((x, y), image.getpixel((x % period_x, y % period_y if wrap_y else y)))
    return output


def hero():
    image = Image.new("RGBA", (30, 38))
    d = ImageDraw.Draw(image)
    ink = "#1a1422"
    d.rectangle((11, 0, 18, 1), fill=ink)
    d.rectangle((9, 2, 20, 10), fill=ink)
    d.polygon([(10, 11), (19, 11), (26, 15), (29, 24), (25, 26),
               (21, 19), (20, 25), (22, 37), (16, 37), (14, 27),
               (12, 37), (6, 37), (9, 25), (8, 19), (4, 26),
               (0, 24), (3, 15)], fill=ink)
    return image


def make_preview(top, side):
    board = Image.new("RGB", (1440, 1792), "#1a1422")
    d = ImageDraw.Draw(board)
    d.fontmode = "1"
    text_color = "#e2dacb"
    d.text((24, 16), f"ORIGINAL BRUSH / {DATE} / UPPER-LEFT LIGHT / NEAREST 4x", font=FONT, fill=text_color)
    d.text((24, 44), "TOP / 95 x 57 / OPAQUE / WRAP X + Y", font=FONT, fill=text_color)
    board.paste(top.resize((380, 228), NEAREST), (24, 66))
    d.text((440, 44), "SIDE / 95 x 24 / WRAP X / BINARY ALPHA", font=FONT, fill=text_color)
    checker = Image.new("RGB", side.size, "#777580")
    cd = ImageDraw.Draw(checker)
    for y in range(0, 24, 4):
        for x in range(0, 95, 4):
            if (x // 4 + y // 4) % 2:
                cd.rectangle((x, y, x + 3, y + 3), fill="#575564")
    checker.paste(side, (0, 0), side)
    board.paste(checker.resize((380, 96), NEAREST), (440, 66))
    d.text((440, 178), "ROWS 0-4: LEAF TIPS / ROWS 5-23: SOLID 19px", font=FONT, fill=text_color)
    d.text((440, 200), "TOP FRONT EDGE = SIDE ROW 5 + FIRST OPAQUE PIXEL", font=FONT, fill=text_color)
    for i, (name, color) in enumerate(PALETTE.items()):
        x = 440 + (i % 4) * 120
        y = 230 + (i // 4) * 36
        d.rectangle((x, y, x + 15, y + 15), fill=color)
        d.text((x + 20, y), color, font=FONT, fill=text_color)
        d.text((x + 20, y + 13), name, font=FONT, fill=text_color)
    d.text((944, 44), "TOP WRAP / 2 x 2 / NEAREST 2x", font=FONT, fill=text_color)
    board.paste(repeat(top, (188, 112)).resize((376, 224), NEAREST), (944, 66))
    with Image.open(GROUND) as source:
        ground = source.convert("RGB")
    scenes = []
    for row, (terrain, cx, cy) in enumerate([
            ("GRASS", 900, 430), ("DIRT ROAD", 900, 554), ("MOSSY JUNGLE", 1100, 750)]):
        for col, units in enumerate((4, 5)):
            crop_box = (cx - 85, cy - 55, cx + 85, cy + 55)
            scene = ground.crop(crop_box)
            width, depth, body = units * 19, round(4 * 11.4), 19
            left, back = (170 - width) // 2, 20
            front = back + depth
            scene.paste(repeat(top, (width, depth)), (left, back))
            person_xy = (left + width // 2 - 15, front + 19 - 38)
            has_hero = row == 0 and col == 1
            if has_hero:
                person = hero()
                scene.paste(person, person_xy, person)
            face = repeat(side, (width, 24), wrap_y=False)
            scene.paste(face, (left, front - 5), face)
            hidden = 0
            if has_hero:
                for y in range(19, 38):
                    for x in range(30):
                        if person.getpixel((x, y))[3]:
                            fx, fy = person_xy[0] + x - left, person_xy[1] + y - front + 5
                            assert 0 <= fx < width and 5 <= fy < 24
                            assert face.getpixel((fx, fy))[3] == 255
                            hidden += 1
            label_y = 320 + row * 490
            screen_x = 24 + col * 704
            label = f"{terrain} / {units} x 4 UNITS / {width} x {depth}px TOP + {body}px BODY"
            d.text((screen_x, label_y), label, font=FONT, fill=text_color)
            if has_hero:
                d.text((screen_x, label_y + 16), "30 x 38px HERO / LOWER HALF OCCLUDED", font=FONT, fill=text_color)
            board.paste(scene.resize((680, 440), NEAREST), (screen_x, label_y + 32))
            scenes.append({"terrain": terrain, "world_size": [units, 4, 1.25],
                           "ground_crop_px": list(crop_box), "top_size_px": [width, depth],
                           "side_body_height_px": body, "hero_size_px": [30, 38] if has_hero else None,
                           "hero_lower_half_opaque_pixels_occluded": hidden})
    save_png(board, PREVIEW)
    return scenes


def seam(image, axis):
    rgba = image.convert("RGBA")
    pairs = ([(rgba.getpixel((0, y)), rgba.getpixel((rgba.width - 1, y)))
              for y in range(rgba.height)] if axis == "left_right" else
             [(rgba.getpixel((x, 0)), rgba.getpixel((x, rgba.height - 1)))
              for x in range(rgba.width)])
    return {"different_pixels": sum(a != b for a, b in pairs),
            "max_channel_difference": max(abs(u - v) for a, b in pairs for u, v in zip(a, b))}


def write_report(top, side, scenes):
    images = {}
    for path in (TOP, SIDE, PREVIEW):
        with Image.open(path) as image:
            pixels = list(image.convert("RGBA").get_flattened_data())
            colors = sorted({p[:3] for p in pixels if p[3] == 255})
            images[str(path.relative_to(ROOT))] = {
                "size_px": list(image.size), "mode": image.mode,
                "opaque_color_count": len(colors),
                "opaque_colors": ["#%02x%02x%02x" % c for c in colors],
                "alpha_values": sorted({p[3] for p in pixels}),
            }
    for path, image, axes in ((TOP, top, ("left_right", "top_bottom")),
                              (SIDE, side, ("left_right",))):
        edges = {axis: {**seam(image, axis), "required_equal": axis in axes}
                 for axis in ("left_right", "top_bottom")}
        images[str(path.relative_to(ROOT))]["seams"] = edges
        assert all(edges[axis]["different_pixels"] == 0 for axis in axes)
    opaque_colors = {p[:3] for im in (top, side)
                     for p in im.convert("RGBA").get_flattened_data() if p[3] == 255}
    assert len(opaque_colors) <= 7
    assert top.size == (95, 57) and side.size == (95, 24)
    assert set(top.convert("RGBA").getchannel("A").get_flattened_data()) == {255}
    assert set(side.getchannel("A").get_flattened_data()) == {0, 255}
    assert set(side.crop((0, 5, 95, 24)).getchannel("A").get_flattened_data()) == {255}
    assert side.getchannel("A").crop((0, 0, 95, 1)).getbbox() is not None
    edge_mismatch = sum(side.getpixel((x, 5))[:3] != top.getpixel((x, 56)) for x in range(95))
    assert edge_mismatch == 0
    report = {
        "date": DATE, "pillow_version": PILLOW_VERSION,
        "method": "Original integer-pixel polygons; no randomness, antialiasing or dithering",
        "palette": PALETTE, "combined_texture_opaque_color_count": len(opaque_colors),
        "images": images, "top_side_edge_color_mismatches": edge_mismatch,
        "top_period_px": [94, 56], "side_period_x_px": 94,
        "side_solid_rows_inclusive": [5, 23], "side_leaf_tip_rows_inclusive": [0, 4],
        "preview_scenes": scenes,
        "sha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in (Path(__file__), TOP, SIDE, PREVIEW)},
        "input_ground_sha256": hashlib.sha256(GROUND.read_bytes()).hexdigest(),
        "report_hash_note": "Self hash excluded to avoid a circular digest",
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    top = brush_top()
    side = brush_side(top)
    save_png(top, TOP)
    save_png(side, SIDE)
    scenes = make_preview(top, side)
    write_report(top, side, scenes)
    print("brush-top 95x57 / brush-side 95x24 / 7 colors / required seams and alpha: PASS")


if __name__ == "__main__":
    main()
