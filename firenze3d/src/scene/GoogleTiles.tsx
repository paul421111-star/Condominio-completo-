import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TilesRenderer, TilesPlugin } from '3d-tiles-renderer/r3f';
import {
  GoogleCloudAuthPlugin,
  ReorientationPlugin,
  TileFlatteningPlugin,
  TilesFadePlugin,
  GLTFExtensionsPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Geo } from '../lib/geo';
import type { PlacedTower } from './Towers';
import type { Parity, TowerTemplate } from './towerModel';

/** Ondulação do geoide (EGM96) em Embu das Artes, ≈ −5 m. */
const GEOID_N = -5;

export function getGoogleKey(): string {
  const q = new URLSearchParams(location.search).get('gkey');
  if (q) localStorage.setItem('gmapsKey', q);
  return q || localStorage.getItem('gmapsKey') || (import.meta.env.VITE_GOOGLE_MAPS_KEY as string) || '';
}

const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

/** Leve dessaturação e tom frio, como a cidade do Oceanos. */
function gradeTile(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (!m || m.userData.graded) return;
    m.userData.graded = true;
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.62) * vec3(0.96, 1.0, 1.08);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.95), 0.12);`,
      );
    };
    m.needsUpdate = true;
  });
}

export function GoogleTiles({
  apiKey,
  geo,
  placed,
  templates,
}: {
  apiKey: string;
  geo: Geo;
  placed: PlacedTower[];
  templates: Record<Parity, TowerTemplate>;
}) {
  const flatten = useRef<TileFlatteningPlugin>(null);
  const tilesRef = useRef<{ group: THREE.Group } | null>(null);

  const shapes = useMemo(
    () =>
      placed.map((t) => {
        const tpl = templates[t.parity];
        const r = Math.max(tpl.size.x, tpl.size.z) * 0.62;
        const g = new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(g);
        m.position.set(t.x, t.baseY + 1.5, t.z);
        m.updateMatrixWorld(true);
        return m;
      }),
    [placed, templates],
  );

  useEffect(() => {
    const plugin = flatten.current;
    const tiles = tilesRef.current;
    if (!plugin || !tiles) return;
    tiles.group.updateMatrixWorld(true);
    const inv = tiles.group.matrixWorld.clone().invert();
    const down = new THREE.Vector3(0, -1, 0).transformDirection(inv);
    plugin.clearShapes();
    for (const s of shapes) {
      const local = s.clone();
      local.matrixAutoUpdate = false;
      local.matrix.copy(inv).multiply(s.matrixWorld);
      local.matrixWorld.copy(local.matrix);
      try {
        plugin.addShape(local, down, 400);
      } catch {
        /* versão sem suporte */
      }
    }
  }, [shapes]);

  return (
    <TilesRenderer
      ref={tilesRef as never}
      errorTarget={12}
      onLoadModel={({ scene }: { scene: THREE.Object3D }) => gradeTile(scene)}
    >
      <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey, autoRefreshToken: true }]} />
      <TilesPlugin plugin={GLTFExtensionsPlugin} args={[{ dracoLoader: draco }]} />
      <TilesPlugin plugin={TilesFadePlugin} />
      <TilesPlugin
        plugin={ReorientationPlugin}
        args={[
          {
            lat: geo.origin.lat * THREE.MathUtils.DEG2RAD,
            lon: geo.origin.lon * THREE.MathUtils.DEG2RAD,
            height: geo.base + GEOID_N,
            recenter: true,
          },
        ]}
      />
      <TilesPlugin plugin={TileFlatteningPlugin} ref={flatten as never} />
    </TilesRenderer>
  );
}
