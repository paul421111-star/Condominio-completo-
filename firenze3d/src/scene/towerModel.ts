import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Parity = 'pares' | 'impares';

const EXTERIOR: Record<Parity, Set<string>> = {
  pares: new Set([
    'Concreto_novo', 'Fachada_branca', 'Fachada_cinza_clara', 'Fachada_cinza_escura',
    'Vidro_fachada', 'Vidro_varanda', 'Esquadria_escura', 'Metal', 'Faixa',
  ]),
  impares: new Set([
    'Concreto', 'Fachada_marfin', 'Fachada_cinza', 'Vidro_azul', 'Vidro_guarda_corpo', 'Esquadrias', 'Metal',
  ]),
};
const GLASS = new Set(['Vidro_fachada', 'Vidro_varanda', 'Vidro_azul', 'Vidro_guarda_corpo']);

export interface Lot {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  glass: boolean;
}

export interface TowerTemplate {
  parity: Parity;
  floors: number;
  floorH: number;
  /** y da base do 1º pavimento-tipo. */
  floor1Y: number;
  height: number;
  size: THREE.Vector3;
  center: THREE.Vector3;
  near: Lot[];
  far: Lot[];
  ghost: THREE.BufferGeometry;
}

export const towerUniforms = {
  uNight: { value: 0 },
};

function floorOf(obj: THREE.Object3D, floors: number): number {
  let n: THREE.Object3D | null = obj;
  while (n) {
    const m = n.name.match(/PAVIMENTO_(\d+)/i);
    if (m) return parseInt(m[1], 10);
    if (/COBERTURA/i.test(n.name)) return floors + 1;
    n = n.parent;
  }
  return 0;
}

function prepGeometry(mesh: THREE.Mesh, floor: number) {
  const src = mesh.geometry as THREE.BufferGeometry;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
  const n = g.getAttribute('position').count;
  if (src.index) g.setIndex(src.index.clone());
  else g.setIndex([...Array(n).keys()]);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.applyMatrix4(mesh.matrixWorld);
  g.setAttribute('aFloor', new THREE.Float32BufferAttribute(new Float32Array(n).fill(floor), 1));
  return g;
}

const SHADER_HEAD_V = /* glsl */ `
attribute float iCut;
varying float vLocalY;
varying float vCut;
varying float vSeed;
`;
const SHADER_BODY_V = /* glsl */ `
#ifdef USE_INSTANCING
  vLocalY = (instanceMatrix * vec4(transformed, 1.0)).y - instanceMatrix[3].y;
  vSeed = float(gl_InstanceID) * 17.0 + floor(transformed.x / 6.5) * 3.0 + floor(transformed.z / 6.5) * 5.0;
#else
  vLocalY = transformed.y;
  vSeed = floor(transformed.x / 6.5) * 3.0 + floor(transformed.z / 6.5) * 5.0;
#endif
  vCut = iCut;
`;
const SHADER_HEAD_F = /* glsl */ `
varying float vLocalY;
varying float vCut;
varying float vSeed;
uniform float uNight;
uniform float uFloorH;
float hash11(float p) { return fract(sin(p * 12.9898) * 43758.5453); }
`;

/** Injeta corte por altura (obra em andamento) e janelas acesas à noite. */
export function patchMaterial(mat: THREE.Material, floorH: number, glass: boolean) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uNight = towerUniforms.uNight;
    s.uniforms.uFloorH = { value: floorH };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${SHADER_HEAD_V}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SHADER_BODY_V}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${SHADER_HEAD_F}`)
      .replace('void main() {', 'void main() {\n  if (vLocalY > vCut) discard;');
    if (glass && 'emissive' in mat) {
      s.fragmentShader = s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  float fl = floor(vLocalY / uFloorH);
  float lit = step(0.42, hash11(fl * 1.37 + vSeed));
  totalEmissiveRadiance += vec3(1.0, 0.76, 0.42) * uNight * lit * 1.8;`,
      );
    }
  };
  mat.customProgramCacheKey = () => `tower-${glass ? 'g' : 's'}-${floorH.toFixed(2)}`;
  return mat;
}

export function patchDepth(floorH: number) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  patchMaterial(m, floorH, false);
  return m;
}

function makeMaterial(src: THREE.MeshStandardMaterial, name: string): THREE.MeshStandardMaterial {
  const glass = GLASS.has(name);
  const m = new THREE.MeshStandardMaterial({
    name,
    color: src.color?.clone() ?? new THREE.Color('#ffffff'),
    roughness: glass ? 0.08 : Math.max(0.55, src.roughness ?? 0.7),
    metalness: glass ? 0.35 : 0.0,
    transparent: glass,
    opacity: glass ? Math.min(0.75, src.opacity ?? 0.6) : 1,
    envMapIntensity: glass ? 1.4 : 0.6,
    emissive: new THREE.Color('#000000'),
    side: THREE.FrontSide,
    depthWrite: !glass,
  });
  return m;
}

function mergeLots(parts: Map<string, THREE.BufferGeometry[]>, mats: Map<string, THREE.MeshStandardMaterial>, floorH: number) {
  const lots: Lot[] = [];
  parts.forEach((list, name) => {
    if (!list.length) return;
    const geometry = mergeGeometries(list, false);
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const glass = GLASS.has(name);
    lots.push({ name, geometry, glass, material: patchMaterial(makeMaterial(mats.get(name)!, name), floorH, glass) });
  });
  return lots;
}

export function buildTemplate(scene: THREE.Object3D, parity: Parity): TowerTemplate {
  const floors = parity === 'pares' ? 28 : 36;
  scene.updateMatrixWorld(true);

  const byFloor = new Map<number, { name: string; geo: THREE.BufferGeometry }[]>();
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const bounds = new THREE.Box3();
  const floorMin = new Map<number, number>();

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    if (!EXTERIOR[parity].has(mat.name)) return;
    const floor = floorOf(mesh, floors);
    const geo = prepGeometry(mesh, floor);
    geo.computeBoundingBox();
    bounds.union(geo.boundingBox!);
    floorMin.set(floor, Math.min(floorMin.get(floor) ?? Infinity, geo.boundingBox!.min.y));
    if (!mats.has(mat.name)) mats.set(mat.name, mat);
    if (!byFloor.has(floor)) byFloor.set(floor, []);
    byFloor.get(floor)!.push({ name: mat.name, geo });
  });

  // Base no chão: o modelo pode ter subsolo abaixo de y = 0.
  const lift = -bounds.min.y;
  const f1 = floorMin.get(1) ?? 0;
  const fN = floorMin.get(floors) ?? bounds.max.y;
  const floorH = (fN - f1) / (floors - 1);
  const floor1Y = f1 + lift;

  const nearParts = new Map<string, THREE.BufferGeometry[]>();
  const farParts = new Map<string, THREE.BufferGeometry[]>();
  const push = (m: Map<string, THREE.BufferGeometry[]>, k: string, g: THREE.BufferGeometry) => {
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(g);
  };

  byFloor.forEach((list, floor) => {
    for (const { name, geo } of list) {
      geo.translate(0, lift, 0);
      push(nearParts, name, geo);
      // O mesmo modelo em qualquer distância: o andar esticado apagava a fachada real.
      push(farParts, name, geo.clone());
    }
  });

  const near = mergeLots(nearParts, mats, floorH);
  const far = mergeLots(farParts, mats, floorH);

  const ghostSrc = far.filter((l) => !l.glass).map((l) => l.geometry);
  const ghost = mergeGeometries(ghostSrc, false)!;
  ghost.computeVertexNormals();

  bounds.translate(new THREE.Vector3(0, lift, 0));
  return {
    parity,
    floors,
    floorH,
    floor1Y,
    height: bounds.max.y,
    size: bounds.getSize(new THREE.Vector3()),
    center: bounds.getCenter(new THREE.Vector3()),
    near,
    far,
    ghost,
  };
}

/** Material das torres "fantasma": vidro azulado com fresnel e linhas de pavimento. */
export function makeGhostMaterial(floorH: number) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uFloorH: { value: floorH }, uColor: { value: new THREE.Color('#6f9cf2') } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float iCut;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vCut;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vY = (instanceMatrix * vec4(position, 1.0)).y - instanceMatrix[3].y;
        vCut = iCut;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uFloorH; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vCut;
      void main() {
        #include <logdepthbuf_fragment>
        float fres = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0);
        float line = 1.0 - smoothstep(0.0, 0.06, abs(fract(vY / uFloorH) - 0.5) - 0.44);
        float a = 0.13 + fres * 0.42 + line * 0.2;
        vec3 c = mix(uColor, vec3(0.86, 0.93, 1.0), fres * 0.55);
        c = mix(c, vec3(0.2, 0.4, 0.85), line * 0.5);
        if (vY > vCut) { a *= 0.35; }
        gl_FragColor = vec4(c, a);
      }`,
  });
  return m;
}

/** Pré-passe só de profundidade: o vidro fantasma pinta apenas a casca externa. */
export function makeGhostDepthMaterial() {
  return new THREE.ShaderMaterial({
    colorWrite: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(0.0);
      }`,
  });
}
