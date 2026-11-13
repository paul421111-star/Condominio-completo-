import { useStore, type ObraTower } from '../store';
import { TOWERS } from '../data/condo';

/**
 * Ponte com o QualiObra quando a maquete roda embutida (iframe same-origin em
 * /maquete/). O pai responde a `maquete:ready` com `qualiobra:auth`, e o status
 * da obra vem de GET /api/maquete/obra-status.
 */
let token: string | null = null;
let timer: number | undefined;

export const OBRA_STAGES: Record<string, { label: string; color: string }> = {
  nao_iniciado: { label: 'Não iniciado', color: '#cbd5e1' },
  fundacao: { label: 'Fundação', color: '#a16207' },
  estrutura: { label: 'Estrutura', color: '#64748b' },
  vedacao: { label: 'Vedação', color: '#c2410c' },
  acabamento: { label: 'Acabamento', color: '#0ea5e9' },
  entregue: { label: 'Entregue', color: '#16a34a' },
  sem_registro: { label: 'Sem registro', color: '#94a3b8' },
};

async function refresh() {
  if (!token) return;
  try {
    const r = await fetch('/api/maquete/obra-status', { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const { towers } = (await r.json()) as {
      towers: { group: number; block: string; stage: string; progress: number; structureFloors: number | null; done: number; updatedAt: string | null }[];
    };
    const map: Record<string, ObraTower> = {};
    for (const t of towers) {
      const id = `G${t.group}-${t.block}`;
      if (!TOWERS.some((x) => x.id === id)) continue;
      map[id] = { stage: t.stage, progress: t.progress, structureFloors: t.structureFloors, done: t.done, updatedAt: t.updatedAt };
    }
    useStore.getState().setObra(map);
  } catch {
    /* fora do QualiObra */
  }
}

export function initQualiObra() {
  if (window.parent === window) return;
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'qualiobra:auth' && typeof e.data.token === 'string') {
      token = e.data.token;
      refresh();
      clearInterval(timer);
      timer = window.setInterval(refresh, 5 * 60_000);
    }
  });
  window.parent.postMessage({ type: 'maquete:ready' }, location.origin);
}

export function openInQualiObra(towerId: string) {
  const [g, block] = towerId.slice(1).split('-');
  window.parent.postMessage({ type: 'maquete:open-block', group: Number(g), block }, location.origin);
}

export const embedded = () => window.parent !== window;
