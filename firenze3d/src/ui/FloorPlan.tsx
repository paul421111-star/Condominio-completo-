import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Environment, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { useStore } from '../store';
import { GROUP_BY_ID, TOWER_BY_ID, aptLabel } from '../data/condo';
import { assetUrl } from '../lib/geo';

function unitOf(o: THREE.Object3D): number | null {
  let n: THREE.Object3D | null = o;
  while (n) {
    const a = n.name.match(/Apartamento_\d{2}(\d{2})/i) || n.name.match(/APARTAMENTO_(\d{2})$/);
    if (a) return parseInt(a[1], 10);
    n = n.parent;
  }
  return null;
}

function Plan({ even, unit }: { even: boolean; unit: number }) {
  const url = assetUrl(even ? 'models/plantas/pares_pavimento_tipo.glb' : 'models/plantas/impares_pavimento_tipo.glb');
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const u = unitOf(m);
      const src = m.material as THREE.MeshStandardMaterial;
      const mat = src.clone();
      if (u !== null && u !== unit) {
        mat.transparent = true;
        mat.opacity = 0.18;
        mat.depthWrite = false;
      }
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return root;
  }, [scene, unit]);
  return <primitive object={model} />;
}

export function FloorPlanModal() {
  const open = useStore((s) => s.planOpen);
  const setOpen = useStore((s) => s.setPlanOpen);
  const towerId = useStore((s) => s.tower);
  const floor = useStore((s) => s.floor);
  const unit = useStore((s) => s.unit);
  if (!open || !towerId || floor == null || unit == null) return null;
  const t = TOWER_BY_ID[towerId];
  const g = GROUP_BY_ID[t.group];

  return (
    <div className="modal" onClick={() => setOpen(false)}>
      <div className="modal-box glass" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <small style={{ color: g.color }}>● {g.name} · Bloco {t.block}</small>
            <h3>Apto {aptLabel(floor, unit)} · {floor}º andar</h3>
            <span className="muted">{g.typology} · {g.area} · pavimento-tipo com {g.aptsPerFloor} unidades</span>
          </div>
          <button className="x" onClick={() => setOpen(false)}>✕</button>
        </header>
        <div className="modal-canvas">
          <Canvas shadows camera={{ position: [18, 26, 24], fov: 40 }} dpr={[1, 2]}>
            <color attach="background" args={['#f3f6f8']} />
            <Suspense fallback={<Html center>Carregando planta…</Html>}>
              <Environment preset="apartment" environmentIntensity={0.7} />
              <directionalLight position={[10, 20, 8]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
              <Bounds fit clip observe margin={1.1}>
                <Plan even={g.even} unit={unit} />
              </Bounds>
              <ContactShadows position={[0, -0.05, 0]} opacity={0.35} scale={60} blur={2.4} far={10} />
            </Suspense>
            <OrbitControls makeDefault maxPolarAngle={Math.PI * 0.48} />
          </Canvas>
        </div>
        <footer className="muted">Unidade destacada; as demais do pavimento aparecem translúcidas. Arraste para girar, role para aproximar.</footer>
      </div>
    </div>
  );
}
