import raw from './towers.json';

export type GroupId = 12 | 13 | 14 | 15 | 16 | 17 | 18;

export interface TowerDef {
  id: string;
  group: GroupId;
  block: string;
  x: number;
  z: number;
  rot: number;
  /** Já erguida na imagem de satélite. */
  built: boolean;
  /** Origem da posição: medida no satélite ou tirada do mapa de implantação do projeto. */
  source: 'satelite' | 'projeto';
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
  area: '81,45 m²', typology: '2 dormitórios (1 suíte)', subsolos: '2 a 4 subsolos',
};
const ODD = {
  floors: 36, aptsPerFloor: 4, aptsPerTower: 144, towers: 7, totalApts: 1008,
  area: '125 m²', typology: '3 dormitórios (1 suíte)', subsolos: '3 subsolos',
};

const ADDRESS: Record<GroupId, string> = {
  12: 'Estrada São Judas, 190 · Parque Esplanada',
  13: 'Av. João Paulo I, 1973 · Jardim São Luiz',
  14: 'Estrada São Judas, 190 · Parque Esplanada',
  15: 'Av. João Paulo I, 1973 · Jardim São Luiz',
  16: 'Estrada São Judas, 190 · Parque Esplanada',
  17: 'Av. João Paulo I, 1973 · Jardim São Luiz',
  18: 'Estrada São Judas, 190 · Parque Esplanada',
};

/** Portaria principal mais próxima de cada grupo, segundo os totens de direção (PE05). */
export const MAIN_GATE: Record<GroupId, string> = {
  12: 'Portaria 01 · São Judas',
  14: 'Portaria 01 · São Judas',
  16: 'Portaria 02 · BR-116',
  18: 'Portaria 02 · BR-116',
  13: 'Portaria 03 · João Paulo I',
  15: 'Portaria 03 · João Paulo I',
  17: 'Portaria 03 · João Paulo I',
};

/** Cores de identificação dos subcondomínios (manual de Comunicação Visual R01). */
const COLORS: Record<GroupId, string> = {
  12: '#00435C', 13: '#3E3A5A', 14: '#3CA958', 15: '#52514C', 16: '#814139', 17: '#9E825B', 18: '#C09100',
};

/** Ambientes do térreo, conforme as plantas de comunicação visual. */
const GROUND_EVEN = ['Acesso principal e secundário', 'Recreação coberta', 'Play kids', 'Salão de festas e copa', 'Administração e sala de reunião'];
const GROUND_ODD: Record<string, [string, string]> = {
  A: ['Administração', 'Salão de festas'],
  B: ['Múltiplo uso', 'Academia'],
  C: ['Múltiplo uso', 'Brinquedoteca'],
  D: ['Múltiplo uso', 'Salão de festas'],
  E: ['Múltiplo uso', 'Múltiplo uso'],
  F: ['Múltiplo uso', 'Academia'],
  G: ['Múltiplo uso', 'Salão de festas'],
};

export function groundFloorOf(group: GroupId, block: string): string[] {
  if (group % 2 === 0) return GROUND_EVEN;
  return GROUND_ODD[block] ?? [];
}

/** Circulação vertical por tipologia, conforme as plantas do tipo. */
export const CORE: Record<'even' | 'odd', string> = {
  even: '2 halls · 2 elevadores sociais e 2 de serviço · escada pressurizada',
  odd: '2 elevadores sociais (um por ala) e 1 de serviço/emergência · antecâmara',
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
  /** Cor de destaque do condomínio geral. */
  color: '#5B90A9',
  textColor: '#3A3838',
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
