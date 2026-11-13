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

export interface Geo extends GeoData {
  heights: Float32Array;
  /** Altitude (m acima do mar) do ponto de origem; y = 0 na cena. */
  base: number;
  /** Altura na cena (y) do terreno real em (x, z). */
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
  return { ...data, heights, base, heightAt: (x, z) => raw(x, z) - base };
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
