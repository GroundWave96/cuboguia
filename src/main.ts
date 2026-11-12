import './styles.css';
import { renderHome } from './ui/home';
import { renderInput } from './ui/input';
import { renderSolve } from './ui/solve';

export type Cleanup = () => void;

const app = document.getElementById('app')!;
let cleanup: Cleanup | null = null;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

export function navigate(path: string) {
  location.hash = path;
}

async function route() {
  cleanup?.();
  cleanup = null;
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const { parts, params } = parseHash();
  try {
    if (parts[0] === 'p' && parts[1]) {
      if (parts[2] === 'solve') cleanup = await renderSolve(app, parts[1], params);
      else cleanup = await renderInput(app, parts[1]);
    } else {
      cleanup = renderHome(app);
    }
  } catch (e) {
    console.error(e);
    app.innerHTML = `<section class="page narrow"><div class="card"><h2>Ops!</h2><p>${(e as Error).message}</p><a class="btn primary" href="#/">Voltar ao início</a></div></section>`;
  }
}

window.addEventListener('hashchange', route);
route();
