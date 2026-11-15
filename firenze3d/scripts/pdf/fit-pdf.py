# Alinha o mapa de implantação do PDF ao referencial da maquete usando as
# torres já erguidas (medidas no satélite) e reposiciona as demais conforme o
# projeto. Uso: python scripts/pdf/fit-pdf.py
import json
import math
import os

import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..", "..")
towers = json.load(open(os.path.join(root, "src", "data", "towers.json"), encoding="utf-8"))["towers"]

cross = [k for k in json.load(open(os.path.join(here, "det_cross.json"))) if k[0] >= 0.6]
odd = [k for k in json.load(open(os.path.join(here, "det_odd.json"))) if k[0] >= 0.6]
# Duplicata vizinha da primeira barra do G13 e a barra do G17 encoberta pela via.
odd = [k for k in odd if not (abs(k[1] - 1506) < 3 and abs(k[2] - 414) < 3)]
odd.append([0.6, 2146, 487, -8.0])

SEEDS = {12: (668, 1025), 14: (632, 832), 16: (940, 700), 18: (1135, 695), 13: (1495, 573), 15: (1640, 630), 17: (2070, 590)}
pdf = {g: [] for g in SEEDS}
for _, x, y, a in cross:
    pdf[min((12, 14, 16, 18), key=lambda g: (x - SEEDS[g][0]) ** 2 + (y - SEEDS[g][1]) ** 2)].append((x, y, a))
for _, x, y, a in odd:
    pdf[min((13, 15, 17), key=lambda g: (x - SEEDS[g][0]) ** 2 + (y - SEEDS[g][1]) ** 2)].append((x, y, a))
print({g: len(v) for g, v in pdf.items()})


def umeyama(src, dst):
    src, dst = np.asarray(src, float), np.asarray(dst, float)
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    U, S, Vt = np.linalg.svd(b.T @ a / len(src))
    D = np.eye(2)
    if np.linalg.det(U @ Vt) < 0:
        D[1, 1] = -1
    R = U @ D @ Vt
    s = np.trace(np.diag(S) @ D) / (a ** 2).sum(1).mean()
    return s, R, md - s * R @ ms


def apply(T, p):
    return (T[0] * (T[1] @ np.asarray(p, float).T)).T + T[2]


gs = sorted(SEEDS)
T = umeyama(
    [np.mean([(x, y) for x, y, _ in pdf[g]], 0) for g in gs],
    [np.mean([(t["x"], t["z"]) for t in towers if t["group"] == g], 0) for g in gs],
)
for _ in range(8):
    S, D = [], []
    for g in gs:
        P = apply(T, [(x, y) for x, y, _ in pdf[g]])
        for t in (t for t in towers if t["group"] == g and t["built"]):
            i = int(np.hypot(P[:, 0] - t["x"], P[:, 1] - t["z"]).argmin())
            S.append(pdf[g][i][:2])
            D.append((t["x"], t["z"]))
    T = umeyama(S, D)
res = np.hypot(*(apply(T, S) - np.asarray(D)).T)
rot = math.degrees(math.atan2(T[1][1, 0], T[1][0, 0]))
print(f"escala {T[0]:.4f} m/px · giro {rot:.2f}° · resíduo das erguidas: média {res.mean():.2f} m, máx {res.max():.2f} m")

moved = []
for g in gs:
    P = apply(T, [(x, y) for x, y, _ in pdf[g]])
    ts = [t for t in towers if t["group"] == g]
    C = np.array([[math.hypot(p[0] - t["x"], p[1] - t["z"]) * (3 if t["built"] else 1) for p in P] for t in ts])
    for i, j in zip(*linear_sum_assignment(C)):
        t = ts[i]
        moved.append({**t, "nx": round(float(P[j][0]), 1), "nz": round(float(P[j][1]), 1),
                      "moved": round(float(math.hypot(P[j][0] - t["x"], P[j][1] - t["z"])), 1)})
for n in moved:
    print(f'{n["id"]:6} {"erguida" if n["built"] else "prevista":8} ({n["x"]:7.1f},{n["z"]:7.1f}) -> ({n["nx"]:7.1f},{n["nz"]:7.1f})  {n["moved"]:5.1f} m')

json.dump({"s": T[0], "R": T[1].tolist(), "t": T[2].tolist(), "residual": float(res.mean())},
          open(os.path.join(here, "pdf-transform.json"), "w"), indent=1)

# Torres previstas passam para a posição do projeto; as erguidas mantêm a medição do satélite.
path = os.path.join(root, "src", "data", "towers.json")
data = json.load(open(path, encoding="utf-8"))
by_id = {n["id"]: n for n in moved}
for tw in data["towers"]:
    if not tw["built"]:
        tw["x"], tw["z"] = by_id[tw["id"]]["nx"], by_id[tw["id"]]["nz"]
    tw.pop("source", None)
    tw["source"] = "satelite" if tw["built"] else "projeto"
for grp in data["groups"]:
    ts = [tw for tw in data["towers"] if tw["group"] == grp["id"]]
    grp["center"] = [round(sum(tw["x"] for tw in ts) / len(ts), 1), round(sum(tw["z"] for tw in ts) / len(ts), 1)]
json.dump(data, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# Sobreposição do mapa no satélite, para conferência visual.
geo = json.load(open(os.path.join(root, "public", "geo", "geo.json"), encoding="utf-8"))
sat = cv2.imread(os.path.join(root, "public", "geo", "sat.jpg"))
H, W = sat.shape[:2]
sm = geo["sat"]
sx, sz = W / (sm["maxX"] - sm["minX"]), H / (sm["maxZ"] - sm["minZ"])
A = T[0] * T[1]
Maff = np.array([[sx * A[0, 0], sx * A[0, 1], sx * (T[2][0] - sm["minX"])],
                 [sz * A[1, 0], sz * A[1, 1], sz * (T[2][1] - sm["minZ"])]])
warp = cv2.warpAffine(cv2.imread(os.path.join(here, "implantacao.png")), Maff, (W, H))
mask = warp.sum(2) > 30
blend = sat.copy()
blend[mask] = (0.45 * sat[mask] + 0.55 * warp[mask]).astype(np.uint8)
px = lambda x, z: (int((x - sm["minX"]) * sx), int((z - sm["minZ"]) * sz))
for n in moved:
    cv2.circle(blend, px(n["x"], n["z"]), 6, (0, 0, 255) if n["built"] else (0, 255, 255), 2)
    cv2.circle(blend, px(n["nx"], n["nz"]), 3, (255, 0, 255), -1)
xs, zs = [n["nx"] for n in moved], [n["nz"] for n in moved]
(x0, z0), (x1, z1) = px(min(xs) - 260, min(zs) - 260), px(max(xs) + 260, max(zs) + 260)
crop = blend[max(0, z0):z1, max(0, x0):x1]
cv2.imwrite(os.path.join(here, "overlay.jpg"), cv2.resize(crop, None, fx=1000 / crop.shape[1], fy=1000 / crop.shape[1]))
