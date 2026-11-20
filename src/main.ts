import './styles.css';
import { getPuzzle } from './core/registry';
import { fromLegacyHash, navigate, parseRoute, setRouteHandler } from './core/router';
import { mountHeader } from './ui/header';
import { setupApp } from './ui/pwa';
import { renderHome } from './ui/home';
import { renderInput } from './ui/input';
import { renderSolve } from './ui/solve';
import { renderTimer } from './ui/timer';

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
const DEFAULT_DESC = document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content;

/** título e descrição de cada página (o que aparece na aba e nos resultados do Google) */
function setMeta(title: string, desc = DEFAULT_DESC) {
  document.title = title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content = desc;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href = location.origin + location.pathname;
}

async function route() {
  cleanup?.();
  cleanup = null;
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const r = parseRoute(location.pathname, location.search);
  // o CSS usa para ajustar o layout por página (ex.: celular deitado no tutorial)
  document.body.dataset.page = r.page === 'notfound' ? 'home' : r.page;
  try {
    if (r.page === 'timer') {
      setActiveNav('timer');
      setMeta(`Cronômetro de cubo mágico (estilo competição) — ${SITE}`, 'Cronômetro de speedcubing no navegador: dois dedos no celular, inspeção de 15 s, embaralhos oficiais, média de 5 e de 12 e desafios com amigos.');
      cleanup = await renderTimer(app, r.params);
    } else if (r.page === 'input' || r.page === 'solve') {
      const def = getPuzzle(r.id)!;
      setActiveNav(r.id);
      const name = def.name.replace('Cubo ', '');
      if (r.page === 'solve') {
        setMeta(`Tutorial: resolvendo o ${def.name} passo a passo — ${SITE}`);
        cleanup = await renderSolve(app, r.id, r.params);
      } else {
        setMeta(
          `Como resolver o ${def.name} — tutorial passo a passo em 3D | ${SITE}`,
          `Aprenda a resolver o ${name}: informe as cores do seu ${name} (pintando em 3D ou pela câmera) e siga um tutorial animado, do iniciante ao avançado. Grátis.`,
        );
        cleanup = await renderInput(app, r.id, r.params);
      }
    } else if (r.page === 'notfound') {
      setActiveNav('');
      setMeta(`Página não encontrada — ${SITE}`);
      app.innerHTML = `<section class="page narrow"><div class="card"><h2>Página não encontrada</h2><p>Esse endereço não existe no CuboGuia.</p><a class="btn primary" href="/">Voltar ao início</a></div></section>`;
    } else {
      setActiveNav('home');
      setMeta(`${SITE} — resolva seu cubo mágico passo a passo`);
      cleanup = renderHome(app);
      if (pendingScroll) {
        const id = pendingScroll;
        pendingScroll = null;
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
      }
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<section class="page narrow"><div class="card"><h2>Ops!</h2><p></p><a class="btn primary" href="/">Voltar ao início</a></div></section>`;
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
    navigate('/');
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
