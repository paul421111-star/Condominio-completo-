// Converte os dados reais (OSM, satélite Esri, relevo Terrarium) para o
// referencial local da maquete: metros, x = leste, z = sul, origem em ORIGIN.
// Uso: node scripts/prep-geo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (p) => path.join(here, '..', p);

const ORIGIN = { lat: -23.6322, lon: -46.8180 };
const M_LAT = 110574;
const M_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLocal = (lat, lon) => [
  +((lon - ORIGIN.lon) * M_LON).toFixed(1),
  +(-(lat - ORIGIN.lat) * M_LAT).toFixed(1),
];

const tileLon = (x, z) => (x / 2 ** z) * 360 - 180;
const tileLat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

// ---- Satélite: extensão do mosaico em metros locais ----
const sat = JSON.parse(fs.readFileSync(path.join(here, 'sat-meta.json'), 'utf8'));
const satPx = (px, py) => {
  const lon = tileLon(sat.x0 + px / 256, sat.z);
  const lat = tileLat(sat.y0 + py / 256, sat.z);
  return toLocal(lat, lon);
};
const [satMinX, satMinZ] = toLocal(tileLat(sat.y0, sat.z), tileLon(sat.x0, sat.z));
const [satMaxX, satMaxZ] = toLocal(tileLat(sat.y1 + 1, sat.z), tileLon(sat.x1 + 1, sat.z));

// ---- Relevo (Terrarium) amostrado numa grade sobre o mosaico ----
const dm = JSON.parse(fs.readFileSync(path.join(here, 'dem', 'meta.json'), 'utf8'));
const tiles = new Map();
for (let x = dm.x0; x <= dm.x1; x++) {
  for (let y = dm.y0; y <= dm.y1; y++) {
    tiles.set(`${y}_${x}`, PNG.sync.read(fs.readFileSync(path.join(here, 'dem', `${y}_${x}.png`))));
  }
}
const demRaw = (gx, gy) => {
  const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256);
  const png = tiles.get(`${ty}_${tx}`);
  if (!png) return null;
  const px = Math.min(255, Math.max(0, Math.floor(gx - tx * 256)));
  const py = Math.min(255, Math.max(0, Math.floor(gy - ty * 256)));
  const i = (py * 256 + px) * 4;
  return png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
};
const demAt = (lat, lon) => {
  const gx = ((lon + 180) / 360) * 2 ** dm.z * 256 - 0.5;
  const r = (lat * Math.PI) / 180;
  const gy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** dm.z * 256 - 0.5;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const a = demRaw(x0, y0), b = demRaw(x0 + 1, y0), c = demRaw(x0, y0 + 1), d = demRaw(x0 + 1, y0 + 1);
  if ([a, b, c, d].some((v) => v === null)) return null;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
};
const DEM_N = 192;
const DEM_HALF = 1300;
const heights = new Float32Array(DEM_N * DEM_N);
let hMin = Infinity, hMax = -Infinity;
for (let j = 0; j < DEM_N; j++) {
  for (let i = 0; i < DEM_N; i++) {
    const x = -DEM_HALF + (2 * DEM_HALF * i) / (DEM_N - 1);
    const z = -DEM_HALF + (2 * DEM_HALF * j) / (DEM_N - 1);
    const lat = ORIGIN.lat - z / M_LAT;
    const lon = ORIGIN.lon + x / M_LON;
    const h = demAt(lat, lon) ?? 780;
    heights[j * DEM_N + i] = h;
    hMin = Math.min(hMin, h); hMax = Math.max(hMax, h);
  }
}
fs.writeFileSync(out('public/geo/dem.bin'), Buffer.from(heights.buffer));

// ---- OSM: vias, água, mata ----
const osm = JSON.parse(fs.readFileSync(path.join(here, 'osm.json'), 'utf8'));
const CLIP = 1500;
const inside = (pts) => pts.some(([x, z]) => Math.hypot(x, z) < CLIP);
const ROAD_W = {
  motorway: 22, motorway_link: 8, trunk: 18, primary: 12, secondary: 10, secondary_link: 7,
  tertiary: 9, unclassified: 7, residential: 7, service: 5, construction: 8, pedestrian: 4,
};
const roads = [], water = [], wood = [];
for (const e of osm.elements) {
  if (e.type !== 'way' || !e.geometry) continue;
  const t = e.tags || {};
  const pts = e.geometry.map((g) => toLocal(g.lat, g.lon));
  if (!inside(pts)) continue;
  if (t.highway && ROAD_W[t.highway]) {
    roads.push({ name: t.name || '', kind: t.highway, w: ROAD_W[t.highway], bridge: t.bridge === 'yes', layer: +(t.layer || 0), pts });
  } else if (t.natural === 'water') {
    water.push(pts);
  } else if (t.natural === 'wood' || t.landuse === 'forest') {
    wood.push(pts);
  }
}

// ---- Torres medidas no mosaico (pixels do sat.jpg, z17) ----
// built = já erguida no satélite; as demais são posições estimadas pelo
// alinhamento da fileira e pelas áreas terraplenadas do lote.
const GROUPS = {
  12: { built: [[1390, 1107], [1427, 1060], [1477, 1027]], planned: [[1353, 1154], [1527, 994], [1567, 960]] },
  14: { built: [[1500, 1140], [1532, 1095], [1565, 1057]], planned: [[1598, 1019], [1467, 1185], [1434, 1230]] },
  16: { built: [[1385, 1317], [1437, 1330], [1487, 1345]], planned: [[1335, 1303], [1537, 1360], [1587, 1374]] },
  18: { built: [[1340, 1425], [1387, 1437], [1435, 1455]], planned: [[1293, 1413], [1483, 1470], [1531, 1485]] },
  13: { built: [[1320, 1730], [1357, 1750], [1365, 1785]], planned: [[1300, 1640], [1340, 1660], [1380, 1680], [1395, 1720]] },
  15: { built: [[1232, 1790], [1270, 1802], [1280, 1840]], planned: [[1195, 1700], [1235, 1690], [1200, 1745], [1245, 1740]] },
  17: { built: [[1055, 2022], [1077, 2047], [1095, 2080]], planned: [[1033, 1994], [1011, 1966], [1105, 2005], [1125, 2038]] },
};
const GOOGLE = {
  12: [-23.6275047, -46.8164567], 14: [-23.6278717, -46.8158344], 16: [-23.6301706, -46.8169938],
  18: [-23.6312291, -46.8162926], 13: [-23.6346244, -46.8171021], 15: [-23.6351968, -46.818112],
  17: [-23.6373848, -46.8202014],
};
const LETTERS = 'ABCDEFG';
const towers = [];
const groups = [];
for (const [gid, g] of Object.entries(GROUPS)) {
  const id = +gid;
  const even = id % 2 === 0;
  const built = g.built.map(([px, py]) => satPx(px, py));
  const [a, b] = [built[0], built[built.length - 1]];
  const rot = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const all = [...built.map((p) => ({ p, built: true })), ...g.planned.map(([px, py]) => ({ p: satPx(px, py), built: false }))];
  all.sort((u, v) => u.p[0] - v.p[0] || u.p[1] - v.p[1]);
  all.forEach((t, i) => {
    towers.push({ id: `G${id}-${LETTERS[i]}`, group: id, block: LETTERS[i], x: t.p[0], z: t.p[1], rot, built: t.built });
  });
  const cx = all.reduce((s, t) => s + t.p[0], 0) / all.length;
  const cz = all.reduce((s, t) => s + t.p[1], 0) / all.length;
  groups.push({ id, even, center: [+cx.toFixed(1), +cz.toFixed(1)], pin: toLocal(...GOOGLE[id]) });
}

const geo = {
  origin: ORIGIN,
  sat: { url: '/geo/sat.jpg', minX: satMinX, maxX: satMaxX, minZ: satMinZ, maxZ: satMaxZ },
  dem: { url: '/geo/dem.bin', n: DEM_N, half: DEM_HALF, min: +hMin.toFixed(1), max: +hMax.toFixed(1) },
  roads, water, wood,
};
fs.writeFileSync(out('public/geo/geo.json'), JSON.stringify(geo));
fs.writeFileSync(out('src/data/towers.json'), JSON.stringify({ groups, towers }, null, 1));
console.log({ sat: geo.sat, dem: geo.dem, roads: roads.length, water: water.length, wood: wood.length, towers: towers.length });
