import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Environment, Preload } from '@react-three/drei';
import type { Geo } from '../lib/geo';
import { GROUP_BY_ID } from '../data/condo';
import { useStore } from '../store';
import { isRaining } from '../lib/weather';
import { Terrain } from './Terrain';
import { Towers, type PlacedTower } from './Towers';
import { Trees, Water } from './Nature';
import { SunPath, SunSystem } from './Sun';
import { Labels } from './Labels';
import { GoogleTiles, getGoogleKey } from './GoogleTiles';
import type { Parity, TowerTemplate } from './towerModel';

const HOME = { pos: new THREE.Vector3(820, 1050, 1350), target: new THREE.Vector3(-40, 60, -60) };

function CameraRig({ placed, templates, target }: { placed: PlacedTower[]; templates: Record<Parity, TowerTemplate> | null; target: React.RefObject<THREE.Vector3> }) {
  const controls = useRef<CameraControls>(null);
  const group = useStore((s) => s.group);
  const tower = useStore((s) => s.tower);
  const nonce = useStore((s) => s.flyNonce);
  const phase = useStore((s) => s.phase);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (phase !== 'explore') {
      c.setLookAt(HOME.pos.x * 1.6, HOME.pos.y * 1.4, HOME.pos.z * 1.6, HOME.target.x, HOME.target.y, HOME.target.z, false);
      return;
    }
    c.setLookAt(HOME.pos.x, HOME.pos.y, HOME.pos.z, HOME.target.x, HOME.target.y, HOME.target.z, true);
  }, [phase, nonce]);

  useEffect(() => {
    const c = controls.current;
    if (!c || !templates) return;
    if (tower) {
      const t = placed.find((p) => p.id === tower);
      if (!t) return;
      const h = templates[t.parity].height;
      const dir = new THREE.Vector3(0.9, 0, 0.42).normalize();
      const look = new THREE.Vector3(t.x, t.baseY + h * 0.5, t.z);
      const pos = look.clone().addScaledVector(dir, 340).setY(t.baseY + h * 1.25);
      c.setLookAt(pos.x, pos.y, pos.z, look.x, look.y, look.z, true);
    } else if (group) {
      const g = GROUP_BY_ID[group];
      const ts = placed.filter((p) => p.group === group);
      const y = ts.length ? Math.min(...ts.map((t) => t.baseY)) : 0;
      c.setLookAt(g.center[0] + 420, y + 320, g.center[1] + 200, g.center[0], y + 50, g.center[1], true);
    }
  }, [group, tower, placed, templates]);

  useFrame(() => {
    controls.current?.getTarget(target.current!);
  });

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { controls: unknown }).controls = controls.current;
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={60}
      maxDistance={3400}
      maxPolarAngle={Math.PI * 0.47}
      smoothTime={0.6}
      dollySpeed={0.6}
    />
  );
}

function IntroOrbit() {
  useFrame(({ camera }, dt) => {
    if (useStore.getState().phase === 'explore') return;
    const a = dt * 0.04;
    const { x, z } = camera.position;
    camera.position.x = x * Math.cos(a) - z * Math.sin(a);
    camera.position.z = x * Math.sin(a) + z * Math.cos(a);
    camera.lookAt(HOME.target);
  });
  return null;
}

function Rain({ target }: { target: React.RefObject<THREE.Vector3> }) {
  const weather = useStore((s) => s.weather);
  const ref = useRef<THREE.LineSegments>(null);
  const N = 5000;
  const geom = useMemo(() => {
    const p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 900, y = Math.random() * 500, z = (Math.random() - 0.5) * 900;
      p.set([x, y, z, x + 1.2, y - 9, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const l = ref.current;
    if (!l) return;
    l.position.y -= dt * 260;
    if (l.position.y < -250) l.position.y += 250;
    const t = target.current;
    if (t) l.position.set(t.x, l.position.y, t.z);
  });
  if (!isRaining(weather)) return null;
  return (
    <lineSegments ref={ref} geometry={geom} frustumCulled={false}>
      <lineBasicMaterial color="#9fb3c8" transparent opacity={0.35} />
    </lineSegments>
  );
}

function World({ geo }: { geo: Geo }) {
  const [placed, setPlaced] = useState<PlacedTower[]>([]);
  const [templates, setTemplates] = useState<Record<Parity, TowerTemplate> | null>(null);
  const target = useRef(new THREE.Vector3());
  const layers = useStore((s) => s.layers);
  const gkey = getGoogleKey();
  const city3d = layers.city3d && !!gkey;

  const onPlaced = useCallback((p: PlacedTower[], t: Record<Parity, TowerTemplate>) => {
    setPlaced(p);
    setTemplates(t);
  }, []);

  return (
    <>
      <SunSystem target={target} />
      <CameraRig placed={placed} templates={templates} target={target} />
      <IntroOrbit />
      {city3d && templates ? (
        <GoogleTiles apiKey={gkey} geo={geo} placed={placed} templates={templates} />
      ) : (
        <Terrain geo={geo} />
      )}
      {!city3d && <Water geo={geo} />}
      {!city3d && layers.trees && <Trees geo={geo} />}
      <Towers geo={geo} onPlaced={onPlaced} />
      {templates && <Labels geo={geo} placed={placed} templates={templates} />}
      <SunPath />
      <Rain target={target} />
    </>
  );
}

export function Experience({ geo }: { geo: Geo }) {
  const shadows = useStore((s) => s.layers.shadows);
  const selectTower = useStore((s) => s.selectTower);
  return (
    <Canvas
      shadows={shadows ? 'soft' : false}
      dpr={[1, 1.75]}
      gl={{ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' }}
      camera={{ fov: 38, near: 2, far: 12000, position: HOME.pos.toArray() }}
      onPointerMissed={() => selectTower(null)}
    >
      <Suspense fallback={null}>
        <Environment preset="city" />
        <World geo={geo} />
        <Preload all />
      </Suspense>
    </Canvas>
  );
}
