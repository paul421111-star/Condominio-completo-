import { useEffect } from 'react';
import { useStore } from '../store';
import { SITE, TOTALS } from '../data/condo';
import { assetUrl } from '../lib/geo';

export function Landing() {
  const setPhase = useStore((s) => s.setPhase);
  const fmt = (n: number) => n.toLocaleString('pt-BR');
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand">
          <span className="brand-mark">VIDA<b>NOVA</b></span>
          <span className="brand-years">30 anos</span>
        </div>
        <ul>
          <li>Quem somos</li>
          <li>Como funciona</li>
          <li>Empreendimentos</li>
          <li className="is-on">Parque Firenze</li>
          <li>Contato</li>
        </ul>
        <button className="btn btn-green btn-sm">Área do cooperado</button>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">● Há 30 anos construindo em cooperativa e entregando chaves</p>
          <h1>
            O sonho da casa própria construído com <em>Transparência</em>
          </h1>
          <p className="lead">
            Em {SITE.city.replace(' · ', ', ')}, a {SITE.coop} ergue o <b>{SITE.name}</b>: {TOTALS.groups} subcondomínios,{' '}
            {TOTALS.towers} torres e <b>{fmt(TOTALS.apts)} apartamentos</b> cercados por 185 mil m² de mata preservada,
            sem juros bancários.
          </p>
          <div className="hero-cta">
            <button className="btn btn-green" onClick={() => setPhase('intro')}>
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.7 3.7L12 11.7 5.3 8 12 4.3ZM5 9.7l6 3.3v6.6l-6-3.3V9.7Zm8 9.9V13l6-3.3v6.6l-6 3.3Z" fill="currentColor" /></svg>
              Explorar o Parque Firenze em 3D
            </button>
            <button className="btn btn-ghost">Conheça a cooperativa →</button>
          </div>
          <ul className="hero-facts">
            <li>⌂ Preço de custo</li>
            <li>◎ {fmt(TOTALS.apts)} famílias</li>
            <li>✓ {TOTALS.built} torres já erguidas</li>
          </ul>
        </div>

        <div className="hero-visual">
          <div className="hero-card">
            <img src={assetUrl('geo/hero.jpg')} alt="Vista aérea dos grupos 12, 14, 16 e 18" />
            <div className="hero-card-caption">
              <small>EMBU DAS ARTES · SP</small>
              <strong>Bairro inteiro construído em cooperação</strong>
            </div>
          </div>
          <div className="hero-chip">
            <span className="hero-chip-ico">🔑</span>
            <div><b>8,4 mil</b><small>apartamentos</small></div>
          </div>
          <div className="hero-mini">
            <img src={assetUrl('geo/hero2.jpg')} alt="Grupos 13 e 15" />
            <div><small>EM OBRA</small><b>Grupos 13 e 15</b></div>
          </div>
          <div className="hero-badge">30<small>anos</small></div>
        </div>
      </section>
    </div>
  );
}

export function Intro() {
  const setPhase = useStore((s) => s.setPhase);
  useEffect(() => {
    const id = setTimeout(() => setPhase('explore'), 2300);
    return () => clearTimeout(id);
  }, [setPhase]);
  return (
    <div className="intro">
      <small>COOPERATIVA HABITACIONAL VIDA NOVA</small>
      <h2>Residencial Parque Firenze</h2>
    </div>
  );
}
