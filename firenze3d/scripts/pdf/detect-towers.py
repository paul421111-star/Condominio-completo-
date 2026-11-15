# Detecta as torres no mapa de implantação do manual de Comunicação Visual
# (PE06, p. 62) por casamento de padrão do contorno escuro de cada torre.
# Uso: python scripts/pdf/detect-towers.py   (gera det_cross.json e det_odd.json)
import json
import os

import cv2
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
im = cv2.imread(os.path.join(here, "implantacao.png"))
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
b, g, r = [im[:, :, i].astype(np.float32) for i in range(3)]
neutral = (np.abs(r - g) < 14) & (np.abs(g - b) < 14)
dark = cv2.GaussianBlur(np.clip(118 - gray, 0, 40) * neutral, (3, 3), 0)

# Torre em cruz (pares) e torre em barra (ímpares), recortadas do próprio mapa.
KINDS = {
    "cross": {"at": (612, 803), "r": 34, "angles": range(0, 90, 2), "sep": 45},
    "odd": {"at": (1537, 420), "r": 32, "angles": range(-90, 90, 2), "sep": 30},
}

for tag, k in KINDS.items():
    (cx, cy), rr = k["at"], k["r"]
    tpl = dark[cy - rr:cy + rr, cx - rr:cx + rr].copy()
    best = np.zeros_like(gray)
    bang = np.zeros_like(gray)
    for ang in k["angles"]:
        M = cv2.getRotationMatrix2D((rr, rr), ang, 1.0)
        res = cv2.matchTemplate(dark, cv2.warpAffine(tpl, M, (2 * rr, 2 * rr)), cv2.TM_CCOEFF_NORMED)
        pad = np.zeros_like(gray)
        pad[rr:rr + res.shape[0], rr:rr + res.shape[1]] = res
        m = pad > best
        best[m] = pad[m]
        bang[m] = ang
    ys, xs = np.where(best > 0.30)
    keep = []
    for s, x, y, a in sorted(((best[y, x], x, y, bang[y, x]) for x, y in zip(xs, ys)), reverse=True):
        if all((x - q[1]) ** 2 + (y - q[2]) ** 2 > k["sep"] ** 2 for q in keep):
            keep.append((float(s), int(x), int(y), float(a)))
    json.dump(keep, open(os.path.join(here, f"det_{tag}.json"), "w"))
    print(tag, sum(1 for q in keep if q[0] >= 0.6), "torres")
