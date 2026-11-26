/**
 * Cabeçalho: Início · Puzzles ▾ (painel com todos os puzzles) · Cronômetro · Algoritmos · Como funciona · PT|EN.
 * Com muitos puzzles o menu continua do mesmo tamanho; no celular vira um botão ☰.
 * Os textos dependem do idioma: o cabeçalho (e o rodapé) é remontado quando o idioma muda.
 */
import { LOCALE, getLang, tr, type Lang } from '../core/i18n';
import { PUZZLES } from '../core/registry';
import { FEEDBACK_EMAIL, feedbackLabel, wireFeedback } from './feedback';
import { algsPath, faqPath, homePath, notationPath, patternsPath, pathInLang, puzzlePath, timerPath } from '../core/router';
import { icon } from './icons';
import { refreshInstall } from './pwa';
import { toggleTheme } from './theme';

/** botão do tema: mostra o sol no escuro (vai para o claro) e a lua no claro */
const themeLabel = () => tr('Trocar entre tema claro e escuro', 'Switch between light and dark theme', 'Cambiar entre tema claro y oscuro');

/** o topo passou da largura (algo sobrepõe ou sai da tela)? */
function topbarOverflows(bar: HTMLElement): boolean {
  const nav = bar.querySelector<HTMLElement>('#main-nav');
  if (bar.scrollWidth > bar.clientWidth + 1) return true;
  if (!nav || nav.offsetParent === null) return false;
  if (nav.scrollWidth > nav.clientWidth + 1) return true;
  const n = nav.getBoundingClientRect();
  const brand = bar.querySelector('.brand')?.getBoundingClientRect();
  const cta = bar.querySelector<HTMLElement>('.nav-cta');
  const c = cta && cta.offsetParent !== null ? cta.getBoundingClientRect() : null;
  return (!!brand && n.left < brand.right + 4) || (!!c && n.right > c.left - 4) || n.right > bar.getBoundingClientRect().right;
}

/**
 * Esconde partes do topo, uma de cada vez, até tudo caber: "Como funciona", o "Resolver agora"
 * e por fim o menu inteiro (vira o botão ☰).
 */
export function fitTopbar() {
  const bar = document.querySelector<HTMLElement>('.topbar-inner');
  if (!bar) return;
  const levels = ['fit-1', 'fit-3', 'fit-4'];
  // o painel de puzzles aberto sai de dentro do menu (é flutuante): não conta na medida
  const mega = bar.querySelector<HTMLElement>('.mega');
  const display = mega?.style.display ?? '';
  if (mega) mega.style.display = 'none';
  bar.classList.remove(...levels);
  for (const l of levels) {
    if (!topbarOverflows(bar)) break;
    bar.classList.add(l);
  }
  if (mega) mega.style.display = display;
}

export function mountHeader() {
  const nav = document.getElementById('main-nav')!;
  const available = PUZZLES.filter((p) => p.available);
  const soon = PUZZLES.filter((p) => !p.available);

  const card = (p: (typeof PUZZLES)[number]) =>
    p.available
      ? `<a class="mm-item" href="${puzzlePath(p.id)}" data-nav="${p.id}">${p.icon}<span><b>${p.name}</b><small>${p.subtitle}</small></span></a>`
      : `<div class="mm-item soon" aria-disabled="true">${p.icon}<span><b>${p.name}</b><small>${tr('Em breve', 'Coming soon', 'Muy pronto')}</small></span></div>`;

  /** PT | EN: leva para a mesma página no outro idioma */
  const langSwitch = (cls: string) => {
    const link = (l: Lang, label: string, title: string) =>
      `<a href="${pathInLang(location.pathname, location.search, l)}" hreflang="${LOCALE[l]}" lang="${LOCALE[l]}" data-lang="${l}" title="${title}" class="${getLang() === l ? 'on' : ''}" ${getLang() === l ? 'aria-current="true"' : ''}>${label}</a>`;
    return `<span class="lang-switch ${cls}" role="group" aria-label="${tr('Idioma', 'Language', 'Idioma')}">${link('pt', 'PT', 'Português')}${link('en', 'EN', 'English')}${link('es', 'ES', 'Español')}</span>`;
  };

  // menu do celular (gaveta)
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'menu-btn';
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.innerHTML = '<span></span><span></span><span></span>';
  nav.parentElement!.appendChild(menuBtn);
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.hidden = true;
  document.body.appendChild(drawer);

  let renderedLang: Lang | null = null;
  function render() {
    renderedLang = getLang();
    nav.innerHTML = `
      <a href="${homePath()}" data-nav="home">${tr('Início', 'Home', 'Inicio')}</a>
      <div class="nav-dd">
        <button type="button" class="nav-dd-btn" aria-haspopup="true" aria-expanded="false" aria-controls="puzzle-menu">
          <span class="nav-dd-label">Puzzles</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
        <div class="mega" id="puzzle-menu" role="menu" hidden>
          <div class="mega-title">${tr('Escolha o seu puzzle', 'Choose your puzzle', 'Elige tu puzzle')}</div>
          <div class="mega-grid">${available.map(card).join('')}</div>
          ${soon.length ? `<div class="mega-title soon-title">${tr('Em breve', 'Coming soon', 'Muy pronto')}</div><div class="mega-grid">${soon.map(card).join('')}</div>` : ''}
        </div>
      </div>
      <a href="${timerPath()}" data-nav="timer">${tr('Cronômetro', 'Timer', 'Cronómetro')}</a>
      <a href="${algsPath()}" data-nav="algs">${tr('Algoritmos', 'Algorithms', 'Algoritmos')}</a>
      <a href="${notationPath()}" data-nav="notation">${tr('Notação', 'Notation', 'Notación')}</a>
      <a href="${homePath()}" data-scroll="como-funciona" class="nav-extra">${tr('Como funciona', 'How it works', 'Cómo funciona')}</a>
      <button type="button" class="nav-install" data-install hidden title="${tr('Instalar o CuboGuia como app (funciona sem internet)', 'Install CuboGuia as an app (works offline)', 'Instalar CuboGuia como app (funciona sin internet)')}">${icon('download')}<span class="nav-install-txt">${tr('Instalar app', 'Install app', 'Instalar app')}</span></button>
      <button type="button" class="theme-btn" data-theme-toggle aria-label="${themeLabel()}" title="${themeLabel()}">${icon('sun', 'when-dark')}${icon('moon', 'when-light')}</button>
      ${langSwitch('nav-lang')}`;
    drawer.innerHTML = `
      <div class="drawer-panel" role="dialog" aria-label="Menu">
        ${langSwitch('drawer-lang')}
        <a class="drawer-link" href="${homePath()}" data-nav="home">${tr('Início', 'Home', 'Inicio')}</a>
        <a class="drawer-link" href="${timerPath()}" data-nav="timer">${tr('Cronômetro', 'Timer', 'Cronómetro')}</a>
        <a class="drawer-link" href="${algsPath()}" data-nav="algs">${tr('Algoritmos OLL e PLL', 'OLL and PLL algorithms', 'Algoritmos OLL y PLL')}</a>
        <a class="drawer-link" href="${notationPath()}" data-nav="notation">${tr("Notação (o que é R, U', F2…)", "Notation (what R, U', F2… mean)", "Notación (qué significan R, U', F2…)")}</a>
        <a class="drawer-link" href="${patternsPath()}" data-nav="patterns">${tr('Padrões bonitos', 'Cube patterns', 'Patrones bonitos')}</a>
        <a class="drawer-link" href="${homePath()}" data-scroll="como-funciona">${tr('Como funciona', 'How it works', 'Cómo funciona')}</a>
        <a class="drawer-link" href="${faqPath()}" data-nav="faq">${tr('Perguntas frequentes', 'FAQ', 'Preguntas frecuentes')}</a>
        <button type="button" class="drawer-link drawer-theme" data-theme-toggle><span class="when-dark">${icon('sun')}${tr('Tema claro', 'Light theme', 'Tema claro')}</span><span class="when-light">${icon('moon')}${tr('Tema escuro', 'Dark theme', 'Tema oscuro')}</span></button>
        <button type="button" class="drawer-link drawer-install" data-install hidden>${icon('download')}${tr('Instalar app (funciona sem internet)', 'Install app (works offline)', 'Instalar app (funciona sin internet)')}</button>
        <div class="mega-title">Puzzles</div>
        <div class="mega-grid">${available.map(card).join('')}</div>
        <a class="drawer-link drawer-feedback" data-feedback href="mailto:${FEEDBACK_EMAIL}">${icon('mail')}${feedbackLabel()}</a>
        ${soon.length ? `<div class="mega-title soon-title">${tr('Em breve', 'Coming soon', 'Muy pronto')}</div><div class="mega-grid">${soon.map(card).join('')}</div>` : ''}
      </div>`;
    menuBtn.setAttribute('aria-label', tr('Abrir menu', 'Open menu', 'Abrir menú'));
    // partes fixas do index.html (marca, botão e rodapé)
    const brand = document.querySelector<HTMLAnchorElement>('.topbar .brand');
    if (brand) {
      brand.href = homePath();
      brand.setAttribute('aria-label', tr('CuboGuia, início', 'CuboGuia, home', 'CuboGuia, inicio'));
    }
    const tag = document.querySelector('.brand-tag');
    if (tag) tag.textContent = tr('tutoriais de cubo mágico em 3D', '3D Rubik’s cube tutorials', 'tutoriales de cubo de Rubik en 3D');
    const cta = document.querySelector<HTMLAnchorElement>('.nav-cta');
    if (cta) {
      cta.href = puzzlePath('cube3');
      cta.textContent = tr('Resolver agora', 'Solve now', 'Resolver ahora');
    }
    const sub = document.querySelector('.footer-sub');
    if (sub) sub.textContent = tr('Aprenda a resolver o cubo mágico, passo a passo.', 'Learn to solve the Rubik’s cube, step by step.', 'Aprende a resolver el cubo de Rubik, paso a paso.');
    const fb = document.querySelector('.footer-feedback');
    if (fb) fb.innerHTML = `${icon('mail')}${feedbackLabel()}`;
    const faq = document.querySelector<HTMLAnchorElement>('.footer-faq');
    if (faq) {
      faq.href = faqPath();
      faq.innerHTML = `${icon('info')}${tr('Perguntas frequentes', 'FAQ', 'Preguntas frecuentes')}`;
    }
    const credit = document.querySelector('.footer-credit');
    if (credit?.firstChild?.nodeType === Node.TEXT_NODE) credit.firstChild.textContent = tr('\n          Desenvolvido por\n          ', '\n          Made by\n          ', '\n          Hecho por\n          ');
    refreshInstall();
    fitTopbar();
  }

  const ddBtn = () => nav.querySelector<HTMLButtonElement>('.nav-dd-btn')!;
  const mega = () => nav.querySelector<HTMLElement>('.mega')!;
  const setMega = (open: boolean) => {
    mega().hidden = !open;
    ddBtn().setAttribute('aria-expanded', String(open));
    ddBtn().classList.toggle('open', open);
  };
  const setDrawer = (open: boolean) => {
    drawer.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.classList.toggle('open', open);
    document.body.classList.toggle('no-scroll', open);
  };
  // um ouvinte para o menu inteiro (os botões são recriados quando o idioma muda)
  nav.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.nav-dd-btn')) {
      e.stopPropagation();
      setMega(mega().hidden);
    } else if (t.closest('.mega a')) setMega(false);
  });
  menuBtn.addEventListener('click', () => setDrawer(drawer.hidden));
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer || (e.target as HTMLElement).closest('a')) setDrawer(false);
  });
  document.addEventListener('click', (e) => {
    if (!mega().hidden && !(e.target as HTMLElement).closest('.nav-dd')) setMega(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setMega(false);
      setDrawer(false);
    }
  });
  wireFeedback();
  // o topo se reajusta quando a janela muda, as fontes chegam ou o "Instalar app" aparece
  let fitting = 0;
  const refit = () => {
    cancelAnimationFrame(fitting);
    fitting = requestAnimationFrame(fitTopbar);
  };
  window.addEventListener('resize', refit);
  document.fonts?.ready.then(refit);
  new MutationObserver(refit).observe(nav, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-theme-toggle]')) toggleTheme();
  });
  // a escolha de idioma fica lembrada (para o convite "Prefer English?" não voltar)
  document.addEventListener('click', (e) => {
    const l = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]')?.dataset.lang;
    if (!l) return;
    try {
      localStorage.setItem('cubo:lang', l);
      // no tutorial: continua no mesmo passo, sem o aviso "continuando de onde parou"
      if (document.body.dataset.page === 'solve') sessionStorage.setItem('cubo:langSwitch', '1');
    } catch {
      /* sem armazenamento */
    }
  });

  /** marca a página atual; num puzzle, o botão mostra o nome dele. Remonta se o idioma mudou. */
  return function setActive(key: string) {
    if (renderedLang !== getLang()) render();
    // os links do seletor de idioma apontam para a página atual
    document.querySelectorAll<HTMLAnchorElement>('[data-lang]').forEach((a) => (a.href = pathInLang(location.pathname, location.search, a.dataset.lang as Lang)));
    const current = available.find((p) => p.id === key);
    nav.querySelector('.nav-dd-label')!.textContent = current ? current.short : 'Puzzles';
    ddBtn().classList.toggle('active', !!current);
    document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === key;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    setMega(false);
    setDrawer(false);
    // o nome do puzzle no botão muda a largura do menu
    fitTopbar();
  };
}
