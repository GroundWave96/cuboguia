/**
 * Página de algoritmos do 3x3 (OLL em 2 etapas e PLL completa), para quem já resolve pelo
 * método de iniciante e quer passar para o CFOP.
 *
 *  - cada caso tem o desenho (calculado: o algoritmo feito ao contrário num cubo resolvido),
 *    o algoritmo, o 3D animado e como montar o caso no cubo de verdade
 *  - "Aprendido" fica guardado no aparelho; o treino sorteia casos (de preferência os que faltam)
 */
import { tr } from '../core/i18n';
import { loadPuzzle } from '../core/registry';
import { loadSpeed } from '../core/store';
import type { PuzzleImpl, PuzzleView } from '../core/types';
import { ALG_CASES, ALG_GROUPS, caseName, caseState, cube3, invertAlg, splitAlg, type AlgCase, type AlgSet } from '../puzzles/cube3/algs';
import { icon } from './icons';
import { notationHtml } from './notation';
import { describeNxNMove } from '../puzzles/nxn/text';

const HEX: Record<string, string> = { U: '#ffd500', R: '#ff6a13', F: '#00a651', D: '#f4f6f8', L: '#d0192d', B: '#0a5bd6' };
const OLL_OFF = '#3a4152';
const LEARNED_KEY = 'cubo:algs:learned';

function loadLearned(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function saveLearned(s: Set<string>) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify([...s]));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

// ---------------------------------------------------------------- desenho do caso (vista de cima)
const { geo, applyAll } = cube3;
/** adesivos da camada de cima: posição no desenho 5×5 (o topo no meio, as laterais em volta) */
const TOP_CELLS = geo.stickers
  .filter((s) => s.cubie2[1] === 2)
  .map((s) => ({
    index: s.index,
    col: (s.cubie2[0] + 2) / 2 + 1 + s.normal[0],
    row: (s.cubie2[2] + 2) / 2 + 1 + s.normal[2],
    side: s.normal[1] === 0,
    piece: s.cubie2.join(','),
  }));

/** para onde vai cada peça da camada de cima (PLL): posição atual → posição de origem */
function pieceMoves(state: string[]): [string, string][] {
  const byPiece = new Map<string, number[]>();
  for (const c of TOP_CELLS) byPiece.set(c.piece, [...(byPiece.get(c.piece) ?? []), c.index]);
  const solved = geo.solved();
  const colors = (s: string[], idx: number[]) => idx.map((i) => s[i]).sort().join('');
  const home = new Map([...byPiece].map(([k, idx]) => [colors(solved, idx), k]));
  const out: [string, string][] = [];
  for (const [k, idx] of byPiece) {
    const h = home.get(colors(state, idx));
    if (h && h !== k) out.push([k, h]);
  }
  return out;
}

export function caseSvg(state: string[], set: AlgSet, size = 120): string {
  const unit = 20, side = 7, gap = 2;
  // posições: colunas/linhas 0 e 4 são as laterais (finas)
  const pos = (i: number) => (i === 0 ? 0 : side + gap + (i - 1) * (unit + gap));
  const len = (i: number) => (i === 0 || i === 4 ? side : unit);
  const total = pos(4) + side;
  const color = (k: string) => (set === 'oll' ? (k === 'U' ? HEX.U : OLL_OFF) : HEX[k]);
  const rects = TOP_CELLS.map((c) => {
    const w = len(c.col), h = len(c.row);
    return `<rect x="${pos(c.col)}" y="${pos(c.row)}" width="${w}" height="${h}" rx="${c.side ? 2 : 3.5}" fill="${color(state[c.index])}"/>`;
  }).join('');
  let arrows = '';
  if (set === 'pll') {
    const center = (k: string) => {
      const [x, , z] = k.split(',').map(Number);
      return [pos((x + 2) / 2 + 1) + unit / 2, pos((z + 2) / 2 + 1) + unit / 2];
    };
    const moves = pieceMoves(state);
    const done = new Set<string>();
    for (const [a, b] of moves) {
      if (done.has(`${a}>${b}`)) continue;
      // troca de duas peças: uma seta de duas pontas
      const swap = moves.some(([c, d]) => c === b && d === a);
      if (swap) done.add(`${b}>${a}`);
      const [x1, y1] = center(a), [x2, y2] = center(b);
      const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, cut = 6;
      arrows += `<line x1="${x1 + ux * cut}" y1="${y1 + uy * cut}" x2="${x2 - ux * cut}" y2="${y2 - uy * cut}" marker-end="url(#ah)" ${swap ? 'marker-start="url(#ah)"' : ''}/>`;
    }
  }
  return `<svg class="al-svg" viewBox="-2 -2 ${total + 4} ${total + 4}" width="${size}" height="${size}" aria-hidden="true">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#0b0e17"/></marker></defs>
    <rect x="${pos(1) - gap}" y="${pos(1) - gap}" width="${3 * unit + 4 * gap}" height="${3 * unit + 4 * gap}" rx="6" fill="#0b0e17"/>
    ${rects}
    <g class="al-arrows" stroke="#0b0e17" stroke-width="2.6" stroke-linecap="round">${arrows}</g>
  </svg>`;
}

/** algoritmo como chips (a parte entre parênteses fica junta) */
const algHtml = (alg: string, cur = -1) =>
  splitAlg(alg)
    .map((m, i) => `<span class="al-mv${i < cur ? ' done' : ''}${i === cur ? ' next' : ''}" data-i="${i}">${m}</span>`)
    .join('');

const setupFor = (alg: string, auf: string[] = []) => [...invertAlg(splitAlg(alg)), ...auf].join(' ');

// ---------------------------------------------------------------- página
export async function renderAlgs(app: HTMLElement) {
  const impl: PuzzleImpl = await loadPuzzle('cube3');
  const learned = loadLearned();
  let tab: AlgSet | 'train' = 'oll';
  let alive = true;

  app.innerHTML = `
  <section class="page algs-page">
    <div class="al-head">
      <span class="eyebrow">${tr('Do iniciante para o CFOP', 'From beginner to CFOP')}</span>
      <h1>${tr('Algoritmos OLL e PLL', 'OLL and PLL algorithms')}</h1>
      <p class="lead">${tr(
        'No CFOP, a última camada sai em duas partes: a <b>OLL</b> deixa o topo todo amarelo e a <b>PLL</b> coloca as peças no lugar. Comece pela OLL em 2 etapas (10 algoritmos) e depois aprenda a PLL completa (21). Segure o cubo com o <b>amarelo em cima</b>.',
        'In CFOP, the last layer is done in two parts: <b>OLL</b> makes the whole top yellow and <b>PLL</b> puts the pieces in place. Start with 2-look OLL (10 algorithms), then learn the full PLL (21). Hold the cube with <b>yellow on top</b>.',
      )}</p>
      <div class="al-bar">
        <div class="al-tabs" role="tablist">
          <button role="tab" data-tab="oll">${tr('OLL em 2 etapas', '2-look OLL')}<small>10</small></button>
          <button role="tab" data-tab="pll">PLL<small>21</small></button>
          <button role="tab" data-tab="train">${icon('shuffle')}${tr('Treino', 'Practice')}</button>
        </div>
        <span class="al-count"></span>
      </div>
      <details class="notation al-notation">
        <summary>${tr('Como ler os algoritmos?', 'How to read the algorithms?')}</summary>
        ${notationHtml(impl)}
        <ul class="notation-list">
          <li><code>M</code> ${tr('fatia do meio, entre R e L, no sentido do L', 'middle slice, between R and L, turning like L')}</li>
          <li><code>r f d</code> ${tr('letra minúscula: a face e a camada do meio juntas', 'lowercase: the face and the middle layer together')}</li>
          <li><code>x y</code> ${tr('girar o cubo inteiro na mão: x como o R, y como o U', 'turn the whole cube in your hands: x like R, y like U')}</li>
        </ul>
      </details>
    </div>
    <div class="al-body"></div>
    <div class="al-viewer" hidden>
      <div class="al-viewer-box card" role="dialog" aria-modal="true" aria-labelledby="al-v-title">
        <div class="al-v-head">
          <h2 id="al-v-title"></h2>
          <button class="icon-btn" data-v="close" aria-label="${tr('Fechar', 'Close')}" title="${tr('Fechar', 'Close')}">${icon('close')}</button>
        </div>
        <div class="al-v-grid">
          <div class="al-v-3d"></div>
          <div class="al-v-side">
            <div class="al-v-alg"></div>
            <div class="controls al-v-ctl">
              <button class="ctl" data-v="restart" aria-label="${tr('Voltar ao começo', 'Back to the start')}" title="${tr('Voltar ao começo', 'Back to the start')}">${icon('stepPrev')}</button>
              <button class="ctl" data-v="prev" aria-label="${tr('Desfazer movimento', 'Undo move')}" title="${tr('Desfazer movimento', 'Undo move')}">${icon('movePrev')}</button>
              <button class="ctl main" data-v="play"></button>
              <button class="ctl" data-v="next" aria-label="${tr('Próximo movimento', 'Next move')}" title="${tr('Próximo movimento', 'Next move')}">${icon('moveNext')}</button>
            </div>
            <p class="al-v-move" aria-live="polite"></p>
            <div class="al-v-setup"></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const body = app.querySelector<HTMLElement>('.al-body')!;
  const count = app.querySelector<HTMLElement>('.al-count')!;

  function renderCount() {
    const n = (s: AlgSet) => ALG_CASES.filter((c) => c.set === s && learned.has(c.id)).length;
    count.innerHTML = `${icon('checkCircle')}${tr(`Aprendidos: OLL ${n('oll')}/10 · PLL ${n('pll')}/21`, `Learned: OLL ${n('oll')}/10 · PLL ${n('pll')}/21`)}`;
  }

  const learnBtn = (c: AlgCase) =>
    `<button class="al-learn ${learned.has(c.id) ? 'on' : ''}" data-learn="${c.id}" aria-pressed="${learned.has(c.id)}">${icon('check')}${tr('Aprendido', 'Learned')}</button>`;

  function renderList(set: AlgSet) {
    body.innerHTML = ALG_GROUPS.filter((g) => g.set === set)
      .map(
        (g) => `
        <section class="al-group">
          <h2>${g.name()}</h2>
          <p class="al-about">${g.about()}</p>
          <div class="al-grid">
            ${ALG_CASES.filter((c) => c.group === g.id)
              .map(
                (c) => `
              <article class="al-card ${learned.has(c.id) ? 'learned' : ''}" data-case="${c.id}">
                <button class="al-pic" data-open="${c.id}" aria-label="${tr(`Ver o caso ${caseName(c)} em 3D`, `See the ${caseName(c)} case in 3D`)}">${caseSvg(caseState(c.alg), c.set)}<span class="al-play">${icon('play')}</span></button>
                <div class="al-info">
                  <h3>${caseName(c)}</h3>
                  <div class="al-alg">${algHtml(c.alg)}</div>
                  ${c.alt ? `<div class="al-alt"><span>${tr('ou', 'or')}</span> ${c.alt}</div>` : ''}
                  ${learnBtn(c)}
                </div>
              </article>`,
              )
              .join('')}
          </div>
        </section>`,
      )
      .join('');
  }

  // ---- treino: sorteia um caso (com o topo girado ao acaso), mostra o desenho e esconde a resposta
  const train = { set: 'all' as AlgSet | 'all', onlyNew: false, cur: null as AlgCase | null, auf: [] as string[], revealed: false, seen: 0 };
  function pickCase() {
    let pool = ALG_CASES.filter((c) => train.set === 'all' || c.set === train.set);
    if (train.onlyNew) {
      const left = pool.filter((c) => !learned.has(c.id));
      if (left.length) pool = left;
    }
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) while (next === train.cur) next = pool[Math.floor(Math.random() * pool.length)];
    train.cur = next;
    train.auf = [[], ['U'], ['U2'], ["U'"]][Math.floor(Math.random() * 4)];
    train.revealed = false;
    train.seen++;
  }
  function renderTrain() {
    if (!train.cur) pickCase();
    const c = train.cur!;
    const state = applyAll(caseState(c.alg), train.auf);
    const opt = (v: string, label: string) => `<button data-tset="${v}" class="${train.set === v ? 'on' : ''}">${label}</button>`;
    body.innerHTML = `
      <div class="al-train card">
        <div class="al-train-opts">
          <span class="tc-range" role="group" aria-label="${tr('Quais casos', 'Which cases')}">${opt('all', tr('Todos', 'All'))}${opt('oll', 'OLL')}${opt('pll', 'PLL')}</span>
          <label class="al-check"><input type="checkbox" data-tnew ${train.onlyNew ? 'checked' : ''}> ${tr('Só os que ainda não aprendi', 'Only the ones I haven’t learned')}</label>
        </div>
        <div class="al-train-main">
          <div class="al-train-pic">${caseSvg(state, c.set, 220)}</div>
          <div class="al-train-side">
            <p class="al-train-q">${tr(`Caso ${train.seen} · qual é este caso de ${c.set.toUpperCase()}?`, `Case ${train.seen} · which ${c.set.toUpperCase()} case is this?`)}</p>
            ${
              train.revealed
                ? `<h3>${caseName(c)}</h3>
                   ${train.auf.length ? `<p class="al-auf">${tr(`Antes, ajuste o topo: <b>${invertAlg(train.auf)[0]}</b> (ou olhe de outro lado)`, `First adjust the top: <b>${invertAlg(train.auf)[0]}</b> (or look from another side)`)}</p>` : ''}
                   <div class="al-alg big">${algHtml(c.alg)}</div>
                   <div class="row-actions">${learnBtn(c)}<button class="btn ghost sm" data-open="${c.id}">${icon('play')}${tr('Ver em 3D', 'See in 3D')}</button></div>`
                : `<button class="btn primary" data-treveal>${tr('Mostrar a resposta', 'Show the answer')}</button>`
            }
            <p class="al-setup">${tr('Para treinar no seu cubo, monte o caso a partir do cubo resolvido (amarelo em cima, verde na frente):', 'To practice on your cube, set up the case from a solved cube (yellow on top, green in front):')}<code>${setupFor(c.alg, train.auf)}</code></p>
            <button class="btn ghost" data-tnext>${tr('Próximo caso', 'Next case')} ${icon('stepNext')}</button>
          </div>
        </div>
      </div>`;
  }

  function render() {
    app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    renderCount();
    if (tab === 'train') renderTrain();
    else renderList(tab);
  }

  // ---- 3D: o caso montado e o algoritmo animado
  const viewer = app.querySelector<HTMLElement>('.al-viewer')!;
  const vHost = viewer.querySelector<HTMLElement>('.al-v-3d')!;
  const vAlg = viewer.querySelector<HTMLElement>('.al-v-alg')!;
  const vMove = viewer.querySelector<HTMLElement>('.al-v-move')!;
  const vPlay = viewer.querySelector<HTMLButtonElement>('[data-v="play"]')!;
  let view: PuzzleView | null = null;
  let vCase: AlgCase | null = null;
  let vMoves: string[] = [];
  let vPos = 0;
  let vBusy = false;
  let vPlaying = false;
  let vStart: string[] = [];
  const moveMs = () => 650 / loadSpeed();

  function vRender() {
    vAlg.innerHTML = algHtml(vCase!.alg, vPos);
    vPlay.innerHTML = vPlaying ? icon('pause') : icon('play');
    vPlay.setAttribute('aria-label', vPlaying ? tr('Pausar', 'Pause') : tr('Animar', 'Play'));
    vPlay.title = vPlay.getAttribute('aria-label')!;
    vMove.textContent =
      vPos < vMoves.length
        ? `${tr('Próximo', 'Next')}: ${vMoves[vPos]} · ${describeNxNMove(vMoves[vPos], true)}`
        : tr('Pronto! O caso foi resolvido.', 'Done! The case is solved.');
  }
  async function vStep(dir: 1 | -1) {
    if (vBusy) return;
    if (dir === 1 && vPos >= vMoves.length) return;
    if (dir === -1 && vPos === 0) return;
    vBusy = true;
    const m = dir === 1 ? vMoves[vPos] : impl.invertMove(vMoves[vPos - 1]);
    await view!.animateMove(m, moveMs());
    vPos += dir;
    vBusy = false;
    vRender();
  }
  async function vPlayAll() {
    if (vPlaying) {
      vPlaying = false;
      return vRender();
    }
    if (vPos >= vMoves.length) vRestart();
    vPlaying = true;
    vRender();
    while (alive && vPlaying && vPos < vMoves.length && !viewer.hidden) await vStep(1);
    vPlaying = false;
    vRender();
  }
  function vRestart() {
    if (vBusy) return;
    vPlaying = false;
    vPos = 0;
    view!.setState(vStart);
    vRender();
  }
  function openViewer(id: string) {
    const c = ALG_CASES.find((x) => x.id === id);
    if (!c) return;
    vCase = c;
    vMoves = splitAlg(c.alg);
    vPos = 0;
    vStart = caseState(c.alg);
    viewer.hidden = false;
    document.body.classList.add('al-modal');
    if (!view) view = impl.createView(vHost);
    view.setState(vStart);
    view.resetCamera();
    viewer.querySelector('#al-v-title')!.textContent = `${c.set.toUpperCase()} · ${caseName(c)}`;
    viewer.querySelector('.al-v-setup')!.innerHTML = `${tr('Montar no seu cubo (a partir do resolvido):', 'Set it up on your cube (from solved):')}<code>${setupFor(c.alg)}</code>`;
    vRender();
    viewer.querySelector<HTMLButtonElement>('[data-v="play"]')!.focus();
  }
  function closeViewer() {
    vPlaying = false;
    viewer.hidden = true;
    document.body.classList.remove('al-modal');
  }
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) return closeViewer();
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v;
    if (v === 'close') closeViewer();
    else if (v === 'play') vPlayAll();
    else if (v === 'next') {
      vPlaying = false;
      vStep(1);
    } else if (v === 'prev') {
      vPlaying = false;
      vStep(-1);
    } else if (v === 'restart') vRestart();
  });

  // ---- cliques da página
  app.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tabBtn = t.closest<HTMLElement>('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab as typeof tab;
      return render();
    }
    const learn = t.closest<HTMLElement>('[data-learn]');
    if (learn) {
      const id = learn.dataset.learn!;
      if (learned.has(id)) learned.delete(id);
      else learned.add(id);
      saveLearned(learned);
      app.querySelectorAll<HTMLElement>(`[data-learn="${id}"]`).forEach((b) => {
        b.classList.toggle('on', learned.has(id));
        b.setAttribute('aria-pressed', String(learned.has(id)));
      });
      app.querySelector(`.al-card[data-case="${id}"]`)?.classList.toggle('learned', learned.has(id));
      return renderCount();
    }
    const open = t.closest<HTMLElement>('[data-open]');
    if (open) return openViewer(open.dataset.open!);
    const tset = t.closest<HTMLElement>('[data-tset]');
    if (tset) {
      train.set = tset.dataset.tset as typeof train.set;
      pickCase();
      return renderTrain();
    }
    if (t.closest('[data-treveal]')) {
      train.revealed = true;
      return renderTrain();
    }
    if (t.closest('[data-tnext]')) {
      pickCase();
      return renderTrain();
    }
  });
  app.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-tnew]')) {
      train.onlyNew = t.checked;
      pickCase();
      renderTrain();
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowRight') vStep(1);
    else if (e.key === 'ArrowLeft') vStep(-1);
    else if (e.key === ' ') {
      e.preventDefault();
      vPlayAll();
    }
  };
  window.addEventListener('keydown', onKey);

  render();
  return () => {
    alive = false;
    vPlaying = false;
    window.removeEventListener('keydown', onKey);
    document.body.classList.remove('al-modal');
    view?.dispose();
  };
}
