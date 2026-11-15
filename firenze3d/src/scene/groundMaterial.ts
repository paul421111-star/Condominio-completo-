import * as THREE from 'three';
import type { Geo } from '../lib/geo';
import siteplan from '../data/siteplan.json';

/** Opacidade da planta do PDF sobre o satélite (0 = só satélite). */
export const groundUniforms = {
  uPlanMix: { value: 1 },
};

/**
 * Chão da maquete: satélite com leve dessaturação e, por cima, a planta de
 * implantação do manual de Comunicação Visual onde ela tem desenho. As duas
 * texturas são amostradas pela posição no mundo, então terreno e lajes casam.
 */
export function makeGroundMaterial(geo: Geo, sat: THREE.Texture, plan: THREE.Texture, opts: { tint?: string } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: opts.tint ?? '#ffffff', roughness: 0.95, metalness: 0 });
  const { minX, maxX, minZ, maxZ } = geo.sat;
  const [u, v] = siteplan.plan.uv;
  m.onBeforeCompile = (s) => {
    s.uniforms.tSat = { value: sat };
    s.uniforms.tPlan = { value: plan };
    s.uniforms.uSatRect = { value: new THREE.Vector4(minX, maxX, minZ, maxZ) };
    s.uniforms.uPlanU = { value: new THREE.Vector3(...u) };
    s.uniforms.uPlanV = { value: new THREE.Vector3(...v) };
    s.uniforms.uPlanMix = groundUniforms.uPlanMix;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vGroundXZ;
uniform sampler2D tSat, tPlan;
uniform vec4 uSatRect;
uniform vec3 uPlanU, uPlanV;
uniform float uPlanMix;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec2 satUv = vec2((vGroundXZ.x - uSatRect.x) / (uSatRect.y - uSatRect.x), 1.0 - (vGroundXZ.y - uSatRect.z) / (uSatRect.w - uSatRect.z));
  vec3 ground = texture2D(tSat, satUv).rgb;
  float lum = dot(ground, vec3(0.299, 0.587, 0.114));
  ground = pow(mix(vec3(lum), ground, 0.78) * vec3(0.98, 1.0, 1.05), vec3(0.92));
  vec2 planUv = vec2(dot(uPlanU, vec3(vGroundXZ, 1.0)), 1.0 - dot(uPlanV, vec3(vGroundXZ, 1.0)));
  vec4 plan = texture2D(tPlan, planUv);
  float inPlan = step(0.001, planUv.x) * step(planUv.x, 0.999) * step(0.001, planUv.y) * step(planUv.y, 0.999);
  ground = mix(ground, plan.rgb, plan.a * inPlan * uPlanMix);
  diffuseColor.rgb *= ground;`,
      );
  };
  m.customProgramCacheKey = () => 'ground';
  return m;
}

export function preparePlanTexture(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
