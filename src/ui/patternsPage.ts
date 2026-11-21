/**
 * Página "Padrões bonitos" (/padroes, /en/patterns): figuras para montar no cubo resolvido.
 * Cada cartão tem o desenho do resultado (calculado); tocar nele monta o padrão no 3D, um
 * movimento de cada vez, marcando na sequência o movimento atual.
 */
import { tr } from '../core/i18n';
import { cubeStateIcon } from '../core/icons';
import { PUZZLES, loadPuzzle } from '../core/registry';
import { notationPath, patternsPath, puzzlePath } from '../core/router';
import type { PuzzleImpl, PuzzleState, PuzzleView } from '../core/types';
import { PATTERNS, PATTERN_PUZZLES, type Pattern } from '../puzzles/patterns';
import { icon } from './icons';

/** o padrão aplicado ao cubo resolvido */
export function patternState(impl: PuzzleImpl, alg: string): PuzzleState {
  return alg.split(' ').reduce((s, m) => impl.applyMove(s, m), impl.solvedState());
}

/** desenho do cubo com o padrão (cima, frente e direita) */
export function patternIcon(impl: PuzzleImpl, n: number, alg: string): string {
  const s = patternState(impl, alg);
  const hex = (k: string) => impl.colors.find((c) => c.key === k)?.hex ?? '#3b4152';
  const face = { U: 0, R: 1, F: 2 } as const;
  return cubeStateIcon(n, (f, r, c) => hex(String(s[face[f] * n * n + r * n + c])));
}

export async function renderPatterns(app: HTMLElement, puzzleId = 'cube3') {
  const id = PATTERN_PUZZLES.includes(puzzleId) ? puzzleId : 'cube3';
  const impl = await loadPuzzle(id);
  const n = Number(id.slice(4));
  const list = PATTERNS[id];
  const short = (pid: string) => PUZZLES.find((p) => p.id === pid)!.short;
  let alive = true;
  /** um padrão de cada vez: os giros já pedidos ao 3D terminam antes do próximo */
  let busy = false;

  const card = (p: Pattern) => `
    <article class="pt-card card" data-p="${p.id}" id="${p.id}">
      <button type="button" class="pt-pic" data-play="${p.id}" aria-label="${tr(`Montar o padrão ${p.name()} no 3D`, `Build the ${p.name()} pattern in 3D`, `Hacer el patrón ${p.name()} en 3D`)}">${patternIcon(impl, n, p.alg)}<span class="al-play">${icon('play')}</span></button>
      <div class="pt-body">
        <h3>${p.name()}</h3>
        <p>${p.about()}</p>
        <div class="pt-alg">${p.alg
          .split(' ')
          .map((m, i) => `<span data-i="${i}">${m}</span>`)
          .join(' ')}</div>
        <span class="pt-count">${tr(`${p.alg.split(' ').length} movimentos`, `${p.alg.split(' ').length} moves`, `${p.alg.split(' ').length} movimientos`)}</span>
      </div>
    </article>`;

  app.innerHTML = `
  <section class="page workspace notation-page patterns-page">
    <div class="ws-header nt-head">
      <span class="eyebrow">${tr('Padrões', 'Patterns', 'Patrones')}</span>
      <h1>${tr('Padrões bonitos', 'Cube patterns', 'Patrones bonitos')}</h1>
      <nav class="al-puzzles" aria-label="Puzzle">
        ${PATTERN_PUZZLES.map((p) => `<a href="${patternsPath(undefined, p)}" class="${p === id ? 'on' : ''}" ${p === id ? 'aria-current="page"' : ''}>${short(p)}</a>`).join('')}
      </nav>
      <p class="lead">${tr(
        `Comece com o cubo <b>resolvido</b>, com o <b>amarelo em cima</b> e o <b>verde de frente</b>, e faça os movimentos: o cubo vira uma figura. Toque num padrão para ver ele sendo montado no 3D. Não sabe ler as letras? Veja a <a href="${notationPath(undefined, id === 'cube3' ? 'cube3' : 'cube5')}">notação</a>.`,
        `Start with a <b>solved</b> cube, <b>yellow on top</b> and <b>green in front</b>, and do the moves: the cube turns into a picture. Tap a pattern to watch it being built in 3D. Can’t read the letters? See the <a href="${notationPath(undefined, id === 'cube3' ? 'cube3' : 'cube5')}">notation</a>.`, `Empieza con el cubo <b>resuelto</b>, con el <b>amarillo arriba</b> y el <b>verde al frente</b>, y haz los movimientos: el cubo se convierte en una figura. Toca un patrón para verlo armarse en 3D. ¿No sabes leer las letras? Mira la <a href="${notationPath(undefined, id === 'cube3' ? 'cube3' : 'cube5')}">notación</a>.`,
      )}</p>
    </div>
    <div class="ws-grid">
      <div class="ws-view card">
        <div class="view-host" id="pt-view"></div>
        <div class="move-badge" aria-live="polite"><strong></strong><span></span></div>
        <button class="icon-btn view-reset" title="${tr('Voltar à vista inicial', 'Reset the view', 'Volver a la vista inicial')}" aria-label="${tr('Voltar à vista inicial', 'Reset the view', 'Volver a la vista inicial')}">${icon('resetView')}</button>
        <div class="pt-tools" hidden>
          <button type="button" class="btn ghost sm" data-again>${icon('play')}${tr('Montar de novo', 'Build again', 'Hacerlo otra vez')}</button>
          <button type="button" class="btn ghost sm" data-undo>${icon('movePrev')}${tr('Desfazer o padrão', 'Undo the pattern', 'Deshacer el patrón')}</button>
        </div>
      </div>
      <div class="pt-list">
        ${list.map(card).join('')}
        <div class="row-actions">
          <a class="btn primary" href="${puzzlePath(id)}">${tr(`Resolver meu ${short(id)}`, `Solve my ${short(id)}`, `Resolver mi ${short(id)}`)}</a>
        </div>
      </div>
    </div>
  </section>`;

  const root = app.querySelector<HTMLElement>('.patterns-page')!;
  const view: PuzzleView = impl.createView(root.querySelector('#pt-view')!);
  const solved = impl.solvedState();
  view.setState(solved);
  root.querySelector('.view-reset')!.addEventListener('click', () => view.resetCamera());
  const badge = root.querySelector<HTMLElement>('.move-badge')!;
  const tools = root.querySelector<HTMLElement>('.pt-tools')!;
  let current: Pattern | null = null;
  const ms = n <= 3 ? 300 : 260;

  /** monta (ou desfaz) o padrão no 3D, marcando o movimento atual na sequência do cartão */
  async function play(p: Pattern, undo = false) {
    if (busy) return;
    busy = true;
    try {
      await run(p, undo);
    } finally {
      busy = false;
    }
  }

  async function run(p: Pattern, undo: boolean) {
    current = p;
    tools.hidden = true;
    root.querySelectorAll('.pt-card.on').forEach((c) => c.classList.remove('on'));
    const el = root.querySelector<HTMLElement>(`.pt-card[data-p="${p.id}"]`)!;
    el.classList.add('on');
    const spans = [...el.querySelectorAll<HTMLElement>('.pt-alg span')];
    spans.forEach((s) => s.classList.remove('now', 'done'));
    const moves = p.alg.split(' ');
    const seq = undo ? [...moves].reverse().map((m) => impl.invertMove(m)) : moves;
    view.setState(undo ? patternState(impl, p.alg) : solved);
    if (matchMedia('(max-width: 900px)').matches) root.querySelector('.ws-view')!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    badge.classList.add('show', 'active');
    for (let i = 0; i < seq.length; i++) {
      if (!alive) return;
      const k = undo ? moves.length - 1 - i : i;
      spans.forEach((s, j) => {
        s.classList.toggle('now', j === k);
        s.classList.toggle('done', undo ? j > k : j < k);
      });
      badge.querySelector('strong')!.classList.remove('ok');
      badge.querySelector('strong')!.textContent = seq[i];
      badge.querySelector('span')!.textContent = `${i + 1}/${seq.length}`;
      await view.animateMove(seq[i], ms);
    }
    if (!alive) return;
    spans.forEach((s) => {
      s.classList.remove('now');
      s.classList.toggle('done', !undo);
    });
    // fim: um "✓" e o nome do padrão (ou "resolvido", depois de desfazer)
    const strong = badge.querySelector('strong')!;
    strong.innerHTML = icon('check');
    strong.classList.add('ok');
    badge.querySelector('span')!.textContent = undo ? tr('De volta ao resolvido', 'Back to solved', 'De vuelta al resuelto') : tr(`${p.name()}: pronto!`, `${p.name()}: done!`, `${p.name()}: ¡listo!`);
    badge.classList.remove('active');
    tools.hidden = false;
  }

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pick = t.closest<HTMLElement>('[data-play], .pt-card');
    if (t.closest('[data-again]') && current) play(current);
    else if (t.closest('[data-undo]') && current) play(current, true);
    else if (pick && !t.closest('a')) {
      const p = list.find((x) => x.id === (pick.dataset.play ?? pick.dataset.p));
      if (p) play(p);
    }
  });

  return () => {
    alive = false;
    view.dispose();
  };
}
