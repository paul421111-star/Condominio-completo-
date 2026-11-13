import raw from './towers.json';

export type GroupId = 12 | 13 | 14 | 15 | 16 | 17 | 18;

export interface TowerDef {
  id: string;
  group: GroupId;
  block: string;
  x: number;
  z: number;
  rot: number;
  /** Já erguida na imagem de satélite (as demais são posições estimadas). */
  built: boolean;
}

export interface GroupDef {
  id: GroupId;
  even: boolean;
  center: [number, number];
  pin: [number, number];
  name: string;
  floors: number;
  aptsPerFloor: number;
  aptsPerTower: number;
  towers: number;
  totalApts: number;
  area: string;
  typology: string;
  subsolos: string;
  address: string;
  color: string;
}

const EVEN = {
  floors: 28, aptsPerFloor: 8, aptsPerTower: 224, towers: 6, totalApts: 1344,
  area: '≈ 60 m²', typology: '2 dormitórios', subsolos: '2 a 4 subsolos',
};
const ODD = {
  floors: 36, aptsPerFloor: 4, aptsPerTower: 144, towers: 7, totalApts: 1008,
  area: '125 m²', typology: '3 dormitórios (suíte)', subsolos: '3 subsolos',
};

const ADDRESS: Record<GroupId, string> = {
  12: 'Estrada São Judas, 190 · Parque Esplanada',
  13: 'Av. João Paulo I, 1973 · Jardim São Luiz',
  14: 'Estrada São Judas, 190 · Parque Esplanada',
  15: 'Av. João Paulo I, 1973 · Jardim São Luiz',
  16: 'Estrada São Judas, 190 · Parque Esplanada',
  17: 'Av. João Paulo I, 1973 · Jardim São Luiz',
  18: 'Estrada São Judas · junto à BR-116',
};

const COLORS: Record<GroupId, string> = {
  12: '#22c55e', 13: '#0ea5e9', 14: '#eab308', 15: '#6366f1', 16: '#f97316', 17: '#14b8a6', 18: '#ec4899',
};

export const GROUPS: GroupDef[] = (raw.groups as { id: GroupId; even: boolean; center: [number, number]; pin: [number, number] }[])
  .map((g) => ({
    ...g,
    ...(g.even ? EVEN : ODD),
    name: `Grupo ${g.id}`,
    address: ADDRESS[g.id],
    color: COLORS[g.id],
  }))
  .sort((a, b) => a.id - b.id);

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, GroupDef>;

export const TOWERS: TowerDef[] = raw.towers as TowerDef[];
export const TOWER_BY_ID = Object.fromEntries(TOWERS.map((t) => [t.id, t])) as Record<string, TowerDef>;

export const TOTALS = {
  groups: GROUPS.length,
  towers: TOWERS.length,
  apts: GROUPS.reduce((s, g) => s + g.totalApts, 0),
  built: TOWERS.filter((t) => t.built).length,
};

export const SITE = {
  name: 'Residencial Parque Firenze',
  coop: 'Cooperativa Habitacional Vida Nova',
  city: 'Embu das Artes · SP',
  lat: -23.6322,
  lon: -46.818,
  areas: [
    { label: 'Mata preservada (APP)', value: '185.346 m²' },
    { label: 'Alamedas e praças', value: '54.066 m²' },
    { label: 'Jardins lineares', value: '20.677 m²' },
    { label: 'Represa / barragem', value: '9.293 m²' },
  ],
};

export function aptLabel(floor: number, unit: number) {
  return `${floor}${unit}`;
}
