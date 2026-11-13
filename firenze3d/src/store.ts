import { create } from 'zustand';
import type { GroupId } from './data/condo';

export type ViewMode = 'real' | 'fantasma' | 'completo';
export type Phase = 'landing' | 'intro' | 'explore';

export interface ObraTower {
  stage: string;
  progress: number;
  structureFloors: number | null;
  done: number;
  updatedAt: string | null;
}

export interface Weather {
  temp: number;
  code: number;
  precip: number;
  humidity: number;
  wind: number;
  cloud: number;
  isDay: boolean;
  updated: Date;
}

interface State {
  phase: Phase;
  setPhase: (p: Phase) => void;

  mode: ViewMode;
  setMode: (m: ViewMode) => void;

  group: GroupId | null;
  tower: string | null;
  floor: number | null;
  unit: number | null;
  selectGroup: (g: GroupId | null) => void;
  selectTower: (t: string | null) => void;
  selectUnit: (floor: number | null, unit?: number | null) => void;
  hovered: string | null;
  setHovered: (t: string | null) => void;

  /** Instante simulado para o sol. */
  time: number;
  live: boolean;
  playing: boolean;
  setTime: (t: number, live?: boolean) => void;
  setLive: (v: boolean) => void;
  setPlaying: (v: boolean) => void;

  layers: { labels: boolean; shadows: boolean; trees: boolean; sunPath: boolean; city3d: boolean };
  toggleLayer: (k: keyof State['layers']) => void;

  weather: Weather | null;
  setWeather: (w: Weather | null) => void;

  obra: Record<string, ObraTower>;
  obraConnected: boolean;
  setObra: (o: Record<string, ObraTower>) => void;

  planOpen: boolean;
  setPlanOpen: (v: boolean) => void;

  flyNonce: number;
  flyHome: () => void;
}

export const useStore = create<State>((set) => ({
  phase: new URLSearchParams(location.search).has('embed') ? 'explore' : 'landing',
  setPhase: (phase) => set({ phase }),

  mode: 'real',
  setMode: (mode) => set({ mode }),

  group: null,
  tower: null,
  floor: null,
  unit: null,
  selectGroup: (group) => set({ group, tower: null, floor: null, unit: null }),
  selectTower: (tower) =>
    set((s) => ({
      tower,
      floor: null,
      unit: null,
      group: tower ? (Number(tower.slice(1, 3)) as GroupId) : s.group,
    })),
  selectUnit: (floor, unit = null) => set({ floor, unit }),
  hovered: null,
  setHovered: (hovered) => set({ hovered }),

  time: Date.now(),
  live: true,
  playing: false,
  setTime: (time, live = false) => set({ time, live }),
  setLive: (live) => set(live ? { live, time: Date.now(), playing: false } : { live }),
  setPlaying: (playing) => set(playing ? { playing, live: false } : { playing }),

  layers: { labels: true, shadows: true, trees: true, sunPath: true, city3d: true },
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),

  weather: null,
  setWeather: (weather) => set({ weather }),

  obra: {},
  obraConnected: false,
  setObra: (obra) => set({ obra, obraConnected: true }),

  planOpen: false,
  setPlanOpen: (planOpen) => set({ planOpen }),

  flyNonce: 0,
  flyHome: () => set((s) => ({ group: null, tower: null, floor: null, unit: null, flyNonce: s.flyNonce + 1 })),
}));

if (import.meta.env.DEV) (window as unknown as { store: typeof useStore }).store = useStore;
