import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { GROUPS, SITE, TOTALS, type GroupId } from '../data/condo';
import { assetUrl } from '../lib/geo';

const WORDS = ['Transparência', 'Qualidade', 'União', 'Compromisso', 'Seriedade'];
const fmt = (n: number) => n.toLocaleString('pt-BR');

const FAQ = [
  {
    q: 'O que é o Residencial Parque Firenze?',
    a: 'É o conjunto da Cooperativa Habitacional Vida Nova em Embu das Artes, com os grupos 12 a 18: 45 torres entre a Estrada São Judas e a Av. João Paulo I, ao lado de mata preservada.',
  },
  {
    q: 'Qual a diferença entre os grupos pares e ímpares?',
    a: 'Os grupos 12, 14, 16 e 18 têm 6 torres de 28 andares, com apartamentos de 81,45 m² e 2 dormitórios (1 suíte). Os grupos 13, 15 e 17 têm 7 torres de 36 andares, com 125 m² e 3 dormitórios (1 suíte).',
  },
  {
    q: 'Como funciona a cooperativa?',
    a: 'A construção é a preço de custo, decidida em assembleia. No site da CHVN, a participação neste empreendimento não exige entrada, parcelas intermediárias nem juros bancários.',
  },
  {
    q: 'Dá para ver uma torre de perto?',
    a: 'Sim. Na maquete, escolha o grupo e o bloco. O modelo abre a planta do pavimento tipo, o estágio da obra e o passeio pelo terreno real.',
  },
];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <em key={WORDS[i]} className="lp-word">
      {WORDS[i]}
    </em>
  );
}

export function Landing() {
  const setPhase = useStore((s) => s.setPhase);
  const selectGroup = useStore((s) => s.selectGroup);
  const [carousel, setCarousel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const enter = (group?: GroupId) => {
    if (group) selectGroup(group);
    setPhase('intro');
  };

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setCarousel((n) => (n + 1) % GROUPS.length), 4200);
    return () => clearInterval(id);
  }, [paused]);

  const go = (hash: string) => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const n = GROUPS.length;
  const windowed = [-1, 0, 1].map((d) => GROUPS[(carousel + d + n) % n]);

  return (
    <div
      className="landing"
      onMouseMove={(e) => {
        const glow = e.currentTarget.querySelector<HTMLElement>('.lp-glow');
        glow?.style.setProperty('--mx', `${e.clientX}px`);
        glow?.style.setProperty('--my', `${e.clientY}px`);
      }}
    >
      <div className="lp-glow" />
      <header className="lp-nav">
        <button className="lp-brand" onClick={() => go('topo')}>
          <img src={assetUrl('logo-chvn.webp')} alt="Cooperativa Habitacional Vida Nova" />
        </button>
        <nav>
          <button onClick={() => go('cooperativa')}>A cooperativa</button>
          <button onClick={() => go('condominios')}>Condomínios</button>
          <button onClick={() => go('grupos')}>Grupos 12–18</button>
          <button onClick={() => go('como')}>Como funciona</button>
          <button onClick={() => go('faq')}>Dúvidas</button>
        </nav>
        <button className="btn btn-green btn-sm" onClick={() => go('condominios')}>
          Condomínios
        </button>
      </header>

      <section className="lp-hero" id="topo">
        <div className="lp-blob lp-blob-a" />
        <div className="lp-blob lp-blob-b" />
        <div className="lp-copy">
          <p className="lp-eyebrow">Cooperativa Habitacional Vida Nova · 30 anos</p>
          <h1>
            O sonho da casa própria, construído com <RotatingWord />
          </h1>
          <p className="lp-lead">
            Em Embu das Artes, a {SITE.coop} ergue o <b>{SITE.name}</b>: {TOTALS.groups} grupos, {TOTALS.towers} torres e{' '}
            <b>{fmt(TOTALS.apts)} apartamentos</b>, ao lado de 185 mil m² de mata preservada.
          </p>
          <div className="lp-cta">
            <button className="btn btn-green" onClick={() => go('condominios')}>
              Ver os 4 condomínios
            </button>
            <button className="btn btn-ghost" onClick={() => go('grupos')}>
              Ver os grupos
            </button>
          </div>
          <ul className="lp-facts">
            <li>Preço de custo</li>
            <li>{fmt(TOTALS.apts)} apartamentos</li>
            <li>{TOTALS.built} torres já no terreno</li>
          </ul>
        </div>

        <div className="lp-visual">
          <div className="lp-photo">
            <img src={assetUrl('geo/hero.jpg')} alt="Vista aérea do Residencial Parque Firenze" />
            <div>
              <small>EMBU DAS ARTES · SP</small>
              <strong>Grupos 12 a 18 num só parque</strong>
            </div>
          </div>
          <div className="lp-float lp-float-a glass">
            <b>7</b>
            <span>grupos</span>
          </div>
          <div className="lp-float lp-float-b glass">
            <img src={assetUrl('geo/hero2.jpg')} alt="Torres dos grupos ímpares" />
            <div>
              <small>36 andares</small>
              <b>Grupos 13, 15 e 17</b>
            </div>
          </div>
          <div className="lp-ring" aria-hidden>
            <span>30</span>
            <small>anos</small>
          </div>
        </div>
      </section>

      <section className="lp-access" id="condominios">
        <header>
          <p className="lp-eyebrow">Maquete 3D</p>
          <h2>Entre em um dos quatro condomínios</h2>
          <p>Jardim das Artes, Parque Firenze, Recanto da Iracema e Residencial Oceanos.</p>
        </header>
        <div className="lp-access-grid">
          <a className="lp-access-card" href="http://127.0.0.1:3006/maquete">
            <small>Grupo 11</small>
            <b>Jardim das Artes</b>
            <span>Embu das Artes · condomínio entregue</span>
            <em>Abrir maquete</em>
          </a>
          <button className="lp-access-card is-here" onClick={() => enter()}>
            <small>Grupos 12 a 18</small>
            <b>Parque Firenze</b>
            <span>Embu das Artes · 45 torres</span>
            <em>Abrir esta maquete</em>
          </button>
          <a className="lp-access-card" href="http://127.0.0.1:3005/maquete">
            <small>Grupo 19</small>
            <b>Recanto da Iracema</b>
            <span>Taboão da Serra · em construção</span>
            <em>Abrir maquete</em>
          </a>
          <a className="lp-access-card" href="http://127.0.0.1:3003/maquete">
            <small>Grupos 20 a 23</small>
            <b>Residencial Oceanos</b>
            <span>Parque Industrial Daci · lançamento</span>
            <em>Abrir maquete</em>
          </a>
        </div>
      </section>

      <section className="lp-stats">
        {[
          ['7', 'grupos', '12 a 18'],
          [String(TOTALS.towers), 'torres', 'pares e ímpares'],
          [fmt(TOTALS.apts), 'apartamentos', '2 e 3 dormitórios'],
          ['185 mil', 'm² de mata', 'área preservada'],
        ].map(([v, l, nte]) => (
          <div key={l}>
            <b>{v}</b>
            <strong>{l}</strong>
            <small>{nte}</small>
          </div>
        ))}
      </section>

      <div className="lp-marquee" aria-hidden>
        <div>
          {Array.from({ length: 2 }).map((_, k) => (
            <p key={k}>
              {WORDS.map((w) => (
                <span key={w}>
                  {w} <i />
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>

      <section className="lp-about" id="cooperativa">
        <div>
          <p className="lp-eyebrow">Desde 1996</p>
          <h2>Uma cooperativa, não uma incorporadora.</h2>
          <p>
            A Vida Nova nasceu em Taboão da Serra para transformar o financiamento da casa própria em construção
            coletiva. No Parque Firenze, cada grupo tem assembleia, prestação de contas e acompanhamento da obra.
          </p>
        </div>
        <ul>
          {[
            ['Credibilidade', 'Três décadas entregando torre após torre.'],
            ['Seriedade', 'Gestão com prestação de contas e assembleias abertas.'],
            ['Responsabilidade', 'Engenharia própria e acompanhamento de cada etapa.'],
            ['Respeito', 'O cooperado participa das decisões do seu grupo.'],
          ].map(([t, d]) => (
            <li key={t}>
              <b>{t}</b>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-groups" id="grupos" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <header>
          <p className="lp-eyebrow">Embu das Artes</p>
          <h2>Sete grupos, duas tipologias.</h2>
          <p>Escolha um grupo para abrir a maquete já focada nele.</p>
        </header>
        <div className="lp-carousel">
          <button className="lp-arrow" aria-label="Grupo anterior" onClick={() => setCarousel((i) => (i - 1 + n) % n)}>
            ‹
          </button>
          <div className="lp-track">
            {windowed.map((g, idx) => (
              <button
                key={g.id}
                className={`lp-card ${idx === 1 ? 'is-on' : ''}`}
                onClick={() => (idx === 1 ? enter(g.id) : setCarousel((carousel + (idx === 0 ? -1 : 1) + n) % n))}
              >
                <i style={{ background: g.color }} />
                <small>{g.even ? '2 dormitórios' : '3 dormitórios'}</small>
                <b>Grupo {g.id}</b>
                <span>
                  {g.towers} torres · {g.floors} andares
                </span>
                <span>
                  {g.area} · {fmt(g.totalApts)} aptos
                </span>
                <em>{g.address}</em>
              </button>
            ))}
          </div>
          <button className="lp-arrow" aria-label="Próximo grupo" onClick={() => setCarousel((i) => (i + 1) % n)}>
            ›
          </button>
        </div>
        <div className="lp-dots">
          {GROUPS.map((g, i) => (
            <button key={g.id} className={i === carousel ? 'is-on' : ''} aria-label={`Grupo ${g.id}`} onClick={() => setCarousel(i)} />
          ))}
        </div>
        <div className="lp-types">
          <article>
            <small>Grupos 12, 14, 16 e 18</small>
            <b>81,45 m²</b>
            <span>6 torres de 28 andares · 8 apartamentos por andar · varanda com espaço gourmet</span>
          </article>
          <article>
            <small>Grupos 13, 15 e 17</small>
            <b>125 m²</b>
            <span>7 torres de 36 andares · 4 apartamentos por andar · suíte com closet e lavabo</span>
          </article>
        </div>
      </section>

      <section className="lp-steps" id="como">
        <header>
          <p className="lp-eyebrow">O caminho</p>
          <h2>Da adesão às chaves.</h2>
        </header>
        <ol>
          {[
            ['01', 'Cadastro', 'Você conhece a cooperativa, tira dúvidas e faz o cadastro.'],
            ['02', 'Adesão', 'Escolhe o grupo — 2 ou 3 dormitórios — e entra na assembleia.'],
            ['03', 'Construção', 'A torre sobe a preço de custo, com a obra acompanhada na maquete.'],
            ['04', 'Chaves', 'A definição acontece em assembleia, sem parcela de entrega.'],
          ].map(([num, title, text]) => (
            <li key={num}>
              <span>{num}</span>
              <b>{title}</b>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-faq" id="faq">
        <h2>Dúvidas frequentes</h2>
        {FAQ.map((item, i) => (
          <div key={item.q} className={openFaq === i ? 'is-open' : ''}>
            <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
              {item.q}
              <span>{openFaq === i ? '–' : '+'}</span>
            </button>
            {openFaq === i && <p>{item.a}</p>}
          </div>
        ))}
      </section>

      <section className="lp-final">
        <h2>Caminhe pelo Parque Firenze.</h2>
        <p>Terreno real, sol da hora e as 45 torres dos grupos 12 a 18.</p>
        <button className="btn btn-green" onClick={() => enter()}>
          Abrir a maquete 3D
        </button>
      </section>

      <footer className="lp-foot">
        <img src={assetUrl('logo-chvn.webp')} alt="" />
        <div>
          <b>Cooperativa Habitacional Vida Nova</b>
          <span>Av. Vida Nova, 28 · Taboão da Serra · SP</span>
          <span>11 4788-3519 · administrativo@chvn.com.br</span>
        </div>
        <a href="https://chvn.com.br/" target="_blank" rel="noreferrer">
          chvn.com.br
        </a>
      </footer>
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
