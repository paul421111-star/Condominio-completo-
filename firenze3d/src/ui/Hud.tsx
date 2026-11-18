import { useEffect, useMemo, useState } from 'react';
import { useStore, type ViewMode } from '../store';
import { CORE, GROUPS, GROUP_BY_ID, MAIN_GATE, SITE, TOTALS, TOWERS, TOWER_BY_ID, aptLabel, groundFloorOf } from '../data/condo';
import { describeWeather, fetchWeather } from '../lib/weather';
import { fmtDate, fmtTime, localMidnight, minutesOfDay, presetDate, sunAltitude, sunTimes } from '../lib/sun';
import { OBRA_STAGES, embedded, openInQualiObra } from '../lib/qualiobra';
import { getGoogleKey } from '../scene/GoogleTiles';

const fmt = (n: number) => n.toLocaleString('pt-BR');

function WeatherIcon({ kind }: { kind: string }) {
  const p: Record<string, string> = {
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1',
    'sun-cloud': 'M8 3v2M3.5 6.5 5 8M2 11h2m9-5.5L11.5 7M7 15a4 4 0 1 1 7.6-1.8A3.5 3.5 0 1 1 16.5 20H8a3 3 0 0 1-1-5.8',
    cloud: 'M7 18a4 4 0 0 1-.6-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18Z',
    fog: 'M4 10h16M3 14h18M6 18h12M7 6h10',
    drizzle: 'M7 14a4 4 0 0 1-.6-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 14ZM8 17v1m4-1v2m4-2v1',
    rain: 'M7 13a4 4 0 0 1-.6-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 13ZM8 16l-1 3m5-3-1 3m5-3-1 3',
    storm: 'M7 13a4 4 0 0 1-.6-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 13Zm5 1-2 4h3l-2 4',
  };
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d={p[kind] ?? p.cloud} />
    </svg>
  );
}

export function BrandCard() {
  const weather = useStore((s) => s.weather);
  const setWeather = useStore((s) => s.setWeather);
  const flyHome = useStore((s) => s.flyHome);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = () => fetchWeather().then(setWeather).catch(() => setWeather(null));
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [setWeather]);

  const d = weather ? describeWeather(weather.code) : null;
  return (
    <div className="hud-tl">
      <div className="glass brand-card" onClick={flyHome} role="button">
        <span className="brand-mark sm">VIDA<b>NOVA</b></span>
        <span className="brand-sep" />
        <div>
          <b className="brand-title">Residencial <em>Parque Firenze</em></b>
          <small>{SITE.city} · {TOTALS.towers} torres · {fmt(TOTALS.apts)} aptos</small>
        </div>
        {weather && <span className="temp-pill">{Math.round(weather.temp)}°C</span>}
      </div>
      {weather && d && open && (
        <div className="glass weather-card" onClick={() => setOpen(false)}>
          <div className="weather-ico"><WeatherIcon kind={d.icon} /></div>
          <div>
            <small>TEMPO AGORA · PARQUE FIRENZE</small>
            <div className="weather-main"><b>{Math.round(weather.temp)}°C</b> {d.label}</div>
            <div className="weather-meta">
              <span>☂ {weather.precip.toFixed(1)} mm</span>
              <span>☁ {weather.cloud}%</span>
              <span>≋ {Math.round(weather.wind)} km/h</span>
              <span>💧 {weather.humidity}%</span>
            </div>
            <small className="muted">Atualizado às {fmtTime(weather.updated.getTime())} · Open-Meteo</small>
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupsPanel() {
  const group = useStore((s) => s.group);
  const tower = useStore((s) => s.tower);
  const obra = useStore((s) => s.obra);
  const selectGroup = useStore((s) => s.selectGroup);
  const selectTower = useStore((s) => s.selectTower);
  const [collapsed, setCollapsed] = useState(false);

  const builtOf = (gid: number) =>
    TOWERS.filter((t) => t.group === gid && (obra[t.id] ? obra[t.id].progress > 0 : t.built)).length;

  return (
    <div className={`glass groups-panel ${collapsed ? 'is-collapsed' : ''}`}>
      <header onClick={() => setCollapsed(!collapsed)}>
        <b>Grupos</b>
        <small>{TOTALS.towers} torres · {fmt(TOTALS.apts)} aptos</small>
        <span className="chev">{collapsed ? '▸' : '▾'}</span>
      </header>
      {!collapsed &&
        GROUPS.map((g) => {
          const built = builtOf(g.id);
          const active = group === g.id;
          return (
            <div key={g.id} className={`group-row ${active ? 'is-active' : ''}`}>
              <button onClick={() => selectGroup(active ? null : g.id)}>
                <i style={{ background: g.color }} />
                <span className="group-name">{g.name}</span>
                <span className="group-meta">{g.towers} torres · {g.floors} and.</span>
                <span className="group-count">{built}/{g.towers}</span>
              </button>
              <div className="bar"><span style={{ width: `${(built / g.towers) * 100}%`, background: g.color }} /></div>
              {active && (
                <div className="block-chips">
                  {TOWERS.filter((t) => t.group === g.id).map((t) => (
                    <button key={t.id} className={`chip ${tower === t.id ? 'is-active' : ''} ${t.built ? '' : 'is-planned'}`} onClick={() => selectTower(t.id)}>
                      {t.block}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

const MODES: { id: ViewMode; label: string; hint: string }[] = [
  { id: 'real', label: 'Real', hint: 'Torres erguidas sólidas; previstas em fantasma' },
  { id: 'fantasma', label: 'Fantasma', hint: 'Todas translúcidas; só a torre escolhida sólida' },
  { id: 'completo', label: 'Completo', hint: 'Condomínio finalizado' },
];

export function Toolbar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const layers = useStore((s) => s.layers);
  const toggle = useStore((s) => s.toggleLayer);
  const ground = useStore((s) => s.ground);
  const setGround = useStore((s) => s.setGround);
  const flyHome = useStore((s) => s.flyHome);
  const hasKey = !!getGoogleKey();

  const askKey = () => {
    if (hasKey) return toggle('city3d');
    const k = prompt('Cole a chave da API do Google Maps (Map Tiles API) para carregar a cidade 3D fotorrealista:');
    if (k) {
      localStorage.setItem('gmapsKey', k.trim());
      location.reload();
    }
  };

  const items: { k: keyof typeof layers; t: string; d: string }[] = [
    { k: 'labels', t: 'Rótulos', d: 'M4 6h10l4 4-4 4H4z' },
    { k: 'shadows', t: 'Sombras', d: 'M12 3a9 9 0 1 0 0 18V3Z' },
    { k: 'trees', t: 'Vegetação', d: 'M12 2 6 11h3l-4 6h6v5h2v-5h6l-4-6h3z' },
    { k: 'sunPath', t: 'Trajetória do sol', d: 'M3 18a9 9 0 0 1 18 0M12 5V3m7 4 1.5-1.5M5 7 3.5 5.5' },
  ];
  return (
    <div className="hud-tr">
      <div className="glass seg">
        <button title="Implantação viária, chão plano, sem a malha do mapa" className={ground === 'planta' ? 'is-on' : ''} onClick={() => setGround('planta')}>
          Planta
        </button>
        <button title="Satélite e cidade 3D do Google" className={ground === 'mapa' ? 'is-on' : ''} onClick={() => setGround('mapa')}>
          Mapa
        </button>
      </div>
      <div className="glass seg">
        {MODES.map((m) => (
          <button key={m.id} title={m.hint} className={mode === m.id ? 'is-on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="glass icons">
        <button title="Visão geral" onClick={flyHome}>
          <svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" /></svg>
        </button>
        {items.map((i) => (
          <button key={i.k} title={i.t} className={layers[i.k] ? 'is-on' : ''} onClick={() => toggle(i.k)}>
            <svg viewBox="0 0 24 24"><path d={i.d} /></svg>
          </button>
        ))}
        <button title={hasKey ? 'Cidade 3D fotorrealista (Google). Abre o modo Mapa.' : 'Ativar cidade 3D fotorrealista (requer chave Google)'} className={hasKey && ground === 'mapa' && layers.city3d ? 'is-on' : ''} onClick={() => {
          if (!hasKey) { askKey(); return; }
          if (ground !== 'mapa') {
            setGround('mapa');
            if (!layers.city3d) toggle('city3d');
            return;
          }
          toggle('city3d');
        }}>
          <svg viewBox="0 0 24 24"><path d="M3 21V9l5-3v15M8 21V4l7 3v14M15 21V10l6 2v9M2 21h20" /></svg>
        </button>
      </div>
    </div>
  );
}

export function TimeBar() {
  const time = useStore((s) => s.time);
  const live = useStore((s) => s.live);
  const playing = useStore((s) => s.playing);
  const setTime = useStore((s) => s.setTime);
  const setLive = useStore((s) => s.setLive);
  const setPlaying = useStore((s) => s.setPlaying);
  const { sunrise, sunset } = useMemo(() => sunTimes(time), [Math.floor(time / 3600_000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const mid = localMidnight(time);
  const min = minutesOfDay(time);
  const alt = (sunAltitude(time) * 180) / Math.PI;
  const pct = (t: number) => `${(minutesOfDay(t) / 1440) * 100}%`;

  const month = new Date(time - 3 * 3600_000).getUTCMonth();
  const season = month === 11 && new Date(time).getUTCDate() >= 20 ? 'verao' : month === 5 && new Date(time).getUTCDate() >= 20 ? 'inverno' : 'hoje';

  return (
    <div className="glass timebar">
      <div className="tb-presets">
        {(
          [
            ['hoje', 'Hoje'],
            ['verao', 'Verão'],
            ['inverno', 'Inverno'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={season === k && !live ? 'is-on' : ''} onClick={() => setTime(presetDate(k, time))}>
            {l}
          </button>
        ))}
        <button className={`live ${live ? 'is-on' : ''}`} onClick={() => setLive(true)}>
          <i /> Ao vivo
        </button>
      </div>
      <button className="tb-play" onClick={() => setPlaying(!playing)} title={playing ? 'Pausar' : 'Animar o dia'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="tb-track">
        <div className="tb-day" style={{ left: pct(sunrise), width: `calc(${pct(sunset)} - ${pct(sunrise)})` }} />
        <input
          type="range"
          min={0}
          max={1439}
          value={min}
          onChange={(e) => setTime(mid + Number(e.target.value) * 60000)}
        />
        <span className="tb-mark" style={{ left: pct(sunrise) }}>☀ {fmtTime(sunrise)}</span>
        <span className="tb-mark" style={{ left: pct(sunset) }}>☾ {fmtTime(sunset)}</span>
      </div>
      <div className="tb-now">
        <b>{fmtTime(time)}</b>
        <small>{fmtDate(time)} · sol {alt > 0 ? `${alt.toFixed(0)}°` : 'abaixo do horizonte'}</small>
      </div>
    </div>
  );
}

type UnitStatus = 'entregue' | 'obra' | 'prevista';

function unitStatus(towerId: string, floor: number, obra: ReturnType<typeof useStore.getState>['obra']): UnitStatus {
  const o = obra[towerId];
  const t = TOWER_BY_ID[towerId];
  if (o) {
    if (o.stage === 'entregue') return 'entregue';
    const f = o.structureFloors ?? 0;
    return floor <= f ? 'obra' : 'prevista';
  }
  return t.built ? 'entregue' : 'prevista';
}

const STATUS_LABEL: Record<UnitStatus, string> = { entregue: 'Erguido', obra: 'Em obra', prevista: 'Previsto' };

export function TowerPanel() {
  const towerId = useStore((s) => s.tower);
  const groupId = useStore((s) => s.group);
  const floor = useStore((s) => s.floor);
  const unit = useStore((s) => s.unit);
  const obra = useStore((s) => s.obra);
  const selectUnit = useStore((s) => s.selectUnit);
  const selectTower = useStore((s) => s.selectTower);
  const setPlanOpen = useStore((s) => s.setPlanOpen);
  const [filter, setFilter] = useState<'todos' | UnitStatus>('todos');

  if (!towerId && groupId) return <GroupCard />;
  if (!towerId) return null;
  const t = TOWER_BY_ID[towerId];
  const g = GROUP_BY_ID[t.group];
  const o = obra[t.id];
  const floors = Array.from({ length: g.floors }, (_, i) => g.floors - i);
  const progress = o ? o.progress : t.built ? 100 : 0;
  const statusTxt = o ? OBRA_STAGES[o.stage]?.label ?? o.stage : t.built ? 'Torre erguida' : 'Posição prevista';
  const counts = floors.reduce(
    (acc, f) => {
      acc[unitStatus(t.id, f, obra)] += g.aptsPerFloor;
      return acc;
    },
    { entregue: 0, obra: 0, prevista: 0 } as Record<UnitStatus, number>,
  );

  return (
    <aside className="glass tower-panel">
      <header>
        <div>
          <small style={{ color: g.color }}>● {g.name}</small>
          <h3>Bloco {t.block}</h3>
          <span className="muted">{g.address}</span>
        </div>
        <button className="x" onClick={() => selectTower(null)}>✕</button>
      </header>

      <div className="stats">
        <div><b>{g.aptsPerTower}</b><small>TOTAL</small></div>
        <div><b>{g.floors}</b><small>ANDARES</small></div>
        <div><b>{g.aptsPerFloor}</b><small>POR ANDAR</small></div>
      </div>
      <div className="progress">
        <div className="progress-head"><span>{statusTxt}</span><b>{progress}% concluído</b></div>
        <div className="bar"><span style={{ width: `${progress}%` }} /></div>
        {!o && <small className="muted">{t.built ? 'Torre visível na imagem de satélite.' : 'Torre ainda não erguida; posição conforme a implantação do projeto.'}</small>}
        {o?.updatedAt && <small className="muted">QualiObra · {new Date(o.updatedAt).toLocaleDateString('pt-BR')}</small>}
      </div>

      <ul className="facts">
        <li><span>Térreo</span><b>{groundFloorOf(t.group, t.block).join(' · ')}</b></li>
        <li><span>Circulação</span><b>{CORE[g.even ? 'even' : 'odd']}</b></li>
      </ul>

      {floor != null && unit != null && (
        <div className="unit-card">
          <small>UNIDADE SELECIONADA</small>
          <div className="unit-main">
            <b>Apto {aptLabel(floor, unit)}</b>
            <span>{floor}º andar · final {unit}</span>
          </div>
          <span className="muted">{g.typology} · {g.area}</span>
          <div className="unit-actions">
            <button className="btn btn-green btn-sm" onClick={() => setPlanOpen(true)}>Ver planta 3D</button>
            {embedded() && <button className="btn btn-ghost btn-sm" onClick={() => openInQualiObra(t.id)}>Abrir FVS no QualiObra</button>}
          </div>
        </div>
      )}

      <div className="filters">
        {(['todos', 'entregue', 'obra', 'prevista'] as const).map((k) => (
          <button key={k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
            {k === 'todos' ? 'Todos' : STATUS_LABEL[k]} {k !== 'todos' && <small>{counts[k]}</small>}
          </button>
        ))}
      </div>

      <div className="unit-map">
        <div className="unit-map-head">
          <small>ANDAR</small>
          {Array.from({ length: g.aptsPerFloor }, (_, i) => (
            <small key={i}>F{i + 1}</small>
          ))}
        </div>
        <div className="unit-map-body">
          {floors.map((f) => {
            const st = unitStatus(t.id, f, obra);
            const dim = filter !== 'todos' && filter !== st;
            return (
              <div key={f} className={`unit-row ${floor === f ? 'is-floor' : ''}`} style={{ gridTemplateColumns: `34px repeat(${g.aptsPerFloor}, 1fr)` }}>
                <small>{f}º</small>
                {Array.from({ length: g.aptsPerFloor }, (_, i) => (
                  <button
                    key={i}
                    className={`unit st-${st} ${dim ? 'is-dim' : ''} ${floor === f && unit === i + 1 ? 'is-on' : ''}`}
                    onClick={() => selectUnit(f, i + 1)}
                    title={`Apto ${aptLabel(f, i + 1)} · ${STATUS_LABEL[st]}`}
                  >
                    {aptLabel(f, i + 1)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function GroupCard() {
  const groupId = useStore((s) => s.group)!;
  const selectTower = useStore((s) => s.selectTower);
  const selectGroup = useStore((s) => s.selectGroup);
  const obra = useStore((s) => s.obra);
  const g = GROUP_BY_ID[groupId];
  const ts = TOWERS.filter((t) => t.group === g.id);
  return (
    <aside className="glass tower-panel">
      <header>
        <div>
          <small style={{ color: g.color }}>● Subcondomínio</small>
          <h3>{g.name}</h3>
          <span className="muted">{g.address}</span>
        </div>
        <button className="x" onClick={() => selectGroup(null)}>✕</button>
      </header>
      <div className="stats">
        <div><b>{g.towers}</b><small>TORRES</small></div>
        <div><b>{fmt(g.totalApts)}</b><small>APTOS</small></div>
        <div><b>{g.floors}</b><small>ANDARES</small></div>
      </div>
      <ul className="facts">
        <li><span>Tipologia</span><b>{g.typology}</b></li>
        <li><span>Área privativa</span><b>{g.area}</b></li>
        <li><span>Garagem</span><b>{g.subsolos}</b></li>
        <li><span>Núcleo</span><b>{CORE[g.even ? 'even' : 'odd']}</b></li>
        <li><span>Acesso</span><b>{MAIN_GATE[g.id]} · portaria social {g.name.replace('Grupo ', 'G')}</b></li>
        <li><span>Portarias</span><b>Social (186 m²) + serviços (158 m²)</b></li>
        <li><span>Lazer</span><b>Piscinas, academia, quadras, salões, playground</b></li>
      </ul>
      <small className="section-title">BLOCOS</small>
      <div className="block-list">
        {ts.map((t) => {
          const o = obra[t.id];
          const p = o ? o.progress : t.built ? 100 : 0;
          return (
            <button key={t.id} onClick={() => selectTower(t.id)}>
              <b>Bloco {t.block}</b>
              <span className="muted">{o ? OBRA_STAGES[o.stage]?.label : t.built ? 'Erguida' : 'Prevista'}</span>
              <div className="bar"><span style={{ width: `${p}%`, background: g.color }} /></div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function Legend() {
  const mode = useStore((s) => s.mode);
  const connected = useStore((s) => s.obraConnected);
  return (
    <div className="glass legend">
      <span><i className="lg-solid" /> Torre erguida</span>
      <span><i className="lg-ghost" /> {mode === 'completo' ? 'Projeto completo' : 'Prevista / fantasma'}</span>
      <span><i className="lg-sel" /> Selecionada</span>
      {connected && <span className="lg-live">● QualiObra conectado</span>}
    </div>
  );
}

export function Attribution() {
  return (
    <div className="attribution">
      Satélite © Esri, Maxar, Earthstar Geographics · Vias e mata © colaboradores do OpenStreetMap · Relevo: AWS Terrain Tiles
      {getGoogleKey() ? ' · Cidade 3D © Google' : ''}
    </div>
  );
}
