/**
 * Cronômetro no estilo das competições (WCA / Stackmat):
 *
 *  - celular: encoste DOIS dedos na área do tempo (fica vermelho, depois verde); soltar os
 *    dois começa; bater os dois dedos de novo para. (Opção de 1 dedo.)
 *  - computador: segure o espaço até ficar verde, solte para começar; qualquer tecla para.
 *  - inspeção opcional de 15 s: toque para começar a inspeção; até 15 s nada, até 17 s +2,
 *    depois DNF.
 *
 * Tempos e configurações ficam no aparelho (localStorage), separados por puzzle.
 */
import { PUZZLES, loadPuzzle } from '../core/registry';
import { averageOf, best, bestAverage, fmt, fmtSolve, inspectionPenalty, mean, type Penalty, type Solve } from '../core/timerstats';
import type { PuzzleImpl } from '../core/types';
import { icon } from './icons';
import { netSvg } from './net';
import { keepScreenOn } from './wakelock';

/** quanto tempo segurar até ficar verde (como o Stackmat) */
const HOLD_MS = 400;
const INSPECTION_MS = 15000;
const MAX_SAVED = 2000;

interface Cfg {
  puzzle: string;
  inspection: boolean;
  /** quantos dedos para começar/parar no celular */
  fingers: 1 | 2;
  preview: boolean;
}

const touchDevice = matchMedia('(pointer: coarse)').matches;

function loadCfg(): Cfg {
  const def: Cfg = { puzzle: 'cube3', inspection: false, fingers: 2, preview: true };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem('cubo:timer:cfg') ?? '{}') };
  } catch {
    return def;
  }
}
function saveCfg(c: Cfg) {
  try {
    localStorage.setItem('cubo:timer:cfg', JSON.stringify(c));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}
function loadSolves(puzzle: string): Solve[] {
  try {
    const v = JSON.parse(localStorage.getItem(`cubo:timer:${puzzle}`) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveSolves(puzzle: string, solves: Solve[]) {
  try {
    localStorage.setItem(`cubo:timer:${puzzle}`, JSON.stringify(solves.slice(-MAX_SAVED)));
  } catch {
    /* sem armazenamento: os tempos valem só nesta visita */
  }
}

const short = (name: string) => name.replace('Cubo ', '');

export async function renderTimer(app: HTMLElement) {
  const available = PUZZLES.filter((p) => p.available);
  const cfg = loadCfg();
  if (!available.some((p) => p.id === cfg.puzzle)) cfg.puzzle = 'cube3';

  app.innerHTML = `
  <section class="page timer-page">
    <div class="tm-top">
      <a class="back tm-back" href="#/">← Início</a>
      <div class="tm-puzzles" role="tablist" aria-label="Puzzle">
        ${available.map((p) => `<button role="tab" class="tm-pz" data-pz="${p.id}">${p.icon}<span>${short(p.name)}</span></button>`).join('')}
      </div>
      <div class="tm-opts">
        <button class="tm-opt" data-opt="inspection" aria-pressed="false" title="15 s para olhar o cubo antes de começar, como nas competições"><span class="sw" aria-hidden="true"></span>Inspeção 15 s</button>
        ${touchDevice ? '<button class="tm-opt" data-opt="fingers" aria-pressed="false" title="Quantos dedos para começar e parar"><span class="sw" aria-hidden="true"></span>Dois dedos</button>' : ''}
        <button class="tm-opt" data-opt="preview" aria-pressed="false" title="Mostrar como o puzzle fica depois de embaralhar"><span class="sw" aria-hidden="true"></span>Desenho</button>
      </div>
    </div>
    <div class="tm-scramble card">
      <div class="tm-scr-head"><span class="tm-label">Embaralho</span><button class="btn ghost sm" data-act="new">${icon('shuffle')}Outro</button></div>
      <p class="tm-scr-text" aria-live="polite"></p>
      <div class="tm-preview"></div>
    </div>
    <div class="tm-pad" tabindex="0" aria-label="Cronômetro">
      <div class="tm-time">0.00</div>
      <div class="tm-hint"></div>
      <div class="tm-last" hidden>
        <button class="btn ghost sm" data-last="2">+2</button>
        <button class="btn ghost sm" data-last="dnf">DNF</button>
        <button class="btn ghost sm" data-last="del">Apagar</button>
      </div>
    </div>
    <div class="tm-stats card"></div>
    <div class="tm-list card">
      <div class="tm-list-head"><span class="tm-label">Tempos</span><button class="btn ghost sm" data-act="clear">Limpar sessão</button></div>
      <ol class="tm-times"></ol>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
  const pad = $<HTMLElement>('.tm-pad');
  const timeEl = $<HTMLElement>('.tm-time');
  const hintEl = $<HTMLElement>('.tm-hint');
  const lastEl = $<HTMLElement>('.tm-last');
  const scrText = $<HTMLElement>('.tm-scr-text');
  const preview = $<HTMLElement>('.tm-preview');

  let impl: PuzzleImpl | null = null;
  let solves = loadSolves(cfg.puzzle);
  let scramble: string[] = [];

  // ---- estado do cronômetro
  type Phase = 'idle' | 'inspect' | 'running';
  let phase: Phase = 'idle';
  let arming: 'none' | 'hold' | 'ready' = 'none';
  let holdTimer = 0;
  /** depois de parar, só volta a armar quando tudo for solto */
  let needRelease = false;
  let t0 = 0;
  let inspectStart = 0;
  let inspectPen: Penalty = 0;
  let raf = 0;
  let alive = true;

  // ---- entradas: dedos na área do tempo, mouse e espaço
  const touches = new Set<number>();
  let mouseDown = false;
  let spaceDown = false;
  const required = () => (touchDevice ? cfg.fingers : 1);
  const pressed = () => spaceDown || mouseDown || touches.size >= required();
  const anyDown = () => spaceDown || mouseDown || touches.size > 0;

  function hint() {
    const how = touchDevice
      ? cfg.fingers === 2
        ? 'Encoste <b>dois dedos</b> aqui e solte para começar · bata os dois para parar'
        : 'Encoste o dedo aqui e solte para começar · toque para parar'
      : 'Segure <b>espaço</b> até ficar verde e solte para começar · qualquer tecla para';
    if (phase === 'inspect') return touchDevice ? 'Inspeção — quando estiver pronto, segure e solte para começar' : 'Inspeção — segure espaço e solte para começar';
    if (phase === 'idle' && cfg.inspection) return touchDevice ? 'Toque para começar a <b>inspeção</b> (15 s)' : 'Aperte <b>espaço</b> para começar a inspeção (15 s)';
    return how;
  }

  function paint() {
    pad.classList.toggle('hold', arming === 'hold');
    pad.classList.toggle('ready', arming === 'ready');
    pad.classList.toggle('running', phase === 'running');
    pad.classList.toggle('inspecting', phase === 'inspect');
    document.body.classList.toggle('timing', phase === 'running' || phase === 'inspect');
    hintEl.innerHTML = phase === 'running' ? '' : hint();
    lastEl.hidden = phase !== 'idle' || !solves.length || arming !== 'none';
  }

  function tick() {
    if (!alive) return;
    const now = performance.now();
    if (phase === 'running') timeEl.textContent = fmt(now - t0);
    else if (phase === 'inspect') {
      const left = INSPECTION_MS - (now - inspectStart);
      const pen = inspectionPenalty(now - inspectStart);
      timeEl.textContent = pen === 'dnf' ? 'DNF' : pen === 2 ? '+2' : String(Math.ceil(left / 1000));
      pad.classList.toggle('late', left < 3000);
    }
    if (phase !== 'idle') raf = requestAnimationFrame(tick);
  }

  function startInspection() {
    phase = 'inspect';
    inspectStart = performance.now();
    raf = requestAnimationFrame(tick);
    paint();
  }

  function startSolve() {
    inspectPen = phase === 'inspect' ? inspectionPenalty(performance.now() - inspectStart) : 0;
    phase = 'running';
    arming = 'none';
    pad.classList.remove('late');
    t0 = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    paint();
  }

  function stopSolve() {
    const ms = Math.round(performance.now() - t0);
    phase = 'idle';
    needRelease = anyDown(); // os dedos/o espaço que pararam ainda estão apertados
    cancelAnimationFrame(raf);
    solves.push({ ms, pen: inspectPen, scramble: scramble.join(' '), at: Date.now() });
    saveSolves(cfg.puzzle, solves);
    timeEl.textContent = fmtSolve(solves[solves.length - 1]);
    navigator.vibrate?.(40);
    newScramble();
    renderStats();
    paint();
  }

  function cancel() {
    phase = 'idle';
    arming = 'none';
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    pad.classList.remove('late');
    timeEl.textContent = solves.length ? fmtSolve(solves[solves.length - 1]) : '0.00';
    paint();
  }

  function onPress() {
    if (phase === 'running') {
      if (pressed()) stopSolve();
      return;
    }
    if (needRelease || arming !== 'none' || !pressed()) return;
    if (phase === 'idle' && cfg.inspection) return; // a inspeção começa ao soltar
    arming = 'hold';
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      if (arming === 'hold' && pressed()) {
        arming = 'ready';
        paint();
      }
    }, HOLD_MS);
    paint();
  }

  function onRelease() {
    if (phase === 'running') return;
    if (needRelease) {
      if (!anyDown()) needRelease = false;
      return;
    }
    if (arming === 'ready') {
      if (!anyDown()) startSolve(); // soltou tudo: começa
      return;
    }
    if (arming === 'hold' && !pressed()) {
      arming = 'none'; // soltou antes de ficar verde
      clearTimeout(holdTimer);
      paint();
      return;
    }
    if (phase === 'idle' && cfg.inspection && !anyDown()) startInspection();
  }

  // dedos e mouse só valem na área do tempo
  pad.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      mouseDown = true;
    } else touches.add(e.pointerId);
    onPress();
  });
  const up = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (!mouseDown) return;
      mouseDown = false;
    } else if (!touches.delete(e.pointerId)) return;
    onRelease();
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  // segurar o dedo não abre menu nem seleciona texto
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  const onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (phase === 'running') {
      if (e.repeat) return;
      e.preventDefault();
      spaceDown = e.code === 'Space';
      stopSolve();
      return;
    }
    if (e.key === 'Escape' && phase === 'inspect') return cancel();
    if (e.code !== 'Space') return;
    e.preventDefault(); // espaço num botão focado não "clica" nele
    if (e.repeat) return;
    spaceDown = true;
    onPress();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    spaceDown = false;
    onRelease();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ---- embaralho
  function newScramble() {
    if (!impl) return;
    scramble = impl.scramble();
    scrText.textContent = scramble.join(' ');
    scrText.classList.toggle('long', scramble.length > 30);
    renderPreview();
  }
  function renderPreview() {
    preview.hidden = !cfg.preview || !impl;
    if (preview.hidden || !impl) return;
    const state = scramble.reduce((s, m) => impl!.applyMove(s, m), impl.solvedState());
    preview.innerHTML = netSvg(impl, state);
  }

  // ---- estatísticas e lista
  function renderStats() {
    const stat = (label: string, v: string, title = '') => `<div class="tm-stat" title="${title}"><span>${label}</span><b>${v}</b></div>`;
    $<HTMLElement>('.tm-stats').innerHTML = [
      stat('Melhor', fmt(best(solves))),
      stat('Média de 5', fmt(averageOf(solves, 5)), 'Últimos 5, sem o melhor e o pior (como nas competições)'),
      stat('Média de 12', fmt(averageOf(solves, 12)), 'Últimos 12, sem o melhor e o pior'),
      stat('Melhor média de 5', fmt(bestAverage(solves, 5))),
      stat('Média geral', fmt(mean(solves))),
      stat('Resoluções', String(solves.length)),
    ].join('');
    const list = $<HTMLElement>('.tm-times');
    list.innerHTML = solves.length
      ? solves
          .map((s, i) => ({ s, i }))
          .reverse()
          .slice(0, 200)
          .map(
            ({ s, i }) => `<li data-i="${i}">
              <span class="tm-n">${i + 1}</span>
              <b class="tm-t ${s.pen === 'dnf' ? 'dnf' : ''}" title="${s.scramble}">${fmtSolve(s)}</b>
              <span class="tm-acts">
                <button class="${s.pen === 2 ? 'on' : ''}" data-pen="2" aria-pressed="${s.pen === 2}">+2</button>
                <button class="${s.pen === 'dnf' ? 'on' : ''}" data-pen="dnf" aria-pressed="${s.pen === 'dnf'}">DNF</button>
                <button data-del aria-label="Apagar este tempo">${icon('trash')}</button>
              </span>
            </li>`,
          )
          .join('')
      : '<li class="tm-empty">Nenhum tempo ainda — faça a primeira resolução!</li>';
  }

  function setPenalty(i: number, pen: Penalty) {
    const s = solves[i];
    if (!s) return;
    s.pen = s.pen === pen ? 0 : pen;
    saveSolves(cfg.puzzle, solves);
    if (i === solves.length - 1 && phase === 'idle') timeEl.textContent = fmtSolve(s);
    renderStats();
  }
  function remove(i: number) {
    solves.splice(i, 1);
    saveSolves(cfg.puzzle, solves);
    if (i === solves.length && phase === 'idle') timeEl.textContent = solves.length ? fmtSolve(solves[solves.length - 1]) : '0.00';
    renderStats();
    paint();
  }

  app.querySelector('.tm-times')!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const i = Number(t.closest<HTMLElement>('[data-i]')?.dataset.i);
    if (Number.isNaN(i)) return;
    const b = t.closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.pen) setPenalty(i, b.dataset.pen === 'dnf' ? 'dnf' : 2);
    else if (b.hasAttribute('data-del')) remove(i);
  });
  lastEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-last]');
    if (!b || !solves.length) return;
    const i = solves.length - 1;
    if (b.dataset.last === 'del') remove(i);
    else setPenalty(i, b.dataset.last === 'dnf' ? 'dnf' : 2);
  });
  $<HTMLElement>('[data-act="new"]').addEventListener('click', newScramble);
  $<HTMLElement>('[data-act="clear"]').addEventListener('click', () => {
    if (!solves.length || !confirm(`Apagar os ${solves.length} tempos deste puzzle?`)) return;
    solves = [];
    saveSolves(cfg.puzzle, solves);
    timeEl.textContent = '0.00';
    renderStats();
    paint();
  });

  // ---- opções e troca de puzzle
  function renderOpts() {
    app.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) => {
      const on = b.dataset.opt === 'inspection' ? cfg.inspection : b.dataset.opt === 'fingers' ? cfg.fingers === 2 : cfg.preview;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    app.querySelectorAll<HTMLButtonElement>('[data-pz]').forEach((b) => {
      const on = b.dataset.pz === cfg.puzzle;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
  }
  app.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) =>
    b.addEventListener('click', () => {
      if (phase !== 'idle') return;
      if (b.dataset.opt === 'inspection') cfg.inspection = !cfg.inspection;
      else if (b.dataset.opt === 'fingers') cfg.fingers = cfg.fingers === 2 ? 1 : 2;
      else cfg.preview = !cfg.preview;
      saveCfg(cfg);
      renderOpts();
      renderPreview();
      paint();
    }),
  );

  async function choose(id: string) {
    cfg.puzzle = id;
    saveCfg(cfg);
    solves = loadSolves(id);
    timeEl.textContent = solves.length ? fmtSolve(solves[solves.length - 1]) : '0.00';
    renderOpts();
    renderStats();
    paint();
    scrText.textContent = 'Carregando…';
    const im = await loadPuzzle(id);
    if (!alive || cfg.puzzle !== id) return;
    impl = im;
    newScramble();
  }
  app.querySelectorAll<HTMLButtonElement>('[data-pz]').forEach((b) =>
    b.addEventListener('click', () => {
      if (phase === 'idle' && b.dataset.pz !== cfg.puzzle) choose(b.dataset.pz!);
    }),
  );

  const releaseScreen = keepScreenOn();
  await choose(cfg.puzzle);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    clearTimeout(holdTimer);
    document.body.classList.remove('timing');
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    releaseScreen();
  };
}
