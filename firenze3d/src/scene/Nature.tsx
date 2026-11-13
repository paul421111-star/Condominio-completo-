import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pointInPolygon, type Geo, type XZ } from '../lib/geo';
import { TOWERS } from '../data/condo';
import { DISC_R } from './Terrain';

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function treeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 4, 5).translate(0, 2, 0);
  const crown = new THREE.IcosahedronGeometry(3, 1).scale(1, 0.85, 1).translate(0, 6, 0);
  const crown2 = new THREE.IcosahedronGeometry(2.2, 0).translate(1.2, 7.6, 0.6);
  const paint = (g: THREE.BufferGeometry, c: THREE.Color, jitter: number) => {
    const g2 = g.index ? g.toNonIndexed() : g;
    const n = g2.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    const r = rng(n + 7);
    for (let i = 0; i < n; i++) {
      const k = 1 - jitter + r() * jitter * 2;
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
    }
    g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g2.deleteAttribute('uv');
    return g2;
  };
  return mergeGeometries([
    paint(trunk, new THREE.Color('#6b4f3a'), 0.05),
    paint(crown, new THREE.Color('#4f7d3a'), 0.18),
    paint(crown2, new THREE.Color('#5d8c42'), 0.18),
  ])!;
}

export function Trees({ geo }: { geo: Geo }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(treeGeometry, []);
  const items = useMemo(() => {
    const r = rng(42);
    const out: { x: number; z: number; y: number; s: number; rot: number; tint: number }[] = [];
    const keepOut = (x: number, z: number) => TOWERS.some((t) => Math.hypot(t.x - x, t.z - z) < 48);
    for (const poly of geo.wood) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of poly) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      const step = 10;
      for (let x = minX; x < maxX; x += step) {
        for (let z = minZ; z < maxZ; z += step) {
          const px = x + (r() - 0.5) * step, pz = z + (r() - 0.5) * step;
          if (Math.hypot(px, pz) > DISC_R - 15) continue;
          if (!pointInPolygon(px, pz, poly as XZ[]) || keepOut(px, pz)) continue;
          out.push({ x: px, z: pz, y: geo.heightAt(px, pz), s: 0.8 + r() * 0.9, rot: r() * Math.PI * 2, tint: r() });
        }
      }
    }
    return out.slice(0, 14000);
  }, [geo]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((t, i) => {
      o.position.set(t.x, t.y - 0.3, t.z);
      o.rotation.set(0, t.rot, 0);
      o.scale.setScalar(t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      c.setHSL(0.24 + t.tint * 0.08, 0.35 + t.tint * 0.2, 0.75 + t.tint * 0.25);
      m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow receiveShadow frustumCulled={false} raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={0.9} />
    </instancedMesh>
  );
}

export function Water({ geo }: { geo: Geo }) {
  const meshes = useMemo(
    () =>
      geo.water
        .filter((p) => p.some(([x, z]) => Math.hypot(x, z) < DISC_R))
        .map((poly) => {
          const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
          const g = new THREE.ShapeGeometry(shape);
          g.rotateX(-Math.PI / 2);
          const y = Math.min(...poly.map(([x, z]) => geo.heightAt(x, z))) + 1.2;
          return { g, y };
        }),
    [geo],
  );
  return (
    <group>
      {meshes.map(({ g, y }, i) => (
        <mesh key={i} geometry={g} position={[0, y, 0]} receiveShadow raycast={() => null}>
          <meshPhysicalMaterial color="#3f6f7c" roughness={0.08} metalness={0.1} transmission={0} clearcoat={1} transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  );
}
