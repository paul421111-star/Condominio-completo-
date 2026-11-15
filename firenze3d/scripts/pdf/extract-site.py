# Extrai do mapa de implantação do manual de Comunicação Visual (PE06) os
# elementos do condomínio, já no referencial da maquete:
#   public/geo/siteplan.png  textura do projeto (mata e entorno transparentes)
#   src/data/siteplan.json   pódios, piscinas, represas e portarias
# Requer pdf-transform.json (fit-pdf.py). Uso: python scripts/pdf/extract-site.py
import json
import math
import os

import cv2
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..", "..")
T = json.load(open(os.path.join(here, "pdf-transform.json")))
S, R, t = T["s"], np.array(T["R"]), np.array(T["t"])
Rinv = R.T
towers = json.load(open(os.path.join(root, "src", "data", "towers.json"), encoding="utf-8"))

im = cv2.imread(os.path.join(here, "implantacao.png"))
H, W = im.shape[:2]
b, g, r = [im[:, :, i].astype(np.int16) for i in range(3)]
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
hue, sat, val = [hsv[:, :, i].astype(np.int16) for i in range(3)]
neutral = (np.abs(r - g) < 18) & (np.abs(g - b) < 18) & (np.abs(r - b) < 22)
outside = (gray < 25) | ((r > 225) & (g > 215) & (b > 210))
K = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))


def to_scene(pts):
    p = (S * (R @ np.asarray(pts, float).T)).T + t
    return [[round(float(x), 1), round(float(z), 1)] for x, z in p]


def to_px(x, z):
    return (Rinv @ ((np.array([x, z], float) - t) / S)).tolist()


def clean(mask, close=5, open_=5):
    m = mask.astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, K(close))
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, K(open_))


def polys(mask, min_area, eps):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [a for a in (cv2.approxPolyDP(c, eps, True).reshape(-1, 2) for c in cs if cv2.contourArea(c) >= min_area) if len(a) >= 3]


pool = clean((hue > 85) & (hue < 105) & (sat > 120) & (val > 170), 3, 3)
lake = clean((hue > 80) & (hue < 100) & (sat > 90) & (val > 90) & (val <= 200), 9, 7)
lake = cv2.bitwise_and(lake, cv2.bitwise_not(cv2.dilate(pool, K(9))))
road = clean(neutral & (gray >= 62) & (gray < 112) & ~outside, 9, 5)
deck = clean(neutral & (gray >= 112) & (gray < 215) & ~outside, 11, 9)
deck = cv2.bitwise_and(deck, cv2.bitwise_not(road))
deck = cv2.morphologyEx(deck, cv2.MORPH_OPEN, K(15))

# ---- Pódios: só os que contêm torres; o grupo vem das torres de dentro ----
decks = []
for p in polys(deck, 2500, 3.0):
    poly = to_scene(p)
    contour = np.array(poly, np.float32).reshape(-1, 1, 2)
    gs = sorted({tw["group"] for tw in towers["towers"] if cv2.pointPolygonTest(contour, (tw["x"], tw["z"]), False) >= 0})
    if gs:
        decks.append({"groups": gs, "poly": poly})
print("pódios", [d["groups"] for d in decks])


def road_yaw(px, py, rad=40):
    """Direção (rad, no referencial da cena) do asfalto em volta de um ponto do mapa."""
    x0, y0 = int(px) - rad, int(py) - rad
    win = road[max(0, y0):y0 + 2 * rad, max(0, x0):x0 + 2 * rad]
    ys, xs = np.nonzero(win)
    if len(xs) < 30:
        return 0.0
    pts = np.stack([xs, ys], 1).astype(float)
    pts -= pts.mean(0)
    w, v = np.linalg.eigh(pts.T @ pts)
    d = R @ v[:, 1]
    return math.atan2(d[1], d[0])


# ---- Portarias principais (marcadores vermelhos do PE06) ----
GATES = [
    ("portaria-01", "Portaria 01", "Estrada São Judas", (503, 917)),
    ("portaria-02", "Portaria 02", "Rodovia Régis Bittencourt · BR-116", (1226, 1033)),
    ("portaria-03", "Portaria 03", "Av. João Paulo I", (2242, 442)),
]
gates = []
for gid, name, street, (px, py) in GATES:
    x, z = to_scene([(px, py)])[0]
    gates.append({"id": gid, "name": name, "street": street, "x": x, "z": z, "roadYaw": round(road_yaw(px, py), 3)})

# ---- Portarias sociais dos subcondomínios (pinos de cada grupo) ----
social = []
for grp in towers["groups"]:
    px, py = to_px(*grp["pin"])
    social.append({"group": grp["id"], "x": grp["pin"][0], "z": grp["pin"][1], "roadYaw": round(road_yaw(px, py, 50), 3)})

# ---- Textura do projeto ----
paint = im.copy()
text = ((gray > 228) & neutral).astype(np.uint8) * 255
marker = ((r > 200) & (g < 80) & (b < 80)).astype(np.uint8) * 255
paint = cv2.inpaint(paint, cv2.dilate(cv2.bitwise_or(text, marker), K(5)), 4, cv2.INPAINT_TELEA)

g32 = gray.astype(np.float32)
std = np.sqrt(np.maximum(cv2.blur(g32 * g32, (9, 9)) - cv2.blur(g32, (9, 9)) ** 2, 0))
greenish = (g > r + 12) & (g > b + 6)
forest = greenish & (std > 13)
orange = (hue >= 8) & (hue <= 28) & (sat > 120)
body = cv2.morphologyEx((~outside).astype(np.uint8), cv2.MORPH_OPEN, K(7))
n, lab, stats, _ = cv2.connectedComponentsWithStats(body)
largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
keep = (lab == largest) & ~(outside | orange)
keep &= ~clean(forest, 7, 9).astype(bool)
alpha = cv2.GaussianBlur(keep.astype(np.uint8) * 255, (7, 7), 0)

ys, xs = np.nonzero(alpha > 8)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
rgba = np.dstack([paint, alpha])[y0:y1, x0:x1]
cv2.imwrite(os.path.join(root, "public", "geo", "siteplan.png"), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])

# uv = M · (x, z, 1): cena -> pixel do mapa -> uv do recorte
A = Rinv / S
c = -A @ t
w, h = x1 - x0, y1 - y0
M = [[A[0, 0] / w, A[0, 1] / w, (c[0] - x0) / w],
     [A[1, 0] / h, A[1, 1] / h, (c[1] - y0) / h]]

res = {
    "source": "Comunicação Visual · Residencial Parque Firenze R01 (19/06/2023) · mapa de implantação PE06",
    "plan": {"url": "geo/siteplan.png", "uv": [[round(v, 8) for v in row] for row in M], "metersPerPixel": round(S, 4)},
    "decks": decks,
    "pools": [to_scene(p) for p in polys(pool, 150, 1.5)],
    "lakes": [to_scene(p) for p in polys(lake, 2500, 3.0)],
    "gates": gates,
    "socialGates": social,
}
json.dump(res, open(os.path.join(root, "src", "data", "siteplan.json"), "w", encoding="utf-8"), ensure_ascii=False)
print({k: len(v) for k, v in res.items() if isinstance(v, list)}, "textura", w, "x", h)
