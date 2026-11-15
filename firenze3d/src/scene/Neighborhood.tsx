import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { assetUrl, type Geo } from '../lib/geo';
import { TOWERS } from '../data/condo';
import { DISC_R } from './Terrain';
import { planOpaqueAt, usePlanMask } from './Nature';

type Footprint = { p: number[]; h: number };

const WALLS = ['#e8e1d4', '#d9cbb3', '#c9b59a', '#b97a5a', '#a86a4c', '#e3d7c2', '#cfc6b8', '#d8b48f'].map((c) => new THREE.Color(c));
const ROOFS = ['#9b5a3c', '#8a8780', '#a7a39a', '#b06a45', '#7e7b74', '#c4c0b6'].map((c) => new THREE.Color(c));

function hash(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function area(pts: THREE.Vector2[]) {
  return Math.abs(THREE.ShapeUtils.area(pts));
}

function heightFor(a: number, r: number) {
  if (a < 60) return 3 + r * 3.5;
  if (a < 180) return 4 + r * 5.5;
  if (a < 600) return 6 + r * 6;
  return 7 + r * 7;
}

function buildGeometry(list: Footprint[], geo: Geo, keep: (x: number, z: number) => boolean) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const push = (x: number, y: number, z: number, n: THREE.Vector3, c: THREE.Color) => {
    pos.push(x, y, z);
    nrm.push(n.x, n.y, n.z);
    col.push(c.r, c.g, c.b);
  };
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();

  list.forEach((b, i) => {
    let pts: THREE.Vector2[] = [];
    for (let k = 0; k < b.p.length; k += 2) pts.push(new THREE.Vector2(b.p[k], b.p[k + 1]));
    if (pts.length < 3) return;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p.x; cz += p.y; }
    cx /= pts.length; cz /= pts.length;
    if (Math.hypot(cx, cz) > DISC_R - 20 || !keep(cx, cz)) return;
    const a = area(pts);
    if (a < 12) return;
    if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.slice().reverse();

    let lo = Infinity, hi = -Infinity;
    for (const p of pts) {
      const y = geo.naturalAt(p.x, p.y);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    const r = hash(i);
    const base = lo - 1.5;
    const top = hi + (b.h > 0 ? b.h : heightFor(a, r));
    const wall = WALLS[Math.floor(hash(i + 7) * WALLS.length)];
    const roof = ROOFS[Math.floor(hash(i + 13) * ROOFS.length)];
    const shade = 0.88 + hash(i + 3) * 0.2;
    const w = wall.clone().multiplyScalar(shade);
    const rf = roof.clone().multiplyScalar(shade);

    for (let k = 0; k < pts.length; k++) {
      const p0 = pts[k], p1 = pts[(k + 1) % pts.length];
      n.set(p1.y - p0.y, 0, -(p1.x - p0.x)).normalize();
      push(p0.x, base, p0.y, n, w);
      push(p1.x, top, p1.y, n, w);
      push(p1.x, base, p1.y, n, w);
      push(p0.x, base, p0.y, n, w);
      push(p0.x, top, p0.y, n, w);
      push(p1.x, top, p1.y, n, w);
    }
    for (const [ia, ib, ic] of THREE.ShapeUtils.triangulateShape(pts, [])) {
      push(pts[ia].x, top, pts[ia].y, up, rf);
      push(pts[ic].x, top, pts[ic].y, up, rf);
      push(pts[ib].x, top, pts[ib].y, up, rf);
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

export function Neighborhood({ geo }: { geo: Geo }) {
  const [list, setList] = useState<Footprint[] | null>(null);
  const mask = usePlanMask();

  useEffect(() => {
    let alive = true;
    fetch(assetUrl('geo/buildings.json'))
      .then((r) => r.json())
      .then((d: Footprint[]) => alive && setList(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const geometry = useMemo(() => {
    if (!list || !mask) return null;
    const keep = (x: number, z: number) =>
      !geo.deckAt(x, z) && !planOpaqueAt(mask, x, z) && !TOWERS.some((t) => Math.hypot(t.x - x, t.z - z) < 40);
    return buildGeometry(list, geo, keep);
  }, [list, mask, geo]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
    </mesh>
  );
}
