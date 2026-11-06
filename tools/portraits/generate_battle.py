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


# 2026-11-06：與 env v2 相同的正交鏡頭；原生像素繪製，不縮放舊立繪。
CAMERA = {"elevation_degrees": 36.87, "sin": 0.6, "cos": 0.8,
          "horizontal_px_per_unit": 19, "height_px_per_unit": 15.2,
          "ground_depth_px_per_unit": 11.4}


def project(horizontal, depth, height=0):
    return (round(horizontal * 19), round(depth * 11.4 - height * 15.2))


def top(p, box, color, light, side=None):
    """2026-11-06：水平圓面以 0.6 深寬比投影，亮面集中在左上。"""
    x, y, width = box
    depth = round(width * CAMERA["sin"])
    p.draw.ellipse((x, y + p.y, x + width, y + depth + p.y),
                   fill=p.palette[color], outline=p.palette["o"])
    p.draw.ellipse((x + 1, y + 1 + p.y, x + width - 2, y + depth - 2 + p.y),
                   fill=p.palette[light])
    if side:
        p.poly([(x + width - 3, y + 2), (x + width - 1, y + depth // 2),
                (x + width - 2, y + depth - 1), (x + width // 2, y + depth - 1)], side, None)


def pose(anim, frame):
    if anim == "battle-idle":
        return 0, [0, -1, 0, 1][frame], [0, 1, -1, 0][frame]
    if anim == "run":
        return 0, [0, -1, -1, 0, -1, -1][frame], [0, 1, 1, 0, -1, -1][frame]
    if anim == "attack":
        return [-1, -2, 2, 1, 0][frame], [0, -1, 0, 1, 0][frame], frame - 2
    return 0, [0, -1, -1, 0, 0][frame], [0, -1, -2, -1, 0][frame]


def legs(p, character, anim, frame, dx, bob):
    """2026-11-06：近腳／遠腳有縱深差；跑步交替抬腳，接地列固定 y=45。"""
    steps = [(-5, 5, 0, -2), (-1, 2, 0, -4), (4, -3, 0, -2),
             (5, -5, -2, 0), (2, -1, -4, 0), (-3, 4, -2, 0)]
    rear, front, rear_up, front_up = steps[frame] if anim == "run" else (-2, 2, 0, 0)
    dark, middle, light = {"warrior": ("steel_d", "steel", "steel_l"),
                           "assassin": ("ink", "leather", "purple_l"),
                           "mage": ("wood", "wood_l", "gold")}[character]
    # 2026-11-06：兩腳輪流支撐在 y=45，遠腳在非支撐時回到較後方的地面列。
    contacts = (45 + rear_up, 45 + front_up) if anim == "run" else (43, 45)
    for hip, step, sole in [(21, rear, contacts[0]), (26, front, contacts[1])]:
        foot, knee = hip + step, hip + step // 2
        p.poly([(hip - 2 + dx, 34 + bob), (hip + 2 + dx, 34 + bob),
                (knee + 2, 38 + (sole - 45) // 2), (foot + 2, sole - 2),
                (foot - 2, sole - 2), (knee - 2, 38 + (sole - 45) // 2)], dark)
        p.line([(hip - 1 + dx, 35 + bob), (knee - 1, 38 + (sole - 45) // 2),
                (foot - 1, sole - 3)], middle, 2)
        p.poly([(foot - 2, sole - 3), (foot + 1, sole - 3),
                (foot + 4, sole - 1), (foot + 3, sole), (foot - 3, sole),
                (foot - 3, sole - 1)], dark)
        p.line([(foot - 1, sole - 2), (foot + 1, sole - 2), (foot + 2, sole - 1)], light)


def arm(p, shoulder, elbow, hand, cloth, light, skin):
    p.line([shoulder, elbow, hand], "o", 5)
    p.line([shoulder, elbow, hand], cloth, 3)
    p.line([(shoulder[0] - 1, shoulder[1] - 1),
            (elbow[0] - 1, elbow[1] - 1)], light)
    x, y = hand
    p.rect((x - 1, y - 1, x + 1, y + 1), skin, "o")
    p.dot(x, y - 1, light)


def blade(p, hand, tip, dagger=False):
    """2026-11-06：刀身亮上緣、暗側面；所有頂點直接量化到整數像素。"""
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


def spark(p, center, radius, color, light):
    x, y = center
    p.poly([(x, y - radius), (x + 1, y - 1), (x + radius, y),
            (x + 1, y + 1), (x, y + radius), (x - 1, y + 1),
            (x - radius, y), (x - 1, y - 1)], color, None)
    p.dot(x, y, light)


def spell(p, anim, frame, center, color, light):
    if anim != "cast" or frame not in (1, 2, 3):
        return
    x, y = center
    radius = [0, 2, 4, 3, 0][frame]
    spark(p, (x, y), radius, color, light)
    if frame == 2:
        p.dot(x - 5, y - 3, light)
        p.dot(x + 4, y - 4, color)
        p.dot(x + 5, y + 3, light)
    elif frame == 3:
        p.dot(x + 5, y - 2, light)


def warrior(anim, frame):
    p = Pixels("warrior", size=SIZE)
    dx, b, sway = pose(anim, frame)
    p.poly([(16 + dx, 26 + b), (26 + dx, 27 + b), (28 + sway, 38),
            (22 + sway, 37), (18 + sway, 39), (12 + sway, 36)], "red_d")
    p.line([(16 + dx, 29 + b), (15 + sway, 35)], "red_s")
    legs(p, "warrior", anim, frame, dx, b)
    p.y = b
    # 2026-11-06：胸甲上面可見，短軀幹與脛甲遵循 0.8 高度投影。
    p.poly([(17 + dx, 25), (27 + dx, 24), (31 + dx, 28),
            (28 + dx, 35), (20 + dx, 37), (15 + dx, 33), (14 + dx, 28)], "red_d")
    p.poly([(16 + dx, 27), (23 + dx, 29), (23 + dx, 34),
            (18 + dx, 33)], "red_s", None)
    p.poly([(24 + dx, 29), (29 + dx, 27), (28 + dx, 33),
            (24 + dx, 35)], "red_m", None)
    p.poly([(17 + dx, 25), (23 + dx, 23), (29 + dx, 26),
            (24 + dx, 29), (17 + dx, 28)], "red", None)
    p.line([(17 + dx, 25), (22 + dx, 24)], "red_l")
    p.line([(20 + dx, 29), (24 + dx, 31), (27 + dx, 29)], "gold")
    p.line([(18 + dx, 34), (23 + dx, 36), (28 + dx, 34)], "ink", 2)
    p.rect((23 + dx, 34, 25 + dx, 36), "gold", "o")
    p.dot(24 + dx, 34, "gold_l")
    p.poly([(17 + dx, 34), (22 + dx, 36), (21 + dx, 39), (16 + dx, 37)], "red_s")
    p.line([(17 + dx, 35), (20 + dx, 36)], "red")
    p.poly([(26 + dx, 35), (29 + dx, 33), (31 + dx, 36), (27 + dx, 39)], "red_d")
    p.line([(27 + dx, 35), (29 + dx, 35)], "red_m")
    p.poly([(12 + dx, 25), (20 + dx, 25), (21 + dx, 29), (17 + dx, 31),
            (11 + dx, 28)], "red_s")
    top(p, (11 + dx, 22, 10), "red_m", "red", "red_s")
    p.line([(13 + dx, 23), (17 + dx, 23)], "red_l")
    p.line([(12 + dx, 28), (17 + dx, 30)], "gold")
    p.poly([(27 + dx, 24), (32 + dx, 24), (34 + dx, 28), (30 + dx, 30),
            (27 + dx, 28)], "red_d")
    top(p, (26 + dx, 21, 8), "red_s", "red_m", "red_d")
    p.line([(28 + dx, 22), (30 + dx, 22)], "red_l")
    # 2026-11-06：盔頂 13×8，面罩只在右下前側，避免平視側臉。
    p.poly([(19 + dx, 18), (28 + dx, 17), (30 + dx, 21), (29 + dx, 24),
            (25 + dx, 27), (19 + dx, 24), (17 + dx, 21)], "steel_d")
    top(p, (17 + dx, 14, 13), "steel", "steel_l", "steel_d")
    p.poly([(25 + dx, 18), (29 + dx, 19), (30 + dx, 21), (26 + dx, 23),
            (22 + dx, 21)], "steel_d", None)
    p.line([(25 + dx, 22), (29 + dx, 21)], "o", 2)
    p.line([(26 + dx, 22), (28 + dx, 22)], "gold_l")
    p.line([(24 + dx, 22), (25 + dx, 25), (28 + dx, 24)], "steel")
    p.poly([(21 + dx, 17), (21 + dx, 14), (23 + dx, 11),
            (26 + dx + sway, 12), (29 + dx + sway, 15),
            (25 + dx, 14), (24 + dx, 18)], "red_d")
    p.line([(22 + dx, 15), (23 + dx, 12), (26 + dx, 13)], "red")
    p.dot(23 + dx, 12, "red_l")
    p.y = 0
    if anim == "attack":
        hands = [(30, 30), (27, 24), (34, 29), (34, 33), (32, 31)]
        tips = [(32, 15), (17, 14), (44, 24), (42, 40), (39, 18)]
    elif anim == "cast":
        hands = [(32, 31), (33, 25), (33, 24), (33, 26), (32, 31)]
        tips = [(39, 18), (36, 13), (34, 14), (37, 14), (39, 18)]
    else:
        swing = [0, -1, 0, 1, 1, 0][frame] if anim == "run" else sway
        hands, tips = [(32, 31 + b)], [(39 + swing, 18 + b)]
    hand = hands[frame] if len(hands) > 1 else hands[0]
    tip = tips[frame] if len(tips) > 1 else tips[0]
    arm(p, (30 + dx, 27 + b), (30 + dx, hand[1] + 1), hand,
        "steel_d", "steel", "steel_d")
    blade(p, hand, tip)
    spell(p, anim, frame, tip, "gold", "gold_l")
    p.y = b - (1 if anim == "cast" and frame in (1, 2, 3) else 0)
    # 2026-11-06：盾牌頂面有厚度，頂緣亮、右下側緣暗。
    p.poly([(11 + dx, 31), (17 + dx, 30), (22 + dx, 32), (21 + dx, 38),
            (17 + dx, 42), (12 + dx, 39), (10 + dx, 34)], "gold_d")
    p.poly([(12 + dx, 33), (17 + dx, 32), (20 + dx, 33), (19 + dx, 37),
            (17 + dx, 40), (13 + dx, 37)], "red_s")
    p.poly([(12 + dx, 32), (16 + dx, 30), (22 + dx, 32), (19 + dx, 34),
            (14 + dx, 34)], "gold")
    p.line([(12 + dx, 32), (16 + dx, 31), (19 + dx, 32)], "gold_l")
    p.line([(13 + dx, 34), (14 + dx, 37)], "red")
    p.poly([(17 + dx, 34), (19 + dx, 35), (17 + dx, 38), (16 + dx, 36)], "gold")
    p.dot(17 + dx, 35, "gold_l")
    return p.image


def assassin(anim, frame):
    p = Pixels("assassin", size=SIZE)
    dx, b, sway = pose(anim, frame)
    p.poly([(18 + dx, 26 + b), (25 + dx, 27 + b), (21 + sway, 34),
            (16 + sway, 39), (15 + sway, 35), (9 + sway, 37),
            (13 + sway, 29)], "purple_d")
    p.poly([(17 + dx, 27 + b), (20 + dx, 28 + b), (16 + sway, 33),
            (12 + sway, 35)], "purple_s", None)
    legs(p, "assassin", anim, frame, dx, b)
    p.y = b
    p.poly([(18 + dx, 26), (25 + dx, 25), (29 + dx, 29), (27 + dx, 34),
            (28 + dx, 37), (21 + dx, 38), (17 + dx, 34), (16 + dx, 29)], "purple_d")
    p.poly([(18 + dx, 29), (23 + dx, 30), (22 + dx, 35),
            (18 + dx, 33)], "purple_s", None)
    p.poly([(24 + dx, 30), (28 + dx, 28), (26 + dx, 34),
            (23 + dx, 36)], "purple", None)
    top(p, (15 + dx, 24, 14), "purple_s", "purple", "purple_d")
    p.line([(17 + dx, 25), (20 + dx, 25)], "purple_l")
    p.line([(26 + dx, 28), (20 + dx, 34)], "leather", 2)
    p.dot(23 + dx, 31, "gold")
    p.line([(19 + dx, 35), (23 + dx, 37), (27 + dx, 35)], "leather", 2)
    p.rect((23 + dx, 35, 25 + dx, 36), "gold")
    p.poly([(18 + dx, 35), (22 + dx, 37), (20 + dx, 40), (16 + dx, 38)], "purple_d")
    p.poly([(25 + dx, 36), (28 + dx, 35), (30 + sway, 39), (26 + sway, 39)], "purple_s")
    p.line([(26 + dx, 36), (28 + sway, 38)], "purple")
    # 2026-11-06：兜帽上方佔較大亮面，臉與面罩縮在右下側。
    p.poly([(18 + dx, 18), (22 + dx, 14), (28 + dx, 17), (31 + dx, 22),
            (29 + dx, 26), (24 + dx, 28), (18 + dx, 25), (16 + dx, 21)], "purple_d")
    top(p, (17 + dx, 14, 13), "purple_s", "purple", "purple_d")
    p.poly([(20 + dx, 16), (22 + dx, 13), (25 + dx, 15), (28 + dx, 19),
            (24 + dx, 21), (18 + dx, 21)], "purple_s", None)
    p.line([(19 + dx, 18), (22 + dx, 15), (24 + dx, 16)], "purple_l")
    p.poly([(24 + dx, 20), (28 + dx, 20), (30 + dx, 23), (28 + dx, 26),
            (24 + dx, 27), (21 + dx, 24)], "ink")
    p.poly([(24 + dx, 21), (27 + dx, 21), (29 + dx, 23), (25 + dx, 24),
            (23 + dx, 23)], "skin", None)
    p.line([(25 + dx, 23), (28 + dx, 23)], "o")
    p.dot(27 + dx, 23, "steel_l")
    p.poly([(23 + dx, 24), (29 + dx, 23), (28 + dx, 26), (25 + dx, 27),
            (22 + dx, 25)], "cloth")
    p.line([(24 + dx, 25), (27 + dx, 25)], "purple")
    p.y = 0
    if anim == "attack":
        rear = [((17, 31), (10, 26)), ((17, 28), (10, 22)),
                ((33, 29), (43, 27)), ((28, 33), (37, 36)), ((17, 32), (10, 37))]
        front = [((30, 31), (36, 25)), ((27, 28), (31, 21)),
                 ((35, 33), (45, 31)), ((35, 29), (44, 27)), ((32, 33), (39, 37))]
    elif anim == "cast":
        rear = [((16, 31), (9, 36)), ((16, 27), (11, 21)),
                ((18, 24), (15, 18)), ((17, 28), (10, 24)), ((16, 31), (9, 36))]
        front = [((32, 33), (39, 37)), ((33, 27), (39, 22)),
                 ((33, 24), (38, 18)), ((33, 28), (40, 24)), ((32, 33), (39, 37))]
    else:
        swing = [0, 2, 2, 0, -2, -2][frame] if anim == "run" else sway
        rear = [((16 - swing, 31 + b), (9 - swing, 36 + b))]
        front = [((32 + swing, 33 + b), (39 + swing, 37 + b))]
    for index, (points, shoulder) in enumerate([(rear, (18 + dx, 28 + b)),
                                                (front, (28 + dx, 28 + b))]):
        hand, tip = points[frame] if len(points) > 1 else points[0]
        elbow = ((shoulder[0] + hand[0]) // 2, max(shoulder[1], hand[1]) + 1)
        arm(p, shoulder, elbow, hand, "purple_d", "purple", "leather")
        blade(p, hand, tip, dagger=True)
        p.dot(hand[0], hand[1], "skin" if index else "skin_d")
        spell(p, anim, frame, (tip[0], tip[1] - 2), "purple_l", "steel_l")
    return p.image


def staff(p, hand, tip, bright):
    hx, hy = hand
    tx, ty = tip
    length = math.hypot(tx - hx, ty - hy)
    ux, uy = (tx - hx) / length, (ty - hy) / length
    nx, ny = -uy, ux
    point = lambda x, y: (round(tx + nx * x - ux * y), round(ty + ny * x - uy * y))
    end = (round(hx - ux * 10), round(hy - uy * 10))
    base = point(0, 3)
    p.line([end, base], "o", 4)
    p.line([end, base], "wood", 2)
    p.line([(end[0] - 1, end[1]), (base[0] - 1, base[1])], "wood_l")
    p.poly([point(-3, 0), point(0, -4), point(3, 0), point(0, 4)], "cyan_d")
    p.poly([point(-2, -1), point(0, -3), point(1, 0), point(-1, 2)], "cyan", None)
    p.line([point(-1, 0), point(-1, -1)], bright)
    p.poly([point(-4, 2), point(-2, 5), point(2, 5), point(4, 2),
            point(3, 6), point(0, 7), point(-3, 5)], "gold_d")
    p.line([point(-3, 3), point(-2, 5), point(1, 5)], "gold")


def mage(anim, frame):
    p = Pixels("mage", size=SIZE)
    dx, b, sway = pose(anim, frame)
    legs(p, "mage", anim, frame, dx, b)
    hem = -2 if anim == "run" else 0
    p.poly([(18 + dx, 28 + b), (26 + dx, 27 + b), (29 + dx, 35),
            (32 + sway, 40 + hem), (28, 43 + hem), (22, 44 + hem),
            (15 + sway, 42 + hem), (12 + sway, 39 + hem), (16 + dx, 33)], "blue_d")
    p.poly([(18 + dx, 30 + b), (22 + dx, 31 + b), (20, 38), (17, 41 + hem),
            (14 + sway, 39 + hem)], "blue_s", None)
    p.line([(17 + dx, 33), (16, 37), (15 + sway, 39 + hem)], "blue")
    p.poly([(25 + dx, 32 + b), (27 + dx, 33), (29 + sway, 40 + hem),
            (25, 42 + hem), (24, 36)], "blue_s", None)
    p.line([(14 + sway, 40 + hem), (19, 43 + hem), (24, 43 + hem),
            (30 + sway, 40 + hem)], "gold")
    p.y = b
    p.poly([(17 + dx, 27), (25 + dx, 26), (29 + dx, 30), (26 + dx, 35),
            (20 + dx, 36), (15 + dx, 32)], "blue_d")
    top(p, (14 + dx, 25, 15), "blue_s", "blue", "blue_d")
    p.line([(16 + dx, 26), (19 + dx, 26)], "blue_l")
    p.poly([(21 + dx, 31), (25 + dx, 30), (24 + dx, 35), (26 + dx, 40),
            (23 + dx, 42), (21 + dx, 36)], "blue_l")
    p.line([(23 + dx, 33), (23 + dx, 35)], "pale")
    p.line([(18 + dx, 34), (22 + dx, 36), (27 + dx, 34)], "wood", 2)
    p.rect((22 + dx, 34, 24 + dx, 36), "gold", "o")
    p.dot(23 + dx, 35, "cyan")
    # 2026-11-06：帽沿 18×11，頭頂遮住部分臉；白鬍位於右下前側。
    p.poly([(20 + dx, 21), (27 + dx, 21), (29 + dx, 24), (27 + dx, 28),
            (23 + dx, 29), (19 + dx, 26)], "skin_d")
    p.poly([(23 + dx, 23), (27 + dx, 23), (29 + dx, 25), (25 + dx, 27),
            (22 + dx, 26)], "skin", None)
    p.line([(25 + dx, 25), (28 + dx, 24)], "o")
    p.poly([(19 + dx, 23), (22 + dx, 24), (21 + dx, 28), (18 + dx, 27)], "blue_l")
    p.line([(19 + dx, 25), (19 + dx, 26)], "pale")
    p.poly([(22 + dx, 27), (25 + dx, 28), (28 + dx, 26), (27 + dx, 30),
            (24 + dx, 33), (22 + dx, 30)], "blue_l")
    p.line([(22 + dx, 28), (24 + dx, 30), (26 + dx, 28)], "pale")
    top(p, (13 + dx, 16, 18), "blue_d", "blue_s", "blue_d")
    p.poly([(17 + dx, 21), (18 + dx, 16), (22 + dx + sway, 12),
            (25 + dx + sway, 11), (24 + dx + sway, 13), (27 + dx, 18),
            (28 + dx, 22), (23 + dx, 24)], "blue_d")
    p.poly([(18 + dx, 20), (20 + dx, 16), (24 + dx + sway, 12),
            (22 + dx, 17), (23 + dx, 22)], "blue_s", None)
    p.line([(19 + dx, 18), (22 + dx, 14)], "blue")
    p.dot(22 + dx, 14, "blue_l")
    p.line([(17 + dx, 21), (22 + dx, 23), (27 + dx, 21)], "gold")
    p.rect((24 + dx, 21, 26 + dx, 23), "gold_d")
    p.dot(25 + dx, 22, "cyan")
    p.y = 0
    bright = ["pale", "pale", "cyan", "blue_l", "pale", "cyan"][frame]
    if anim == "attack":
        hands = [(33, 31), (29, 26), (32, 28), (33, 33), (34, 32)]
        tips = [(35, 21), (23, 17), (41, 24), (41, 33), (37, 22)]
    elif anim == "cast":
        hands = [(34, 32), (34, 28), (34, 27), (34, 28), (34, 32)]
        tips = [(37, 22), (37, 18), (37, 17), (37, 18), (37, 22)]
    else:
        hands = [(34, 32 + b)]
        tips = [(37 + (sway if anim == "run" else 0), 22 + b)]
    hand = hands[frame] if len(hands) > 1 else hands[0]
    tip = tips[frame] if len(tips) > 1 else tips[0]
    staff(p, hand, tip, bright)
    arm(p, (28 + dx, 30 + b), (30 + dx, hand[1] + 1), hand,
        "blue_d", "blue", "skin")
    raised = [0, -3, -5, -3, 0][frame] if anim == "cast" else sway
    palm = (12 + dx, 33 + b + raised)
    arm(p, (17 + dx, 30 + b), (14 + dx, 32 + b), palm,
        "blue_d", "blue", "skin")
    spell(p, anim, frame, (tip[0], tip[1] - 1), "cyan", "pale")
    spell(p, anim, frame, (palm[0], palm[1] - 5), "cyan_d", "pale")
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
    d.text((gutter, 16), "WEBDOTA / 36.87 DEG TOP-DOWN BATTLE / 4x NEAREST / 2026-11-06",
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


SCENE_CROP = (300, 270, 780, 510)
SCENE_POSES = (("battle-idle", 0), ("run", 2), ("attack", 2), ("cast", 2))


def scene_preview(animations):
    """2026-11-06：保持原生比例，只讀取 env v2，整張合成後 nearest 3 倍。"""
    env = OUT.parent / "env"
    ground = Image.open(env / "ground-blue.png").convert("RGB").crop(SCENE_CROP)
    actors = []
    for row, character in enumerate(DRAW):
        for column, (anim, index) in enumerate(SCENE_POSES):
            x, y = project(column * 2.5, row * 5)
            actors.append((112 + y, 110 + x, animations[character, anim][index], PIVOT))
        creep = Image.open(env / "creep-blue-walk.png").convert("RGBA")
        actors.append((112 + project(0, row * 5)[1], 310, creep.crop((row * 32, 0, (row + 1) * 32, 32)), [16, 30]))
    for name, x, y, size, pivot in [("tower-blue-idle", 372, 164, (48, 112), [24, 108]),
                                   ("pillar-s-idle", 432, 220, (48, 96), [24, 92]),
                                   ("creep-red-walk", 344, 220, (32, 32), [16, 30])]:
        sheet = Image.open(env / f"{name}.png").convert("RGBA")
        actors.append((y, x, sheet.crop((0, 0, *size)), pivot))
    for y, x, sprite, pivot in sorted(actors, key=lambda item: item[0]):
        ground.paste(sprite, (x - pivot[0], y - pivot[1]), sprite)
    board = Image.new("RGB", (ground.width * 3 + 36, ground.height * 3 + 94), "#10131d")
    board.paste(ground.resize((ground.width * 3, ground.height * 3), Image.Resampling.NEAREST), (18, 64))
    d = ImageDraw.Draw(board)
    d.fontmode = "1"
    font, small = ImageFont.load_default(size=16), ImageFont.load_default(size=12)
    d.text((18, 12), "WEBDOTA / BATTLE V2 + ENV V2 / 36.87 DEG / UPPER-LEFT LIGHT / 3x NEAREST / 2026-11-06",
           font=font, fill="#dce7ef")
    for column, (anim, _) in enumerate(SCENE_POSES):
        d.text((18 + (90 + project(column * 2.5, 0)[0]) * 3, 43), anim.upper(), font=small, fill="#aebdd3")
    for row, name in enumerate(DRAW):
        d.text((30, 64 + (89 + project(0, row * 5)[1]) * 3), name.upper(), font=small, fill="#dce7ef")
    d.text((18 + 289 * 3, 43), "V2 CREEPS", font=small, fill="#aebdd3")
    d.text((18 + 350 * 3, 43), "V2 TOWER / PILLAR", font=small, fill="#aebdd3")
    d.text((18, board.height - 21), "Native 19px/unit | 15.2px vertical/unit | 11.4px ground depth/unit | no baked ground shadows",
           font=small, fill="#aebdd3")
    save_preview(board, "preview-battle-scene.png")


def validate_battle():
    report = {"date": "2026-11-06", "version": 2, "camera": CAMERA,
              "facing": "right", "light": "upper-left", "ground_shadow": False,
              "frameSize": [SIZE, SIZE], "pivot": PIVOT,
              "foot_y": 45, "transparent_bottom_rows": 2,
              "checks": ["sheet_dimensions", "metadata", "palette_union_at_most_16",
                         "binary_alpha", "distinct_frames", "fixed_grounded_foot",
                         "unclipped_bounds", "height_32_to_36_px", "png_at_most_50000_bytes",
                         "camera_projection_basis", "scene_native_scale"],
              "scene": {"preview": "tools/portraits/preview-battle-scene.png", "nearest_scale": 3,
                        "ground": "public/env/ground-blue.png", "crop": list(SCENE_CROP),
                        "character_poses": [{"animation": anim, "frame": i} for anim, i in SCENE_POSES],
                        "environment_references": ["creep-blue-walk", "creep-red-walk",
                                                   "tower-blue-idle", "pillar-s-idle"]},
              "characters": {}}
    assert project(1, 0, 0) == (19, 0)
    assert project(0, 5, 5) == (0, -19)
    scene = Image.open(PREVIEW / "preview-battle-scene.png").convert("RGB")
    assert scene.size == (1476, 814), scene.size
    # 2026-11-06：排除左側文字，逐像素確認地面、角色與參照物全為 nearest 3 倍。
    region = scene.crop((18 + 90 * 3, 64, 18 + 480 * 3, 64 + 240 * 3))
    native = region.resize((390, 240), Image.Resampling.NEAREST)
    assert native.resize(region.size, Image.Resampling.NEAREST).tobytes() == region.tobytes()
    report["scene"]["nearest_verified_native_rect"] = [90, 0, 480, 240]
    report["scene"]["source_sha256"] = {
        name: hashlib.sha256((OUT.parent / "env" / name).read_bytes()).hexdigest()
        for name in ["ground-blue.png", "creep-blue-walk.png", "creep-red-walk.png",
                     "tower-blue-idle.png", "pillar-s-idle.png"]}
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
                assert box[3] == 46 and 32 <= box[3] - box[1] <= 36, (png, i, box)
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
                           "distinct_frames": len(set(hashes)), "bounds": bounds,
                           "height_range": [min(b[3] - b[1] for b in bounds), max(b[3] - b[1] for b in bounds)]}
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
    scene_preview(animations)
    assert all(p.read_bytes() == old for p, old in before.items()), "legacy artwork changed"
    old_frames, avatars = {}, {}
    for name in DRAW:
        sheet = Image.open(OUT / f"{name}-idle.png").convert("RGBA")
        old_frames[name] = [sheet.crop((i * 96, 0, (i + 1) * 96, 96)) for i in range(8)]
        avatars[name] = Image.open(OUT / f"{name}-avatar.png").convert("RGBA")
    validate(old_frames, avatars)


if __name__ == "__main__":
    main()
