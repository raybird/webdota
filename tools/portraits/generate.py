#!/usr/bin/env python3
"""重製 webdota 原創角色素材；像素設計日期：2026-11-06。"""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "characters"
PREVIEW = Path(__file__).resolve().parent
SIZE = 96
FPS = 8
COUNT = 8
PIVOT = [48, 92]
OUTLINE = "#1a1422"
BREATH = [0, 0, -1, -1, -1, 0, 1, 1]
SWAY = [0, 1, 2, 1, 0, -1, -2, -1]

PALETTES = {
    "warrior": {
        "o": OUTLINE, "ink": "#302538", "steel_d": "#555366",
        "steel": "#8d94a1", "steel_l": "#d9e2df", "ivory": "#f9f3ce",
        "red_d": "#660f29", "red_s": "#aa0000", "red": "#ff4444",
        "red_m": "#d92d3d", "red_l": "#ff8a73", "gold_d": "#8d562e",
        "gold": "#d99e51", "gold_l": "#f7d886", "leather": "#63414b",
        "leather_l": "#9b6260",
    },
    "assassin": {
        "o": OUTLINE, "ink": "#2c203e", "purple_d": "#432553",
        "purple_s": "#6c3483", "purple": "#9b59b6", "purple_l": "#c18bd4",
        "lilac": "#e8b9e5", "cloth": "#352b46", "leather": "#5f3e55",
        "skin_d": "#a56c67", "skin": "#d8a183", "skin_l": "#f1c6a0",
        "steel_d": "#526477", "steel": "#a6c5cc", "steel_l": "#e6f6e8",
        "gold": "#d3a164",
    },
    "mage": {
        "o": OUTLINE, "ink": "#18314f", "blue_d": "#205377",
        "blue_s": "#2874a6", "blue": "#3498db", "blue_l": "#74c7e8",
        "pale": "#cdeeeb", "white": "#f2fff4", "cyan": "#00ffff",
        "cyan_d": "#00a9b9", "skin_d": "#aa776f", "skin": "#deab84",
        "wood": "#70404a", "wood_l": "#a96f56", "gold": "#d1a15e",
        "gold_d": "#816043",
    },
}


class Pixels:
    """所有圖形均直接落在原生整數網格，不縮放、不平滑。"""

    def __init__(self, character, size=SIZE, y=0):
        self.image = Image.new("RGBA", (size, size))
        self.draw = ImageDraw.Draw(self.image)
        self.palette = PALETTES[character]
        self.y = y

    def poly(self, points, color, edge="o"):
        self.draw.polygon(
            [(x, y + self.y) for x, y in points],
            fill=self.palette[color],
            outline=self.palette[edge] if edge else None,
        )

    def rect(self, box, color, edge=None):
        x0, y0, x1, y1 = box
        self.draw.rectangle(
            (x0, y0 + self.y, x1, y1 + self.y),
            fill=self.palette[color],
            outline=self.palette[edge] if edge else None,
        )

    def line(self, points, color, width=1):
        self.draw.line(
            [(x, y + self.y) for x, y in points],
            fill=self.palette[color], width=width,
        )

    def dot(self, x, y, color):
        self.draw.point((x, y + self.y), fill=self.palette[color])


def warrior(frame):
    p = Pixels("warrior")
    b, s = BREATH[frame], SWAY[frame]

    # 披布、關節與腳底；腳底不跟著胸腔呼吸平移。
    p.poly([(34, 38), (61, 38), (66 + s, 76), (58, 74), (54 + s, 79),
            (45, 75), (30 + s, 78)], "red_d")
    p.poly([(35, 45), (39, 47), (35 + s, 73), (32 + s, 75)], "red_s", None)
    p.poly([(37, 63), (46, 64), (46, 85), (42, 89), (33, 88), (34, 75)], "ink")
    p.poly([(51, 64), (60, 64), (63, 84), (61, 89), (52, 88), (50, 74)], "ink")
    p.poly([(35, 73), (45, 74), (44, 86), (34, 87)], "steel_d")
    p.poly([(52, 74), (61, 73), (62, 87), (53, 87)], "steel_d")
    p.poly([(35, 75), (40, 76), (39, 85), (35, 85)], "steel", None)
    p.poly([(53, 76), (57, 77), (59, 85), (54, 85)], "steel", None)
    p.line([(36, 76), (36, 82)], "steel_l")
    p.line([(54, 77), (55, 82)], "steel_l")
    p.poly([(33, 86), (43, 85), (45, 88), (45, 91), (29, 91), (29, 89)], "steel_d")
    p.poly([(53, 85), (62, 86), (66, 89), (66, 91), (51, 91), (51, 88)], "steel_d")
    p.line([(31, 88), (39, 87), (42, 88)], "steel_l")
    p.line([(54, 87), (60, 87), (63, 89)], "steel")
    p.line([(30, 90), (43, 90)], "ink")
    p.line([(53, 90), (65, 90)], "ink")
    for x in (35, 53):
        p.poly([(x, 69), (x + 5, 67), (x + 10, 70), (x + 8, 77), (x + 2, 77)], "red_s")
        p.poly([(x + 1, 70), (x + 5, 69), (x + 7, 71), (x + 2, 74)], "red", None)
        p.line([(x + 2, 69), (x + 5, 68), (x + 8, 70)], "gold")

    p.y = b
    # 大劍在角色右手（畫面左側），盾牌在角色左手。
    p.poly([(19, 17), (24, 23), (28, 53), (22, 55), (17, 26)], "steel")
    p.poly([(19, 20), (20, 27), (24, 52), (22, 52), (18, 26)], "steel_l", None)
    p.poly([(20, 23), (23, 26), (27, 51), (25, 52)], "steel_d", None)
    p.line([(19, 21), (19, 26), (23, 48)], "ivory")
    p.line([(21, 27), (24, 46)], "steel")
    p.poly([(15, 52), (21, 53), (28, 51), (31, 53), (31, 56), (25, 58),
            (26, 66), (22, 67), (21, 58), (14, 56)], "gold_d")
    p.line([(16, 53), (21, 55), (28, 53), (30, 54)], "gold_l")
    p.rect((23, 57, 24, 63), "leather")
    p.line([(23, 58), (24, 58)], "gold")
    p.line([(23, 61), (24, 61)], "gold")
    p.rect((23, 65, 25, 66), "gold")

    # 板甲採大片群聚色塊；左上亮面與右下暗面固定。
    p.poly([(38, 35), (57, 35), (64, 44), (60, 63), (35, 63), (30, 45)], "red_s")
    p.poly([(38, 37), (47, 39), (47, 54), (35, 51), (33, 44)], "red", None)
    p.poly([(49, 39), (56, 38), (61, 44), (57, 54), (49, 55)], "red_m", None)
    p.poly([(36, 53), (47, 56), (58, 53), (58, 60), (37, 60)], "red_d", None)
    p.line([(35, 43), (39, 38), (44, 39)], "red_l")
    p.line([(36, 49), (45, 52)], "red_l")
    p.line([(50, 51), (57, 48)], "red")
    p.poly([(40, 43), (46, 46), (54, 42), (54, 46), (47, 51), (40, 47)], "gold_d")
    p.line([(41, 43), (46, 46), (53, 43)], "gold_l")
    p.line([(42, 47), (47, 49), (52, 46)], "gold")
    p.rect((37, 57, 58, 60), "ink", "o")
    p.line([(38, 57), (56, 57)], "leather_l")
    p.poly([(46, 56), (51, 56), (52, 60), (47, 62), (45, 59)], "gold")
    p.rect((48, 58, 49, 59), "gold_l")
    p.poly([(35, 61), (46, 63), (44, 72), (33, 70)], "red_s")
    p.poly([(49, 63), (59, 61), (63, 70), (51, 73)], "red_d")
    p.line([(35, 63), (43, 65), (42, 69)], "red")
    p.line([(51, 65), (57, 64), (60, 69)], "red_m")
    p.line([(34, 70), (43, 72)], "gold_d")
    p.line([(52, 72), (62, 70)], "gold_d")

    p.poly([(29, 44), (38, 46), (36, 57), (30, 63), (25, 60), (26, 52)], "steel_d")
    p.poly([(28, 49), (33, 50), (32, 56), (28, 57)], "steel", None)
    p.line([(28, 50), (27, 54)], "steel_l")
    p.poly([(25, 58), (31, 58), (33, 61), (31, 65), (25, 64), (23, 61)], "steel_d")
    p.line([(26, 59), (30, 59), (31, 61)], "steel_l")
    p.line([(26, 61), (29, 61)], "steel")
    p.poly([(60, 43), (69, 42), (73, 54), (70, 64), (63, 61)], "steel_d")

    # 寬肩輪廓與鉚釘。
    p.poly([(29, 36), (37, 35), (42, 40), (40, 47), (27, 48), (24, 44), (25, 39)], "red_s")
    p.poly([(28, 38), (36, 37), (39, 41), (28, 43), (26, 42)], "red", None)
    p.line([(27, 39), (30, 37), (35, 37)], "red_l")
    p.line([(27, 46), (38, 45)], "gold")
    p.dot(28, 44, "gold_l")
    p.dot(36, 43, "gold_l")
    p.poly([(59, 35), (68, 36), (73, 41), (72, 47), (59, 48), (55, 42)], "red_d")
    p.poly([(59, 37), (66, 38), (70, 41), (59, 43), (57, 41)], "red_m", None)
    p.line([(59, 37), (64, 37)], "red_l")
    p.line([(60, 46), (70, 45)], "gold_d")
    p.dot(61, 44, "gold")
    p.dot(68, 43, "gold")

    # 原創無紋章的折面盾；嵌入不對稱折線金屬補強。
    p.poly([(67, 43), (78, 41), (85, 47), (84, 65), (76, 79), (65, 71), (62, 51)], "gold_d")
    p.poly([(67, 45), (77, 43), (83, 48), (81, 64), (75, 75), (67, 69), (64, 52)], "red_s")
    p.poly([(67, 46), (73, 45), (72, 64), (69, 68), (66, 64), (65, 52)], "red", None)
    p.poly([(75, 45), (80, 48), (79, 63), (75, 71), (73, 64)], "red_d", None)
    p.line([(65, 51), (68, 46), (76, 44)], "gold_l")
    p.line([(83, 49), (82, 64), (76, 76)], "gold")
    p.poly([(73, 51), (77, 54), (76, 60), (72, 64), (69, 60), (69, 55)], "gold_d")
    p.poly([(73, 53), (75, 55), (74, 59), (72, 61), (71, 58), (71, 55)], "gold")
    p.line([(72, 54), (72, 57)], "gold_l")
    for x, y in [(68, 49), (79, 49), (68, 66), (75, 70)]:
        p.dot(x, y, "gold_l")

    # 封閉盔面與短紅纓。
    p.poly([(40, 31), (56, 31), (59, 37), (53, 40), (41, 37)], "steel_d")
    p.line([(42, 34), (48, 37), (54, 35)], "steel")
    p.poly([(45, 22), (45, 17), (49, 14), (54 + s, 15), (60 + s, 21),
            (55 + s, 21), (52, 19), (51, 25)], "red_d")
    p.poly([(47, 19), (50, 16), (53 + s, 17), (56 + s, 19), (51, 18), (49, 23)], "red", None)
    p.dot(50, 16, "red_l")
    p.poly([(43, 20), (53, 20), (59, 25), (59, 32), (55, 37), (44, 37),
            (39, 32), (39, 25)], "steel_d")
    p.poly([(43, 21), (48, 21), (47, 26), (40, 28), (40, 25)], "steel", None)
    p.poly([(49, 21), (53, 22), (57, 25), (57, 29), (49, 26)], "red_s", None)
    p.line([(42, 23), (44, 21), (47, 21)], "steel_l")
    p.line([(50, 22), (54, 24)], "red")
    p.poly([(41, 27), (48, 26), (57, 28), (56, 32), (49, 33), (42, 31)], "o", None)
    p.line([(42, 28), (46, 28)], "gold_l")
    p.line([(51, 29), (55, 29)], "gold")
    p.poly([(47, 27), (49, 27), (50, 34), (48, 36), (46, 33)], "steel")
    p.line([(47, 28), (47, 32)], "steel_l")
    p.line([(42, 33), (45, 35)], "steel")
    p.line([(52, 35), (56, 33)], "steel")
    p.dot(41, 30, "gold")
    p.dot(57, 30, "gold_d")
    return p.image


def assassin(frame):
    p = Pixels("assassin")
    b, s = BREATH[frame], SWAY[frame]
    # 後披風的叉尾跟隨風向，重心與雙腳固定。
    p.poly([(51, 35 + b), (61, 35 + b), (68 + s, 48), (78 + s, 66),
            (71 + s, 63), (75 + s, 73), (64 + s, 69), (60 + s, 75),
            (55, 61), (49, 46)], "purple_d")
    p.poly([(58, 39 + b), (62 + s, 43), (69 + s, 59), (73 + s, 65),
            (65 + s, 62), (62 + s, 56)], "purple_s", None)
    p.line([(61, 42 + b), (65 + s, 49), (68 + s, 55)], "purple")
    p.line([(63 + s, 62), (68 + s, 67), (71 + s, 68)], "purple_s")

    p.poly([(43, 60), (51, 64), (43, 76), (38, 86), (30, 86), (31, 76), (35, 69)], "cloth")
    p.poly([(50, 63), (57, 62), (65, 70), (70, 83), (65, 87), (58, 76), (49, 72)], "ink")
    p.poly([(35, 72), (39, 70), (42, 73), (37, 80), (33, 81)], "purple_s")
    p.line([(35, 73), (38, 72), (39, 74)], "purple")
    p.poly([(58, 70), (62, 72), (67, 81), (64, 83), (59, 77)], "purple_s", None)
    p.line([(59, 72), (62, 75)], "purple")
    p.poly([(32, 80), (39, 81), (36, 88), (36, 91), (22, 91), (23, 88), (29, 87)], "ink")
    p.poly([(64, 81), (69, 82), (69, 87), (75, 89), (75, 91), (60, 91), (59, 88)], "ink")
    p.poly([(33, 82), (36, 83), (33, 88), (27, 89), (25, 89), (31, 86)], "leather", None)
    p.poly([(65, 83), (67, 84), (66, 88), (71, 89), (63, 89), (62, 88)], "cloth", None)
    p.line([(32, 84), (36, 85)], "purple_l")
    p.line([(31, 86), (34, 87)], "purple")
    p.line([(63, 85), (67, 86)], "purple")
    p.line([(26, 90), (34, 90)], "cloth")
    p.line([(62, 90), (73, 90)], "cloth")

    p.y = b
    # 窄胸、斜背帶、束腰及兩片短衣襬。
    p.poly([(43, 40), (55, 39), (62, 45), (58, 58), (59, 64),
            (51, 68), (40, 64), (42, 55), (38, 48)], "purple_s")
    p.poly([(43, 43), (48, 43), (48, 53), (44, 59), (43, 53), (40, 48)], "purple", None)
    p.poly([(51, 44), (56, 44), (59, 47), (55, 57), (49, 58)], "purple_d", None)
    p.line([(42, 46), (45, 44), (47, 45)], "purple_l")
    p.poly([(53, 42), (56, 43), (45, 60), (42, 59)], "leather")
    p.line([(54, 44), (45, 57)], "skin_d")
    p.poly([(50, 48), (52, 49), (50, 52), (48, 51)], "gold")
    p.rect((42, 59, 57, 62), "leather", "o")
    p.line([(43, 60), (54, 60)], "purple_l")
    p.rect((48, 59, 51, 62), "gold", "o")
    p.dot(49, 60, "skin_l")
    p.poly([(41, 63), (48, 64), (43, 75), (38, 72)], "purple_d")
    p.poly([(51, 64), (57, 63), (61 + s, 76), (56 + s, 73), (55 + s, 78)], "purple_s")
    p.line([(53, 65), (56 + s, 73)], "purple")
    p.line([(41, 66), (40, 71)], "purple")

    # 向下外翻的刀刃位於拳頭下方，讀得出反握。
    p.poly([(22, 64), (25, 67), (18, 78), (12, 83), (14, 76)], "steel")
    p.poly([(23, 67), (22, 71), (15, 79), (16, 75)], "steel_l", None)
    p.poly([(23, 70), (24, 68), (18, 77), (15, 80)], "steel_d", None)
    p.poly([(68, 65), (72, 64), (77, 74), (81, 83), (75, 79), (67, 69)], "steel_d")
    p.poly([(71, 67), (75, 75), (79, 80), (74, 77), (69, 69)], "steel", None)
    p.line([(71, 68), (75, 75)], "steel_l")
    p.poly([(19, 64), (26, 63), (27, 65), (20, 67)], "gold")
    p.poly([(66, 64), (73, 64), (74, 67), (67, 66)], "gold")
    p.line([(22, 59), (23, 65)], "leather", 3)
    p.line([(69, 59), (70, 65)], "leather", 3)
    p.rect((20, 56, 23, 58), "gold", "o")
    p.rect((67, 56, 70, 58), "gold", "o")

    p.poly([(39, 43), (45, 47), (37, 55), (28, 62), (23, 60), (28, 53)], "cloth")
    p.poly([(39, 44), (42, 47), (34, 54), (31, 54)], "purple_s", None)
    p.line([(38, 45), (40, 46)], "purple_l")
    p.poly([(28, 54), (33, 57), (29, 62), (24, 60)], "purple_d")
    p.line([(27, 56), (30, 58)], "purple_l")
    p.poly([(22, 58), (26, 58), (29, 61), (26, 65), (22, 63), (21, 60)], "leather")
    p.line([(23, 59), (25, 59)], "skin")
    p.line([(24, 61), (27, 62)], "purple_l")
    p.poly([(58, 43), (63, 45), (70, 53), (72, 61), (67, 63), (64, 54), (57, 50)], "cloth")
    p.poly([(59, 45), (61, 46), (67, 54), (65, 55), (59, 49)], "purple_s", None)
    p.line([(60, 46), (62, 48)], "purple")
    p.poly([(67, 55), (71, 55), (73, 60), (68, 63), (65, 60)], "purple_d")
    p.line([(68, 56), (70, 58)], "purple")
    p.poly([(67, 60), (71, 59), (73, 62), (71, 65), (67, 65), (66, 63)], "leather")
    p.line([(68, 61), (70, 61)], "skin_d")

    # 兜帽與面罩；眼睛被壓在狹長的亮面內。
    p.poly([(45, 36), (58, 35), (63, 41), (59, 46), (47, 44), (39, 46), (37, 43)], "purple_d")
    p.poly([(42, 39), (50, 40), (56, 38), (59, 41), (48, 43), (41, 42)], "purple", None)
    p.line([(41, 40), (47, 41)], "purple_l")
    p.poly([(48, 19), (55, 21), (61, 27), (64, 36), (60, 43), (44, 43),
            (39, 37), (40, 29), (44, 23)], "purple_s")
    p.poly([(47, 22), (50, 21), (47, 27), (43, 32), (42, 37), (40, 35), (42, 28)], "purple", None)
    p.line([(44, 26), (47, 23), (49, 23)], "purple_l")
    p.poly([(50, 24), (55, 25), (60, 30), (61, 36), (58, 40),
            (45, 40), (43, 35), (45, 30)], "ink")
    p.poly([(46, 31), (50, 29), (57, 31), (59, 34), (56, 37), (47, 36), (45, 34)], "skin_d", None)
    p.poly([(46, 32), (50, 31), (54, 32), (54, 34), (47, 34)], "skin", None)
    p.line([(46, 32), (50, 32)], "o")
    p.line([(54, 33), (58, 33)], "o")
    p.line([(47, 33), (49, 33)], "steel_l")
    p.line([(55, 34), (57, 34)], "lilac")
    p.poly([(45, 35), (50, 36), (58, 35), (58, 40), (53, 43), (46, 40)], "cloth")
    p.line([(47, 37), (51, 38), (56, 37)], "purple")
    p.line([(49, 40), (53, 41)], "purple_s")
    p.line([(59, 28), (61, 32), (61, 36)], "purple_d")
    return p.image


def mage(frame):
    p = Pixels("mage")
    b, s = BREATH[frame], SWAY[frame]
    pulse = ["pale", "white", "white", "pale", "blue_l", "pale", "white", "pale"][frame]
    orb_y = [0, -1, -2, -2, -1, 0, 1, 1][frame]

    p.poly([(37, 85), (45, 85), (46, 91), (33, 91), (33, 89)], "wood")
    p.poly([(53, 85), (60, 85), (63, 89), (63, 91), (51, 91)], "wood")
    p.line([(35, 89), (41, 88)], "wood_l")
    p.line([(54, 89), (59, 89)], "gold_d")

    # 袍腳的風擺只改變外側，腳底與主要皺褶固定。
    p.poly([(39, 45 + b), (56, 46 + b), (61, 64), (63, 76),
            (68 + s, 87), (60, 89), (53, 87), (47, 90), (39, 88),
            (28 + s, 89), (33, 74), (35, 58)], "blue_d")
    p.poly([(39, 52), (46, 53), (43, 76), (38, 85), (31 + s, 86), (36, 69)], "blue_s", None)
    p.poly([(39, 57), (42, 57), (40, 74), (35, 84), (33, 84)], "blue", None)
    p.poly([(50, 55), (55, 53), (58, 68), (61, 84), (54, 84), (51, 72)], "blue_s", None)
    p.poly([(53, 60), (55, 62), (57, 77), (55, 80)], "blue", None)
    p.poly([(45, 63), (49, 63), (51, 85), (46, 87), (43, 85)], "ink", None)
    p.line([(32 + s, 87), (39, 86), (46, 88), (53, 85), (60, 87), (65 + s, 86)], "gold")
    p.line([(35, 83), (38, 76)], "blue_l")
    p.line([(59, 75), (62, 83)], "ink")

    p.y = b
    p.poly([(39, 46), (55, 45), (61, 51), (56, 60), (40, 60), (34, 53)], "blue_s")
    p.poly([(39, 47), (45, 49), (43, 56), (37, 54)], "blue", None)
    p.poly([(46, 49), (50, 48), (55, 53), (51, 65), (54, 79),
            (49, 83), (45, 79), (47, 65), (43, 55)], "blue_l")
    p.poly([(47, 52), (49, 51), (50, 64), (48, 75), (49, 79), (47, 78), (49, 63)], "pale", None)
    p.line([(47, 58), (50, 58)], "gold")
    p.poly([(40, 58), (56, 58), (57, 62), (41, 63)], "wood")
    p.line([(41, 59), (54, 59)], "gold_d")
    p.poly([(47, 58), (50, 57), (53, 60), (50, 63), (47, 62)], "gold")
    p.dot(50, 60, "cyan")

    # 寬袖與斜肩披領。
    p.poly([(35, 47), (42, 51), (36, 66), (25, 63), (27, 57)], "blue_d")
    p.poly([(35, 49), (39, 52), (35, 60), (30, 60)], "blue", None)
    p.line([(32, 54), (35, 50)], "blue_l")
    p.poly([(27, 59), (36, 62), (35, 65), (25, 63)], "gold_d")
    p.line([(27, 60), (34, 62)], "gold")
    p.poly([(56, 48), (62, 48), (68, 54), (65, 64), (56, 62), (53, 55)], "blue_d")
    p.poly([(58, 49), (61, 50), (64, 55), (62, 59), (57, 57)], "blue", None)
    p.line([(58, 50), (60, 51)], "blue_l")
    p.poly([(62, 58), (66, 56), (68, 59), (65, 64), (60, 62)], "gold_d")
    p.line([(63, 59), (66, 58)], "gold")
    p.poly([(65, 57), (68, 56), (69, 53), (71, 54), (70, 60), (66, 62), (64, 60)], "skin_d")
    p.line([(66, 58), (68, 58), (69, 55)], "skin")

    p.poly([(37, 43), (45, 45), (49, 48), (56, 44), (60, 46), (63, 51),
            (55, 55), (49, 51), (41, 55), (32, 51)], "blue_s")
    p.poly([(37, 45), (43, 47), (46, 49), (41, 52), (35, 50)], "blue", None)
    p.line([(35, 48), (38, 46), (43, 48)], "blue_l")
    p.line([(33, 51), (41, 54), (47, 50)], "gold")
    p.line([(51, 50), (55, 54), (62, 51)], "gold_d")

    # 白髮、短尖鬍及清楚的兩個眼睛。
    p.poly([(38, 34), (56, 34), (59, 42), (57, 51), (53, 49), (51, 53),
            (43, 51), (38, 51), (35, 46)], "blue_l")
    p.poly([(39, 36), (42, 36), (40, 44), (39, 48), (37, 45)], "pale", None)
    p.poly([(42, 36), (53, 35), (56, 39), (54, 47), (48, 51), (42, 47), (40, 42)], "skin_d")
    p.poly([(42, 37), (49, 36), (52, 38), (51, 45), (46, 47), (42, 43)], "skin", None)
    p.line([(42, 39), (45, 39)], "o")
    p.line([(50, 39), (53, 39)], "o")
    p.dot(43, 40, "white")
    p.dot(51, 40, "pale")
    p.line([(47, 40), (46, 43), (48, 43)], "skin_d")
    p.poly([(41, 43), (45, 44), (48, 46), (53, 43), (53, 49),
            (49, 54), (46, 56), (43, 51)], "blue_l")
    p.poly([(42, 44), (45, 45), (48, 48), (51, 46), (49, 51), (46, 53), (44, 49)], "pale", None)
    p.line([(43, 45), (45, 46), (47, 49)], "white")

    # 彎折尖帽、銅環帽帶與偏心扣飾。
    p.poly([(30, 31), (38, 28), (58, 29), (66, 34), (64, 38), (52, 40),
            (38, 38), (28, 35)], "blue_d")
    p.poly([(31, 32), (39, 30), (58, 31), (62, 34), (51, 35), (37, 34)], "blue", None)
    p.line([(31, 32), (38, 30), (43, 30)], "blue_l")
    p.poly([(34, 31), (38, 24), (42, 17), (49 + s, 13), (47 + s, 18),
            (54, 22), (57, 30), (53, 34), (42, 33)], "blue_s")
    p.poly([(38, 28), (42, 20), (46 + s, 16), (44 + s, 21), (47, 23),
            (45, 29), (43, 31)], "blue", None)
    p.line([(40, 24), (43, 19), (46 + s, 16)], "blue_l")
    p.poly([(48, 22), (51, 24), (53, 29), (50, 29)], "blue_d", None)
    p.poly([(35, 29), (43, 30), (55, 29), (57, 32), (51, 35), (39, 34), (34, 32)], "gold_d")
    p.line([(36, 30), (42, 31), (52, 30)], "gold")
    p.poly([(43, 30), (46, 29), (49, 32), (46, 35), (43, 33)], "gold")
    p.poly([(46, 30), (48, 32), (46, 34), (45, 32)], "cyan_d", None)
    p.dot(46, 31, "cyan")

    # 法杖及水晶皆用硬邊，光感只由離散色階表現。
    p.y = 0
    p.poly([(23, 38), (27, 38), (29, 86), (28, 89), (25, 88)], "wood")
    p.line([(24, 42), (26, 70), (27, 85)], "wood_l")
    p.line([(25, 46), (27, 46)], "gold_d")
    p.line([(25, 49), (27, 49)], "gold")
    p.line([(26, 80), (28, 80)], "gold_d")
    p.line([(26, 83), (28, 83)], "gold")
    p.y = b
    p.poly([(22, 55), (27, 55), (30, 58), (28, 62), (23, 61), (21, 58)], "skin_d")
    p.line([(23, 56), (26, 56), (28, 58)], "skin")
    p.line([(23, 58), (26, 58)], "skin")
    p.y = 0
    p.poly([(17, 32), (20, 34), (21, 39), (27, 40), (31, 35), (33, 34),
            (32, 40), (28, 44), (22, 43), (18, 39)], "gold_d")
    p.line([(18, 34), (20, 39), (23, 41), (27, 42)], "gold")
    p.line([(29, 39), (31, 36)], "gold")
    p.poly([(24, 18), (30, 25), (29, 33), (25, 39), (19, 31), (19, 25)], "cyan_d")
    p.poly([(24, 20), (24, 30), (21, 31), (20, 25)], "cyan", None)
    p.poly([(25, 22), (28, 26), (27, 31), (25, 35), (25, 29)], "blue_l", None)
    p.line([(23, 23), (22, 26), (22, 29)], pulse)
    p.dot(24, 21, "white")
    p.line([(25, 32), (25, 35)], "cyan")

    # 懸浮球獨立移動，亮度不改變 alpha。
    x, y = 76, 47 + orb_y
    p.poly([(x - 2, y - 4), (x + 2, y - 4), (x + 4, y - 2),
            (x + 4, y + 2), (x + 2, y + 4), (x - 2, y + 4),
            (x - 4, y + 2), (x - 4, y - 2)], "cyan_d")
    p.poly([(x - 2, y - 3), (x + 1, y - 3), (x + 2, y - 1),
            (x + 1, y + 2), (x - 2, y + 2), (x - 3, y)], "cyan", None)
    p.rect((x - 2, y - 2, x, y), pulse)
    p.dot(x - 1, y - 2, "white")
    p.line([(x + 2, y + 1), (x + 1, y + 2)], "blue_l")
    return p.image


def avatar(character):
    """獨立的 32px 頭肩構圖，沒有裁切或縮小立繪。"""
    p = Pixels(character, size=32)
    if character == "warrior":
        p.poly([(5, 22), (12, 21), (22, 21), (29, 24), (31, 31), (1, 31), (1, 26)], "red_s")
        p.poly([(4, 24), (10, 23), (14, 27), (12, 31), (2, 30), (2, 27)], "red")
        p.line([(3, 26), (5, 24), (9, 24)], "red_l")
        p.poly([(23, 23), (28, 25), (30, 30), (22, 31), (20, 27)], "red_d")
        p.line([(24, 24), (27, 26)], "red")
        p.line([(3, 30), (10, 30)], "gold")
        p.dot(5, 28, "gold_l")
        p.dot(25, 28, "gold")
        p.poly([(12, 19), (22, 19), (25, 24), (18, 28), (10, 24)], "steel_d")
        p.line([(12, 23), (18, 26), (22, 23)], "steel")
        p.poly([(14, 9), (14, 4), (18, 1), (23, 3), (27, 8), (22, 7), (19, 5), (19, 11)], "red_d")
        p.poly([(16, 6), (19, 3), (22, 4), (24, 6), (20, 5), (18, 8)], "red", None)
        p.dot(19, 3, "red_l")
        p.poly([(12, 8), (21, 8), (26, 12), (26, 19), (22, 24), (13, 24), (9, 19), (9, 12)], "steel_d")
        p.poly([(12, 9), (17, 9), (16, 14), (10, 15), (10, 12)], "steel", None)
        p.line([(11, 12), (13, 10), (16, 10)], "steel_l")
        p.poly([(18, 9), (21, 10), (24, 12), (24, 16), (18, 14)], "red_s", None)
        p.line([(19, 10), (22, 12)], "red")
        p.poly([(11, 15), (17, 14), (24, 16), (24, 19), (18, 21), (11, 19)], "o", None)
        p.line([(12, 16), (15, 16)], "gold_l")
        p.line([(20, 17), (23, 17)], "gold")
        p.poly([(16, 15), (18, 15), (19, 21), (17, 23), (15, 20)], "steel")
        p.line([(16, 16), (16, 19)], "steel_l")
        p.dot(11, 20, "gold")
        p.line([(21, 22), (24, 20)], "steel")
        p.poly([(14, 28), (18, 29), (22, 27), (21, 31), (16, 31)], "gold_d")
        p.line([(15, 28), (18, 29), (21, 28)], "gold_l")
    elif character == "assassin":
        p.poly([(8, 23), (16, 21), (24, 23), (29, 27), (31, 31), (2, 31), (3, 27)], "purple_d")
        p.poly([(7, 25), (12, 24), (15, 27), (10, 31), (3, 30)], "purple_s", None)
        p.line([(5, 28), (8, 25), (11, 25)], "purple_l")
        p.poly([(24, 24), (28, 28), (29, 31), (21, 31), (18, 27)], "purple_s", None)
        p.poly([(13, 2), (19, 3), (24, 7), (27, 15), (25, 23), (19, 27),
                (9, 24), (5, 19), (6, 10), (10, 5)], "purple_s")
        p.poly([(11, 6), (15, 4), (13, 9), (9, 14), (8, 20), (6, 17), (8, 10)], "purple", None)
        p.line([(9, 9), (12, 6), (14, 5)], "purple_l")
        p.poly([(15, 7), (20, 8), (23, 12), (24, 19), (21, 23), (12, 23),
                (9, 18), (10, 13)], "ink")
        p.poly([(12, 13), (16, 11), (22, 13), (23, 17), (19, 20), (12, 18), (10, 16)], "skin_d", None)
        p.poly([(12, 14), (16, 13), (19, 14), (18, 17), (12, 16)], "skin", None)
        p.line([(11, 14), (15, 14)], "o")
        p.line([(19, 15), (22, 15)], "o")
        p.line([(12, 15), (14, 15)], "steel_l")
        p.line([(20, 16), (22, 16)], "lilac")
        p.poly([(10, 17), (16, 18), (23, 17), (23, 21), (19, 25), (13, 23)], "cloth")
        p.line([(12, 19), (16, 20), (21, 19)], "purple")
        p.line([(15, 23), (18, 24)], "purple_s")
        p.line([(24, 11), (25, 15), (25, 19)], "purple_d")
        p.poly([(20, 27), (23, 28), (19, 31), (16, 31)], "leather")
        p.dot(20, 29, "gold")
    else:
        p.poly([(9, 27), (16, 25), (23, 27), (28, 31), (4, 31)], "blue_d")
        p.line([(8, 29), (12, 28), (16, 30)], "gold")
        p.line([(19, 29), (23, 28), (26, 30)], "gold_d")
        p.poly([(10, 16), (23, 16), (25, 22), (23, 28), (19, 29), (11, 28), (8, 23)], "blue_l")
        p.poly([(10, 19), (12, 18), (12, 24), (10, 26), (9, 23)], "pale", None)
        p.poly([(13, 18), (20, 18), (23, 20), (22, 24), (18, 28), (13, 25), (11, 22)], "skin_d")
        p.poly([(13, 19), (19, 19), (20, 22), (18, 25), (14, 24), (12, 21)], "skin", None)
        p.line([(12, 21), (15, 21)], "o")
        p.line([(19, 21), (22, 21)], "o")
        p.dot(13, 22, "white")
        p.dot(20, 22, "pale")
        p.dot(17, 24, "skin_d")
        p.poly([(12, 24), (16, 25), (18, 26), (22, 24), (21, 28), (17, 31), (14, 29)], "blue_l")
        p.poly([(13, 25), (16, 26), (18, 28), (20, 26), (18, 29), (16, 29)], "pale", None)
        p.dot(14, 25, "white")
        p.poly([(5, 14), (11, 12), (23, 13), (28, 16), (27, 18), (19, 20), (9, 18), (3, 17)], "blue_d")
        p.poly([(5, 15), (11, 14), (22, 14), (25, 16), (17, 17), (9, 16)], "blue", None)
        p.line([(5, 15), (10, 14)], "blue_l")
        p.poly([(8, 14), (11, 8), (15, 4), (21, 1), (19, 5), (23, 9), (24, 14), (19, 16), (12, 16)], "blue_s")
        p.poly([(11, 12), (14, 6), (18, 4), (16, 7), (17, 9), (14, 13)], "blue", None)
        p.line([(13, 9), (15, 6), (18, 4)], "blue_l")
        p.poly([(9, 12), (15, 13), (23, 12), (24, 14), (19, 17), (12, 16), (8, 14)], "gold_d")
        p.line([(10, 13), (15, 14), (22, 13)], "gold")
        p.poly([(15, 13), (18, 12), (20, 14), (18, 17), (15, 16)], "gold")
        p.poly([(18, 13), (19, 14), (18, 16), (17, 15)], "cyan_d", None)
        p.dot(18, 14, "cyan")
    return p.image


def metadata(character):
    return {
        "frames": [{
            "filename": f"{character}-idle {i}",
            "frame": {"x": i * SIZE, "y": 0, "w": SIZE, "h": SIZE},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": SIZE, "h": SIZE},
            "sourceSize": {"w": SIZE, "h": SIZE},
            "duration": 1000 // FPS,
        } for i in range(COUNT)],
        "meta": {
            "app": "webdota/tools/portraits/generate.py",
            "version": "1",
            "image": f"{character}-idle.png",
            "format": "RGBA8888",
            "size": {"w": SIZE * COUNT, "h": SIZE},
            "scale": "1",
            "frameTags": [{"name": "idle", "from": 0, "to": COUNT - 1, "direction": "forward"}],
            "pixelfx": {
                "id": f"characters/{character}-idle", "name": f"{character} idle",
                "fps": FPS, "loop": True, "frames": COUNT,
                "frameSize": [SIZE, SIZE], "pivot": PIVOT, "columns": COUNT,
            },
        },
    }


def preview(animations, avatars):
    # 預覽可以有文字與底色，交付的角色 PNG 保持透明且不含文字。
    scale, gap, col = 4, 24, 408
    font = ImageFont.load_default(size=16)
    small = ImageFont.load_default(size=12)
    bg, panel, rule, text = "#10121c", "#181c2a", "#303649", "#dbe4ef"
    width = 3 * col + gap
    overview = Image.new("RGB", (width, 620), bg)
    d = ImageDraw.Draw(overview)
    d.fontmode = "1"
    for i, character in enumerate(animations):
        x = gap + i * col
        d.rounded_rectangle((x, 20, x + 384, 600), radius=8, fill=panel, outline=rule)
        d.text((x + 16, 34), character.upper(), font=font, fill=text)
        d.text((x + 16, 58), "96 x 96 / 8 frames / 8 fps / loop", font=small, fill="#98a8c3")
        overview.paste(animations[character][0].resize((384, 384), Image.Resampling.NEAREST),
                       (x, 83), animations[character][0].resize((384, 384), Image.Resampling.NEAREST))
        av = avatars[character].resize((128, 128), Image.Resampling.NEAREST)
        overview.paste(av, (x + 16, 466), av)
        d.text((x + 164, 492), "32 x 32 avatar", font=small, fill=text)
        d.text((x + 164, 516), "independent composition", font=small, fill="#98a8c3")
        d.text((x + 164, 552), "4x nearest-neighbor", font=small, fill="#98a8c3")
    save_preview(overview, "preview-overview.png")

    all_frames = Image.new("RGB", (width, 220 + COUNT * 410), bg)
    d = ImageDraw.Draw(all_frames)
    d.fontmode = "1"
    d.text((gap, 16), "WEBDOTA / ORIGINAL CHARACTER PIXELS / 2026-11-06", font=font, fill=text)
    for i, character in enumerate(animations):
        x = gap + i * col
        d.text((x + 152, 76), character.upper(), font=font, fill=text)
        d.text((x + 152, 104), "Every frame at 4x", font=small, fill="#98a8c3")
        av = avatars[character].resize((128, 128), Image.Resampling.NEAREST)
        all_frames.paste(av, (x + 8, 54), av)
        for f, frame in enumerate(animations[character]):
            y = 204 + f * 410
            d.rectangle((x, y, x + 383, y + 399), fill=panel, outline=rule)
            d.text((x + 8, y + 8), f"{f + 1:02d} / 08", font=small, fill="#98a8c3")
            large = frame.resize((384, 384), Image.Resampling.NEAREST)
            all_frames.paste(large, (x, y + 15), large)
    save_preview(all_frames, "preview-all-frames.png")

    # 逐角色分頁方便用一般圖片檢視器保持 4 倍像素檢查全部影格。
    for character, frames in animations.items():
        board = Image.new("RGB", (4 * col + gap, 96 + 2 * 410), bg)
        d = ImageDraw.Draw(board)
        d.fontmode = "1"
        d.text((gap, 18), f"{character.upper()} / ALL 8 IDLE FRAMES / 4x / 2026-11-06", font=font, fill=text)
        for f, frame in enumerate(frames):
            x, y = gap + (f % 4) * col, 72 + (f // 4) * 410
            d.rectangle((x, y, x + 383, y + 399), fill=panel, outline=rule)
            d.text((x + 8, y + 8), f"{f + 1:02d} / 08", font=small, fill="#98a8c3")
            large = frame.resize((384, 384), Image.Resampling.NEAREST)
            board.paste(large, (x, y + 15), large)
        save_preview(board, f"preview-{character}.png")


def save_preview(image, filename):
    assert image.getcolors(maxcolors=256) is not None
    indexed = image.convert("P", palette=Image.Palette.ADAPTIVE, colors=256, dither=Image.Dither.NONE)
    assert indexed.convert("RGB").tobytes() == image.tobytes()
    indexed.save(PREVIEW / filename, optimize=True)


def validate(animations, avatars):
    report = {"date": "2026-11-06", "characters": {}}
    for character, frames in animations.items():
        png = OUT / f"{character}-idle.png"
        data = json.loads((OUT / f"{character}-idle.json").read_text())
        sheet = Image.open(png).convert("RGBA")
        av = Image.open(OUT / f"{character}-avatar.png").convert("RGBA")
        assert sheet.size == (768, 96) and av.size == (32, 32)
        assert len(data["frames"]) == COUNT
        assert data["meta"]["image"] == png.name
        assert data["meta"]["size"] == {"w": sheet.width, "h": sheet.height}
        assert data["meta"]["pixelfx"]["pivot"] == PIVOT
        palette = {pixel[:3] for image in [sheet, av]
                   for _, pixel in image.getcolors(maxcolors=image.width * image.height) if pixel[3]}
        assert len(palette) <= 16, (character, len(palette))
        assert set(sheet.getchannel("A").tobytes()) == {0, 255}
        assert set(av.getchannel("A").tobytes()) == {0, 255}
        assert len({frame.tobytes() for frame in frames}) == COUNT
        bounds = []
        for i, frame in enumerate(frames):
            r = data["frames"][i]["frame"]
            assert r == {"x": i * SIZE, "y": 0, "w": SIZE, "h": SIZE}
            assert data["frames"][i]["duration"] == 125
            assert sheet.crop((r["x"], 0, r["x"] + SIZE, SIZE)).tobytes() == frame.tobytes()
            box = frame.getbbox()
            assert box[3] == 92 and 70 <= box[3] - box[1] <= 80, (character, i, box)
            assert box[0] > 0 and box[1] > 0 and box[2] < SIZE
            bounds.append(list(box))
        files = {p.name: p.stat().st_size for p in sorted(OUT.glob(f"{character}-*"))}
        report["characters"][character] = {
            "files_bytes": files, "colors": len(palette), "frames": COUNT,
            "fps": FPS, "loop": True, "pivot": PIVOT, "frameSize": [SIZE, SIZE],
            "columns": COUNT, "bounds": bounds,
        }
    for png in [*OUT.glob("*.png"), *PREVIEW.glob("*.png")]:
        assert png.stat().st_size <= 100_000, (png, png.stat().st_size)
    report["files"] = [
        {"path": str(p.relative_to(ROOT)), "bytes": p.stat().st_size,
         "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in sorted([*OUT.iterdir(), *PREVIEW.glob("*.png")]) if p.is_file()
    ]
    (PREVIEW / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    animations = {name: [draw(i) for i in range(COUNT)]
                  for name, draw in [("warrior", warrior), ("assassin", assassin), ("mage", mage)]}
    avatars = {name: avatar(name) for name in animations}
    for name, frames in animations.items():
        sheet = Image.new("RGBA", (SIZE * COUNT, SIZE))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (i * SIZE, 0))
        sheet.save(OUT / f"{name}-idle.png", optimize=True)
        avatars[name].save(OUT / f"{name}-avatar.png", optimize=True)
        (OUT / f"{name}-idle.json").write_text(json.dumps(metadata(name), indent=1) + "\n")
    preview(animations, avatars)
    validate(animations, avatars)


if __name__ == "__main__":
    main()
