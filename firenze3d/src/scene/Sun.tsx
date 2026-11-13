import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from '../store';
import { fmtTime, sunDirection, sunTimes } from '../lib/sun';
import { towerUniforms } from './towerModel';

const DAY_BG = new THREE.Color('#eaf1f6');
const GOLD_BG = new THREE.Color('#f6e3cf');
const NIGHT_BG = new THREE.Color('#0d1626');
const SUN_DAY = new THREE.Color('#fff6e8');
const SUN_GOLD = new THREE.Color('#ffb36b');
const ARC_R = 1150;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function SunSystem({ target }: { target: React.RefObject<THREE.Vector3> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const { scene } = useThree();
  const shadows = useStore((s) => s.layers.shadows);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const bg = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.background = new THREE.Color(DAY_BG);
    scene.fog = new THREE.Fog(DAY_BG, 2600, 6500);
    if (import.meta.env.DEV) (window as unknown as { scene: THREE.Scene }).scene = scene;
  }, [scene]);

  useFrame((_, dt) => {
    const s = useStore.getState();
    if (s.playing) s.setTime(s.time + dt * 3600_000 * 1.2);
    else if (s.live && Math.random() < 0.01) s.setTime(Date.now(), true);

    sunDirection(s.time, dir);
    const alt = dir.y;
    const day = smooth(-0.06, 0.12, alt);
    const gold = smooth(0.35, 0.02, alt) * day;
    const cloud = (s.weather?.cloud ?? 0) / 100;

    bg.copy(NIGHT_BG).lerp(DAY_BG, day).lerp(GOLD_BG, gold * 0.6);
    (scene.background as THREE.Color).copy(bg);
    (scene.fog as THREE.Fog).color.copy(bg);

    towerUniforms.uNight.value = 1 - smooth(-0.04, 0.08, alt);

    const t = target.current ?? new THREE.Vector3();
    if (light.current) {
      const L = light.current;
      L.position.copy(t).addScaledVector(dir.y > 0 ? dir : dir.clone().setY(0.05).normalize(), 1800);
      L.target.position.copy(t);
      L.target.updateMatrixWorld();
      L.intensity = 3.2 * day * (1 - cloud * 0.55);
      L.color.copy(SUN_DAY).lerp(SUN_GOLD, gold);
      L.castShadow = shadows && day > 0.02;
    }
    if (hemi.current) hemi.current.intensity = 0.06 + day * (0.9 + cloud * 0.4);
    if (amb.current) amb.current.intensity = 0.04 + day * 0.25;
    scene.environmentIntensity = 0.08 + day * 0.5;
  });

  return (
    <>
      <directionalLight
        ref={light}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-900}
        shadow-camera-right={900}
        shadow-camera-top={900}
        shadow-camera-bottom={-900}
        shadow-camera-near={10}
        shadow-camera-far={4200}
      />
      <hemisphereLight ref={hemi} args={['#dbe9ff', '#6b6f5a', 1]} />
      <ambientLight ref={amb} intensity={0.2} />
    </>
  );
}

/** Trajetória do sol no dia simulado, com nascer e pôr. */
export function SunPath() {
  const time = useStore((s) => s.time);
  const show = useStore((s) => s.layers.sunPath);
  const sunRef = useRef<THREE.Mesh>(null);
  const dayKey = Math.floor((time - 3 * 3600_000) / 86400_000);

  const { tube, hours, rise, set } = useMemo(() => {
    const { sunrise, sunset } = sunTimes(time);
    const pts: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= 96; i++) {
      const t = sunrise + ((sunset - sunrise) * i) / 96;
      sunDirection(t, v);
      pts.push(v.clone().multiplyScalar(ARC_R));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 3, 6, false);
    const hours: THREE.Vector3[] = [];
    for (let h = Math.ceil(sunrise / 3600_000) * 3600_000; h < sunset; h += 3600_000) {
      hours.push(sunDirection(h).multiplyScalar(ARC_R));
    }
    return { tube, hours, rise: { t: sunrise, p: pts[0] }, set: { t: sunset, p: pts[pts.length - 1] } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);

  useFrame(() => {
    const s = useStore.getState();
    const d = sunDirection(s.time);
    sunRef.current?.position.copy(d.multiplyScalar(ARC_R));
    if (sunRef.current) sunRef.current.visible = d.y > -5;
  });

  if (!show) return null;
  return (
    <group>
      <mesh geometry={tube} raycast={() => null}>
        <meshBasicMaterial color="#f5b301" transparent opacity={0.75} toneMapped={false} fog={false} />
      </mesh>
      {hours.map((p, i) => (
        <mesh key={i} position={p} raycast={() => null}>
          <sphereGeometry args={[7, 12, 8]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} fog={false} />
        </mesh>
      ))}
      <mesh ref={sunRef}>
        <sphereGeometry args={[34, 32, 16]} />
        <meshBasicMaterial color="#ffd34d" toneMapped={false} />
      </mesh>
      <Html position={rise.p} center className="sun-tag" zIndexRange={[6, 0]}>
        <span>☀ Nascer · {fmtTime(rise.t)}</span>
      </Html>
      <Html position={set.p} center className="sun-tag" zIndexRange={[6, 0]}>
        <span>☾ Pôr · {fmtTime(set.t)}</span>
      </Html>
    </group>
  );
}
