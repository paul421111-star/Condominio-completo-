import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { assetUrl, type Geo } from '../lib/geo';

export const DISC_R = 1250;
const RINGS = 110;
const SEGS = 220;
export const SKIRT_DEPTH = 26;

/** Leve dessaturação e tom frio, no estilo da cidade 3D do Oceanos. */
function gradeSatellite(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.78) * vec3(0.98, 1.0, 1.05);
  diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.92));`,
    );
  };
}

export function Terrain({ geo }: { geo: Geo }) {
  const tex = useTexture(assetUrl(geo.sat.url));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;

  const { top, skirt, minY } = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = geo.sat;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    pos.push(0, geo.heightAt(0, 0), 0);
    uv.push((0 - minX) / (maxX - minX), 1 - (0 - minZ) / (maxZ - minZ));
    let minY = Infinity;
    for (let r = 1; r <= RINGS; r++) {
      const rad = (r / RINGS) * DISC_R;
      for (let s = 0; s < SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const y = geo.heightAt(x, z);
        minY = Math.min(minY, y);
        pos.push(x, y, z);
        uv.push((x - minX) / (maxX - minX), 1 - (z - minZ) / (maxZ - minZ));
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
    top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    top.setIndex(idx);
    top.computeVertexNormals();

    // Saia lateral até a base da "mesa" da maquete.
    const floorY = minY - SKIRT_DEPTH;
    const sp: number[] = [];
    const si: number[] = [];
    for (let s = 0; s <= SEGS; s++) {
      const a = (s / SEGS) * Math.PI * 2;
      const x = Math.cos(a) * DISC_R, z = Math.sin(a) * DISC_R;
      sp.push(x, geo.heightAt(x, z), z, x, floorY, z);
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
  }, [geo]);

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    gradeSatellite(m);
    return m;
  }, [tex]);

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
