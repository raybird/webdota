"""
arena_v2 地圖佈局（2026-11-10 草圖確認，見 docs/gameplay-v2/maps/arena_v2.md）

只寫藍方那一半，紅方以原點點對稱 (x, z) -> (-x, -z) 產生，兩隊條件完全相同。
座標為世界座標：x 為藍方畫面上方，z 為藍方畫面右方（見 src/core/view.ts），
所以藍方主堡在畫面左下、紅方主堡在右上。牆一律與座標軸平行，像素貼圖才能正對鏡頭。

用法：
  python3 tools/maps/arena_v2_layout.py            寫入 src/data/maps/arena_v2.json 與 docs/gameplay-v2/maps/arena_v2.svg
  python3 tools/maps/arena_v2_layout.py <目錄>     只把草圖、預覽 PNG 與佈局 JSON 輸出到該目錄
"""

import json
import math
import sys
from pathlib import Path

HALF = 48  # 地圖 96×96
WALL = 2  # 外牆厚度

# ---- 建築（藍方；紅方點對稱） ----
BASE = (-38, -38)
TOWERS = [  # 由外到內：外塔、內塔、主堡前塔
    ("outer", (-12, -12)),
    ("inner", (-22, -22)),
    ("front", (-30, -30)),
]
SPAWN_HERO = (-36, -40)  # 重生點：GameEngine.getRespawnPosition 再往中央移 7 → (-36, -33)，在泉水內
CREEP_SPAWN = (-33, -33)  # 小兵出生點：主堡前方，避開主堡碰撞體

# 小兵中繼點：沿主路中線，最後一點是敵方主堡前；中央柱由移動碰撞繞過，不設中繼點
WAYPOINTS = [(-33, -33), (-20, -20), (20, 20), (33, 33)]

# ---- 主路與野區邊界 ----
# 主路沿對角線 x = z。上側野區（藍方畫面左上）介於兩道階梯牆之間：
#   主路邊界 x - z = LANE_EDGE，野區外緣 x - z = JUNGLE_EDGE（更外側的角落封閉、不能走）。
# 階梯由每段 STEP 的 L 形牆組成，轉角落在邊界線上。
LANE_EDGE = 18
JUNGLE_EDGE = 62
STEP = 8
# 野區入口：主路邊界上拿掉的段落，以 s = x + z 標示（藍方近端、紅方近端各一）
ENTRANCES = [-32, 32]


def stair_start(c):
    """階梯第一段的 z；對齊成每段中點的 s = x + z 為 2*STEP 的倍數，入口才能左右對稱"""
    z0 = -HALF - c - STEP
    return z0 - ((2 * z0 + c + STEP) % (2 * STEP)) / 2


def lane_uv(x, z):
    """世界座標轉主路座標：u 沿主路（藍 → 紅），v 垂直主路（正值為藍方畫面左上）"""
    return ((x + z) / math.sqrt(2), (x - z) / math.sqrt(2))


def clip(walls):
    out = []
    lo, hi = -HALF + WALL, HALF - WALL
    for w in walls:
        x0, x1 = max(lo, w["x"] - w["w"] / 2), min(hi, w["x"] + w["w"] / 2)
        z0, z1 = max(lo, w["z"] - w["d"] / 2), min(hi, w["z"] + w["d"] / 2)
        if x1 - x0 > 0.5 and z1 - z0 > 0.5:
            out.append({**w, "x": (x0 + x1) / 2, "z": (z0 + z1) / 2, "w": x1 - x0, "d": z1 - z0})
    return out


def staircase(c, gaps=()):
    """轉角在 x - z = c 上的 L 形階梯牆；gaps 為要留空的段落（s = x + z 的值）"""
    walls = []
    z = stair_start(c)
    while z + c < HALF:
        x = z + c
        s_mid = x + z + STEP
        if not any(abs(s_mid - g) < STEP for g in gaps):
            walls.append({"kind": "wall", "x": x, "z": z + STEP / 2, "w": WALL, "d": STEP + WALL})
            walls.append({"kind": "wall", "x": x + STEP / 2, "z": z + STEP, "w": STEP + WALL, "d": WALL})
        z += STEP
    return clip(walls)


def staircase_outline(c):
    """階梯牆的折線（轉角在 x - z = c 上），裁到地圖內；用來畫出外側封閉區"""
    lim = HALF - WALL
    pts = []
    z = stair_start(c)
    while z + c < HALF:
        x = z + c
        pts += [(x, z), (x, z + STEP)]
        z += STEP
    inside = [(x, z) for x, z in pts if -lim <= x <= lim and -lim <= z <= lim]
    # 前後補上折線碰到外牆的點
    first, last = inside[0], inside[-1]
    return [(first[0], -lim)] + inside + [(lim, last[1])]


def dead_zone(c):
    """上側野區外緣以外、不能走的角落（藍方畫面左上角）"""
    lim = HALF - WALL
    return staircase_outline(c) + [(lim, -lim)]


def ring(cx, cz, half=6, arm=4):
    """四角 L 形斷牆圍出的空地，四邊中間各留一個開口"""
    walls = []
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = cx + sx * half, cz + sz * half
            walls.append({"kind": "wall", "x": x, "z": z - sz * arm / 2, "w": WALL, "d": arm + WALL})
            walls.append({"kind": "wall", "x": x - sx * arm / 2, "z": z, "w": arm + WALL, "d": WALL})
    return walls


OBJECTIVE = (18, -18)  # 上側野區中央空地（預留給之後的野怪或目標點）

JUNGLE = (
    staircase(LANE_EDGE, ENTRANCES)
    + staircase(JUNGLE_EDGE)
    + ring(*OBJECTIVE)
    + [
        # 入口內側的掩體，讓入口不是一眼看穿
        {"kind": "crate", "x": 1, "z": -31, "w": 3, "d": 3},
        {"kind": "crate", "x": 31, "z": 1, "w": 3, "d": 3},
    ]
)

# 草叢（矩形，不擋路；規則見 F7）
BRUSH = [
    # 主路邊、外塔之間的凹處（兩隊都會經過）
    {"x": 1.5, "z": -9.5, "w": 4, "d": 4},
    # 入口內側
    {"x": -3, "z": -29, "w": 5, "d": 4},
    {"x": 29, "z": -3, "w": 4, "d": 5},
    # 空地外圍、兩條路線交會處
    {"x": 30, "z": -12, "w": 4, "d": 4},
    {"x": 12, "z": -30, "w": 4, "d": 4},
]


def mirror_point(p):
    return (-p[0], -p[1])


def mirror_rect(r):
    m = dict(r)
    m["x"], m["z"] = -r["x"], -r["z"]
    return m


def build():
    obstacles = JUNGLE + [mirror_rect(o) for o in JUNGLE]
    # 中央柱
    obstacles.append({"kind": "pillar", "x": 0, "z": 0, "r": 1.5})
    brush = BRUSH + [mirror_rect(b) for b in BRUSH]
    structures = []
    for team, f in (("blue", lambda p: p), ("red", mirror_point)):
        structures.append({"kind": "base", "team": team, "pos": f(BASE)})
        for name, p in TOWERS:
            structures.append({"kind": name, "team": team, "pos": f(p)})
    return {
        "obstacles": obstacles,
        "brush": brush,
        "structures": structures,
        "waypoints": WAYPOINTS,
        "objectives": [OBJECTIVE, mirror_point(OBJECTIVE)],
        "deadZones": [dead_zone(JUNGLE_EDGE), [mirror_point(q) for q in dead_zone(JUNGLE_EDGE)]],
        "spawns": {"blue": [SPAWN_HERO, CREEP_SPAWN], "red": [mirror_point(SPAWN_HERO), mirror_point(CREEP_SPAWN)]},
    }


def dead_rects(c):
    """上側野區外緣以外的封閉區，拆成矩形（每階一條），給移動碰撞用；延伸到階梯牆內側，不留縫"""
    lim = HALF - WALL
    rects = []
    z = stair_start(c)
    while z + c < HALF:
        x0, x1 = max(z + c, -lim), min(z + c + STEP, lim)
        z1 = min(z + STEP, lim)
        if x1 - x0 > 0.5 and z1 + lim > 0.5:
            rects.append({"x": (x0 + x1) / 2, "z": (z1 - lim) / 2, "w": x1 - x0, "d": z1 + lim})
        z += STEP
    return rects


def map_config(layout):
    """遊戲用的地圖設定（MapConfig，見 src/core/map/MapData.ts）"""
    blocks = []
    edge = HALF - WALL / 2
    for name, x, z, w, d in (("north", -edge, 0, WALL, HALF * 2), ("south", edge, 0, WALL, HALF * 2),
                             ("west", 0, -edge, HALF * 2, WALL), ("east", 0, edge, HALF * 2, WALL)):
        blocks.append({"id": f"wall_{name}", "type": "box", "position": [x, 2, z], "scale": [w, 4, d], "material": "wall_stone"})
    for i, o in enumerate(layout["obstacles"]):
        if o["kind"] == "pillar":
            blocks.append({"id": f"pillar_{i}", "type": "cylinder", "position": [o["x"], 3, o["z"]],
                           "scale": [o["r"] * 2, 6, o["r"] * 2], "material": "pillar_dark"})
        else:
            material = "obstacle_wood" if o["kind"] == "crate" else "wall_stone"
            blocks.append({"id": f"{o['kind']}_{i}", "type": "box", "position": [o["x"], 1, o["z"]],
                           "scale": [o["w"], 2, o["d"]], "material": material})
    for team, (x, z) in (("blue", BASE), ("red", mirror_point(BASE))):
        blocks.append({"id": f"{team}_base_marker", "type": "box", "position": [x, 0.1, z], "scale": [8, 0.2, 8],
                       "material": f"highlight_{team}", "isCollider": False})
    entities = []
    power = {"outer": 80, "inner": 100, "front": 100}
    order = {"outer": 1, "inner": 2, "front": 3}
    for team, f in (("blue", lambda p: p), ("red", mirror_point)):
        hx, hz = f(SPAWN_HERO)
        cx, cz = f(CREEP_SPAWN)
        entities.append({"type": "spawn_point", "team": team, "position": [hx, 1, hz]})
        entities.append({"type": "creep_spawn", "team": team, "position": [cx, 1, cz]})
    for st in layout["structures"]:
        x, z = st["pos"]
        if st["kind"] == "base":
            config = {"maxHp": 5000, "attackRange": 8, "order": 4}
        else:
            config = {"attackRange": 10, "attackPower": power[st["kind"]], "order": order[st["kind"]]}
        entities.append({"type": "base" if st["kind"] == "base" else "tower", "team": st["team"],
                         "position": [x, 0, z], "config": config})
    dead = dead_rects(JUNGLE_EDGE)
    return {
        "id": "arena_v2",
        "name": "斷牆古道",
        "size": {"w": HALF * 2, "h": HALF * 2},
        "environment": {"skyColor": [0.05, 0.05, 0.15], "ambientIntensity": 1.2, "groundColor": [0.15, 0.25, 0.15]},
        "materials": {
            "wall_stone": {"color": [0.4, 0.4, 0.45], "roughness": 0.8},
            "pillar_dark": {"color": [0.25, 0.25, 0.3], "roughness": 0.6},
            "obstacle_wood": {"color": [0.5, 0.35, 0.2], "roughness": 0.7},
            "highlight_blue": {"color": [0.2, 0.4, 0.8], "emissive": [0.1, 0.2, 0.4]},
            "highlight_red": {"color": [0.8, 0.3, 0.2], "emissive": [0.4, 0.15, 0.1]},
        },
        "blocks": blocks,
        "entities": entities,
        "lanes": {"blue": [list(p) for p in WAYPOINTS], "red": [list(mirror_point(p)) for p in reversed(WAYPOINTS)]},
        "brush": layout["brush"],
        "deadZones": dead + [mirror_rect({**r, "kind": "dead"}) for r in dead],
    }


# ---- 繪圖 ----
SCALE = 8  # 每單位像素
PAD = 40
SIZE = HALF * 2 * SCALE + PAD * 2
COLORS = {
    "ground": "#3f6b3a", "lane": "#8a7650", "wall": "#9a9aa6", "pillar": "#55556a", "crate": "#8b5a2b",
    "brush": "#1f7a3a", "blue": "#3b82f6", "red": "#ef4444", "path": "#f5e6b0", "text": "#ffffff",
}


def to_px(x, z):
    """藍方視角：z 往右、x 往上"""
    return PAD + (z + HALF) * SCALE, PAD + (HALF - x) * SCALE


def rect_px(o):
    x0, y0 = to_px(o["x"] + o["w"] / 2, o["z"] - o["d"] / 2)
    return x0, y0, o["d"] * SCALE, o["w"] * SCALE


def svg(layout):
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE + 80}" font-family="sans-serif">']
    s.append(f'<rect width="{SIZE}" height="{SIZE + 80}" fill="#14121f"/>')
    gx, gy = to_px(HALF, -HALF)
    s.append(f'<rect x="{gx}" y="{gy}" width="{HALF * 2 * SCALE}" height="{HALF * 2 * SCALE}" fill="{COLORS["ground"]}"/>')
    for zone in layout["deadZones"]:
        pts = " ".join(f"{to_px(x, z)[0]},{to_px(x, z)[1]}" for x, z in zone)
        s.append(f'<polygon points="{pts}" fill="#26262e"/>')
    # 主路（示意：中線兩側各 9）
    a, b = to_px(-HALF + WALL, -HALF + WALL), to_px(HALF - WALL, HALF - WALL)
    s.append(f'<clipPath id="map"><rect x="{gx}" y="{gy}" width="{HALF * 2 * SCALE}" height="{HALF * 2 * SCALE}"/></clipPath>')
    s.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="{COLORS["lane"]}" stroke-width="{24 / math.sqrt(2) * SCALE}" opacity="0.55" clip-path="url(#map)"/>')
    # 外牆
    s.append(f'<rect x="{gx}" y="{gy}" width="{HALF * 2 * SCALE}" height="{HALF * 2 * SCALE}" fill="none" stroke="{COLORS["wall"]}" stroke-width="{WALL * SCALE}"/>')
    for br in layout["brush"]:
        x, y, w, h = rect_px(br)
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{COLORS["brush"]}" stroke="#4ade80" stroke-dasharray="4 3"/>')
    for o in layout["obstacles"]:
        if o["kind"] == "pillar":
            cx, cy = to_px(o["x"], o["z"])
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{o["r"] * SCALE}" fill="{COLORS["pillar"]}" stroke="#222"/>')
        else:
            x, y, w, h = rect_px(o)
            s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{COLORS[o["kind"]]}" stroke="#222"/>')
    # 小兵路線
    pts = " ".join(f"{to_px(x, z)[0]},{to_px(x, z)[1]}" for x, z in layout["waypoints"])
    s.append(f'<polyline points="{pts}" fill="none" stroke="{COLORS["path"]}" stroke-width="3" stroke-dasharray="10 6"/>')
    for x, z in layout["waypoints"]:
        cx, cy = to_px(x, z)
        s.append(f'<circle cx="{cx}" cy="{cy}" r="4" fill="{COLORS["path"]}"/>')
    for x, z in layout["objectives"]:
        cx, cy = to_px(x, z)
        s.append(f'<circle cx="{cx}" cy="{cy}" r="{3 * SCALE}" fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="6 4"/>')
    labels = {"base": "主堡", "outer": "外塔", "inner": "內塔", "front": "前塔"}
    for st in layout["structures"]:
        cx, cy = to_px(*st["pos"])
        c = COLORS[st["team"]]
        if st["kind"] == "base":
            s.append(f'<rect x="{cx - 2.5 * SCALE}" y="{cy - 2.5 * SCALE}" width="{5 * SCALE}" height="{5 * SCALE}" fill="{c}" stroke="#fff" stroke-width="2"/>')
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{6 * SCALE}" fill="none" stroke="{c}" stroke-dasharray="3 3"/>')
        else:
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{10 * SCALE}" fill="{c}" opacity="0.08"/>')
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{1.2 * SCALE}" fill="{c}" stroke="#fff" stroke-width="2"/>')
        s.append(f'<text x="{cx}" y="{cy - 2 * SCALE - 4}" fill="{COLORS["text"]}" font-size="13" text-anchor="middle">{labels[st["kind"]]}</text>')
    for team, pts in layout["spawns"].items():
        hx, hz = pts[0]
        cx, cy = to_px(hx + (7 if team == "blue" else -7) * 0, hz + (7 if team == "blue" else -7))
        s.append(f'<text x="{cx}" y="{cy + 4}" fill="#fff" font-size="12" text-anchor="middle">★</text>')
    # 圖例
    ly = SIZE + 10
    items = [("wall", "牆／斷牆"), ("pillar", "柱子"), ("crate", "木箱"), ("brush", "草叢"), ("path", "小兵路線")]
    for i, (k, name) in enumerate(items):
        x = PAD + i * 140
        s.append(f'<rect x="{x}" y="{ly}" width="18" height="18" fill="{COLORS[k]}"/>')
        s.append(f'<text x="{x + 26}" y="{ly + 14}" fill="#ddd" font-size="14">{name}</text>')
    s.append(f'<text x="{PAD}" y="{ly + 40}" fill="#aaa" font-size="13">藍方視角（紅方畫面相同、轉 180°）。淡色圓為塔射程 10，虛線圓為泉水半徑 6，</text>')
    s.append(f'<text x="{PAD}" y="{ly + 58}" fill="#aaa" font-size="13">黃虛線圓為野區中央空地，★ 為重生點，深色為封閉區。1 單位 = {SCALE}px，地圖 {HALF * 2}×{HALF * 2}。</text>')
    s.append("</svg>")
    return "\n".join(s)


def png(layout, path):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (SIZE, SIZE), "#14121f")
    d = ImageDraw.Draw(img)
    gx, gy = to_px(HALF, -HALF)
    d.rectangle([gx, gy, gx + HALF * 2 * SCALE, gy + HALF * 2 * SCALE], fill=COLORS["ground"])
    # 主路帶：|x - z| <= 12
    for px in range(int(gx), int(gx + HALF * 2 * SCALE), 2):
        for py in range(int(gy), int(gy + HALF * 2 * SCALE), 2):
            z = (px - PAD) / SCALE - HALF
            x = HALF - (py - PAD) / SCALE
            if abs(x - z) <= 12:
                d.rectangle([px, py, px + 1, py + 1], fill=COLORS["lane"])

    for zone in layout["deadZones"]:
        d.polygon([to_px(x, z) for x, z in zone], fill="#26262e")
    for br in layout["brush"]:
        x, y, w, h = rect_px(br)
        d.rectangle([x, y, x + w, y + h], fill=COLORS["brush"], outline="#4ade80")
    for o in layout["obstacles"]:
        if o["kind"] == "pillar":
            cx, cy = to_px(o["x"], o["z"])
            r = o["r"] * SCALE
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=COLORS["pillar"])
        else:
            x, y, w, h = rect_px(o)
            d.rectangle([x, y, x + w, y + h], fill=COLORS[o["kind"]], outline="#222")
    d.rectangle([gx, gy, gx + HALF * 2 * SCALE, gy + HALF * 2 * SCALE], outline=COLORS["wall"], width=WALL * SCALE)
    pts = [to_px(x, z) for x, z in layout["waypoints"]]
    d.line(pts, fill=COLORS["path"], width=3)
    for x, z in layout["objectives"]:
        cx, cy = to_px(x, z)
        d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], outline="#facc15", width=2)
    for st in layout["structures"]:
        cx, cy = to_px(*st["pos"])
        c = COLORS[st["team"]]
        if st["kind"] == "base":
            d.rectangle([cx - 20, cy - 20, cx + 20, cy + 20], fill=c, outline="#fff", width=2)
            d.ellipse([cx - 48, cy - 48, cx + 48, cy + 48], outline=c, width=1)
        else:
            d.ellipse([cx - 80, cy - 80, cx + 80, cy + 80], outline=c, width=1)
            d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=c, outline="#fff", width=2)
    img.save(path)


def write_json(path, data):
    text = json.dumps(data, ensure_ascii=False, indent=1)
    path.write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    layout = build()
    if len(sys.argv) > 1:
        out = Path(sys.argv[1])
        out.mkdir(parents=True, exist_ok=True)
        (out / "arena_v2.svg").write_text(svg(layout), encoding="utf-8")
        png(layout, out / "arena_v2.png")
        write_json(out / "arena_v2.layout.json", layout)
    else:
        root = Path(__file__).resolve().parents[2]
        config = map_config(layout)
        for r in config["deadZones"]:
            r.pop("kind", None)
        write_json(root / "src/data/maps/arena_v2.json", config)
        (root / "docs/gameplay-v2/maps/arena_v2.svg").write_text(svg(layout), encoding="utf-8")
        print(f"blocks={len(config['blocks'])} entities={len(config['entities'])} deadZones={len(config['deadZones'])}")
