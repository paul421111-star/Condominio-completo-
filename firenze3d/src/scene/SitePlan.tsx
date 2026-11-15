import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { assetUrl, type Deck, type Geo, type XZ } from '../lib/geo';
import { GROUP_BY_ID, type GroupId } from '../data/condo';
import siteplan from '../data/siteplan.json';
import { makeGroundMaterial, preparePlanTexture } from './groundMaterial';

/** Laje plana com normais para cima a partir de um polígono no plano xz. */
function flatPolygon(poly: XZ[], y: number) {
  const contour = poly.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const pos = poly.flatMap(([x, z]) => [x, y, z]);
  const idx: number[] = [];
  for (const [a, b, c] of tris) {
    const [ax, az] = poly[a], [bx, bz] = poly[b], [cx, cz] = poly[c];
    const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (up >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(poly.flatMap(() => [0, 1, 0]), 3));
  g.setIndex(idx);
  return g;
}

const signedArea = (poly: XZ[]) => poly.reduce((s, [x0, z0], i) => {
  const [x1, z1] = poly[(i + 1) % poly.length];
  return s + x0 * z1 - x1 * z0;
}, 0);

/**
 * Muros do pódio: descem até o terreno onde há aterro (fachada dos subsolos)
 * e sobem até o talude onde há corte (arrimo). `aWall` = (metros ao longo do
 * perímetro, profundidade abaixo da laje).
 */
function deckWalls(geo: Geo, deck: Deck) {
  const poly = deck.poly;
  const outward = signedArea(poly) > 0 ? -1 : 1;
  const pos: number[] = [];
  const nor: number[] = [];
  const wall: number[] = [];
  const idx: number[] = [];
  let run = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) continue;
    const nx = (-(bz - az) / len) * outward;
    const nz = ((bx - ax) / len) * outward;
    const steps = Math.max(1, Math.ceil(len / 4));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const p0: XZ = [ax + (bx - ax) * t0, az + (bz - az) * t0];
      const p1: XZ = [ax + (bx - ax) * t1, az + (bz - az) * t1];
      const n0 = geo.naturalAt(p0[0] + nx * 2, p0[1] + nz * 2);
      const n1 = geo.naturalAt(p1[0] + nx * 2, p1[1] + nz * 2);
      const lo0 = Math.min(n0, deck.level) - 1.5, lo1 = Math.min(n1, deck.level) - 1.5;
      // Guarda-corpo de 1,1 m sobre o aterro; arrimo 0,3 m acima do talude no corte.
      const hi0 = n0 > deck.level ? n0 + 0.3 : deck.level + 1.1;
      const hi1 = n1 > deck.level ? n1 + 0.3 : deck.level + 1.1;
      const r0 = run + len * t0, r1 = run + len * t1;
      const base = pos.length / 3;
      pos.push(p0[0], lo0, p0[1], p1[0], lo1, p1[1], p1[0], hi1, p1[1], p0[0], hi0, p0[1]);
      for (let k = 0; k < 4; k++) nor.push(nx, 0, nz);
      wall.push(r0, deck.level - lo0, r1, deck.level - lo1, r1, deck.level - hi1, r0, deck.level - hi0);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    run += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aWall', new THREE.Float32BufferAttribute(wall, 2));
  g.setIndex(idx);
  return g;
}

/** Concreto aparente com as aberturas de ventilação dos subsolos a cada 3 m. */
function makeWallMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#d4d0c8', roughness: 0.92 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aWall;\nvarying vec2 vWall;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWall;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  float depth = vWall.y;
  float level = fract(depth / 3.0);
  float bay = fract(vWall.x / 7.5);
  float opening = step(1.4, depth) * step(0.32, level) * step(level, 0.7) * step(0.12, bay) * step(bay, 0.88);
  float slab = step(0.0, depth) * (1.0 - smoothstep(0.0, 0.12, abs(level - 0.03)));
  float rail = 1.0 - step(-0.05, depth);
  vec3 c = diffuseColor.rgb;
  c = mix(c, vec3(0.16, 0.17, 0.19), opening * 0.92);
  c = mix(c, c * 0.82, slab);
  c = mix(c, vec3(0.93, 0.93, 0.9), rail);
  c *= 1.0 - smoothstep(10.0, 22.0, depth) * 0.14;
  diffuseColor.rgb = c;`,
      );
  };
  m.customProgramCacheKey = () => 'deck-wall';
  return m;
}

/** Textura de placa desenhada em canvas. */
function signTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const SCRIPT_FONT = "'Segoe Script', 'Brush Script MT', 'Comic Sans MS', cursive";

/** Testeira PE03: painel em ACM dourado com "Residencial Parque Firenze". */
function mainTesteira() {
  return signTexture(2048, 220, (c, w, h) => {
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f6dc8c');
    grad.addColorStop(1, '#e9c766');
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.shadowColor = 'rgba(120, 90, 20, 0.55)';
    c.shadowBlur = 8;
    c.textBaseline = 'middle';
    c.font = `600 64px ${SCRIPT_FONT}`;
    c.fillText('Residencial', 70, h * 0.56);
    c.font = `700 132px ${SCRIPT_FONT}`;
    c.fillText('Parque Firenze', 520, h * 0.52);
    // Selo aquarelado do logotipo, na cor geral do condomínio.
    c.shadowBlur = 0;
    const g2 = c.createRadialGradient(w - 190, h / 2, 10, w - 190, h / 2, 110);
    g2.addColorStop(0, 'rgba(91, 144, 169, 0.95)');
    g2.addColorStop(1, 'rgba(91, 144, 169, 0)');
    c.fillStyle = g2;
    c.fillRect(w - 320, 0, 260, h);
    c.fillStyle = '#ffffff';
    c.font = `600 34px ${SCRIPT_FONT}`;
    c.fillText('Parque Firenze', w - 300, h / 2);
  });
}

/** Testeira PE04 da portaria social: concreto com a "pincelada" do grupo. */
function socialTesteira(group: GroupId) {
  const g = GROUP_BY_ID[group];
  return signTexture(1024, 180, (c, w, h) => {
    c.fillStyle = '#a6a39c';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 60},${Math.random() > 0.5 ? 255 : 60},${Math.random() > 0.5 ? 255 : 60},0.05)`;
      c.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    c.fillStyle = g.color;
    c.beginPath();
    c.moveTo(60, 50);
    for (let x = 60; x <= 520; x += 20) c.lineTo(x, 40 + Math.sin(x * 0.11) * 8);
    for (let x = 520; x >= 60; x -= 20) c.lineTo(x, 140 + Math.cos(x * 0.09) * 9);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    c.font = `700 80px ${SCRIPT_FONT}`;
    c.fillText(g.name, 100, h / 2 + 4);
  });
}

/** Ângulo em Y que alinha o eixo local Z com a via (marquise atravessando a pista). */
const yawAlongRoad = (roadYaw: number) => Math.PI / 2 - roadYaw;

function Gate({ x, z, y, roadYaw, kind, group }: { x: number; z: number; y: number; roadYaw: number; kind: 'main' | 'social'; group?: GroupId }) {
  const main = kind === 'main';
  const W = main ? 26 : 17;
  const D = main ? 11 : 8;
  const H = main ? 6.2 : 5.2;
  const sign = useMemo(() => (main ? mainTesteira() : socialTesteira(group!)), [main, group]);
  const glass = main ? '#1d3f9e' : '#284d8f';
  const guard = main ? 5.5 : 4.5;
  const cols = main ? [-W / 2 + 1, -6.8, 6.8, W / 2 - 1] : [-W / 2 + 0.8, W / 2 - 0.8];
  return (
    <group position={[x, y, z]} rotation={[0, yawAlongRoad(roadYaw), 0]}>
      <mesh position={[0, H + 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, 0.7, D]} />
        <meshStandardMaterial color={main ? '#f1f1ee' : '#b9b6ae'} roughness={0.7} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, H + 1.35, (side * D) / 2 + side * 0.06]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[W, main ? 2.4 : 1.7]} />
          <meshStandardMaterial map={sign} roughness={0.45} metalness={main ? 0.35 : 0} />
        </mesh>
      ))}
      <mesh position={[0, H + 1.35, 0]}>
        <boxGeometry args={[W, main ? 2.4 : 1.7, D - 0.2]} />
        <meshStandardMaterial color={main ? '#e8c76a' : '#a6a39c'} roughness={0.6} />
      </mesh>
      {cols.map((cx) =>
        [-D / 2 + 0.6, D / 2 - 0.6].map((cz) => (
          <mesh key={`${cx}${cz}`} position={[cx, H / 2, cz]} castShadow>
            <boxGeometry args={[0.55, H, 0.55]} />
            <meshStandardMaterial color="#e9e8e4" roughness={0.8} />
          </mesh>
        )),
      )}
      {(main ? [-1, 1] : [1]).map((side) => (
        <mesh key={side} position={[side * (W / 2 - guard / 2 - 0.4), 1.65, 0]} castShadow>
          <boxGeometry args={[guard, 3.3, D * 0.62]} />
          <meshPhysicalMaterial color={glass} roughness={0.12} metalness={0.4} clearcoat={1} />
        </mesh>
      ))}
      {(main ? [-3.4, 3.4] : [0]).map((cx) => (
        <group key={cx} position={[cx, 0, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.45, 1.2, 0.45]} />
            <meshStandardMaterial color="#f2c200" />
          </mesh>
          <mesh position={[-1.6, 1.05, 0]}>
            <boxGeometry args={[3.2, 0.1, 0.1]} />
            <meshStandardMaterial color="#d93025" emissive="#5a0d08" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const WATER = { color: '#2fb7d6', roughness: 0.06, metalness: 0.1, clearcoat: 1 };

export function SitePlan({ geo }: { geo: Geo }) {
  const [tex, plan] = useTexture([assetUrl(geo.sat.url), assetUrl(siteplan.plan.url)]);
  preparePlanTexture(plan);
  const deckMat = useMemo(() => makeGroundMaterial(geo, tex, plan), [geo, tex, plan]);
  const wallMat = useMemo(makeWallMaterial, []);

  const decks = useMemo(() => {
    const tops = geo.decks.map((d) => flatPolygon(d.poly, d.level));
    const walls = geo.decks.map((d) => deckWalls(geo, d));
    return { top: mergeGeometries(tops)!, walls: mergeGeometries(walls)! };
  }, [geo]);

  const pools = useMemo(() => {
    const gs = (siteplan.pools as XZ[][]).map((p) => {
      const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
      const cz = p.reduce((s, q) => s + q[1], 0) / p.length;
      return flatPolygon(p, geo.heightAt(cx, cz) + 0.06);
    });
    return gs.length ? mergeGeometries(gs) : null;
  }, [geo]);

  const lakes = useMemo(() => {
    const gs = (siteplan.lakes as XZ[][]).map((p) => flatPolygon(p, Math.min(...p.map(([x, z]) => geo.naturalAt(x, z))) + 0.6));
    return gs.length ? mergeGeometries(gs) : null;
  }, [geo]);

  return (
    <group>
      <mesh geometry={decks.top} material={deckMat} receiveShadow />
      <mesh geometry={decks.walls} material={wallMat} castShadow receiveShadow />
      {pools && (
        <mesh geometry={pools} renderOrder={1}>
          <meshPhysicalMaterial {...WATER} />
        </mesh>
      )}
      {lakes && (
        <mesh geometry={lakes} receiveShadow>
          <meshPhysicalMaterial color="#3f6f7c" roughness={0.08} metalness={0.1} clearcoat={1} transparent opacity={0.92} />
        </mesh>
      )}
      {siteplan.gates.map((g) => (
        <Gate key={g.id} kind="main" x={g.x} z={g.z} y={geo.heightAt(g.x, g.z)} roadYaw={g.roadYaw} />
      ))}
      {siteplan.socialGates.map((g) => (
        <Gate key={g.group} kind="social" group={g.group as GroupId} x={g.x} z={g.z} y={geo.heightAt(g.x, g.z)} roadYaw={g.roadYaw} />
      ))}
    </group>
  );
}