import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { Geo, XZ } from '../lib/geo';
import { GROUPS, GROUP_BY_ID } from '../data/condo';
import { useStore } from '../store';
import type { PlacedTower } from './Towers';
import type { Parity, TowerTemplate } from './towerModel';
import { DISC_R, SKIRT_DEPTH } from './Terrain';

const ROADS: { match: RegExp; title: string; sub: string }[] = [
  { match: /Régis Bittencourt/, title: 'BR-116', sub: 'Rodovia Régis Bittencourt' },
  { match: /^Estrada São Judas/, title: 'Estrada São Judas', sub: 'Acesso G12 · G14 · G16 · G18' },
  { match: /^Avenida João Paulo I$/, title: 'Av. João Paulo I', sub: 'Acesso G13 · G15 · G17' },
  { match: /Rodoanel/, title: 'Rodoanel', sub: 'Mário Covas · SP-021' },
];

function anchorOf(lines: XZ[][], prefer: number) {
  let best: XZ | null = null;
  let score = Infinity;
  for (const pts of lines) {
    for (const p of pts) {
      const d = Math.hypot(p[0], p[1]);
      if (d > DISC_R - 60) continue;
      const s = Math.abs(d - prefer);
      if (s < score) { score = s; best = p; }
    }
  }
  return best;
}

export function Labels({ geo, placed, templates }: { geo: Geo; placed: PlacedTower[]; templates: Record<Parity, TowerTemplate> }) {
  const show = useStore((s) => s.layers.labels);
  const group = useStore((s) => s.group);
  const tower = useStore((s) => s.tower);
  const selectGroup = useStore((s) => s.selectGroup);
  const selectTower = useStore((s) => s.selectTower);
  const obra = useStore((s) => s.obra);

  const roads = useMemo(
    () =>
      ROADS.map((r) => {
        const lines = geo.roads.filter((x) => r.match.test(x.name)).map((x) => x.pts);
        const p = anchorOf(lines, 700);
        return p ? { ...r, pos: [p[0], geo.heightAt(p[0], p[1]) + 14, p[1]] as [number, number, number] } : null;
      }).filter(Boolean) as { title: string; sub: string; pos: [number, number, number] }[],
    [geo],
  );

  if (!show) return null;
  const compassY = Math.min(...[0, 1, 2, 3].map((i) => geo.heightAt(Math.cos(i) * DISC_R, Math.sin(i) * DISC_R))) - SKIRT_DEPTH + 2;
  const R = DISC_R + 140;

  return (
    <group>
      {GROUPS.map((g) => {
        const ts = placed.filter((t) => t.group === g.id);
        const top = Math.max(...ts.map((t) => t.baseY + templates[t.parity].height));
        const built = ts.filter((t) => (obra[t.id] ? obra[t.id].progress > 0 : t.built)).length;
        const active = group === g.id;
        return (
          <Html key={g.id} position={[g.center[0], top + 22, g.center[1]]} center zIndexRange={[9, 0]}>
            <button className={`pill pill-group ${active ? 'is-active' : ''}`} onClick={() => selectGroup(g.id)}>
              <i style={{ background: g.color }} />
              <b>{g.name}</b>
              <span>{g.towers} torres · {built} erguidas</span>
            </button>
          </Html>
        );
      })}

      {group &&
        placed
          .filter((t) => t.group === group)
          .map((t) => {
            const tpl = templates[t.parity];
            const o = obra[t.id];
            const sub = o ? `${o.progress}% · ${o.stage.replace('_', ' ')}` : t.built ? 'Erguida' : 'Prevista';
            return (
              <Html key={t.id} position={[t.x, t.baseY + tpl.height + 6, t.z]} center zIndexRange={[9, 0]}>
                <button className={`pill pill-block ${tower === t.id ? 'is-active' : ''}`} onClick={() => selectTower(t.id)}>
                  <b>Bloco {t.block}</b>
                  <span>{sub}</span>
                </button>
              </Html>
            );
          })}

      {GROUPS.map((g) => (
        <Html key={`p${g.id}`} position={[g.pin[0], geo.heightAt(g.pin[0], g.pin[1]) + 8, g.pin[1]]} center zIndexRange={[8, 0]}>
          <div className="pill pill-gate">
            <b>Portaria {GROUP_BY_ID[g.id].name.replace('Grupo ', 'G')}</b>
            <span>Social + serviços</span>
          </div>
        </Html>
      ))}

      {roads.map((r) => (
        <Html key={r.title} position={r.pos} center zIndexRange={[8, 0]}>
          <div className="pill pill-road">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 3 5 21M16 3l3 18M12 4v3m0 4v3m0 4v3" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
            <div><b>{r.title}</b><span>{r.sub}</span></div>
          </div>
        </Html>
      ))}

      {[
        ['N', 0, -R],
        ['L', R, 0],
        ['S', 0, R],
        ['O', -R, 0],
      ].map(([l, x, z]) => (
        <Html key={l as string} position={[x as number, compassY, z as number]} center zIndexRange={[7, 0]}>
          <div className={`compass-dot ${l === 'N' ? 'is-north' : ''}`}>{l}</div>
        </Html>
      ))}
    </group>
  );
}
