/**
 * Página de algoritmos: 3x3 (OLL em 2 etapas, OLL completa e PLL), 2x2 (Ortega: face amarela
 * e PBL) e Pyraminx (última camada).
 *
 *  - cada caso tem o desenho (calculado: o algoritmo feito ao contrário no puzzle resolvido),
 *    o algoritmo, o 3D animado e como montar o caso no puzzle de verdade
 *  - "Aprendido" fica guardado no aparelho; o treino sorteia casos (de preferência os que faltam)
 */
import { tr } from '../core/i18n';
import { loadPuzzle } from '../core/registry';
import { algsPath } from '../core/router';
import { loadSpeed } from '../core/store';
import type { PuzzleImpl, PuzzleView } from '../core/types';
import { invertAlg, splitAlg, type AlgCase, type AlgGroup, type AlgSetDef, type AlgStyle, type NxNKit } from '../puzzles/algkit';
import { ALG_CASES, ALG_GROUPS, CUBE3_SETS, cube3 } from '../puzzles/cube3/algs';
import { CUBE2_CASES, CUBE2_GROUPS, CUBE2_SETS, cube2 } from '../puzzles/cube2/algs';
import { PYRA_CASES, PYRA_GROUPS, PYRA_SETS, pyra, pyraCaseState } from '../puzzles/pyraminx/algs';
import { invertPyraMove } from '../puzzles/pyraminx/geometry';
import { describeNxNMove } from '../puzzles/nxn/text';
import { invertMove } from '../puzzles/nxn/geometry';
import { icon } from './icons';
import { netSvg } from './net';
import { notationHtml } from './notation';

const HEX: Record<string, string> = { U: '#ffd500', R: '#ff6a13', F: '#00a651', D: '#f4f6f8', L: '#d0192d', B: '#0a5bd6' };
const OLL_OFF = '#3a4152';
const LEARNED_KEY = 'cubo:algs:learned';

/** os puzzles da página */
interface AlgPuzzle {
  id: 'cube3' | 'cube2' | 'pyraminx';
  label: string;
  sets: AlgSetDef[];
  groups: AlgGroup[];
  cases: AlgCase[];
  caseState: (alg: string) => string[];
  applyAll: (s: string[], moves: string[]) => string[];
  invert: (m: string) => string;
  /** giro da camada de cima para o treino */
  auf: string[][];
  kit?: NxNKit;
  intro: () => string;
  extraNotation: () => string;
}

const PUZZLES: AlgPuzzle[] = [
  {
    id: 'cube3',
    label: '3x3',
    sets: CUBE3_SETS,
    groups: ALG_GROUPS,
    cases: ALG_CASES,
    caseState: cube3.caseState,
    applyAll: cube3.applyAll,
    invert: invertMove,
    auf: [[], ['U'], ['U2'], ["U'"]],
    kit: cube3,
    intro: () =>
      tr(
        'No CFOP, a última camada sai em duas partes: a <b>OLL</b> deixa o topo todo amarelo e a <b>PLL</b> coloca as peças no lugar. Comece pela OLL em 2 etapas (10 algoritmos), aprenda a PLL completa (21) e depois a OLL completa (57). Segure o cubo com o <b>amarelo em cima</b>.',
        'In CFOP, the last layer is done in two parts: <b>OLL</b> makes the whole top yellow and <b>PLL</b> puts the pieces in place. Start with 2-look OLL (10 algorithms), learn the full PLL (21), then the full OLL (57). Hold the cube with <b>yellow on top</b>.',
      ),
    extraNotation: () => `
      <li><code>M</code> ${tr('fatia do meio, entre R e L, no sentido do L', 'middle slice, between R and L, turning like L')}</li>
      <li><code>S</code> ${tr('fatia do meio, entre F e B, no sentido do F', 'middle slice, between F and B, turning like F')}</li>
      <li><code>r l f d</code> ${tr('letra minúscula: a face e a camada do meio juntas', 'lowercase: the face and the middle layer together')}</li>
      <li><code>x y</code> ${tr('girar o cubo inteiro na mão: x como o R, y como o U', 'turn the whole cube in your hands: x like R, y like U')}</li>`,
  },
  {
    id: 'cube2',
    label: '2x2',
    sets: CUBE2_SETS,
    groups: CUBE2_GROUPS,
    cases: CUBE2_CASES,
    caseState: cube2.caseState,
    applyAll: cube2.applyAll,
    invert: invertMove,
    auf: [[], ['U'], ['U2'], ["U'"]],
    kit: cube2,
    intro: () =>
      tr(
        'O método <b>Ortega</b> resolve o 2x2 em 3 partes: a face branca (sem se preocupar com as laterais), a <b>face amarela</b> (7 casos) e a <b>PBL</b>, que coloca as duas camadas no lugar de uma vez (6 casos). Segure com a <b>face branca embaixo</b>.',
        'The <b>Ortega</b> method solves the 2x2 in 3 parts: the white face (without caring about the sides), the <b>yellow face</b> (7 cases) and <b>PBL</b>, which puts both layers in place at once (6 cases). Hold it with the <b>white face on the bottom</b>.',
      ),
    extraNotation: () => `<li><code>x2</code> ${tr('virar o cubo inteiro de cabeça para baixo (como o R, duas vezes)', 'turn the whole cube upside down (like R, twice)')}</li>`,
  },
  {
    id: 'pyraminx',
    label: 'Pyraminx',
    sets: PYRA_SETS,
    groups: PYRA_GROUPS,
    cases: PYRA_CASES,
    caseState: pyraCaseState,
    applyAll: pyra.applyAll,
    invert: invertPyraMove,
    auf: [[], ['U'], ["U'"]],
    intro: () =>
      tr(
        'Depois das pontas, dos centros e da base amarela, sobram só as <b>3 arestas de cima</b>. São 5 casos, todos com algoritmos curtos. Segure com a <b>base amarela embaixo</b> e a face verde de frente.',
        'After the tips, the centers and the yellow bottom, only the <b>3 top edges</b> are left. There are 5 cases, all with short algorithms. Hold it with the <b>yellow bottom down</b> and the green face in front.',
      ),
    extraNotation: () => '',
  },
];

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

// ---------------------------------------------------------------- desenho do caso (cubos: vista de cima)
let arrowId = 0;
function layerSvg(kit: NxNKit, state: string[], y: number, ollStyle: boolean, arrows: boolean, size: number): string {
  const n = kit.n;
  const unit = n === 2 ? 28 : 20, side = 7, gap = 2;
  const pos = (i: number) => (i === 0 ? 0 : side + gap + (i - 1) * (unit + gap));
  const len = (i: number) => (i === 0 || i === n + 1 ? side : unit);
  const total = pos(n + 1) + side;
  const color = (k: string) => (ollStyle ? (k === 'U' ? HEX.U : OLL_OFF) : HEX[k]);
  // a base é desenhada como vista de baixo (espelhada da esquerda para a direita)
  const col = (c: number) => (y > 0 ? c : n + 1 - c);
  const rects = kit
    .layerCells(y)
    .map((c) => `<rect x="${pos(col(c.col))}" y="${pos(c.row)}" width="${len(col(c.col))}" height="${len(c.row)}" rx="${c.side ? 2 : 3.5}" fill="${color(state[c.index])}"/>`)
    .join('');
  const id = `ah${++arrowId}`;
  let lines = '';
  if (arrows) {
    const h = n - 1;
    const center = (k: string) => {
      const [x, , z] = k.split(',').map(Number);
      return [pos(col((x + h) / 2 + 1)) + unit / 2, pos((z + h) / 2 + 1) + unit / 2];
    };
    const moves = kit.pieceMoves(state, y);
    const done = new Set<string>();
    for (const [a, b] of moves) {
      if (done.has(`${a}>${b}`)) continue;
      // troca de duas peças: uma seta de duas pontas
      const swap = moves.some(([c, d]) => c === b && d === a);
      if (swap) done.add(`${b}>${a}`);
      const [x1, y1] = center(a), [x2, y2] = center(b);
      const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, cut = 6;
      lines += `<line x1="${x1 + ux * cut}" y1="${y1 + uy * cut}" x2="${x2 - ux * cut}" y2="${y2 - uy * cut}" marker-end="url(#${id})" ${swap ? `marker-start="url(#${id})"` : ''}/>`;
    }
  }
  return `<svg class="al-svg" viewBox="-2 -2 ${total + 4} ${total + 4}" width="${size}" height="${size}" aria-hidden="true">
    <defs><marker id="${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#0b0e17"/></marker></defs>
    <rect x="${pos(1) - gap}" y="${pos(1) - gap}" width="${n * unit + (n + 1) * gap}" height="${n * unit + (n + 1) * gap}" rx="6" fill="#0b0e17"/>
    ${rects}
    <g stroke="#0b0e17" stroke-width="2.4" stroke-linecap="round">${lines}</g>
  </svg>`;
}

function caseSvg(pz: AlgPuzzle, impl: PuzzleImpl, state: string[], style: AlgStyle, size = 104): string {
  if (style === 'net' || !pz.kit) return `<span class="al-net">${netSvg(impl, state, 'al-svg al-net-svg')}</span>`;
  const h = pz.kit.n - 1;
  if (style === 'pbl') return `<span class="al-pbl">${layerSvg(pz.kit, state, h, false, true, size * 0.72)}${layerSvg(pz.kit, state, -h, false, true, size * 0.72)}</span>`;
  return layerSvg(pz.kit, state, h, style === 'oll', style === 'pll', size);
}

/** algoritmo como chips */
const algHtml = (alg: string, cur = -1) =>
  splitAlg(alg)
    .map((m, i) => `<span class="al-mv${i < cur ? ' done' : ''}${i === cur ? ' next' : ''}" data-i="${i}">${m}</span>`)
    .join('');

const caseName = (c: AlgCase) => (typeof c.name === 'string' ? c.name : tr(...c.name));

// ---------------------------------------------------------------- página
export async function renderAlgs(app: HTMLElement, puzzleId = 'cube3') {
  const pz = PUZZLES.find((p) => p.id === puzzleId) ?? PUZZLES[0];
  const impl: PuzzleImpl = await loadPuzzle(pz.id);
  const learned = loadLearned();
  const setOf = (id: string) => pz.sets.find((s) => s.id === id)!;
  let tab: string = pz.sets[0].id;
  let alive = true;
  const setupFor = (alg: string, auf: string[] = []) => [...invertAlg(splitAlg(alg), pz.invert), ...auf].join(' ');

  app.innerHTML = `
  <section class="page algs-page">
    <div class="al-head">
      <span class="eyebrow">${tr('Algoritmos', 'Algorithms')}</span>
      <h1>${pz.id === 'cube3' ? tr('Algoritmos OLL e PLL', 'OLL and PLL algorithms') : tr(`Algoritmos do ${pz.label}`, `${pz.label} algorithms`)}</h1>
      <nav class="al-puzzles" aria-label="Puzzle">
        ${PUZZLES.map((p) => `<a href="${algsPath(undefined, p.id)}" class="${p.id === pz.id ? 'on' : ''}" ${p.id === pz.id ? 'aria-current="page"' : ''}>${p.label}</a>`).join('')}
      </nav>
      <p class="lead">${pz.intro()}</p>
      <div class="al-bar">
        <div class="al-tabs" role="tablist">
          ${pz.sets.map((s) => `<button role="tab" data-tab="${s.id}">${s.name()}<small>${pz.cases.filter((c) => c.set === s.id).length}</small></button>`).join('')}
          <button role="tab" data-tab="train">${icon('shuffle')}${tr('Treino', 'Practice')}</button>
        </div>
        <span class="al-count"></span>
      </div>
      <details class="notation al-notation">
        <summary>${tr('Como ler os algoritmos?', 'How to read the algorithms?')}</summary>
        ${notationHtml(impl, pz.id)}
        ${pz.extraNotation() ? `<ul class="notation-list">${pz.extraNotation()}</ul>` : ''}
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
    const parts = pz.sets.map((s) => {
      const all = pz.cases.filter((c) => c.set === s.id);
      return `${s.name()} ${all.filter((c) => learned.has(c.id)).length}/${all.length}`;
    });
    count.innerHTML = `${icon('checkCircle')}${tr('Aprendidos', 'Learned')}: ${parts.join(' · ')}`;
  }

  const learnBtn = (c: AlgCase) =>
    `<button class="al-learn ${learned.has(c.id) ? 'on' : ''}" data-learn="${c.id}" aria-pressed="${learned.has(c.id)}">${icon('check')}${tr('Aprendido', 'Learned')}</button>`;

  function renderList(set: string) {
    const style = setOf(set).style;
    body.innerHTML = pz.groups
      .filter((g) => g.set === set)
      .map(
        (g) => `
        <section class="al-group">
          <h2>${g.name()}</h2>
          <p class="al-about">${g.about()}</p>
          <div class="al-grid">
            ${pz.cases
              .filter((c) => c.group === g.id)
              .map(
                (c) => `
              <article class="al-card ${learned.has(c.id) ? 'learned' : ''}" data-case="${c.id}">
                <button class="al-pic" data-open="${c.id}" aria-label="${tr(`Ver o caso ${caseName(c)} em 3D`, `See the ${caseName(c)} case in 3D`)}">${caseSvg(pz, impl, pz.caseState(c.alg), style)}<span class="al-play">${icon('play')}</span></button>
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
  const train = { set: 'all', onlyNew: false, cur: null as AlgCase | null, auf: [] as string[], revealed: false, seen: 0 };
  function pickCase() {
    let pool = pz.cases.filter((c) => train.set === 'all' || c.set === train.set);
    if (train.onlyNew) {
      const left = pool.filter((c) => !learned.has(c.id));
      if (left.length) pool = left;
    }
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) while (next === train.cur) next = pool[Math.floor(Math.random() * pool.length)];
    train.cur = next;
    // PBL do 2x2: as duas camadas contam, então o caso fica como no desenho (sem giro do topo)
    train.auf = setOf(next.set).style === 'pbl' ? [] : pz.auf[Math.floor(Math.random() * pz.auf.length)];
    train.revealed = false;
    train.seen++;
  }
  function renderTrain() {
    if (!train.cur) pickCase();
    const c = train.cur!;
    const set = setOf(c.set);
    const state = pz.applyAll(pz.caseState(c.alg), train.auf);
    const opt = (v: string, label: string) => `<button data-tset="${v}" class="${train.set === v ? 'on' : ''}">${label}</button>`;
    const fix = invertAlg(train.auf, pz.invert)[0];
    body.innerHTML = `
      <div class="al-train card">
        <div class="al-train-opts">
          ${pz.sets.length > 1 ? `<span class="tc-range" role="group" aria-label="${tr('Quais casos', 'Which cases')}">${opt('all', tr('Todos', 'All'))}${pz.sets.map((s) => opt(s.id, s.name())).join('')}</span>` : ''}
          <label class="al-check"><input type="checkbox" data-tnew ${train.onlyNew ? 'checked' : ''}> ${tr('Só os que ainda não aprendi', 'Only the ones I haven’t learned')}</label>
        </div>
        <div class="al-train-main">
          <div class="al-train-pic">${caseSvg(pz, impl, state, set.style, 220)}</div>
          <div class="al-train-side">
            <p class="al-train-q">${tr(`Caso ${train.seen} · qual é este caso (${set.name()})?`, `Case ${train.seen} · which case is this (${set.name()})?`)}</p>
            ${
              train.revealed
                ? `<h3>${caseName(c)}</h3>
                   ${fix ? `<p class="al-auf">${tr(`Antes, ajuste o topo: <b>${fix}</b> (ou olhe de outro lado)`, `First adjust the top: <b>${fix}</b> (or look from another side)`)}</p>` : ''}
                   <div class="al-alg big">${algHtml(c.alg)}</div>
                   <div class="row-actions">${learnBtn(c)}<button class="btn ghost sm" data-open="${c.id}">${icon('play')}${tr('Ver em 3D', 'See in 3D')}</button></div>`
                : `<button class="btn primary" data-treveal>${tr('Mostrar a resposta', 'Show the answer')}</button>`
            }
            <p class="al-setup">${tr('Para treinar no seu puzzle, monte o caso a partir dele resolvido:', 'To practice on your puzzle, set up the case starting from solved:')}<code>${setupFor(c.alg, train.auf)}</code></p>
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
  const describe = (m: string) => (pz.kit ? describeNxNMove(m, true) : impl.describeMove?.(m) ?? '');

  function vRender() {
    vAlg.innerHTML = algHtml(vCase!.alg, vPos);
    vPlay.innerHTML = vPlaying ? icon('pause') : icon('play');
    vPlay.setAttribute('aria-label', vPlaying ? tr('Pausar', 'Pause') : tr('Animar', 'Play'));
    vPlay.title = vPlay.getAttribute('aria-label')!;
    vMove.textContent = vPos < vMoves.length ? `${tr('Próximo', 'Next')}: ${vMoves[vPos]} · ${describe(vMoves[vPos])}` : tr('Pronto! O caso foi resolvido.', 'Done! The case is solved.');
  }
  async function vStep(dir: 1 | -1) {
    if (vBusy) return;
    if (dir === 1 && vPos >= vMoves.length) return;
    if (dir === -1 && vPos === 0) return;
    vBusy = true;
    const m = dir === 1 ? vMoves[vPos] : pz.invert(vMoves[vPos - 1]);
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
    const c = pz.cases.find((x) => x.id === id);
    if (!c) return;
    vCase = c;
    vMoves = splitAlg(c.alg);
    vPos = 0;
    vStart = pz.caseState(c.alg);
    viewer.hidden = false;
    document.body.classList.add('al-modal');
    if (!view) view = impl.createView(vHost);
    view.setState(vStart);
    view.resetCamera();
    viewer.querySelector('#al-v-title')!.textContent = `${setOf(c.set).name()} · ${caseName(c)}`;
    viewer.querySelector('.al-v-setup')!.innerHTML = `${tr('Montar no seu puzzle (a partir do resolvido):', 'Set it up on your puzzle (from solved):')}<code>${setupFor(c.alg)}</code>`;
    vRender();
    vPlay.focus();
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

  // ---- cliques da página (na seção, não no #app: o #app continua o mesmo quando se troca de página)
  const root = app.querySelector<HTMLElement>('.algs-page')!;
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tabBtn = t.closest<HTMLElement>('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab!;
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
      train.set = tset.dataset.tset!;
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
  root.addEventListener('change', (e) => {
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
