import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { assetUrl, type Geo } from '../lib/geo';
import siteplan from '../data/siteplan.json';
import { groundUniforms, makeGroundMaterial, preparePlanTexture } from './groundMaterial';

export const DISC_R = 1250;
const RINGS = 220;
const SEGS = 480;
export const SKIRT_DEPTH = 26;
/** O terreno sob a laje do pódio fica abaixo dela, para a laje cobrir sem z-fighting. */
const UNDER_DECK = 0.8;

/** Dentro da planta, tira o relevo miúdo do mapa para as ruas não entortarem. A ladeira geral permanece. */
function smoothSite(geo: Geo) {
  const [[u0, u1, u2], [v0, v1, v2]] = siteplan.plan.uv;
  const det = u0 * v1 - u1 * v0;
  const toWorld = (u: number, v: number) => {
    const uu = u - u2;
    const vv = v - v2;
    return { x: (uu * v1 - u1 * vv) / det, z: (u0 * vv - v0 * uu) / det };
  };
  const corners = [toWorld(-0.08, -0.08), toWorld(1.08, -0.08), toWorld(-0.08, 1.08), toWorld(1.08, 1.08)];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
  }
  const step = 16;
  const nx = Math.ceil((maxX - minX) / step) + 1;
  const nz = Math.ceil((maxZ - minZ) / step) + 1;
  let field = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) field[j * nx + i] = geo.naturalAt(minX + i * step, minZ + j * step);
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(field.length);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = Math.min(nx - 1, Math.max(0, i + di));
            const jj = Math.min(nz - 1, Math.max(0, j + dj));
            s += field[jj * nx + ii];
            n++;
          }
        }
        next[j * nx + i] = s / n;
      }
    }
    field = next;
  }
  const sample = (x: number, z: number) => {
    const fx = (x - minX) / step;
    const fz = (z - minZ) / step;
    const i = Math.min(nx - 2, Math.max(0, Math.floor(fx)));
    const j = Math.min(nz - 2, Math.max(0, Math.floor(fz)));
    const tx = fx - i;
    const tz = fz - j;
    const a = field[j * nx + i] ?? 0;
    const b = field[j * nx + i + 1] ?? a;
    const c = field[(j + 1) * nx + i] ?? a;
    const d = field[(j + 1) * nx + i + 1] ?? a;
    return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
  };
  return (x: number, z: number) => {
    const u = u0 * x + u1 * z + u2;
    const v = v0 * x + v1 * z + v2;
    const inside = Math.min(u - 0.03, 1.03 - u, v - 0.03, 1.03 - v);
    if (inside <= 0) return geo.naturalAt(x, z);
    const w = Math.min(1, inside / 0.05);
    const n = geo.naturalAt(x, z);
    return n * (1 - w) + sample(x, z) * w;
  };
}

export function Terrain({ geo, flat = false }: { geo: Geo; flat?: boolean }) {
  const [tex, plan] = useTexture([assetUrl(geo.sat.url), assetUrl(siteplan.plan.url)]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  preparePlanTexture(plan);

  useEffect(() => {
    groundUniforms.uPlanMix.value = flat ? 1 : 0;
  }, [flat]);

  const { top, skirt, minY } = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    const smooth = flat ? smoothSite(geo) : null;
    const surface = (x: number, z: number) => {
      const natural = smooth ? smooth(x, z) : geo.naturalAt(x, z);
      const d = geo.deckAt(x, z);
      return d ? Math.min(natural, d.level - UNDER_DECK) : natural;
    };
    pos.push(0, surface(0, 0), 0);
    let minY = Infinity;
    // Anéis mais densos no miolo (condomínio) e mais espaçados na borda.
    for (let r = 1; r <= RINGS; r++) {
      const rad = Math.pow(r / RINGS, 1.35) * DISC_R;
      for (let s = 0; s < SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const y = surface(x, z);
        minY = Math.min(minY, y);
        pos.push(x, y, z);
      }
    }
    const v = (r: number, s: number) => (r === 0 ? 0 : 1 + (r - 1) * SEGS + (s % SEGS));
    for (let s = 0; s < SEGS; s++) idx.push(0, v(1, s + 1), v(1, s));
    for (let r = 1; r < RINGS; r++) {
      for (let s = 0; s < SEGS; s++) {
        const a = v(r, s), b = v(r, s + 1), c = v(r + 1, s), d = v(r + 1, s + 1);
        idx.push(a, b, c, b, d, c);
      }
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setIndex(idx);
    top.computeVertexNormals();

    // Saia lateral até a base da "mesa" da maquete.
    const floorY = minY - SKIRT_DEPTH;
    const sp: number[] = [];
    const si: number[] = [];
    for (let s = 0; s <= SEGS; s++) {
      const a = (s / SEGS) * Math.PI * 2;
      const x = Math.cos(a) * DISC_R, z = Math.sin(a) * DISC_R;
      sp.push(x, geo.naturalAt(x, z), z, x, floorY, z);
    }
    for (let s = 0; s < SEGS; s++) {
      const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
      si.push(a, c, b, b, c, d);
    }
    const skirt = new THREE.BufferGeometry();
    skirt.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    skirt.setIndex(si);
    skirt.computeVertexNormals();
    return { top, skirt, minY };
  }, [geo, flat]);

  const mat = useMemo(() => makeGroundMaterial(geo, tex, plan), [geo, tex, plan]);

  return (
    <group>
      <mesh geometry={top} material={mat} receiveShadow />
      <mesh geometry={skirt}>
        <meshStandardMaterial color="#e7ecef" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <PlatformRing y={minY - SKIRT_DEPTH} />
    </group>
  );
}

/** Mesa circular com grade e marcas, como a plataforma das maquetes de referência. */
function PlatformRing({ y }: { y: number }) {
  const grid = useMemo(() => {
    const pts: number[] = [];
    const R = DISC_R + 260;
    for (let r = DISC_R + 40; r <= R; r += 55) {
      for (let s = 0; s < 180; s++) {
        const a0 = (s / 180) * Math.PI * 2, a1 = ((s + 1) / 180) * Math.PI * 2;
        pts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r);
      }
    }
    for (let s = 0; s < 72; s++) {
      const a = (s / 72) * Math.PI * 2;
      pts.push(Math.cos(a) * (DISC_R + 10), 0, Math.sin(a) * (DISC_R + 10), Math.cos(a) * R, 0, Math.sin(a) * R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <group position={[0, y + 0.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DISC_R + 300, 128]} />
        <meshStandardMaterial color="#dfe5ea" roughness={1} />
      </mesh>
      <lineSegments geometry={grid} position={[0, 0.4, 0]}>
        <lineBasicMaterial color="#b9c3cc" transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}
