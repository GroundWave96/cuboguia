import './styles.css';
import { getLang, setLang, tr } from './core/i18n';
import { getPuzzle } from './core/registry';
import { fromLegacyHash, homePath, navigate, parseRoute, pathInLang, setRouteHandler } from './core/router';
import { mountHeader } from './ui/header';
import { setupApp } from './ui/pwa';
import { renderHome } from './ui/home';
import { renderInput } from './ui/input';
import { renderSolve } from './ui/solve';
import { renderTimer } from './ui/timer';
import { renderAlgs } from './ui/algs';

export type Cleanup = () => void;

const app = document.getElementById('app')!;
let cleanup: Cleanup | null = null;
/** seção da página inicial para rolar depois de renderizar (ex.: "Como funciona") */
let pendingScroll: string | null = null;

// altura real da barra do topo (usada pelo painel fixo do tutorial no celular)
const topbar = document.querySelector<HTMLElement>('.topbar')!;
new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`)).observe(topbar);

// menu montado a partir do registro: novos puzzles aparecem sozinhos no painel
const setActiveNav = mountHeader();

const SITE = 'CuboGuia';
const defaultDesc = () =>
  tr(
    'Informe as cores do seu cubo mágico (pintando em 3D ou pela câmera) e siga um tutorial animado, passo a passo, para resolvê-lo.',
    'Enter your Rubik’s cube colors (painting in 3D or with the camera) and follow an animated step-by-step tutorial to solve it.',
  );

/** título e descrição de cada página (o que aparece na aba e nos resultados do Google) */
function setMeta(title: string, desc = defaultDesc()) {
  document.title = title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content = desc;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href = location.origin + location.pathname;
  // a mesma página no outro idioma (para o Google mostrar a versão certa)
  for (const [l, hl] of [
    ['pt', 'pt-BR'],
    ['en', 'en'],
    ['pt', 'x-default'],
  ] as const) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hl}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hl;
      document.head.appendChild(link);
    }
    link.href = location.origin + pathInLang(location.pathname, '', l);
  }
}

/** navegador em inglês, na versão em português, sem ter escolhido idioma: oferece o inglês */
function offerEnglish() {
  document.querySelector('.lang-offer')?.remove();
  if (getLang() !== 'pt' || /^pt\b/i.test(navigator.language || 'pt')) return;
  try {
    if (localStorage.getItem('cubo:lang')) return;
  } catch {
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'lang-offer';
  bar.lang = 'en';
  bar.innerHTML = `<span>Prefer English?</span><a class="btn primary sm" data-lang="en" href="${pathInLang(location.pathname, location.search, 'en')}">Switch to English</a><button class="btn ghost sm" data-close aria-label="Close">✕</button>`;
  bar.querySelector('[data-close]')!.addEventListener('click', () => {
    bar.remove();
    try {
      localStorage.setItem('cubo:lang', 'pt');
    } catch {
      /* sem armazenamento */
    }
  });
  bar.querySelector('a')!.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}

async function route() {
  cleanup?.();
  cleanup = null;
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const r = parseRoute(location.pathname, location.search);
  setLang(r.lang);
  // o CSS usa para ajustar o layout por página (ex.: celular deitado no tutorial)
  document.body.dataset.page = r.page === 'notfound' ? 'home' : r.page;
  try {
    if (r.page === 'timer') {
      setActiveNav('timer');
      setMeta(
        tr(`Cronômetro de cubo mágico (estilo competição) — ${SITE}`, `Rubik’s cube timer (competition style) — ${SITE}`),
        tr(
          'Cronômetro de speedcubing no navegador: dois dedos no celular, inspeção de 15 s, embaralhos oficiais, média de 5 e de 12 e desafios com amigos.',
          'Speedcubing timer in your browser: two-finger start on phones, 15 s inspection, official-style scrambles, ao5 and ao12, and challenges with friends.',
        ),
      );
      cleanup = await renderTimer(app, r.params);
    } else if (r.page === 'algs') {
      setActiveNav('algs');
      setMeta(
        tr(`Algoritmos OLL e PLL do cubo mágico, com animação 3D — ${SITE}`, `OLL and PLL algorithms for the Rubik’s cube, with 3D animation — ${SITE}`),
        tr(
          'OLL em 2 etapas e PLL completa (21 casos) do CFOP: desenho de cada caso, o algoritmo animado em 3D, como montar o caso no seu cubo e um modo treino.',
          'CFOP 2-look OLL and full PLL (21 cases): a picture of each case, the algorithm animated in 3D, how to set it up on your cube, and a training mode.',
        ),
      );
      cleanup = await renderAlgs(app);
    } else if (r.page === 'input' || r.page === 'solve') {
      const def = getPuzzle(r.id)!;
      setActiveNav(r.id);
      const name = def.short;
      if (r.page === 'solve') {
        setMeta(tr(`Tutorial: resolvendo o ${def.name} passo a passo — ${SITE}`, `Tutorial: solving the ${def.name} step by step — ${SITE}`));
        cleanup = await renderSolve(app, r.id, r.params);
      } else {
        setMeta(
          tr(`Como resolver o ${def.name} — tutorial passo a passo em 3D | ${SITE}`, `How to solve the ${def.name} — step-by-step 3D tutorial | ${SITE}`),
          tr(
            `Aprenda a resolver o ${name}: informe as cores do seu ${name} (pintando em 3D ou pela câmera) e siga um tutorial animado, do iniciante ao avançado. Grátis.`,
            `Learn to solve the ${name}: enter your ${name}’s colors (painting in 3D or with the camera) and follow an animated tutorial, from beginner to advanced. Free.`,
          ),
        );
        cleanup = await renderInput(app, r.id, r.params);
      }
    } else if (r.page === 'notfound') {
      setActiveNav('');
      setMeta(tr(`Página não encontrada — ${SITE}`, `Page not found — ${SITE}`));
      app.innerHTML = `<section class="page narrow"><div class="card"><h2>${tr('Página não encontrada', 'Page not found')}</h2><p>${tr('Esse endereço não existe no CuboGuia.', 'This address doesn’t exist on CuboGuia.')}</p><a class="btn primary" href="${homePath()}">${tr('Voltar ao início', 'Back to home')}</a></div></section>`;
    } else {
      setActiveNav('home');
      setMeta(tr(`${SITE} — resolva seu cubo mágico passo a passo`, `${SITE} — solve your Rubik’s cube step by step`));
      cleanup = renderHome(app);
      if (pendingScroll) {
        const id = pendingScroll;
        pendingScroll = null;
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
      }
    }
    offerEnglish();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<section class="page narrow"><div class="card"><h2>${tr('Ops!', 'Oops!')}</h2><p></p><a class="btn primary" href="${homePath()}">${tr('Voltar ao início', 'Back to home')}</a></div></section>`;
    app.querySelector('p')!.textContent = (e as Error).message;
  }
}

// links "rolar até uma seção" da página inicial
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-scroll]');
  if (!a) return;
  e.preventDefault();
  const id = a.dataset.scroll!;
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: 'smooth' });
  else {
    pendingScroll = id;
    navigate(homePath());
  }
});

// links internos trocam de página sem recarregar (Ctrl/Cmd+clique continua abrindo em outra aba)
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!a || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname + url.search === location.pathname + location.search) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  navigate(url.pathname + url.search);
});

setupApp();
setRouteHandler(route);
window.addEventListener('popstate', route);

// links antigos (#/p/cube3, #/cronometro?...) viram o endereço novo
const legacy = fromLegacyHash(location.hash);
if (legacy) history.replaceState(null, '', legacy);
route();
