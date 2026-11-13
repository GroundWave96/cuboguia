/**
 * Cabeçalho: Início · Puzzles ▾ (painel com todos os puzzles) · Como funciona.
 * Com muitos puzzles o menu continua do mesmo tamanho; no celular vira um botão ☰.
 */
import { PUZZLES } from '../core/registry';

const short = (name: string) => name.replace('Cubo ', '');

export function mountHeader() {
  const nav = document.getElementById('main-nav')!;
  const available = PUZZLES.filter((p) => p.available);
  const soon = PUZZLES.filter((p) => !p.available);

  const card = (p: (typeof PUZZLES)[number]) =>
    p.available
      ? `<a class="mm-item" href="#/p/${p.id}" data-nav="${p.id}">${p.icon}<span><b>${p.name}</b><small>${p.subtitle}</small></span></a>`
      : `<div class="mm-item soon" aria-disabled="true">${p.icon}<span><b>${p.name}</b><small>Em breve</small></span></div>`;

  nav.innerHTML = `
    <a href="#/" data-nav="home">Início</a>
    <div class="nav-dd">
      <button type="button" class="nav-dd-btn" aria-haspopup="true" aria-expanded="false" aria-controls="puzzle-menu">
        <span class="nav-dd-label">Puzzles</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
      <div class="mega" id="puzzle-menu" role="menu" hidden>
        <div class="mega-title">Escolha o seu puzzle</div>
        <div class="mega-grid">${available.map(card).join('')}</div>
        ${soon.length ? `<div class="mega-title soon-title">Em breve</div><div class="mega-grid">${soon.map(card).join('')}</div>` : ''}
      </div>
    </div>
    <a href="#/" data-scroll="como-funciona" class="nav-extra">Como funciona</a>`;

  // menu do celular (gaveta)
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'menu-btn';
  menuBtn.setAttribute('aria-label', 'Abrir menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.innerHTML = '<span></span><span></span><span></span>';
  nav.parentElement!.appendChild(menuBtn);
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="drawer-panel" role="dialog" aria-label="Menu">
      <a class="drawer-link" href="#/" data-nav="home">Início</a>
      <a class="drawer-link" href="#/" data-scroll="como-funciona">Como funciona</a>
      <div class="mega-title">Puzzles</div>
      <div class="mega-grid">${available.map(card).join('')}</div>
      ${soon.length ? `<div class="mega-title soon-title">Em breve</div><div class="mega-grid">${soon.map(card).join('')}</div>` : ''}
    </div>`;
  document.body.appendChild(drawer);

  const ddBtn = nav.querySelector<HTMLButtonElement>('.nav-dd-btn')!;
  const mega = nav.querySelector<HTMLElement>('.mega')!;
  const setMega = (open: boolean) => {
    mega.hidden = !open;
    ddBtn.setAttribute('aria-expanded', String(open));
    ddBtn.classList.toggle('open', open);
  };
  const setDrawer = (open: boolean) => {
    drawer.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.classList.toggle('open', open);
    document.body.classList.toggle('no-scroll', open);
  };
  ddBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMega(mega.hidden);
  });
  menuBtn.addEventListener('click', () => setDrawer(drawer.hidden));
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer || (e.target as HTMLElement).closest('a')) setDrawer(false);
  });
  document.addEventListener('click', (e) => {
    if (!mega.hidden && !(e.target as HTMLElement).closest('.nav-dd')) setMega(false);
  });
  mega.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setMega(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setMega(false);
      setDrawer(false);
    }
  });

  /** marca a página atual; num puzzle, o botão mostra o nome dele */
  return function setActive(key: string) {
    const current = available.find((p) => p.id === key);
    nav.querySelector('.nav-dd-label')!.textContent = current ? short(current.name) : 'Puzzles';
    ddBtn.classList.toggle('active', !!current);
    document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === key;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    setMega(false);
    setDrawer(false);
  };
}
