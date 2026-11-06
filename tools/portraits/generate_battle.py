#!/usr/bin/env python3
"""重製原生 48px 戰場角色連續圖；像素設計日期：2026-11-06。"""

import hashlib
import json
import math
import sys

sys.dont_write_bytecode = True
from generate import OUT, PALETTES, PREVIEW, Pixels, save_preview, validate
from PIL import Image, ImageDraw, ImageFont


SIZE = 48
PIVOT = [24, 45]
ANIMATIONS = {
    "battle-idle": (4, 6, True),
    "run": (6, 12, True),
    "attack": (5, 15, False),
    "cast": (5, 12, False),
}


def pose(anim, frame):
    if anim == "battle-idle":
        return 0, [0, -1, 0, 1][frame], [0, 1, -1, 0][frame]
    if anim == "run":
        return 0, [0, -1, -1, 0, -1, -1][frame], [0, 1, 1, 0, -1, -1][frame]
    if anim == "attack":
        return [-1, -1, 2, 1, 0][frame], [0, -1, 0, 1, 0][frame], frame - 2
    return 0, [0, -1, -1, 0, 0][frame], [0, -1, -2, -1, 0][frame]


def legs(p, character, anim, frame, dx, bob):
    """2026-11-06：跑步雙腳交替支撐，至少一隻鞋底維持 y=45。"""
    steps = [(-5, 5, 0, -2), (-1, 2, 0, -4), (4, -3, 0, -2),
             (5, -5, -2, 0), (2, -1, -4, 0), (-3, 4, -2, 0)]
    rear, front, rear_up, front_up = steps[frame] if anim == "run" else (-2, 2, 0, 0)
    armor = {"warrior": ("steel_d", "steel", "steel_l"),
             "assassin": ("ink", "leather", "purple_l"),
             "mage": ("wood", "wood_l", "gold")}[character]
    for hip, step, lift in [(21, rear, rear_up), (26, front, front_up)]:
        foot = hip + step
        knee = hip + step // 2
        p.poly([(hip - 2 + dx, 33 + bob), (hip + 2 + dx, 33 + bob),
                (knee + 2, 38 + lift // 2), (foot + 2, 43 + lift),
                (foot - 2, 43 + lift), (knee - 2, 38 + lift // 2)], armor[0])
        p.line([(hip - 1 + dx, 35 + bob), (knee - 1, 38 + lift // 2),
                (foot - 1, 42 + lift)], armor[1], 2)
        p.poly([(foot - 2, 42 + lift), (foot + 1, 42 + lift),
                (foot + 4, 44 + lift), (foot + 4, 45 + lift),
                (foot - 3, 45 + lift), (foot - 3, 44 + lift)], armor[0])
        p.line([(foot - 1, 43 + lift), (foot + 1, 43 + lift),
                (foot + 2, 44 + lift)], armor[2])


def arm(p, shoulder, elbow, hand, cloth, light, skin):
    p.line([shoulder, elbow, hand], "o", 5)
    p.line([shoulder, elbow, hand], cloth, 3)
    p.line([(shoulder[0] - 1, shoulder[1] - 1),
            (elbow[0] - 1, elbow[1] - 1)], light)
    x, y = hand
    p.rect((x - 1, y - 1, x + 1, y + 1), skin, "o")
    p.dot(x, y - 1, light)


def blade(p, hand, tip, dagger=False):
    """2026-11-06：整數頂點的武器，沒有旋轉點陣圖或插值。"""
    hx, hy = hand
    tx, ty = tip
    length = math.hypot(tx - hx, ty - hy)
    ux, uy = (tx - hx) / length, (ty - hy) / length
    nx, ny = -uy, ux
    width, guard = (1, 2) if dagger else (2, 3)
    bx, by = hx + ux * 3, hy + uy * 3
    pt = lambda x, y: (round(x), round(y))
    p.line([pt(hx - ux * 2, hy - uy * 2), (hx, hy)], "o", 3)
    p.line([pt(hx - ux, hy - uy), (hx, hy)], "leather")
    p.poly([pt(bx + nx * width, by + ny * width), (tx, ty),
            pt(bx - nx * width, by - ny * width)], "steel")
    p.line([pt(bx - nx * (width - 1), by - ny * (width - 1)),
            pt(tx - ux * 2, ty - uy * 2)], "steel_l")
    p.line([pt(hx + ux + nx * guard, hy + uy + ny * guard),
            pt(hx + ux - nx * guard, hy + uy - ny * guard)], "o", 3)
    p.line([pt(hx + ux + nx * guard, hy + uy + ny * guard),
            pt(hx + ux - nx * guard, hy + uy - ny * guard)], "gold")


def warrior(anim, frame):
    p = Pixels("warrior", size=SIZE)
    dx, b, sway = pose(anim, frame)
    p.poly([(17 + dx, 23 + b), (28 + dx, 24 + b), (29, 38),
            (23 + sway, 37), (19 + sway, 40), (14 + sway, 37)], "red_d")
    p.line([(17 + dx, 27 + b), (16 + sway, 35)], "red_s")
    legs(p, "warrior", anim, frame, dx, b)
    p.y = b
    p.poly([(16 + dx, 22), (28 + dx, 22), (31 + dx, 27),
            (28 + dx, 34), (18 + dx, 34), (14 + dx, 27)], "red_s")
    p.poly([(17 + dx, 23), (22 + dx, 24), (22 + dx, 29),
            (16 + dx, 28)], "red", None)
    p.poly([(24 + dx, 24), (28 + dx, 23), (29 + dx, 27),
            (24 + dx, 29)], "red_m", None)
    p.line([(17 + dx, 24), (20 + dx, 24)], "red_l")
    p.line([(20 + dx, 27), (23 + dx, 29), (27 + dx, 26)], "gold")
    p.rect((18 + dx, 31, 28 + dx, 33), "ink", "o")
    p.rect((22 + dx, 31, 24 + dx, 33), "gold")
    p.dot(22 + dx, 31, "gold_l")
    p.poly([(17 + dx, 33), (22 + dx, 34), (21 + dx, 38),
            (16 + dx, 37)], "red_s")
    p.line([(18 + dx, 34), (20 + dx, 35)], "red")
    p.poly([(25 + dx, 34), (29 + dx, 33), (31 + dx, 37),
            (26 + dx, 39)], "red_d")
    p.line([(26 + dx, 35), (28 + dx, 35)], "red_m")
    p.poly([(14 + dx, 21), (19 + dx, 21), (21 + dx, 24),
            (19 + dx, 27), (12 + dx, 26), (12 + dx, 23)], "red_s")
    p.line([(14 + dx, 22), (18 + dx, 22), (19 + dx, 23)], "red_l")
    p.line([(13 + dx, 25), (18 + dx, 25)], "gold")
    p.poly([(27 + dx, 21), (31 + dx, 22), (33 + dx, 25),
            (31 + dx, 27), (27 + dx, 26)], "red_d")
    p.line([(28 + dx, 22), (30 + dx, 23)], "red")
    # 2026-11-06：偏右的盔鼻與單側眼縫標示 3/4 面向右。
    p.poly([(21 + dx, 13), (26 + dx, 13), (29 + dx, 16),
            (29 + dx, 21), (25 + dx, 24), (19 + dx, 22),
            (18 + dx, 17)], "steel_d")
    p.poly([(21 + dx, 14), (24 + dx, 14), (23 + dx, 18),
            (19 + dx, 19), (19 + dx, 17)], "steel", None)
    p.line([(20 + dx, 16), (22 + dx, 14)], "steel_l")
    p.poly([(25 + dx, 14), (27 + dx, 15), (28 + dx, 18),
            (25 + dx, 17)], "red_s", None)
    p.line([(24 + dx, 19), (28 + dx, 19)], "o", 2)
    p.line([(25 + dx, 19), (28 + dx, 19)], "gold_l")
    p.line([(25 + dx, 20), (26 + dx, 22), (28 + dx, 21)], "steel")
    p.poly([(21 + dx, 13), (21 + dx, 11), (23 + dx, 9),
            (26 + dx + sway, 11), (29 + dx + sway, 13),
            (25 + dx, 12), (23 + dx, 14)], "red_d")
    p.line([(22 + dx, 12), (23 + dx, 11), (26 + dx, 12)], "red")
    p.y = 0
    if anim == "attack":
        hands = [(30, 29), (29, 24), (34, 26), (34, 31), (32, 31)]
        tips = [(31, 13), (21, 10), (44, 20), (42, 38), (39, 17)]
    elif anim == "cast":
        hands = [(32, 30), (32, 23), (31, 21), (32, 23), (32, 30)]
        tips = [(39, 16), (35, 8), (31, 6), (35, 8), (39, 16)]
    else:
        swing = [0, -1, 0, 1, 1, 0][frame] if anim == "run" else sway
        hands, tips = [(32, 30 + b)], [(39 + swing, 15 + b)]
    hand, tip = hands[frame] if len(hands) > 1 else hands[0], tips[frame] if len(tips) > 1 else tips[0]
    arm(p, (30 + dx, 25 + b), (30 + dx, hand[1]), hand, "steel_d", "steel", "steel_d")
    blade(p, hand, tip)
    # 2026-11-06：盾牌在靠鏡頭的手臂，保留紅甲與金色盾緣。
    sy = b - (1 if anim == "cast" and frame in (1, 2, 3) else 0)
    p.y = sy
    p.poly([(12 + dx, 27), (19 + dx, 26), (22 + dx, 29),
            (21 + dx, 36), (17 + dx, 41), (12 + dx, 37),
            (10 + dx, 31)], "gold_d")
    p.poly([(13 + dx, 28), (18 + dx, 28), (20 + dx, 30),
            (19 + dx, 35), (17 + dx, 38), (13 + dx, 35),
            (12 + dx, 31)], "red_s")
    p.line([(12 + dx, 30), (13 + dx, 28), (17 + dx, 27)], "gold_l")
    p.poly([(13 + dx, 29), (15 + dx, 29), (15 + dx, 35),
            (14 + dx, 34)], "red", None)
    p.poly([(17 + dx, 30), (19 + dx, 32), (17 + dx, 35),
            (16 + dx, 33)], "gold")
    p.dot(17 + dx, 31, "gold_l")
    return p.image


def assassin(anim, frame):
    p = Pixels("assassin", size=SIZE)
    dx, b, sway = pose(anim, frame)
    p.poly([(19 + dx, 22 + b), (25 + dx, 24 + b), (19 + sway, 34),
            (14 + sway, 38), (14 + sway, 34), (9 + sway, 36),
            (14 + sway, 27)], "purple_d")
    p.poly([(18 + dx, 24 + b), (20 + dx, 25 + b), (16 + sway, 32),
            (12 + sway, 34)], "purple_s", None)
    legs(p, "assassin", anim, frame, dx, b)
    p.y = b
    p.poly([(19 + dx, 23), (26 + dx, 23), (30 + dx, 27),
            (27 + dx, 33), (28 + dx, 36), (19 + dx, 35),
            (18 + dx, 29)], "purple_s")
    p.poly([(20 + dx, 24), (23 + dx, 25), (21 + dx, 31),
            (19 + dx, 29)], "purple", None)
    p.line([(20 + dx, 25), (21 + dx, 25)], "purple_l")
    p.line([(27 + dx, 25), (21 + dx, 32)], "leather", 2)
    p.dot(25 + dx, 28, "gold")
    p.rect((19 + dx, 32, 27 + dx, 34), "leather", "o")
    p.rect((23 + dx, 32, 24 + dx, 33), "gold")
    p.poly([(19 + dx, 35), (23 + dx, 35), (20 + dx, 39),
            (17 + dx, 38)], "purple_d")
    p.poly([(25 + dx, 35), (28 + dx, 34), (30 + sway, 39),
            (27 + sway, 38)], "purple_s")
    p.line([(26 + dx, 36), (28 + sway, 38)], "purple")
    p.poly([(19 + dx, 23), (22 + dx, 22), (28 + dx, 23),
            (28 + dx, 26), (22 + dx, 27), (17 + dx, 25)], "purple_d")
    p.line([(19 + dx, 24), (23 + dx, 25), (26 + dx, 24)], "purple_l")
    # 2026-11-06：向右突出的帽沿、鼻樑與面罩，不以左右對稱臉代替。
    p.poly([(22 + dx, 9), (27 + dx, 12), (30 + dx, 17),
            (29 + dx, 23), (24 + dx, 25), (18 + dx, 22),
            (17 + dx, 17), (19 + dx, 12)], "purple_s")
    p.poly([(22 + dx, 11), (24 + dx, 12), (21 + dx, 16),
            (19 + dx, 21), (18 + dx, 18), (20 + dx, 13)], "purple", None)
    p.line([(20 + dx, 14), (22 + dx, 12)], "purple_l")
    p.poly([(24 + dx, 14), (27 + dx, 15), (29 + dx, 18),
            (28 + dx, 22), (23 + dx, 23), (21 + dx, 20)], "ink")
    p.poly([(24 + dx, 16), (27 + dx, 17), (29 + dx, 19),
            (24 + dx, 20), (22 + dx, 18)], "skin", None)
    p.line([(24 + dx, 18), (27 + dx, 18)], "o")
    p.line([(25 + dx, 18), (27 + dx, 18)], "steel_l")
    p.poly([(23 + dx, 20), (29 + dx, 19), (28 + dx, 22),
            (24 + dx, 23), (22 + dx, 21)], "cloth")
    p.line([(24 + dx, 21), (27 + dx, 21)], "purple")
    p.y = 0
    if anim == "attack":
        rear = [((17, 29), (10, 23)), ((18, 26), (12, 18)),
                ((33, 27), (44, 26)), ((28, 31), (37, 34)), ((17, 31), (10, 37))]
        front = [((30, 29), (36, 22)), ((28, 28), (34, 20)),
                 ((35, 31), (45, 29)), ((35, 27), (44, 25)), ((32, 31), (39, 36))]
    elif anim == "cast":
        rear = [((16, 30), (9, 36)), ((16, 24), (11, 16)),
                ((18, 20), (15, 10)), ((17, 25), (10, 20)), ((16, 30), (9, 36))]
        front = [((32, 31), (39, 36)), ((33, 24), (39, 16)),
                 ((33, 20), (38, 10)), ((33, 25), (41, 20)), ((32, 31), (39, 36))]
    else:
        swing = [0, 2, 2, 0, -2, -2][frame] if anim == "run" else sway
        rear = [((16 - swing, 30 + b), (9 - swing, 36 + b))]
        front = [((32 + swing, 31 + b), (39 + swing, 36 + b))]
    for index, (points, shoulder) in enumerate([(rear, (19 + dx, 26 + b)),
                                                (front, (28 + dx, 26 + b))]):
        hand, tip = points[frame] if len(points) > 1 else points[0]
        elbow = ((shoulder[0] + hand[0]) // 2, max(shoulder[1], hand[1]) + 1)
        arm(p, shoulder, elbow, hand, "purple_d", "purple", "leather")
        blade(p, hand, tip, dagger=True)
        p.dot(hand[0], hand[1], "skin" if index else "skin_d")
    return p.image


def staff(p, hand, tip, bright):
    hx, hy = hand
    tx, ty = tip
    length = math.hypot(tx - hx, ty - hy)
    ux, uy = (tx - hx) / length, (ty - hy) / length
    nx, ny = -uy, ux
    point = lambda x, y: (round(tx + nx * x - ux * y), round(ty + ny * x - uy * y))
    end = (round(hx - ux * 13), round(hy - uy * 13))
    base = point(0, 4)
    p.line([end, base], "o", 4)
    p.line([end, base], "wood", 2)
    p.line([(end[0] - 1, end[1]), (base[0] - 1, base[1])], "wood_l")
    p.poly([point(-3, 0), point(0, -5), point(3, 0), point(0, 4)], "cyan_d")
    p.poly([point(-2, 0), point(0, -3), point(0, 2)], "cyan", None)
    p.line([point(-1, 0), point(-1, -1)], bright)
    p.poly([point(-4, 2), point(-2, 5), point(2, 5), point(4, 2),
            point(3, 6), point(0, 7), point(-3, 5)], "gold_d")
    p.line([point(-3, 3), point(-2, 5), point(1, 5)], "gold")


def mage(anim, frame):
    p = Pixels("mage", size=SIZE)
    dx, b, sway = pose(anim, frame)
    legs(p, "mage", anim, frame, dx, b)
    hem = -2 if anim == "run" else 0
    p.poly([(18 + dx, 25 + b), (27 + dx, 25 + b), (29 + dx, 34),
            (32 + sway, 42 + hem), (27, 43 + hem), (23, 42 + hem), (19, 44 + hem),
            (12 + sway, 43 + hem), (16 + dx, 32)], "blue_d")
    p.poly([(18 + dx, 28 + b), (22 + dx, 29 + b), (20, 38),
            (17, 42 + hem), (14 + sway, 42 + hem)], "blue_s", None)
    p.line([(18 + dx, 31), (17, 37), (15 + sway, 40 + hem)], "blue")
    p.poly([(25 + dx, 29 + b), (27 + dx, 32), (29 + sway, 41 + hem),
            (25, 41 + hem), (24, 35)], "blue_s", None)
    p.line([(14 + sway, 42 + hem), (19, 43 + hem), (23, 41 + hem), (27, 42 + hem),
            (30 + sway, 41 + hem)], "gold")
    p.y = b
    p.poly([(18 + dx, 23), (26 + dx, 23), (29 + dx, 28),
            (26 + dx, 33), (17 + dx, 33), (15 + dx, 28)], "blue_s")
    p.poly([(18 + dx, 24), (22 + dx, 26), (19 + dx, 30),
            (16 + dx, 28)], "blue", None)
    p.poly([(22 + dx, 26), (25 + dx, 25), (25 + dx, 32),
            (23 + dx, 35), (25 + dx, 40), (22 + dx, 41),
            (21 + dx, 36)], "blue_l")
    p.line([(23 + dx, 28), (23 + dx, 31)], "pale")
    p.rect((17 + dx, 31, 27 + dx, 33), "wood", "o")
    p.rect((22 + dx, 31, 24 + dx, 33), "gold")
    p.dot(23 + dx, 32, "cyan")
    p.poly([(19 + dx, 16), (27 + dx, 16), (29 + dx, 20),
            (27 + dx, 24), (23 + dx, 26), (18 + dx, 23)], "skin_d")
    p.poly([(21 + dx, 17), (25 + dx, 17), (27 + dx, 20),
            (25 + dx, 22), (21 + dx, 21)], "skin", None)
    p.line([(25 + dx, 19), (28 + dx, 19)], "o")
    p.dot(26 + dx, 20, "pale")
    p.poly([(19 + dx, 18), (21 + dx, 19), (20 + dx, 23),
            (18 + dx, 24), (17 + dx, 21)], "blue_l")
    p.line([(18 + dx, 20), (18 + dx, 22)], "pale")
    p.poly([(21 + dx, 22), (24 + dx, 23), (28 + dx, 21),
            (27 + dx, 26), (24 + dx, 28), (22 + dx, 25)], "blue_l")
    p.line([(22 + dx, 23), (24 + dx, 25), (26 + dx, 23)], "pale")
    # 2026-11-06：帽子是獨立原生像素設計，尖頂與寬帽沿保留明確剪影。
    p.poly([(17 + dx, 15), (20 + dx, 10), (25 + dx + sway, 7),
            (24 + dx + sway, 10), (28 + dx, 14), (29 + dx, 17),
            (21 + dx, 18)], "blue_s")
    p.poly([(18 + dx, 15), (21 + dx, 11), (24 + dx + sway, 9),
            (22 + dx, 13), (22 + dx, 16)], "blue", None)
    p.line([(20 + dx, 13), (22 + dx, 11)], "blue_l")
    p.poly([(14 + dx, 17), (19 + dx, 15), (28 + dx, 16),
            (32 + dx, 19), (30 + dx, 21), (21 + dx, 20),
            (13 + dx, 19)], "blue_d")
    p.line([(15 + dx, 17), (20 + dx, 16), (27 + dx, 17)], "gold")
    p.rect((24 + dx, 16, 26 + dx, 18), "gold_d")
    p.dot(25 + dx, 17, "cyan")
    p.y = 0
    bright = ["pale", "pale", "cyan", "blue_l", "pale", "cyan"][frame]
    if anim == "attack":
        hands = [(33, 29), (30, 23), (32, 25), (33, 30), (34, 31)]
        tips = [(31, 15), (24, 11), (41, 19), (41, 30), (37, 17)]
    elif anim == "cast":
        hands = [(34, 31), (34, 26), (34, 25), (34, 26), (34, 31)]
        tips = [(37, 17), (37, 12), (37, 11), (37, 12), (37, 17)]
    else:
        hands = [(34, 31 + b)]
        tips = [(37 + (sway if anim == "run" else 0), 17 + b)]
    hand = hands[frame] if len(hands) > 1 else hands[0]
    tip = tips[frame] if len(tips) > 1 else tips[0]
    staff(p, hand, tip, bright)
    arm(p, (28 + dx, 27 + b), (30 + dx, hand[1] + 1), hand,
        "blue_d", "blue", "skin")
    raised = [0, -3, -5, -3, 0][frame] if anim == "cast" else sway
    arm(p, (17 + dx, 27 + b), (14 + dx, 30 + b), (12 + dx, 31 + b + raised),
        "blue_d", "blue", "skin")
    return p.image


DRAW = {"warrior": warrior, "assassin": assassin, "mage": mage}


def metadata(character, anim):
    count, fps, loop = ANIMATIONS[anim]
    name = f"{character}-{anim}"
    return {
        "frames": [{"filename": f"{name} {i}",
                    "frame": {"x": i * SIZE, "y": 0, "w": SIZE, "h": SIZE},
                    "rotated": False, "trimmed": False,
                    "spriteSourceSize": {"x": 0, "y": 0, "w": SIZE, "h": SIZE},
                    "sourceSize": {"w": SIZE, "h": SIZE},
                    "duration": round(1000 / fps)} for i in range(count)],
        "meta": {"app": "webdota/tools/portraits/generate_battle.py", "version": "1",
                 "image": f"{name}.png", "format": "RGBA8888",
                 "size": {"w": SIZE * count, "h": SIZE}, "scale": "1",
                 "frameTags": [{"name": anim, "from": 0, "to": count - 1,
                                "direction": "forward"}],
                 "pixelfx": {"id": f"characters/{name}",
                             "name": f"{character} {anim}", "fps": fps,
                             "loop": loop, "frames": count, "frameSize": [SIZE, SIZE],
                             "pivot": PIVOT, "columns": count}},
    }


def preview(animations):
    scale, cell, gutter = 4, 192, 12
    board = Image.new("RGB", (6 * (cell + gutter) + gutter, 12 * 236 + 64), "#10131d")
    d = ImageDraw.Draw(board)
    d.fontmode = "1"
    font, small = ImageFont.load_default(size=18), ImageFont.load_default(size=13)
    d.text((gutter, 16), "WEBDOTA / NATIVE 48px BATTLE SPRITES / 4x NEAREST / 2026-11-06",
           font=font, fill="#dce7ef")
    for row, ((character, anim), frames) in enumerate(animations.items()):
        y = 64 + row * 236
        count, fps, loop = ANIMATIONS[anim]
        d.text((gutter, y), f"{character.upper()} / {anim.upper()} / {count} FRAMES / {fps} FPS / LOOP {loop}",
               font=small, fill="#aebdd3")
        for i, frame in enumerate(frames):
            x = gutter + i * (cell + gutter)
            d.rectangle((x, y + 24, x + cell - 1, y + 24 + cell - 1), fill="#1b2232")
            large = frame.resize((SIZE * scale, SIZE * scale), Image.Resampling.NEAREST)
            board.paste(large, (x, y + 24), large)
            d.text((x + 6, y + 28), f"{i + 1:02d}", font=small, fill="#75849e")
    save_preview(board, "preview-battle.png")


def validate_battle():
    report = {"date": "2026-11-06", "frameSize": [SIZE, SIZE], "pivot": PIVOT,
              "foot_y": 45, "transparent_bottom_rows": 2,
              "checks": ["sheet_dimensions", "metadata", "palette_union_at_most_16",
                         "binary_alpha", "distinct_frames", "fixed_grounded_foot",
                         "unclipped_bounds", "png_at_most_50000_bytes"], "characters": {}}
    for character in DRAW:
        palette, anims = set(), {}
        for anim, (count, fps, loop) in ANIMATIONS.items():
            png = OUT / f"{character}-{anim}.png"
            sheet = Image.open(png).convert("RGBA")
            data = json.loads(png.with_suffix(".json").read_text())
            assert sheet.size == (SIZE * count, SIZE), (png, sheet.size)
            assert data == metadata(character, anim), png
            assert set(sheet.getchannel("A").tobytes()) == {0, 255}, png
            palette.update(pixel[:3] for _, pixel in sheet.getcolors(sheet.width * sheet.height) if pixel[3])
            assert png.stat().st_size <= 50_000, png
            bounds, hashes = [], []
            for i in range(count):
                image = sheet.crop((i * SIZE, 0, (i + 1) * SIZE, SIZE))
                box = image.getbbox()
                assert box[3] == 46 and 36 <= box[3] - box[1] <= 40, (png, i, box)
                assert box[0] > 0 and box[1] > 0 and box[2] < SIZE, (png, i, box)
                assert image.getchannel("A").crop((0, 46, SIZE, SIZE)).getbbox() is None
                assert image.getchannel("A").crop((14, 45, 35, 46)).getbbox() is not None
                assert image.tobytes() == DRAW[character](anim, i).tobytes(), (png, i)
                bounds.append(list(box))
                hashes.append(hashlib.sha256(image.tobytes()).hexdigest())
            # 2026-11-06：施法收勢允許回到第一格，其他影格必須各自有動作差異。
            required = count - 1 if anim == "cast" else count
            assert len(set(hashes)) >= required, (png, len(set(hashes)))
            anims[anim] = {"frames": count, "fps": fps, "loop": loop,
                           "columns": count, "duration_ms": round(1000 / fps),
                           "sheetSize": list(sheet.size), "bytes": png.stat().st_size,
                           "distinct_frames": len(set(hashes)), "bounds": bounds}
        assert len(palette) <= 16, (character, len(palette))
        assert palette <= {tuple(bytes.fromhex(c[1:])) for c in PALETTES[character].values()}
        report["characters"][character] = {"colors": len(palette),
                                             "palette": ["#%02x%02x%02x" % c for c in sorted(palette)],
                                             "animations": anims}
    return report


def main():
    protected = sorted([*OUT.glob("*-idle.*"), *OUT.glob("*-avatar.png")])
    protected = [p for p in protected if "battle-idle" not in p.name]
    before = {p: p.read_bytes() for p in protected}
    animations = {(name, anim): [draw(anim, i) for i in range(spec[0])]
                  for name, draw in DRAW.items() for anim, spec in ANIMATIONS.items()}
    for (name, anim), frames in animations.items():
        sheet = Image.new("RGBA", (SIZE * len(frames), SIZE))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (SIZE * i, 0))
        sheet.save(OUT / f"{name}-{anim}.png", optimize=True)
        (OUT / f"{name}-{anim}.json").write_text(json.dumps(metadata(name, anim), indent=1) + "\n")
    preview(animations)
    assert all(p.read_bytes() == old for p, old in before.items()), "legacy artwork changed"
    old_frames, avatars = {}, {}
    for name in DRAW:
        sheet = Image.open(OUT / f"{name}-idle.png").convert("RGBA")
        old_frames[name] = [sheet.crop((i * 96, 0, (i + 1) * 96, 96)) for i in range(8)]
        avatars[name] = Image.open(OUT / f"{name}-avatar.png").convert("RGBA")
    validate(old_frames, avatars)


if __name__ == "__main__":
    main()
