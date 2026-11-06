#!/usr/bin/env python3
"""2026-11-06：離線重製 36.87° 正交斜俯視原創場景素材 v2。"""

import hashlib
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/env"
TOOLS = Path(__file__).resolve().parent
MAP = ROOT / "src/data/maps/demo_arena.json"
DATE = "2026-11-06"
SEED = 20261106
O = "#1a1422"
PPU, DEPTH, HEIGHT = 19, 11.4, 15.2
GROUND_SIZE = (1140, 684)
NEAREST = Image.Resampling.NEAREST
STONE = {
    "o": O, "ao": "#302b3c", "dark": "#4b485b", "shade": "#696575",
    "stone": "#8e8996", "light": "#b9b3b8", "edge": "#e2dacb",
    "mortar": "#595363", "gold_d": "#80583e", "gold": "#c39555",
    "gold_l": "#f0d599", "moss_d": "#394a44", "moss": "#60755a",
    "moss_l": "#92a06a", "wood": "#715047", "skin": "#d3a18b",
    "steel": "#96a7b4", "steel_l": "#dce7dc",
}
TEAMS = {
    "blue": {"team_d": "#253454", "team_s": "#354e8f", "team": "#3b6fd8",
             "team_l": "#7db9ed", "core": "#d2f4ef"},
    "red": {"team_d": "#592f40", "team_s": "#9a3b45", "team": "#d84a3b",
            "team_l": "#f8a47c", "core": "#fff0bd"},
}
SPECS = {
    "tower": {"size": [48, 112], "count": 4, "fps": 6, "loop": True, "pivot": [24, 108], "footprint": [38, 23]},
    "base": {"size": [128, 176], "count": 4, "fps": 6, "loop": True, "pivot": [64, 172], "footprint": [95, 57]},
    "pillar-s": {"size": [48, 96], "count": 1, "fps": 1, "loop": True, "pivot": [24, 92], "footprint": [38, 23]},
    "pillar-l": {"size": [64, 136], "count": 1, "fps": 1, "loop": True, "pivot": [32, 132], "footprint": [57, 34]},
    "walk": {"size": [32, 32], "count": 4, "fps": 8, "loop": True, "pivot": [16, 30]},
    "attack": {"size": [32, 32], "count": 4, "fps": 10, "loop": False, "pivot": [16, 30]},
}
TILES = {"wall-side": (95, 76), "wall-top": (95, 57),
         "crate-side": (95, 76), "crate-top": (95, 57)}
GRASS = ["#30443e", "#3a5143", "#435b46", "#4b6449", "#566e4d", "#647b52", "#84915f"]
DIRT = ["#6d5c4c", "#806d53", "#94805d", "#a18c65", "#b19b74", "#c3ad85"]
PAVING = ["#575564", "#777580", "#8d8891", "#a49ca1", "#bdb4b0", "#d4c8b9"]
FONT = ImageFont.load_default()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_png(image, path):
    image.save(path, optimize=True, compress_level=9)


def project(x, z, y=0, team="blue"):
    sign = 1 if team == "blue" else -1
    return round((30 + sign * z) * PPU), round((30 - sign * x) * DEPTH - y * HEIGHT)


class Pixels:
    def __init__(self, size, team="blue", dark=False):
        self.image = Image.new("RGBA", size)
        self.d = ImageDraw.Draw(self.image)
        self.p = {**STONE, **TEAMS[team]}
        if dark:
            self.p.update({"ao": "#252534", "dark": "#343546", "shade": "#484b5e",
                           "stone": "#606577", "light": "#8b8d9a", "edge": "#bab7bc"})

    def poly(self, pts, c, edge="o"):
        self.d.polygon(pts, fill=self.p[c], outline=self.p[edge] if edge else None)

    def rect(self, box, c, edge=None):
        self.d.rectangle(box, fill=self.p[c], outline=self.p[edge] if edge else None)

    def ellipse(self, box, c, edge="o"):
        self.d.ellipse(box, fill=self.p[c], outline=self.p[edge] if edge else None)

    def line(self, pts, c, width=1):
        self.d.line(pts, fill=self.p[c], width=width)

    def dot(self, xy, c):
        self.d.point(xy, fill=self.p[c])


def cylinder(p, cx, front, width, depth, height, courses=0):
    # 2026-11-06：頂、底為同一橢圓，僅沿畫面垂直移動 height；不使用等角菱形。
    left = cx - width // 2
    right = left + width - 1
    bottom = front - (depth - 1) / 2
    top = bottom - height
    ry = (depth - 1) / 2
    mask = Image.new("L", p.image.size)
    d = ImageDraw.Draw(mask)
    d.rectangle((left, round(top), right, round(bottom)), fill=255)
    d.ellipse((left, round(bottom - ry), right, front), fill=255)
    d.ellipse((left, round(top - ry), right, round(top + ry)), fill=255)
    body = Image.new("RGBA", p.image.size)
    bd = ImageDraw.Draw(body)
    bands = [(0, .09, "light"), (.09, .28, "stone"), (.28, .53, "shade"),
             (.53, .79, "dark"), (.79, 1, "ao")]
    for a, b, c in bands:
        bd.rectangle((left + round(width * a), 0, min(right, left + round(width * b)), p.image.height), fill=p.p[c])
    if courses:
        for n, cy in enumerate(range(round(top) + courses, round(bottom), courses)):
            bd.arc((left - 1, cy - ry, right + 1, cy + ry), 0, 180, fill=p.p["ao"])
            bx = left + (width * (0.35 if n % 2 else 0.62))
            bd.line((bx, cy + ry, bx, min(bottom + ry - 3, cy + ry + courses - 2)), fill=p.p["dark"])
            bd.line((left + 4, cy + ry + 1, left + 8, cy + ry + 2), fill=p.p["stone"])
    p.image.paste(body, (0, 0), mask)
    p.line([(left, round(top)), (left, round(bottom))], "o")
    p.line([(right, round(top)), (right, round(bottom))], "o")
    p.d.arc((left, round(bottom - ry), right, front), 0, 180, fill=p.p["o"])
    p.d.arc((left + 1, round(bottom - ry) - 1, right - 1, front - 1), 10, 170, fill=p.p["ao"])
    p.ellipse((left, round(top - ry), right, round(top + ry)), "light")
    p.d.arc((left + 2, round(top - ry) + 2, right - 2, round(top + ry) - 2), 185, 300, fill=p.p["edge"])
    p.d.arc((left + 2, round(top - ry) + 2, right - 2, round(top + ry) - 2), 0, 95, fill=p.p["stone"])
    return left, right, round(top), round(bottom)


def crystal(p, cx, top, width, height, frame):
    left, right = cx - width // 2, cx + width // 2
    shoulder, bottom = top + height // 3, top + height
    p.poly([(cx, top), (right, shoulder), (right - 2, bottom - 6),
            (cx, bottom), (left + 2, bottom - 6), (left, shoulder)], "team_d")
    p.poly([(cx, top + 2), (cx - 1, shoulder), (left + 2, shoulder + 1)], "core", None)
    p.poly([(cx, top + 3), (right - 2, shoulder), (cx + 1, shoulder + 2)], "team_l", None)
    p.poly([(left + 2, shoulder + 2), (cx - 1, shoulder), (cx, bottom - 3), (left + 3, bottom - 6)], "team", None)
    p.poly([(cx + 1, shoulder + 2), (right - 2, shoulder + 1), (right - 3, bottom - 6), (cx + 1, bottom - 2)], "team_s", None)
    p.line([(cx - 1, top + 4), (cx - 2, shoulder - 1)], "core")
    p.line([(cx, shoulder + 2), (cx, bottom - 4)], "team_l")
    y = shoulder + [2, 5, 8, 4][frame]
    p.line([(left + 3, y + 1), (cx - 2, y - 1)], "core")
    p.dot((right - 3, shoulder + [5, 8, 11, 6][frame]), "team_l")


def tower(team, frame):
    p = Pixels(SPECS["tower"]["size"], team)
    cylinder(p, 24, 108, 38, 23, 4)
    cylinder(p, 24, 99, 30, 18, 5)
    cylinder(p, 24, 91, 25, 15, 51, courses=10)
    # 2026-11-06：前方符文與柱身縱向高光固定，動畫只改水晶內部閃光。
    p.line([(15, 48), (15, 78)], "light")
    p.line([(17, 51), (17, 62)], "stone")
    p.poly([(20, 58), (26, 58), (29, 63), (26, 70), (20, 70), (18, 64)], "ao")
    p.line([(21, 60), (24, 62), (26, 60), (25, 66), (22, 68), (21, 60)], "gold")
    p.dot((22, 61), "gold_l")
    p.line([(29, 76), (27, 79), (28, 83)], "ao")
    p.line([(17, 82), (20, 83)], "light")
    cylinder(p, 24, 44, 34, 20, 6)
    p.ellipse((12, 21, 35, 35), "ao")
    p.ellipse((15, 23, 32, 33), "gold_d")
    p.d.arc((13, 22, 34, 34), 185, 300, fill=p.p["gold_l"])
    for x, y in [(10, 27), (35, 28), (17, 35), (29, 36)]:
        p.poly([(x, y - 6), (x + 3, y - 7), (x + 3, y + 2), (x, y + 3)], "shade")
        p.line([(x + 1, y - 5), (x + 1, y)], "light")
    crystal(p, 24, 6, 19, 29, frame)
    for x, y in [(8, 97), (12, 99), (31, 103)]:
        p.line([(x, y), (x + 2, y - 1), (x + 4, y)], "moss_d")
        p.dot((x + 1, y - 1), "moss")
    p.line([(9, 100), (10, 97), (11, 100)], "moss_l")
    return p.image


def pillar(size):
    large = size == "l"
    spec = SPECS[f"pillar-{size}"]
    p = Pixels(spec["size"], dark=True)
    cx, front = spec["pivot"]
    if large:
        cylinder(p, cx, front, 57, 34, 6)
        cylinder(p, cx, 123, 47, 28, 76, courses=16)
        cylinder(p, cx, 46, 57, 34, 5)
        top_box = (10, 12, 53, 37)
    else:
        cylinder(p, cx, front, 38, 23, 5)
        cylinder(p, cx, 85, 30, 18, 51, courses=12)
        cylinder(p, cx, 35, 38, 23, 4)
        top_box = (10, 13, 37, 28)
    p.d.ellipse(top_box, outline=p.p["stone"])
    x0, y0, x1, y1 = top_box
    p.line([(cx - 5, y0 + 3), (cx - 2, y0 + 6), (cx - 5, y0 + 9), (cx - 1, y1 - 1)], "shade")
    p.line([(cx + 3, y0), (cx + 5, y0 + 4), (cx + 3, y0 + 7)], "dark")
    if large:
        p.line([(22, 52), (30, 49), (35, 53), (29, 59), (23, 56), (29, 52), (29, 72)], "ao", 3)
        p.line([(22, 51), (29, 48), (34, 52), (28, 58), (23, 55), (28, 52), (28, 71)], "moss_l")
        p.line([(26, 64), (33, 61)], "moss")
        p.line([(19, 43), (17, 51), (20, 62), (17, 74), (19, 86), (16, 99), (18, 112)], "moss_d", 2)
        for x, y in [(17, 51), (20, 62), (17, 75), (19, 86), (16, 99), (18, 109)]:
            p.poly([(x, y), (x - 4, y - 3), (x - 3, y + 2)], "moss", None)
            p.dot((x - 3, y - 2), "moss_l")
        p.line([(41, 72), (38, 77), (40, 83), (37, 89)], "ao")
    else:
        p.line([(27, 47), (25, 53), (28, 57), (26, 63)], "ao")
        p.line([(14, 53), (17, 54)], "light")
    for x, y in [(cx - 14, front - 10), (cx - 10, front - 7), (cx + 8, front - 4)]:
        p.line([(x, y), (x + 3, y - 2), (x + 5, y - 1)], "moss_d", 2)
        p.line([(x + 1, y - 1), (x + 3, y - 2)], "moss")
    p.line([(cx - 13, front - 7), (cx - 12, front - 11), (cx - 10, front - 8)], "moss_l")
    return p.image


def roof(p, cx, cy, width, depth, rise):
    left, right = cx - width // 2, cx + width // 2
    p.ellipse((left, cy - depth // 2, right, cy + depth // 2), "dark")
    p.d.pieslice((left, cy - depth // 2, right, cy + depth // 2), 90, 270, fill=p.p["stone"])
    p.poly([(cx, cy - rise), (right, cy), (right - 2, cy + depth // 2 - 1),
            (cx, cy + depth // 2 + 2), (left + 2, cy + depth // 2 - 1), (left, cy)], "dark")
    p.poly([(cx, cy - rise + 2), (left + 2, cy), (cx - 5, cy + depth // 2)], "light", None)
    p.poly([(cx, cy - rise + 2), (cx - 5, cy + depth // 2), (cx + 6, cy + depth // 2)], "stone", None)
    p.line([(cx - 1, cy - rise + 3), (left + 4, cy)], "edge")
    p.d.arc((left + 1, cy - depth // 2, right - 1, cy + depth // 2), 0, 180, fill=p.p["ao"])
    for t in (.42, .7):
        yy = round(cy - rise * (1 - t))
        ww = round(width * t / 2)
        p.line([(cx - ww, yy), (cx - 3, yy + round(depth * t / 2)), (cx + ww, yy)], "shade")


def base(team, frame):
    p = Pixels(SPECS["base"]["size"], team)
    cylinder(p, 64, 172, 95, 57, 4)
    p.d.ellipse((22, 117, 105, 164), outline=p.p["stone"])
    p.d.arc((23, 118, 104, 163), 185, 300, fill=p.p["edge"])
    for x in (36, 53, 75, 92):
        p.line([(x, 152), (x - 3, 165)], "shade")
    # 2026-11-06：後塔先畫；所有水平塔頂保留 0.6 的深寬比。
    for cx in (39, 89):
        cylinder(p, cx, 130, 22, 13, 62, courses=12)
        cylinder(p, cx, 76, 26, 16, 4)
        roof(p, cx, 59, 28, 17, 17)
        p.rect((cx - 2, 85, cx + 1, 98), "ao")
        p.line([(cx - 2, 85), (cx - 2, 96)], "gold_d")
    cylinder(p, 64, 146, 50, 30, 91, courses=13)
    cylinder(p, 64, 72, 58, 35, 5)
    roof(p, 64, 50, 62, 37, 29)
    p.line([(64, 21), (64, 17)], "gold_l")
    p.dot((63, 18), "edge")
    # 2026-11-06：深門洞與核心在前面，核心與水晶無外擴半透明光暈。
    p.poly([(48, 111), (48, 89), (53, 78), (63, 73), (74, 78), (80, 89), (80, 127), (48, 127)], "gold_d")
    p.poly([(51, 123), (51, 89), (56, 81), (64, 78), (73, 83), (77, 91), (77, 124)], "ao")
    p.line([(50, 109), (50, 90), (54, 81), (62, 77)], "gold_l")
    p.line([(78, 95), (78, 123)], "dark")
    p.ellipse((53, 112, 75, 125), "team_d", None)
    crystal(p, 64, 84, 18, 33, frame)
    p.line([(55, 122), (63, 125), (73, 121)], "team_s")
    for cx in (43, 84):
        p.poly([(cx - 3, 75), (cx + 3, 77), (cx + 3, 103), (cx, 109), (cx - 3, 104)], "team_d")
        p.line([(cx - 2, 78), (cx - 2, 101), (cx, 105)], "team")
        p.line([(cx - 4, 74), (cx + 4, 76)], "gold_l")
    # 2026-11-06：前方雙柱有可見橢圓頂、曲面色階與接地 AO。
    for cx in (31, 97):
        cylinder(p, cx, 155, 23, 14, 57, courses=12)
        cylinder(p, cx, 101, 27, 16, 5)
        p.ellipse((cx - 9, 84, cx + 8, 94), "stone")
        p.d.arc((cx - 7, 85, cx + 7, 93), 190, 300, fill=p.p["edge"])
        for dx in (-9, -1, 7):
            p.rect((cx + dx, 83, cx + dx + 3, 90), "shade", "o")
            p.line([(cx + dx + 1, 84), (cx + dx + 2, 84)], "edge")
        p.rect((cx - 3, 112, cx + 2, 126), "ao")
        p.line([(cx - 3, 112), (cx - 3, 124)], "stone")
        p.dot((cx - 6, 136), "light")
    p.poly([(49, 130), (78, 130), (83, 145), (44, 145)], "shade")
    p.line([(49, 131), (78, 131)], "edge")
    p.line([(47, 137), (80, 137)], "dark")
    p.line([(47, 138), (80, 138)], "light")
    p.line([(45, 144), (82, 144)], "ao")
    for x, y in [(21, 151), (25, 155), (37, 160), (91, 161), (101, 150)]:
        p.line([(x, y), (x + 4, y - 2), (x + 6, y)], "moss_d", 2)
        p.line([(x + 1, y - 1), (x + 3, y - 2)], "moss")
    p.line([(23, 152), (24, 148), (25, 152), (27, 149)], "moss_l")
    p.line([(52, 153), (49, 156), (50, 161)], "shade")
    p.dot((53, 154), "edge")
    return p.image


def blade(p, hand, tip):
    hx, hy = hand
    tx, ty = tip
    p.line([(hx, hy), (tx, ty)], "o", 4)
    p.line([(hx, hy), (tx, ty)], "steel", 2)
    p.line([(hx - 1, hy - 1), (tx - 1, ty)], "steel_l")
    p.line([(hx - 2, hy + 1), (hx + 2, hy - 1)], "gold", 2)


def creep(team, anim, frame):
    p = Pixels((32, 32), team)
    bob = [0, -1, 0, -1][frame] if anim == "walk" else [0, -1, 0, 0][frame]
    stride = [0, 2, 0, -2][frame] if anim == "walk" else [0, -1, 1, 0][frame]
    p.poly([(12, 19), (19, 18), (23, 23), (18, 27), (10, 25)], "team_d")
    p.poly([(11, 23), (14, 23), (14 + stride, 27), (19 + stride, 28), (19 + stride, 29), (12, 29), (10, 28)], "dark")
    p.line([(12, 27), (15 + stride, 27), (18 + stride, 28)], "steel")
    p.poly([(18, 23), (21, 22), (23 - stride, 25), (26 - stride, 26), (25 - stride, 28), (20, 28)], "ao")
    p.line([(21, 25), (24 - stride, 26)], "shade")
    p.poly([(10, 15 + bob), (17, 13 + bob), (23, 16 + bob), (22, 22 + bob), (16, 25 + bob), (10, 21 + bob)], "team_s")
    p.poly([(11, 16 + bob), (16, 14 + bob), (21, 16 + bob), (17, 19 + bob), (11, 18 + bob)], "team_l", None)
    p.line([(11, 19 + bob), (16, 22 + bob), (20, 20 + bob)], "team")
    p.line([(12, 23 + bob), (19, 24 + bob)], "gold_d")
    p.ellipse((9, 14 + bob, 15, 19 + bob), "steel")
    p.line([(10, 15 + bob), (13, 15 + bob)], "steel_l")
    hand, tip = (23, 19 + bob), (27 + [0, -1, 1, 0][frame], 9 + bob)
    if anim == "attack":
        hand, tip = [((22, 18), (26, 7)), ((20, 15), (16, 4)),
                     ((25, 18), (29, 13)), ((24, 23), (29, 27))][frame]
    p.line([(21, 17 + bob), hand], "ao", 4)
    p.line([(21, 17 + bob), hand], "steel", 2)
    blade(p, hand, tip)
    p.dot(hand, "skin")
    # 2026-11-06：頭盔頂為 12×7 橢圓；臉只露右前方，避免平視人像比例。
    p.poly([(13, 11 + bob), (21, 11 + bob), (24, 15 + bob), (22, 18 + bob), (16, 17 + bob)], "shade")
    p.ellipse((11, 8 + bob, 23, 15 + bob), "steel")
    p.ellipse((12, 9 + bob, 21, 13 + bob), "steel_l", None)
    p.poly([(19, 9 + bob), (22, 11 + bob), (23, 14 + bob), (20, 14 + bob)], "shade", None)
    p.line([(15, 9 + bob), (18, 9 + bob), (20, 12 + bob)], "gold_l")
    p.line([(21, 14 + bob), (23, 15 + bob)], "ao", 2)
    p.dot((23, 16 + bob), "skin")
    p.poly([(8, 19 + bob), (12, 18 + bob), (16, 21 + bob), (15, 26 + bob), (12, 28 + bob), (8, 25 + bob)], "gold_d")
    p.poly([(9, 20 + bob), (12, 19 + bob), (14, 22 + bob), (13, 26 + bob), (9, 24 + bob)], "team")
    p.line([(9, 20 + bob), (12, 19 + bob), (14, 21 + bob)], "gold_l")
    p.dot((11, 22 + bob), "core")
    return p.image


def make_tile(name):
    w, h = TILES[name]
    pw, ph = w - 1, h - 1
    image = Image.new("RGB", (pw * 3, ph * 3), "#5c5561" if name.startswith("wall") else "#67473a")
    d = ImageDraw.Draw(image)
    # 2026-11-06：以 94×75／94×56 週期繪圖，重合的末列／末欄讓四邊逐像素相等。
    for oy in (0, ph, ph * 2):
        for ox in (0, pw, pw * 2):
            if name.startswith("wall"):
                rows = 3 if name.endswith("side") else 2
                step = ph // rows
                for row in range(rows):
                    y = oy + row * step
                    shift = 23 if row % 2 else 0
                    for x in range(ox - 47 + shift, ox + pw, 47):
                        color = ["#96909b", "#a19aa2", "#8e8995"][(row + (x - ox) // 47) % 3]
                        d.rectangle((x + 1, y + 1, x + 45, y + step - 2), fill=color)
                        d.line([(x + 2, y + step - 5), (x + 2, y + 2), (x + 41, y + 2)], fill="#c8bfb8")
                        d.line([(x + 45, y + 4), (x + 45, y + step - 2), (x + 5, y + step - 2)], fill="#726b7d")
                        d.line([(x + 33, y + 1), (x + 30, y + 6), (x + 33, y + 9)], fill="#726b7d")
                        d.line([(x + 11, y + 13), (x + 16, y + 12), (x + 19, y + 13)], fill="#b3aab0")
                        d.point((x + 23, y + 7), fill="#d3c8bc")
                        if row == rows - 1:
                            d.line([(x + 2, y + step - 3), (x + 5, y + step - 4), (x + 8, y + step - 3)], fill="#687261")
            else:
                for i, (a, b) in enumerate([(0, 18), (19, 37), (38, 56), (57, 75), (76, 93)]):
                    x = ox + a
                    d.rectangle((x, oy, ox + b - 1, oy + ph - 1), fill=["#ac7b50", "#ba8857", "#a5724a"][i % 3])
                    d.line([(x + 1, oy), (x + 1, oy + ph - 1)], fill="#d2a06a")
                    d.line([(ox + b - 1, oy), (ox + b - 1, oy + ph - 1)], fill="#79513d")
                    d.line([(x + 7, oy + 4), (x + 6, oy + 17), (x + 9, oy + 24), (x + 7, oy + 39)], fill="#8d5d43")
                    d.line([(x + 11, oy + 35), (x + 12, oy + ph - 5)], fill="#c4915e")
                    d.ellipse((x + 5, oy + 21, x + 11, oy + 28), outline="#79513d")
                    d.line([(x + 7, oy + 22), (x + 8, oy + 25)], fill="#dfad73")
                if name.endswith("side"):
                    bars = [(ox, oy + 7, ox + pw - 1, oy + 13), (ox, oy + ph - 14, ox + pw - 1, oy + ph - 8)]
                else:
                    bars = [(ox + 9, oy, ox + 15, oy + ph - 1), (ox + 78, oy, ox + 84, oy + ph - 1)]
                for x0, y0, x1, y1 in bars:
                    d.rectangle((x0, y0, x1, y1), fill="#55535d", outline=O)
                    d.line([(x0 + 1, y1 - 1), (x0 + 1, y0 + 1), (x1 - 1, y0 + 1)], fill="#8e9299")
                    for t in (0.15, 0.8):
                        nx, ny = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
                        d.rectangle((nx - 1, ny - 1, nx + 1, ny + 1), fill="#34333f")
                        d.point((nx - 1, ny - 1), fill="#ced3c9")
    inner = image.crop((pw, ph, pw * 2, ph * 2))
    tile = Image.new("RGB", (w, h))
    tile.paste(inner, (0, 0))
    tile.paste(inner.crop((0, 0, 1, ph)), (w - 1, 0))
    tile.paste(tile.crop((0, 0, w, 1)), (0, h - 1))
    return tile


def path_routes(data):
    routes = []
    for team in TEAMS:
        home = next(e for e in data["entities"] if e["type"] == "base" and e["team"] == team)
        a = [home["position"][0], home["position"][2]]
        for tower_entity in [e for e in data["entities"] if e["type"] == "tower" and e["team"] == team]:
            b = [tower_entity["position"][0], tower_entity["position"][2]]
            for start, end, bend in [(a, b, .6), (b, [0, 0], 2.2 if b[1] else .35)]:
                dx, dz = end[0] - start[0], end[1] - start[1]
                length = math.hypot(dx, dz)
                points = []
                for i in range(101):
                    t = i / 100
                    off = math.sin(t * math.pi) * bend * (1 if team == "blue" else -1)
                    points.append(project(start[0] + dx * t + dz / length * off,
                                          start[1] + dz * t - dx / length * off))
                routes.append({"team": team, "from": start, "to": end, "width_world": 3, "pixels": points})
    return routes


def ground(data):
    rng = random.Random(SEED)
    image = Image.new("RGB", GROUND_SIZE, GRASS[2])
    d = ImageDraw.Draw(image)
    for _ in range(3400):
        x, y = rng.randrange(1140), rng.randrange(684)
        w, h = rng.randrange(7, 55), rng.randrange(3, 19)
        d.polygon([(x, y + 2), (x + w // 3, y), (x + w - 4, y + 1),
                   (x + w, y + h // 2), (x + w - 3, y + h), (x + 2, y + h - 1)], fill=rng.choice(GRASS[:6]))
    routes = path_routes(data)
    mask = Image.new("L", GROUND_SIZE)
    md = ImageDraw.Draw(mask)
    for route in routes:
        for cx, cy in route["pixels"]:
            md.ellipse((cx - 28, cy - 17, cx + 28, cy + 17), fill=255)
    soil = Image.new("RGB", GROUND_SIZE, DIRT[2])
    sd = ImageDraw.Draw(soil)
    for _ in range(13000):
        x, y = rng.randrange(1140), rng.randrange(684)
        if mask.getpixel((x, y)):
            sd.rectangle((x, y, x + rng.randrange(2, 12), y + rng.randrange(0, 3)), fill=rng.choice(DIRT))
    for route in routes:
        pts = route["pixels"]
        for side in (-1, 1):
            rut = []
            for i, (x, y) in enumerate(pts):
                prev, nxt = pts[max(0, i - 1)], pts[min(100, i + 1)]
                dx, dy = nxt[0] - prev[0], (nxt[1] - prev[1]) / .6
                mag = max(1, math.hypot(dx, dy))
                rut.append((round(x - dy / mag * 10 * side), round(y + dx / mag * 6 * side)))
            sd.line(rut, fill=DIRT[1], width=2)
            for i in range(0, 100, 7):
                sd.line(rut[i:i + 3], fill=DIRT[0])
    image.paste(soil, (0, 0), mask)
    d = ImageDraw.Draw(image)
    for _ in range(23500):
        x, y = rng.randrange(38, 1102), rng.randrange(23, 661)
        on_path = mask.getpixel((x, y))
        near = any(mask.getpixel((x + dx, y + dy)) != on_path for dx, dy in [(4, 0), (-4, 0), (0, 3), (0, -3)])
        if on_path and not near:
            if rng.randrange(9) == 0:
                d.rectangle((x, y, x + 1, y), fill=rng.choice(DIRT))
            continue
        if near or rng.randrange(3) == 0:
            color = rng.choice(GRASS[1:])
            d.line([(x - 2, y), (x - 1, y - 2), (x, y), (x + 2, y - 3)], fill=color)
            if rng.randrange(4) == 0:
                d.point((x - 1, y - 3), fill=GRASS[5])
        elif rng.randrange(30) == 0:
            d.ellipse((x, y, x + 3, y + 1), fill=PAVING[1])
            d.point((x, y), fill=PAVING[3])
        elif rng.randrange(44) == 0:
            d.line([(x, y), (x + 1, y - 2)], fill=GRASS[1])
            d.point((x + 1, y - 2), fill=rng.choice(["#d6c58c", "#bca7ae", "#d6d0b0"]))
    platforms, accents = [], Image.new("L", GROUND_SIZE)
    ad = ImageDraw.Draw(accents)
    for e in data["entities"]:
        if e["type"] not in ("base", "tower"):
            continue
        cx, cy = project(e["position"][0], e["position"][2])
        is_base = e["type"] == "base"
        rx, ry = (85, 51) if is_base else (28, 17)
        paving_mask = Image.new("L", GROUND_SIZE)
        pd = ImageDraw.Draw(paving_mask)
        box = (cx - rx, cy - ry, cx + rx, cy + ry)
        if is_base:
            pd.rectangle(box, fill=255)
        else:
            pd.ellipse(box, fill=255)
            pd.ellipse((cx - 20, cy - 12, cx + 20, cy + 12), fill=0)
        paving = Image.new("RGB", GROUND_SIZE, PAVING[0])
        st = ImageDraw.Draw(paving)
        for row, y in enumerate(range(cy - ry - 6, cy + ry + 1, 11)):
            for x in range(cx - rx - 20 + (9 if row % 2 else 0), cx + rx + 1, 19):
                st.rectangle((x + 1, y + 1, x + 17, y + 9), fill=rng.choice(PAVING[1:5]))
                st.line([(x + 2, y + 7), (x + 2, y + 2), (x + 14, y + 2)], fill=PAVING[4])
                st.line([(x + 17, y + 3), (x + 17, y + 9), (x + 4, y + 9)], fill=PAVING[1])
                if rng.randrange(7) == 0:
                    st.line([(x + 10, y + 1), (x + 9, y + 4), (x + 11, y + 6)], fill=PAVING[0])
                if rng.randrange(9) == 0:
                    st.line([(x + 2, y + 9), (x + 4, y + 8)], fill=GRASS[3])
        image.paste(paving, (0, 0), paving_mask)
        d = ImageDraw.Draw(image)
        if is_base:
            d.rectangle(box, outline=PAVING[0])
            team_id = 1 if e["team"] == "blue" else 2
            ad.rectangle((cx - 81, cy - 47, cx + 81, cy + 47), outline=team_id, width=2)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    x, y = cx + sx * 74, cy + sy * 40
                    ad.polygon([(x, y - 3), (x + 5, y), (x, y + 3), (x - 5, y)], fill=team_id + 2)
        else:
            d.ellipse(box, outline=PAVING[0])
            d.arc((cx - 26, cy - 15, cx + 26, cy + 15), 185, 310, fill=PAVING[5])
            d.ellipse((cx - 20, cy - 12, cx + 20, cy + 12), outline=PAVING[0])
        platforms.append({"type": e["type"], "team": e["team"], "world_xz": [e["position"][0], e["position"][2]],
                          "blue_center": [cx, cy], "red_center": list(project(e["position"][0], e["position"][2], team="red")),
                          "size_px": [rx * 2 + 1, ry * 2 + 1]})
    images = {}
    for view in TEAMS:
        im = image.copy()
        for n in (1, 2, 3, 4):
            team = "blue" if n in (1, 3) else "red"
            if view == "red":
                team = "red" if team == "blue" else "blue"
            color = TEAMS[team]["team_l" if n > 2 else "team"]
            im.paste(color, (0, 0), accents.point(lambda v: 255 if v == n else 0))
        images[f"ground-{view}"] = im
    return images, routes, platforms, accents


def sprite_sheet(name, spec, frames):
    w, h = spec["size"]
    count = spec["count"]
    assert len(frames) == count
    sheet = Image.new("RGBA", (w * count, h))
    for i, image in enumerate(frames):
        sheet.paste(image, (i * w, 0))
    animation = name.rsplit("-", 1)[1]
    metadata = {"frames": [{"filename": f"{name} {i}", "frame": {"x": i * w, "y": 0, "w": w, "h": h},
                            "rotated": False, "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
                            "sourceSize": {"w": w, "h": h}, "duration": round(1000 / spec["fps"])} for i in range(count)],
                "meta": {"app": "webdota/tools/env/generate.py", "version": "2", "image": f"{name}.png",
                         "format": "RGBA8888", "size": {"w": w * count, "h": h}, "scale": "1",
                         "frameTags": [{"name": animation, "from": 0, "to": count - 1, "direction": "forward"}],
                         "pixelfx": {"id": f"env/{name}", "name": name.replace("-", " "), "fps": spec["fps"],
                                     "loop": spec["loop"], "frames": count, "frameSize": [w, h],
                                     "pivot": spec["pivot"], "columns": count}}}
    (OUT / f"{name}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return sheet


def repeat_tile(tile, size, brightness=1):
    result = Image.new("RGB", size)
    tile = tile.convert("RGB")
    if brightness != 1:
        tile = tile.point(lambda v: round(v * brightness))
    for y in range(0, size[1], tile.height - 1):
        for x in range(0, size[0], tile.width - 1):
            result.paste(tile, (x, y))
    return result


def preview_scene(images, data):
    # 2026-11-06：足印中心先投影，再加半個底面深度，讓指定 front-pivot 落在足印前緣。
    canvas = images["ground-blue"].convert("RGBA")
    objects = []
    near_x, far_x, left_z, right_z = -26, -6, -29, 1
    def visible(x, z, sx, sz):
        return x + sx / 2 >= near_x and x - sx / 2 <= far_x and z + sz / 2 >= left_z and z - sz / 2 <= right_z
    for block in data["blocks"]:
        x, y, z = block["position"]
        sx, sy, sz = block["scale"]
        if not visible(x, z, sx, sz):
            continue
        if block["material"] == "pillar_dark":
            large = sx == 3
            name = "pillar-l-idle" if large else "pillar-s-idle"
            objects.append((x - sx / 2, "sprite", (x, z, name, SPECS["pillar-l" if large else "pillar-s"])))
        elif block["material"] in ("wall_stone", "obstacle_wood"):
            objects.append((x - sx / 2, "box", block))
    for e in data["entities"]:
        if e["type"] in ("base", "tower"):
            spec = SPECS[e["type"]]
            x, _, z = e["position"]
            if not visible(x, z, spec["footprint"][1] / DEPTH, spec["footprint"][0] / PPU):
                continue
            objects.append((x - spec["footprint"][1] / DEPTH / 2, "sprite", (x, z, f'{e["type"]}-{e["team"]}-idle', spec)))
    creeps = [(-19, -18, "blue", 0), (-17.7, -16.8, "blue", 1), (-16.3, -14.5, "blue", 2),
              (-11.8, -6, "red", 0), (-13.2, -5, "red", 2), (-12.5, -2.8, "blue", 3)]
    for x, z, team, frame in creeps:
        objects.append((x, "creep", (x, z, f"creep-{team}-walk", frame)))
    for _, kind, obj in sorted(objects, key=lambda item: -item[0]):
        if kind == "box":
            x, y, z = obj["position"]
            sx, sy, sz = obj["scale"]
            prefix = "wall" if obj["material"] == "wall_stone" else "crate"
            left, back = project(x + sx / 2, z - sz / 2)
            right, front = project(x - sx / 2, z + sz / 2)
            top = round(sy * HEIGHT)
            canvas.paste(repeat_tile(images[f"{prefix}-side"], (right - left, top), .85), (left, front - top))
            canvas.paste(repeat_tile(images[f"{prefix}-top"], (right - left, front - back)), (left, back - top))
            d = ImageDraw.Draw(canvas)
            d.line([(left, back - top), (right - 1, back - top)], fill=STONE["edge"])
            d.line([(left, front), (right - 1, front)], fill=O)
        else:
            if kind == "creep":
                x, z, name, frame = obj
                spec, half = SPECS["walk"], 0
            else:
                x, z, name, spec = obj
                frame, half = 0, (spec["footprint"][1] - 1) / 2
            w, h = spec["size"]
            sprite = images[name].crop((frame * w, 0, (frame + 1) * w, h))
            cx, cy = project(x, z)
            canvas.alpha_composite(sprite, (cx - spec["pivot"][0], round(cy + half - spec["pivot"][1])))
    left, near = project(near_x, left_z)
    _, far = project(far_x, left_z)
    skyline = 96
    crop = canvas.crop((left, far - skyline, left + 570, near))
    result = Image.new("RGB", (1770, crop.height * 3 + 102), "#181823")
    d = ImageDraw.Draw(result)
    d.text((30, 18), "WEBDOTA / BLUE CAMERA / 36.87 DEG / UPPER-LEFT LIGHT", fill="#e2dacb", font=FONT)
    d.text((30, 38), "30 x 20 world ground window + 96px height margin | nearest 3x | no cast shadows baked", fill="#a7abb9", font=FONT)
    result.paste(crop.resize((crop.width * 3, crop.height * 3), NEAREST).convert("RGB"), (30, 65))
    d.text((30, result.height - 22), "2026-11-06 | map coordinates, camera-aware footprints, depth-sorted walls / pillars / towers / base / creeps", fill="#a7abb9", font=FONT)
    save_png(result, TOOLS / "preview-scene.png")
    return {"ground_world_x": [near_x, far_x], "ground_world_z": [left_z, right_z], "height_margin_px": skyline,
            "ground_window_px": [570, near - far], "nearest_scale": 3, "footprint_center_to_pivot": "add (footprint_depth_px - 1)/2 to projected row",
            "outside_ground_window_objects_culled": True, "objects": len(objects), "creep_world_xz": [[x, z, team] for x, z, team, _ in creeps]}


def preview(images):
    board = Image.new("RGB", (1200, 3000), "#191923")
    d = ImageDraw.Draw(board)
    def text(x, y, value):
        d.text((x, y), value, fill="#ddd8cf", font=FONT)
    def paste(im, x, y, scale):
        rgba = im.convert("RGBA")
        board.paste(rgba.resize((im.width * scale, im.height * scale), NEAREST), (x, y), rgba.resize((im.width * scale, im.height * scale), NEAREST))
    text(24, 16, "WEBDOTA ENV v2 / 2026-11-06 / orthographic 36.87 deg / light: upper left / no baked cast shadows")
    for i, team in enumerate(TEAMS):
        text(24 + i * 588, 44, f"ground-{team} / 1140 x 684 / overview 1:2")
        board.paste(images[f"ground-{team}"].resize((570, 342), NEAREST), (24 + i * 588, 66))
    text(24, 430, "GROUND DETAIL / nearest 2x / grass layers, wheel ruts, ellipse paving, plaza inlay")
    paste(images["ground-blue"].crop((80, 492, 360, 652)), 24, 452, 2)
    paste(images["ground-blue"].crop((410, 416, 690, 576)), 612, 452, 2)
    y = 804
    for team in TEAMS:
        name = f"base-{team}-idle"
        text(24, y, f"{name} / 4 frames / 128 x 176 / pivot 64,172 / nearest 2x")
        paste(images[name], 24, y + 20, 2)
        y += 384
    text(24, y, "TOWERS / 48 x 112 / pivot 24,108 / nearest 2x")
    paste(images["tower-blue-idle"], 24, y + 20, 2)
    paste(images["tower-red-idle"], 430, y + 20, 2)
    paste(images["pillar-s-idle"], 846, y + 20, 2)
    paste(images["pillar-l-idle"], 970, y + 20, 2)
    text(846, y + 294, "PILLARS: visible ellipse tops")
    y += 330
    for i, anim in enumerate(("walk", "attack")):
        for j, team in enumerate(TEAMS):
            name = f"creep-{team}-{anim}"
            x = 24 + j * 588
            text(x, y + i * 126, f"{name} / 4 frames / nearest 3x")
            paste(images[name], x, y + 20 + i * 126, 3)
    y += 270
    for i, name in enumerate(TILES):
        x = 24 + (i % 2) * 588
        yy = y + (i // 2) * 336
        text(x, yy, f"{name} / {images[name].width} x {images[name].height} / 2 x 2 tiles / nearest 2x")
        tiled = repeat_tile(images[name], (images[name].width * 2, images[name].height * 2))
        paste(tiled, x, yy + 20, 2)
    y += 678
    text(24, y, "BINARY BLACK SHADOW MASKS / nearest 4x / runtime sets opacity")
    paste(images["shadow-unit"], 24, y + 22, 4)
    paste(images["shadow-creep"], 160, y + 22, 4)
    save_png(board.crop((0, 0, 1200, y + 72)), TOOLS / "preview.png")


def notice():
    (OUT / "NOTICE.md").write_text("""# webdota 原創場景像素素材 v2

製作與規格日期：2026-11-06。所有遊戲圖形由本專案 Python 3 + Pillow 產生器以整數像素原創繪製，未使用外部圖片或生成式影像；預覽標籤使用 Pillow 內建字型。可隨 webdota 專案使用、修改與散布。

正交鏡頭沿世界 x 軸看，俯角 36.87°（sin=0.6、cos=0.8）。水平 19px／世界單位，地面與頂面縱深 11.4px／單位，垂直高度 15.2px／單位。圓形水平面呈深寬比 0.6 的橢圓，垂直柱身只沿畫面向上延伸；不是等角菱形投影。全部物件採畫面左上光源、亮頂面、五階曲面明暗、邊緣高光與物體內接地 AO；建築、石柱與材質不含落在地面上的投影，由遊戲即時計算。輪廓 `#1a1422`，無抗鋸齒、無抖色、PNG alpha 只有 0／255，地面與材質不透明。紅藍色基準分別為 `#d84a3b`／`#3b6fd8`。

| 檔名（連續圖均含同名 PNG + JSON） | 格子／原生尺寸 | 格數 | fps | loop | pivot |
|---|---|---:|---:|---|---|
| ground-blue.png、ground-red.png | 各 1140×684 | — | — | — | — |
| wall-side.png、crate-side.png | 各 95×76 | — | — | — | — |
| wall-top.png、crate-top.png | 各 95×57 | — | — | — | — |
| tower-red-idle、tower-blue-idle | 48×112（整張 192×112） | 4 | 6 | true | [24,108] |
| base-red-idle、base-blue-idle | 128×176（整張 512×176） | 4 | 6 | true | [64,172] |
| pillar-s-idle | 48×96 | 1 | 1 | true | [24,92] |
| pillar-l-idle | 64×136 | 1 | 1 | true | [32,132] |
| creep-red-walk、creep-blue-walk | 32×32（整張 128×32） | 4 | 8 | true | [16,30] |
| creep-red-attack、creep-blue-attack | 32×32（整張 128×32） | 4 | 10 | false | [16,30] |
| shadow-unit.png | 24×8 | — | — | — | — |
| shadow-creep.png | 16×6 | — | — | — | — |

連續圖為單列橫排，JSON 沿用 `public/characters/*.json` 的 `frames[].frame/duration` 與 `meta.image/size/pixelfx`；`pixelfx.id` 為 `env/<檔名>`。建築與石柱 pivot 是底面橢圓最前緣的最下方中央像素，不是橢圓中心；小兵為腳底前緣。建築、石柱 pivot 下方保留 3px 透明；小兵腳底最後一列為 row 29，pivot [16,30] 位於該列的幾何下邊界，底部保留 2px 透明。所有動畫固定足印；塔與主堡僅改核心內部亮點，步行循環，揮擊不循環。

足印寬×深：塔與小柱 38×23px，主堡 95×57px，大柱 57×34px。小／大柱自地面中心到頂面中心高度為 61／91px，塔身約 68px 加水晶，主堡包含尖頂約 114px。合成時將地圖的物體足印中心投影，再將畫面 row 加 `(足印深度px−1)/2`，得到 front-pivot 落點，避免將底面前緣誤認為地圖中心。

## 地面座標與配置

藍方：圖片上方為世界 +x、右方為 +z；紅方：上方為 −x、右方為 −z。紅方畫面旋轉 180°後重畫光照，素材本身不倒轉。兩張使用相同畫面配置與草地細節，只有主堡廣場隊伍色對調；畫面左下永遠是看的人自己的主堡。

```
藍方 col = (z + 30) × 19     row = (30 − x) × 11.4
紅方 col = (30 − z) × 19     row = (x + 30) × 11.4
物體高度另扣 row = y × 15.2
```

地圖連續邊界對應 col 0／1140、row 0／684，索引為 col 0～1139、row 0～683；中間座標四捨五入到整數像素。地圖唯讀來源 `src/data/maps/demo_arena.json`，主堡廣場約 9×9 單位（171×103px），塔外圈鋪石約直徑 3 單位（57×35px），中心保留泥土供物件自身底座覆蓋。每方主堡各自連到己方兩塔，再各自連向中央；泥土小徑寬 3 單位，以橢圓筆刷、曲線車轍、草鬚、石子與小花表現斜俯視。中央柱下與牆下的路徑由實際幾何遮擋。

四張材質以 94×75（垂直面）／94×56（頂面）的週期加一個重合邊界繪製，首末欄、首末列逐像素相等，可上下左右無縫平鋪。材質採受光中間亮度，每塊磚／木板的左上高光與右下暗邊固定；程式可將頂面設為 100%、正面設為 85%。兩隊都以正向使用。兩張 shadow 是形狀內純黑的二值橢圓遮罩，由程式設定透明度。

## 重製與驗證

需要 Python 3 與 Pillow，離線、固定種子 `20261106`。從專案根目錄執行：

```sh
python3 tools/env/generate.py
```

程式只寫入 `public/env/` 與 `tools/env/`，並刪除已淘汰的 `ground.png`、`pillar-side.png`、`pillar-top.png`、`shadow.png`。同一 Pillow 版本重跑產生相同位元組；Pillow／PNG 編碼器版本不同時壓縮結果可能不同。規格日期固定為 2026-11-06。

`tools/env/preview.png` 是深色背景總覽，包含兩方地面、nearest 2 倍局部、全部動畫幀、石柱、材質連鋪與腳下陰影。`tools/env/preview-scene.png` 按地圖取 x=[−26,−6]、z=[−29,1] 的藍方 30×20 單位地面視窗，只拼入足印與視窗相交的物件，上方保留 96px 建築高度餘裕，nearest 3 倍顯示牆、木箱、柱、塔、主堡與紅藍小兵；依足印前緣深度排序，沒有烘焙投影。`tools/env/validation.json` 記錄尺寸、格數、fps、loop、pivot、足印、透明留白、色數、二值 alpha、無縫四邊、兩方地面差異範圍、檔案大小與 SHA-256；不計報告自身雜湊。
""", encoding="utf-8")


def validate(images, specs, routes, platforms, accents, scene, data):
    report = {"date": DATE, "version": 2, "seed": SEED, "pillow": PILLOW_VERSION,
              "projection": {"angle_degrees": 36.87, "sin": .6, "cos": .8, "horizontal_px_per_world": PPU,
                             "ground_depth_px_per_world": DEPTH, "vertical_height_px_per_world": HEIGHT,
                             "light": "screen upper-left", "cast_shadows_baked": False,
                             "designed_heights_px": {"tower_body": 68.5, "base_peak_above_keep_ground": 114.5,
                                                     "pillar_s": 61, "pillar_l": 91}},
              "map_source": str(MAP.relative_to(ROOT)), "map_sha256": sha(MAP),
              "routes": [{k: v for k, v in r.items() if k != "pixels"} for r in routes],
              "platforms": platforms, "scene": scene, "files": {}}
    for name, image in images.items():
        path = OUT / f"{name}.png"
        decoded = Image.open(path).convert("RGBA")
        assert decoded.tobytes() == image.convert("RGBA").tobytes(), name
        colors = decoded.getcolors(decoded.width * decoded.height)
        alpha = sorted({p[3] for _, p in colors})
        entry = {"size": list(image.size), "bytes": path.stat().st_size, "sha256": sha(path),
                 "colors_including_transparent": len(colors), "alpha_values": alpha, "binary_alpha": set(alpha) <= {0, 255}}
        assert entry["binary_alpha"] and len(colors) <= 96, name
        if name.startswith("ground-"):
            assert image.size == GROUND_SIZE and alpha == [255] and path.stat().st_size <= 500000
            entry["max_bytes"] = 500000
        elif name in TILES:
            assert image.size == TILES[name] and alpha == [255]
            w, h = image.size
            horizontal = all(image.getpixel((0, y)) == image.getpixel((w - 1, y)) for y in range(h))
            vertical = all(image.getpixel((x, 0)) == image.getpixel((x, h - 1)) for x in range(w))
            assert horizontal and vertical, name
            entry["seamless"] = {"left_equals_right": horizontal, "top_equals_bottom": vertical,
                                 "tile_period": [w - 1, h - 1]}
        elif name.startswith("shadow-"):
            assert image.size == ((24, 8) if name == "shadow-unit" else (16, 6)) and alpha == [0, 255]
            assert all(p[:3] == (0, 0, 0) for _, p in colors if p[3])
            entry["opaque_rgb"] = "#000000"
        else:
            spec = specs[name]
            w, h = spec["size"]
            count = spec["count"]
            meta_path = path.with_suffix(".json")
            meta = json.loads(meta_path.read_text())
            fx = meta["meta"]["pixelfx"]
            assert image.size == (w * count, h) and len(meta["frames"]) == count
            assert meta["meta"]["size"] == {"w": w * count, "h": h}
            assert meta["meta"]["image"] == path.name
            assert [fx[k] for k in ("frameSize", "frames", "fps", "loop", "pivot", "columns")] == [spec["size"], count, spec["fps"], spec["loop"], spec["pivot"], count]
            hashes, bounds, alpha_hashes = [], [], []
            for i, frame in enumerate(meta["frames"]):
                assert frame["frame"] == {"x": w * i, "y": 0, "w": w, "h": h}
                assert frame["duration"] == round(1000 / spec["fps"])
                cell = image.crop((w * i, 0, w * (i + 1), h))
                box = cell.getbbox()
                assert box and box[0] > 0 and box[2] < w and box[1] > 0
                assert box[3] == spec["pivot"][1] + (0 if "creep" in name else 1), (name, box)
                assert cell.getpixel((spec["pivot"][0], box[3] - 1))[3] == 255, name
                bounds.append(list(box))
                hashes.append(hashlib.sha256(cell.tobytes()).hexdigest())
                alpha_hashes.append(hashlib.sha256(cell.getchannel("A").tobytes()).hexdigest())
            assert len(set(hashes)) == count, name
            if "creep" not in name:
                assert len(set(alpha_hashes)) == 1, name
                assert all(h - b[3] == 3 for b in bounds), name
            else:
                assert all(h - b[3] == 2 for b in bounds), name
            entry.update({"frames": count, "frame_size": [w, h], "fps": spec["fps"], "loop": spec["loop"],
                          "pivot": spec["pivot"], "columns": count, "frame_bounds": bounds,
                          "distinct_frames": len(set(hashes)), "transparent_rows_below_object": [h - b[3] for b in bounds],
                          "fixed_silhouette": len(set(alpha_hashes)) == 1})
            if "footprint" in spec:
                entry["footprint_px"] = spec["footprint"]
                assert abs(spec["footprint"][1] - spec["footprint"][0] * .6) <= 1, name
            report["files"][str(meta_path.relative_to(ROOT))] = {"bytes": meta_path.stat().st_size, "sha256": sha(meta_path)}
        report["files"][str(path.relative_to(ROOT))] = entry
    blue, red = images["ground-blue"], images["ground-red"]
    differences, outside = 0, 0
    for y in range(684):
        for x in range(1140):
            if blue.getpixel((x, y)) != red.getpixel((x, y)):
                differences += 1
                outside += not bool(accents.getpixel((x, y)))
    assert differences > 0 and outside == 0
    report["team_ground_difference"] = {"different_pixels": differences, "outside_base_color_inlays": outside,
                                        "same_layout_and_detail": outside == 0}
    entity_set = {(e["type"], e["position"][0], e["position"][2], e.get("team")) for e in data["entities"] if e["type"] in ("base", "tower")}
    assert all((kind, -x, -z, "red" if team == "blue" else "blue") in entity_set for kind, x, z, team in entity_set)
    report["map_entity_point_symmetry"] = True
    for path in (TOOLS / "generate.py", TOOLS / "preview.png", TOOLS / "preview-scene.png", OUT / "NOTICE.md"):
        entry = {"bytes": path.stat().st_size, "sha256": sha(path)}
        if path.suffix == ".png":
            entry["size"] = list(Image.open(path).size)
        report["files"][str(path.relative_to(ROOT))] = entry
    obsolete = ["ground.png", "pillar-side.png", "pillar-top.png", "shadow.png"]
    assert all(not (OUT / name).exists() for name in obsolete)
    report["obsolete_files_absent"] = obsolete
    report["creep_contact_boundary"] = "last opaque foot row is 29; pivot [16,30] is its geometric bottom boundary; 2 transparent rows"
    report["checks_passed"] = True
    (TOOLS / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checks_passed": True, "png_files": len(images), "sprite_sheets": len(specs),
                      "frames": sum(s["count"] for s in specs.values()),
                      "ground_bytes": {team: (OUT / f"ground-{team}.png").stat().st_size for team in TEAMS},
                      "report": "tools/env/validation.json"}, ensure_ascii=False))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MAP.read_text())
    assert data["size"] == {"w": 60, "h": 60}
    images, routes, platforms, accents = ground(data)
    specs = {}
    for name in TILES:
        images[name] = make_tile(name)
    for team in TEAMS:
        for kind, draw in (("tower", tower), ("base", base)):
            name = f"{kind}-{team}-idle"
            specs[name] = SPECS[kind]
            images[name] = sprite_sheet(name, SPECS[kind], [draw(team, i) for i in range(4)])
        for anim in ("walk", "attack"):
            name = f"creep-{team}-{anim}"
            specs[name] = SPECS[anim]
            images[name] = sprite_sheet(name, SPECS[anim], [creep(team, anim, i) for i in range(4)])
    for size in ("s", "l"):
        name = f"pillar-{size}-idle"
        specs[name] = SPECS[f"pillar-{size}"]
        images[name] = sprite_sheet(name, specs[name], [pillar(size)])
    for kind, size in (("unit", (24, 8)), ("creep", (16, 6))):
        im = Image.new("RGBA", size)
        ImageDraw.Draw(im).ellipse((0, 0, size[0] - 1, size[1] - 1), fill="#000000")
        images[f"shadow-{kind}"] = im
    for name, image in images.items():
        save_png(image, OUT / f"{name}.png")
    for name in ("ground.png", "pillar-side.png", "pillar-top.png", "shadow.png"):
        (OUT / name).unlink(missing_ok=True)
    notice()
    preview(images)
    scene = preview_scene(images, data)
    validate(images, specs, routes, platforms, accents, scene, data)


if __name__ == "__main__":
    main()
