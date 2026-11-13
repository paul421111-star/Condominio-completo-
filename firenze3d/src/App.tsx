import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { loadGeo, type Geo } from './lib/geo';
import { useStore } from './store';
import { initQualiObra } from './lib/qualiobra';
import { Experience } from './scene/Experience';
import { Landing, Intro } from './ui/Landing';
import { Attribution, BrandCard, GroupsPanel, Legend, TimeBar, Toolbar, TowerPanel } from './ui/Hud';
import { FloorPlanModal } from './ui/FloorPlan';

function Loader() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <div className="loader glass">
      <small>Carregando modelos BIM · terreno real</small>
      <div className="bar"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}

export default function App() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const phase = useStore((s) => s.phase);

  useEffect(() => {
    loadGeo().then(setGeo);
    initQualiObra();
  }, []);

  return (
    <div className={`app phase-${phase}`}>
      <div className="stage">{geo && <Experience geo={geo} />}</div>
      {phase === 'landing' && <Landing />}
      {phase === 'intro' && <Intro />}
      {phase === 'explore' && (
        <>
          <BrandCard />
          <GroupsPanel />
          <TowerPanel />
          <Toolbar />
          <TimeBar />
          <Legend />
          <Attribution />
          <FloorPlanModal />
        </>
      )}
      <Loader />
    </div>
  );
}
