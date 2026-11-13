import './styles.css';
import { PUZZLES } from './core/registry';
import { renderHome } from './ui/home';
import { renderInput } from './ui/input';
import { renderSolve } from './ui/solve';

export type Cleanup = () => void;

const app = document.getElementById('app')!;
const nav = document.getElementById('main-nav')!;
let cleanup: Cleanup | null = null;
/** seção da página inicial para rolar depois de renderizar (ex.: "Como funciona") */
let pendingScroll: string | null = null;

// altura real da barra do topo (usada pelo painel fixo do tutorial no celular)
const topbar = document.querySelector<HTMLElement>('.topbar')!;
new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`)).observe(topbar);

// menu montado a partir do registro: novos puzzles aparecem sozinhos
nav.innerHTML = [
  `<a href="#/" data-nav="home">Início</a>`,
  ...PUZZLES.filter((p) => p.available).map((p) => `<a href="#/p/${p.id}" data-nav="${p.id}">${p.name.replace('Cubo ', '')}</a>`),
  `<a href="#/" data-scroll="como-funciona" class="nav-extra">Como funciona</a>`,
].join('');

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

export function navigate(path: string) {
  location.hash = path;
}

function setActiveNav(key: string) {
  nav.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === key;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function route() {
  cleanup?.();
  cleanup = null;
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const { parts, params } = parseHash();
  try {
    if (parts[0] === 'p' && parts[1]) {
      setActiveNav(parts[1]);
      if (parts[2] === 'solve') cleanup = await renderSolve(app, parts[1], params);
      else cleanup = await renderInput(app, parts[1]);
    } else {
      setActiveNav('home');
      cleanup = renderHome(app);
      if (pendingScroll) {
        const id = pendingScroll;
        pendingScroll = null;
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
      }
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<section class="page narrow"><div class="card"><h2>Ops!</h2><p>${(e as Error).message}</p><a class="btn primary" href="#/">Voltar ao início</a></div></section>`;
  }
}

// links "rolar até uma seção" (o roteador usa o # da URL, então não dá para usar âncoras comuns)
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-scroll]');
  if (!a) return;
  e.preventDefault();
  const id = a.dataset.scroll!;
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: 'smooth' });
  else {
    pendingScroll = id;
    location.hash = '#/';
  }
});

window.addEventListener('hashchange', route);
route();
