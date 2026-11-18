import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { assetUrl, type Geo } from '../lib/geo';
import { GROUP_BY_ID, TOWERS, type TowerDef } from '../data/condo';
import { useStore } from '../store';
import { buildTemplate, makeGhostDepthMaterial, makeGhostMaterial, patchDepth, type Parity, type TowerTemplate } from './towerModel';

const NEAR_DIST = 560;
const FULL = 1e5;
const SELECTED_TINT = new THREE.Color('#ffffff');
const HOVER_TINT = new THREE.Color('#ffffff');
const GROUP_TINT = new THREE.Color('#ffffff');
const WHITE = new THREE.Color('#ffffff');

export interface PlacedTower extends TowerDef {
  parity: Parity;
  baseY: number;
  matrix: THREE.Matrix4;
  pos: THREE.Vector3;
}

export function placeTowers(geo: Geo, templates: Record<Parity, TowerTemplate>): PlacedTower[] {
  return TOWERS.map((t) => {
    const parity: Parity = GROUP_BY_ID[t.group].even ? 'pares' : 'impares';
    const r = Math.max(templates[parity].size.x, templates[parity].size.z) * 0.35;
    let baseY = Infinity;
    for (let a = 0; a < 8; a++) {
      baseY = Math.min(baseY, geo.heightAt(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r));
    }
    baseY = Math.min(baseY, geo.heightAt(t.x, t.z));
    const pos = new THREE.Vector3(t.x, baseY, t.z);
    const matrix = new THREE.Matrix4().compose(
      pos,
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot),
      new THREE.Vector3(1, 1, 1),
    );
    return { ...t, parity, baseY, matrix, pos };
  });
}

interface Slot {
  meshes: THREE.InstancedMesh[];
  cut: THREE.InstancedBufferAttribute[];
}

function makeSlot(lots: { geometry: THREE.BufferGeometry; material: THREE.Material }[], cap: number, floorH: number, shadows: boolean): Slot {
  const depth = patchDepth(floorH);
  const meshes: THREE.InstancedMesh[] = [];
  const cut: THREE.InstancedBufferAttribute[] = [];
  for (const lot of lots) {
    const g = lot.geometry;
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(FULL), 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iCut', attr);
    const m = new THREE.InstancedMesh(g, lot.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, WHITE);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = shadows && !(lot.material as THREE.MeshStandardMaterial).transparent;
    m.receiveShadow = true;
    m.customDepthMaterial = depth;
    m.raycast = () => {};
    meshes.push(m);
    cut.push(attr);
  }
  return { meshes, cut };
}

function useParitySet(tpl: TowerTemplate, towers: PlacedTower[]) {
  return useMemo(() => {
    const cap = towers.length;
    const near = makeSlot(tpl.near, cap, tpl.floorH, false);
    const far = makeSlot(tpl.far, cap, tpl.floorH, true);
    const ghostMat = makeGhostMaterial(tpl.floorH);
    ghostMat.side = THREE.FrontSide;
    ghostMat.depthFunc = THREE.LessEqualDepth;
    const ghost = makeSlot(
      [
        { geometry: tpl.ghost, material: makeGhostDepthMaterial() },
        { geometry: tpl.ghost.clone(), material: ghostMat },
      ],
      cap,
      tpl.floorH,
      false,
    );
    ghost.meshes[0].renderOrder = 1;
    ghost.meshes[1].renderOrder = 2;
    const group = new THREE.Group();
    [...near.meshes, ...far.meshes, ...ghost.meshes].forEach((m) => group.add(m));
    return { near, far, ghost, group };
  }, [tpl, towers]);
}

/** Altura (m, local da torre) até onde a torre aparece sólida. */
function cutFor(t: PlacedTower, tpl: TowerTemplate, obra: ReturnType<typeof useStore.getState>['obra']) {
  const o = obra[t.id];
  if (o) {
    if (o.stage === 'entregue' || o.stage === 'acabamento' || o.stage === 'vedacao') return FULL;
    if (o.stage === 'nao_iniciado' || o.stage === 'sem_registro') return -1;
    if (o.stage === 'fundacao') return tpl.floor1Y;
    const f = o.structureFloors ?? Math.round((o.progress / 100) * tpl.floors);
    return tpl.floor1Y + f * tpl.floorH;
  }
  return t.built ? FULL : -1;
}

export function Towers({ geo, onPlaced }: { geo: Geo; onPlaced?: (t: PlacedTower[], tpl: Record<Parity, TowerTemplate>) => void }) {
  const paresGltf = useGLTF(assetUrl('models/Firenze_Pares.glb'));
  const imparesGltf = useGLTF(assetUrl('models/Firenze_Impares.glb'));
  const templates = useMemo(
    () => ({ pares: buildTemplate(paresGltf.scene, 'pares'), impares: buildTemplate(imparesGltf.scene, 'impares') }),
    [paresGltf, imparesGltf],
  );
  const placed = useMemo(() => placeTowers(geo, templates), [geo, templates]);
  const byParity = useMemo(
    () => ({ pares: placed.filter((t) => t.parity === 'pares'), impares: placed.filter((t) => t.parity === 'impares') }),
    [placed],
  );
  useEffect(() => onPlaced?.(placed, templates), [placed, templates, onPlaced]);

  const pares = useParitySet(templates.pares, byParity.pares);
  const impares = useParitySet(templates.impares, byParity.impares);
  const lastKey = useRef('');
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const s = useStore.getState();
    const lods = placed.map((t) => {
      tmpV.copy(t.pos).y += 40;
      return t.id === s.tower || camera.position.distanceTo(tmpV) < NEAR_DIST;
    });
    const key = `${s.mode}|${s.tower}|${s.hovered}|${s.group}|${s.layers.shadows}|${lods.map(Number).join('')}|${Object.keys(s.obra).length}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    for (const [parity, set] of [['pares', pares], ['impares', impares]] as const) {
      const tpl = templates[parity];
      const counts = { near: 0, far: 0, ghost: 0 };
      placed.forEach((t, i) => {
        if (t.parity !== parity) return;
        const selected = t.id === s.tower;
        const cut = cutFor(t, tpl, s.obra);
        const solid = s.mode === 'completo' ? true : s.mode === 'fantasma' ? selected : cut > 0;
        const solidCut = s.mode === 'completo' ? FULL : cut;
        const tint = selected ? SELECTED_TINT : t.id === s.hovered ? HOVER_TINT : s.group === t.group ? GROUP_TINT : WHITE;
        if (solid && (solidCut > 0 || selected)) {
          const slot = lods[i] ? set.near : set.far;
          const k = lods[i] ? counts.near++ : counts.far++;
          slot.meshes.forEach((m, j) => {
            m.setMatrixAt(k, t.matrix);
            m.setColorAt(k, tint);
            slot.cut[j].setX(k, solidCut <= 0 ? FULL : solidCut);
          });
        }
        const showGhost = !solid || solidCut < tpl.height;
        if (showGhost) {
          const k = counts.ghost++;
          set.ghost.meshes.forEach((m, j) => {
            m.setMatrixAt(k, t.matrix);
            set.ghost.cut[j].setX(k, solid ? -1 : FULL);
          });
        }
      });
      for (const [slot, n] of [[set.near, counts.near], [set.far, counts.far], [set.ghost, counts.ghost]] as const) {
        slot.meshes.forEach((m, j) => {
          m.count = n;
          m.visible = n > 0;
          m.castShadow = slot === set.far && s.layers.shadows && !(m.material as THREE.Material).transparent;
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
          slot.cut[j].needsUpdate = true;
        });
      }
    }
  });

  return (
    <group>
      <primitive object={pares.group} />
      <primitive object={impares.group} />
      <Pickers placed={placed} templates={templates} />
      <SelectionHighlight placed={placed} templates={templates} />
    </group>
  );
}

function Pickers({ placed, templates }: { placed: PlacedTower[]; templates: Record<Parity, TowerTemplate> }) {
  const selectTower = useStore((s) => s.selectTower);
  const setHovered = useStore((s) => s.setHovered);
  const items = useMemo(
    () =>
      placed.map((t) => {
        const tpl = templates[t.parity];
        const c = tpl.center.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
        return { t, size: [tpl.size.x * 0.8, tpl.height, tpl.size.z * 0.8] as const, pos: [t.x + c.x, t.baseY + tpl.height / 2, t.z + c.z] as const };
      }),
    [placed, templates],
  );
  return (
    <group>
      {items.map(({ t, size, pos }) => (
        <mesh
          key={t.id}
          position={pos as unknown as THREE.Vector3Tuple}
          rotation={[0, t.rot, 0]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            selectTower(t.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(t.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(null);
            document.body.style.cursor = '';
          }}
        >
          <boxGeometry args={size as unknown as [number, number, number]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Faixa verde no pavimento escolhido do mapa de unidades. */
function SelectionHighlight({ placed, templates }: { placed: PlacedTower[]; templates: Record<Parity, TowerTemplate> }) {
  const towerId = useStore((s) => s.tower);
  const floor = useStore((s) => s.floor);
  const t = placed.find((p) => p.id === towerId);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.12;
  });
  if (!t || floor == null) return null;
  const tpl = templates[t.parity];
  const c = tpl.center.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
  const y = t.baseY + tpl.floor1Y + (floor - 1) * tpl.floorH + tpl.floorH / 2;
  return (
    <mesh ref={ref} position={[t.x + c.x, y, t.z + c.z]} rotation={[0, t.rot, 0]} renderOrder={3}>
      <boxGeometry args={[tpl.size.x * 1.02, tpl.floorH * 0.96, tpl.size.z * 1.02]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

useGLTF.preload(assetUrl('models/Firenze_Pares.glb'));
useGLTF.preload(assetUrl('models/Firenze_Impares.glb'));
