import siteplan from '../data/siteplan.json';

export type XZ = [number, number];

export interface Road {
  name: string;
  kind: string;
  w: number;
  bridge: boolean;
  layer: number;
  pts: XZ[];
}

export interface GeoData {
  origin: { lat: number; lon: number };
  sat: { url: string; minX: number; maxX: number; minZ: number; maxZ: number };
  dem: { url: string; n: number; half: number; min: number; max: number };
  roads: Road[];
  water: XZ[][];
  wood: XZ[][];
}

export interface Deck {
  groups: number[];
  poly: XZ[];
  /** Cota (y da cena) da laje de cobertura dos subsolos. */
  level: number;
  bbox: [number, number, number, number];
}

export interface Geo extends GeoData {
  heights: Float32Array;
  /** Altitude (m acima do mar) do ponto de origem; y = 0 na cena. */
  base: number;
  decks: Deck[];
  /** Altura do terreno natural, sem os platôs dos pódios. */
  naturalAt: (x: number, z: number) => number;
  deckAt: (x: number, z: number) => Deck | null;
  /** Altura na cena (y): laje do pódio onde houver, senão o terreno natural. */
  heightAt: (x: number, z: number) => number;
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

export async function loadGeo(): Promise<Geo> {
  const data: GeoData = await (await fetch(asset('geo/geo.json'))).json();
  const buf = await (await fetch(asset(data.dem.url))).arrayBuffer();
  const heights = new Float32Array(buf);
  const { n, half } = data.dem;

  const raw = (x: number, z: number) => {
    const gx = ((x + half) / (2 * half)) * (n - 1);
    const gz = ((z + half) / (2 * half)) * (n - 1);
    const i0 = Math.max(0, Math.min(n - 2, Math.floor(gx)));
    const j0 = Math.max(0, Math.min(n - 2, Math.floor(gz)));
    const fx = Math.max(0, Math.min(1, gx - i0));
    const fz = Math.max(0, Math.min(1, gz - j0));
    const h = (i: number, j: number) => heights[j * n + i];
    return (
      h(i0, j0) * (1 - fx) * (1 - fz) +
      h(i0 + 1, j0) * fx * (1 - fz) +
      h(i0, j0 + 1) * (1 - fx) * fz +
      h(i0 + 1, j0 + 1) * fx * fz
    );
  };
  const base = raw(0, 0);
  const naturalAt = (x: number, z: number) => raw(x, z) - base;

  const decks: Deck[] = (siteplan.decks as { groups: number[]; poly: XZ[] }[]).map((d) => {
    const xs = d.poly.map((p) => p[0]);
    const zs = d.poly.map((p) => p[1]);
    const bbox: Deck['bbox'] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const samples: number[] = [];
    for (let x = bbox[0]; x <= bbox[1]; x += 6) {
      for (let z = bbox[2]; z <= bbox[3]; z += 6) {
        if (pointInPolygon(x, z, d.poly)) samples.push(naturalAt(x, z));
      }
    }
    samples.sort((a, b) => a - b);
    return { ...d, bbox, level: samples[Math.floor(samples.length / 2)] ?? naturalAt(xs[0], zs[0]) };
  });
  const deckAt = (x: number, z: number) =>
    decks.find((d) => x >= d.bbox[0] && x <= d.bbox[1] && z >= d.bbox[2] && z <= d.bbox[3] && pointInPolygon(x, z, d.poly)) ?? null;

  return {
    ...data,
    heights,
    base,
    decks,
    naturalAt,
    deckAt,
    heightAt: (x, z) => deckAt(x, z)?.level ?? naturalAt(x, z),
  };
}

export const assetUrl = asset;

export function pointInPolygon(x: number, z: number, poly: XZ[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
