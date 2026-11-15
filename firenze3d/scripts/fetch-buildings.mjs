// Footprints do Microsoft Global ML Building Footprints em volta do Parque
// Firenze, gravados em metros locais (x = leste, z = sul) no referencial da maquete.
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';

const URL =
  'https://minedbuildings.z5.web.core.windows.net/global-buildings/2026-02-03/global-buildings.geojsonl/RegionName=Brazil/quadkey=210311121/part-00111-4feead82-d499-422b-94cb-c036c212127a.c000.csv.gz';
const ORIGIN = { lat: -23.6322, lon: -46.818 };
const M_LAT = 110574;
const M_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const RADIUS = Number(process.argv[2] ?? 1250);
const local = path.join(os.tmpdir(), 'ms-210311121.csv.gz');

if (!existsSync(local)) {
  console.log('baixando…');
  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(String(res.status));
  await pipeline(Readable.fromWeb(res.body), createWriteStream(local));
}

const result = [];
const rl = createInterface({ input: createReadStream(local).pipe(createGunzip()) });
let total = 0;
for await (const line of rl) {
  total++;
  if (!line.startsWith('{')) continue;
  const feature = JSON.parse(line);
  const ring = feature.geometry.coordinates[0];
  const [lon, lat] = ring[0];
  const x = (lon - ORIGIN.lon) * M_LON;
  const z = -(lat - ORIGIN.lat) * M_LAT;
  if (Math.hypot(x, z) > RADIUS) continue;
  const p = [];
  for (const [lo, la] of ring.slice(0, -1)) {
    p.push(Math.round((lo - ORIGIN.lon) * M_LON * 10) / 10, Math.round(-(la - ORIGIN.lat) * M_LAT * 10) / 10);
  }
  const h = Number(feature.properties?.height ?? -1);
  result.push({ p, h: Number.isFinite(h) ? Math.round(h * 10) / 10 : -1 });
}
await writeFile('public/geo/buildings.json', JSON.stringify(result));
console.log({ total, kept: result.length, withHeight: result.filter((b) => b.h > 0).length });
