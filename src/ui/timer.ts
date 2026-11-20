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
import { homePath, timerPath } from '../core/router';
import { MAX_NAME, challengeQuery, cleanName, readChallenge, type Challenge } from '../core/challenge';
import { averageOf, best, bestAverage, fmt, fmtSolve, inspectionPenalty, mean, newRecords, value, type Penalty, type RecordKind, type Solve } from '../core/timerstats';
import { ImportError, exportJson, mergeSolves, parseImport } from '../core/timerio';
import { tr } from '../core/i18n';
import type { PuzzleImpl } from '../core/types';
import { icon } from './icons';
import { netSvg } from './net';
import { notationHtml } from './notation';
import { toast } from './toast';
import { keepScreenOn } from './wakelock';
import { createTimeChart } from './timechart';

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


/** como segurar o puzzle resolvido antes de embaralhar (a posição do desenho) */
const scrambleHold = (puzzle: string) =>
  puzzle === 'pyraminx'
    ? tr('com a face <b>verde</b> de frente para você e a <b>amarela</b> embaixo', 'with the <b>green</b> face toward you and the <b>yellow</b> one on the bottom')
    : puzzle === 'megaminx'
      ? tr('com o <b>cinza</b> em cima e o <b>verde-claro</b> de frente para você', 'with <b>gray</b> on top and <b>light green</b> facing you')
      : tr('com o <b>amarelo</b> em cima e o <b>verde</b> de frente para você', 'with <b>yellow</b> on top and <b>green</b> facing you');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function loadName(): string {
  try {
    return cleanName(localStorage.getItem('cubo:timer:name') ?? '');
  } catch {
    return '';
  }
}
function saveName(n: string) {
  try {
    localStorage.setItem('cubo:timer:name', n);
  } catch {
    /* sem armazenamento */
  }
}

export async function renderTimer(app: HTMLElement, params = new URLSearchParams()) {
  const available = PUZZLES.filter((p) => p.available);
  const cfg = loadCfg();
  if (!available.some((p) => p.id === cfg.puzzle)) cfg.puzzle = 'cube3';
  // desafio recebido pelo link: abre no puzzle dele, com o embaralho dele
  const received = readChallenge(params, available.map((p) => p.id));
  if (received) cfg.puzzle = received.puzzle;

  app.innerHTML = `
  <section class="page timer-page">
    <div class="tm-top">
      <a class="back tm-back" href="${homePath()}">← ${tr('Início', 'Home')}</a>
      <div class="tm-puzzles" role="tablist" aria-label="Puzzle">
        ${available.map((p) => `<button role="tab" class="tm-pz" data-pz="${p.id}">${p.icon}<span>${p.short}</span></button>`).join('')}
      </div>
      <div class="tm-opts">
        <button class="tm-opt" data-opt="inspection" aria-pressed="false" title="${tr('15 s para olhar o cubo antes de começar, como nas competições', '15 s to look at the puzzle before starting, like in competitions')}"><span class="sw" aria-hidden="true"></span>${tr('Inspeção 15 s', '15 s inspection')}</button>
        ${touchDevice ? `<button class="tm-opt" data-opt="fingers" aria-pressed="false" title="${tr('Quantos dedos para começar e parar', 'How many fingers to start and stop')}"><span class="sw" aria-hidden="true"></span>${tr('Dois dedos', 'Two fingers')}</button>` : ''}
        <button class="tm-opt" data-opt="preview" aria-pressed="false" title="${tr('Mostrar como o puzzle fica depois de embaralhar', 'Show how the puzzle looks after scrambling')}"><span class="sw" aria-hidden="true"></span>${tr('Desenho', 'Preview')}</button>
      </div>
    </div>
    <div class="tm-challenge card" hidden></div>
    <div class="tm-scramble card">
      <div class="tm-scr-head">
        <span class="tm-label">${tr('Embaralho', 'Scramble')}<button class="tm-info-btn" aria-expanded="false" aria-controls="tm-info" title="${tr('O que é o embaralho e como fazer', 'What a scramble is and how to do it')}">${icon('info')}<span class="sr-only">${tr('O que é o embaralho e como fazer', 'What a scramble is and how to do it')}</span></button></span>
        <button class="btn ghost sm" data-act="new">${icon('shuffle')}${tr('Outro', 'New')}</button>
      </div>
      <p class="tm-scr-text" aria-live="polite"></p>
      <div class="tm-preview"></div>
      <div class="tm-info" id="tm-info"><div class="tm-info-in"></div></div>
    </div>
    <div class="tm-pad" tabindex="0" aria-label="${tr('Cronômetro', 'Timer')}">
      <div class="tm-time">0.00</div>
      <div class="tm-hint"></div>
      <div class="tm-pb" hidden role="status"></div>
      <div class="tm-last" hidden>
        <button class="btn ghost sm" data-last="2">+2</button>
        <button class="btn ghost sm" data-last="dnf">DNF</button>
        <button class="btn ghost sm" data-last="del">${tr('Apagar', 'Delete')}</button>
        <button class="btn primary sm" data-last="share">${icon('share')}${tr('Desafiar', 'Challenge')}</button>
      </div>
    </div>
    <div class="tm-stats card"></div>
    <div class="tm-chart card" hidden></div>
    <div class="tm-list card">
      <div class="tm-list-head"><span class="tm-label">${tr('Tempos', 'Times')}</span>
        <span class="tm-list-acts">
          <button class="btn ghost sm" data-act="export" title="${tr('Baixar um arquivo com os tempos de todos os puzzles', 'Download a file with the times of every puzzle')}">${icon('download')}${tr('Exportar', 'Export')}</button>
          <button class="btn ghost sm" data-act="import" title="${tr('Abrir um arquivo exportado do CuboGuia ou do csTimer', 'Open a file exported from CuboGuia or csTimer')}">${icon('upload')}${tr('Importar', 'Import')}</button>
          <button class="btn ghost sm" data-act="clear" title="${tr('Apagar todos os tempos deste puzzle', 'Delete every time for this puzzle')}">${tr('Limpar<span class="long"> sessão</span>', 'Clear<span class="long"> session</span>')}</button>
        </span>
        <input type="file" class="tm-file" accept=".json,.txt,application/json,text/plain" hidden>
      </div>
      <ol class="tm-times"></ol>
    </div>
    <div class="tm-share" hidden>
      <div class="tm-share-box card" role="dialog" aria-modal="true" aria-labelledby="tm-share-title">
        <h3 id="tm-share-title">${icon('share')}${tr('Desafiar um amigo', 'Challenge a friend')}</h3>
        <p class="tm-share-sub">${tr('Quem abrir o link recebe <b>o mesmo embaralho</b> e vê o seu tempo para tentar bater.', 'Whoever opens the link gets <b>the same scramble</b> and sees your time to try to beat it.')}</p>
        <label class="tm-name">${tr('Seu nome (opcional)', 'Your name (optional)')}<input type="text" maxlength="${MAX_NAME}" autocomplete="nickname" placeholder="${tr('Ex.: Gabriel', 'E.g. Alex')}"></label>
        <p class="tm-share-msg"></p>
        <input class="tm-share-link" type="text" readonly aria-label="${tr('Link do desafio', 'Challenge link')}">
        <div class="row-actions">
          ${'share' in navigator ? `<button class="btn primary" data-share="native">${icon('share')}${tr('Compartilhar', 'Share')}</button>` : ''}
          <button class="btn ${'share' in navigator ? 'ghost' : 'primary'}" data-share="copy">${tr('Copiar link', 'Copy link')}</button>
          <button class="btn ghost" data-share="close">${tr('Fechar', 'Close')}</button>
        </div>
      </div>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
  const pad = $<HTMLElement>('.tm-pad');
  const timeEl = $<HTMLElement>('.tm-time');
  const hintEl = $<HTMLElement>('.tm-hint');
  const lastEl = $<HTMLElement>('.tm-last');
  const scrText = $<HTMLElement>('.tm-scr-text');
  const preview = $<HTMLElement>('.tm-preview');
  const info = $<HTMLElement>('.tm-info');
  const infoBtn = $<HTMLButtonElement>('.tm-info-btn');
  const pbEl = $<HTMLElement>('.tm-pb');
  const chart = createTimeChart($<HTMLElement>('.tm-chart'));

  let impl: PuzzleImpl | null = null;
  let solves = loadSolves(cfg.puzzle);
  let scramble: string[] = [];
  /** desafio aberto: o embaralho e o tempo de quem desafiou (since = desde quando vale) */
  let challenge: (Challenge & { since: number }) | null = received ? { ...received, since: Date.now() } : null;
  const banner = $<HTMLElement>('.tm-challenge');
  const shareEl = $<HTMLElement>('.tm-share');
  let shareSolve: Solve | null = null;

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
        ? tr('Encoste <b>dois dedos</b> aqui e solte para começar · bata os dois para parar', 'Put <b>two fingers</b> here and lift them to start · tap both to stop')
        : tr('Encoste o dedo aqui e solte para começar · toque para parar', 'Put your finger here and lift it to start · tap to stop')
      : tr('Segure <b>espaço</b> até ficar verde e solte para começar · qualquer tecla para', 'Hold <b>space</b> until it turns green, then release to start · any key stops');
    if (phase === 'inspect')
      return touchDevice
        ? tr('Inspeção — quando estiver pronto, segure e solte para começar', 'Inspection — when you’re ready, hold and release to start')
        : tr('Inspeção — segure espaço e solte para começar', 'Inspection — hold space and release to start');
    if (phase === 'idle' && cfg.inspection)
      return touchDevice
        ? tr('Toque para começar a <b>inspeção</b> (15 s)', 'Tap to start the <b>inspection</b> (15 s)')
        : tr('Aperte <b>espaço</b> para começar a inspeção (15 s)', 'Press <b>space</b> to start the inspection (15 s)');
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
    if (phase !== 'idle' || arming !== 'none') hidePb();
  }

  // ---- recorde: comemora quando a última resolução bate o melhor tempo ou a melhor média
  function showPb(kinds: RecordKind[]) {
    const label: Record<RecordKind, string> = {
      single: tr('melhor tempo', 'best single'),
      ao5: tr('melhor média de 5', 'best ao5'),
      ao12: tr('melhor média de 12', 'best ao12'),
    };
    // "melhor tempo e melhor média de 5" / "best single and best ao5"
    const what = new Intl.ListFormat(tr('pt-BR', 'en'), { type: 'conjunction' }).format(kinds.map((k) => label[k]));

    pbEl.innerHTML = `<div class="confetti" aria-hidden="true">${'<i></i>'.repeat(16)}</div>${icon('trophy')}<span><b>${tr('Novo recorde!', 'New record!')}</b> ${what[0].toUpperCase() + what.slice(1)}</span>`;
    pbEl.hidden = false;
    pad.classList.add('pb');
    navigator.vibrate?.([40, 60, 40, 60, 120]);
  }
  function hidePb() {
    if (pbEl.hidden) return;
    pbEl.hidden = true;
    pbEl.innerHTML = '';
    pad.classList.remove('pb');
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
    renderChallenge();
    paint();
    const rec = newRecords(solves);
    if (rec.length) showPb(rec);
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
    // com a janela de compartilhar aberta, o cronômetro não reage
    if (!shareEl.hidden) {
      if (e.key === 'Escape') closeShare();
      return;
    }
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
    if (e.code !== 'Space' || !shareEl.hidden) return;
    e.preventDefault();
    spaceDown = false;
    onRelease();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ---- embaralho
  function newScramble(fromChallenge = false) {
    if (!impl) return;
    scramble = impl.scramble();
    if (fromChallenge && challenge && challenge.puzzle === cfg.puzzle) {
      try {
        // confere se os movimentos existem neste puzzle (o link pode ter sido alterado)
        challenge.scramble.reduce((s, m) => impl!.applyMove(s, m), impl.solvedState());
        scramble = [...challenge.scramble];
      } catch {
        challenge = null;
        toast(tr('O link do desafio tem um embaralho inválido — usando um novo.', 'The challenge link has an invalid scramble — using a new one.'));
      }
    }
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
      stat(tr('Melhor', 'Best'), fmt(best(solves))),
      stat(tr('Média de 5', 'Ao5'), fmt(averageOf(solves, 5)), tr('Últimos 5, sem o melhor e o pior (como nas competições)', 'Last 5, without the best and the worst (like in competitions)')),
      stat(tr('Média de 12', 'Ao12'), fmt(averageOf(solves, 12)), tr('Últimos 12, sem o melhor e o pior', 'Last 12, without the best and the worst')),
      stat(tr('Melhor média de 5', 'Best ao5'), fmt(bestAverage(solves, 5))),
      stat(tr('Média geral', 'Mean'), fmt(mean(solves))),
      stat(tr('Resoluções', 'Solves'), String(solves.length)),
    ].join('');
    chart.update(solves);
    const bestMs = best(solves);
    const list = $<HTMLElement>('.tm-times');
    list.innerHTML = solves.length
      ? solves
          .map((s, i) => ({ s, i }))
          .reverse()
          .slice(0, 200)
          .map(
            ({ s, i }) => `<li data-i="${i}">
              <span class="tm-n">${i + 1}</span>
              <b class="tm-t ${s.pen === 'dnf' ? 'dnf' : ''}" title="${s.scramble}">${fmtSolve(s)}${value(s) === bestMs ? `<span class="tm-best" title="${tr('Seu melhor tempo', 'Your best single')}">${icon('trophy')}</span>` : ''}</b>
              <span class="tm-acts">
                <button class="${s.pen === 2 ? 'on' : ''}" data-pen="2" aria-pressed="${s.pen === 2}">+2</button>
                <button class="${s.pen === 'dnf' ? 'on' : ''}" data-pen="dnf" aria-pressed="${s.pen === 'dnf'}">DNF</button>
                <button data-del aria-label="${tr('Apagar este tempo', 'Delete this time')}">${icon('trash')}</button>
                <button data-share-i aria-label="${tr('Desafiar um amigo com este tempo', 'Challenge a friend with this time')}" title="${tr('Desafiar um amigo', 'Challenge a friend')}">${icon('share')}</button>
              </span>
            </li>`,
          )
          .join('')
      : `<li class="tm-empty">${tr('Nenhum tempo ainda — faça a primeira resolução!', 'No times yet — do your first solve!')}</li>`;
  }

  function setPenalty(i: number, pen: Penalty) {
    const s = solves[i];
    if (!s) return;
    s.pen = s.pen === pen ? 0 : pen;
    saveSolves(cfg.puzzle, solves);
    if (i === solves.length - 1) hidePb();
    if (i === solves.length - 1 && phase === 'idle') timeEl.textContent = fmtSolve(s);
    renderStats();
    renderChallenge();
  }
  function remove(i: number) {
    if (i === solves.length - 1) hidePb();
    solves.splice(i, 1);
    saveSolves(cfg.puzzle, solves);
    if (i === solves.length && phase === 'idle') timeEl.textContent = solves.length ? fmtSolve(solves[solves.length - 1]) : '0.00';
    renderStats();
    renderChallenge();
    paint();
  }

  // ---- desafio: o aviso de quem desafiou e o resultado da sua tentativa
  const puzzleName = (id = cfg.puzzle) => available.find((p) => p.id === id)!.short;
  function renderChallenge() {
    banner.hidden = !challenge || challenge.puzzle !== cfg.puzzle;
    if (!challenge || banner.hidden) return;
    const c = challenge;
    const key = c.scramble.join(' ');
    const who = c.name ? `<b>${esc(c.name)}</b>` : tr('Um amigo', 'A friend');
    const theirs = c.ms;
    const attempt = [...solves].reverse().find((s) => s.scramble === key && s.at >= c.since);
    const onIt = scramble.join(' ') === key;
    let html: string;
    if (!attempt)
      html = `${icon('target')}<div class="tm-ch-text">${
        theirs === null
          ? tr(`${who} tentou este embaralho do ${puzzleName()} e <b>não terminou</b>. Termine e ganhe!`, `${who} tried this ${puzzleName()} scramble and <b>didn’t finish</b>. Finish it and you win!`)
          : tr(
              `${who} fez <b>${fmt(theirs)}</b> neste embaralho do ${puzzleName()}. Embaralhe seu cubo igual e tente bater!`,
              `${who} did <b>${fmt(theirs)}</b> on this ${puzzleName()} scramble. Scramble yours the same way and try to beat it!`,
            )
      }</div><div class="tm-ch-acts">${onIt ? '' : `<button class="btn primary sm" data-ch="retry">${tr('Usar o embaralho do desafio', 'Use the challenge scramble')}</button>`}<button class="btn ghost sm" data-ch="close">${tr('Fechar', 'Close')}</button></div>`;
    else {
      const mine = value(attempt);
      const diff = (a: number, b: number) => `${(Math.abs(a - b) / 1000).toFixed(2)} s`;
      const result = !Number.isFinite(mine)
        ? theirs === null
          ? tr('Os dois não terminaram — empate!', 'Neither of you finished — it’s a tie!')
          : tr(`Você não terminou (DNF). ${c.name ? esc(c.name) : 'Seu amigo'} ganhou desta vez.`, `You didn’t finish (DNF). ${c.name ? esc(c.name) : 'Your friend'} wins this time.`)
        : theirs === null || mine < theirs
          ? tr(
              `Você fez <b>${fmt(mine)}</b> — <b class="win">ganhou${theirs === null ? '' : ` por ${diff(mine, theirs)}`}!</b>`,
              `You did <b>${fmt(mine)}</b> — <b class="win">you won${theirs === null ? '' : ` by ${diff(mine, theirs)}`}!</b>`,
            )
          : mine === theirs
            ? tr(`Você fez <b>${fmt(mine)}</b> — empate!`, `You did <b>${fmt(mine)}</b> — it’s a tie!`)
            : tr(`Você fez <b>${fmt(mine)}</b> — faltou ${diff(mine, theirs)}.`, `You did <b>${fmt(mine)}</b> — ${diff(mine, theirs)} short.`);
      html = `${icon('trophy')}<div class="tm-ch-text">${result} <span class="tm-ch-vs">(${who}: ${theirs === null ? 'DNF' : fmt(theirs)})</span></div>
        <div class="tm-ch-acts"><button class="btn ghost sm" data-ch="retry">${tr('Tentar de novo', 'Try again')}</button><button class="btn primary sm" data-ch="reply">${icon('share')}${tr('Responder', 'Reply')}</button><button class="btn ghost sm" data-ch="close">${tr('Fechar', 'Close')}</button></div>`;
    }
    banner.innerHTML = html;
  }
  banner.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-ch]')?.dataset.ch;
    if (act === 'close') {
      challenge = null;
      renderChallenge();
    } else if (act === 'retry') {
      newScramble(true);
      renderChallenge();
    } else if (act === 'reply' && challenge) {
      const key = challenge.scramble.join(' ');
      const attempt = [...solves].reverse().find((s) => s.scramble === key);
      if (attempt) openShare(attempt);
    }
  });

  // ---- compartilhar: link com o mesmo embaralho e o seu tempo
  const nameInput = shareEl.querySelector<HTMLInputElement>('.tm-name input')!;
  const linkInput = shareEl.querySelector<HTMLInputElement>('.tm-share-link')!;
  function shareData() {
    const s = shareSolve!;
    const name = cleanName(nameInput.value);
    const v = value(s);
    const ms = Number.isFinite(v) ? v : null;
    const url = `${location.origin}${timerPath()}?${challengeQuery({ puzzle: cfg.puzzle, scramble: s.scramble.split(' '), ms, name })}`;
    const text =
      ms === null
        ? tr(
            `${name ? `${name} tentou` : 'Tentei'} este embaralho do ${puzzleName()} no CuboGuia e não terminou. Consegue?`,
            `${name ? `${name} tried` : 'I tried'} this ${puzzleName()} scramble on CuboGuia and didn’t finish. Can you?`,
          )
        : tr(
            `${name ? `${name} fez` : 'Fiz'} ${fmt(ms)} neste embaralho do ${puzzleName()} no CuboGuia. Consegue bater? É o mesmo embaralho:`,
            `${name ? `${name} did` : 'I did'} ${fmt(ms)} on this ${puzzleName()} scramble on CuboGuia. Can you beat it? Same scramble:`,
          );
    return { url, text };
  }
  function refreshShare() {
    const { url, text } = shareData();
    shareEl.querySelector('.tm-share-msg')!.textContent = text;
    linkInput.value = url;
  }
  function openShare(s: Solve) {
    if (phase !== 'idle') return;
    shareSolve = s;
    nameInput.value = loadName();
    refreshShare();
    shareEl.hidden = false;
  }
  function closeShare() {
    shareEl.hidden = true;
    shareSolve = null;
  }
  nameInput.addEventListener('input', () => {
    saveName(cleanName(nameInput.value));
    refreshShare();
  });
  shareEl.addEventListener('click', async (e) => {
    if (e.target === shareEl) return closeShare();
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-share]')?.dataset.share;
    if (!act || !shareSolve) return;
    if (act === 'close') return closeShare();
    const { url, text } = shareData();
    if (act === 'native') {
      try {
        await navigator.share({ title: tr('Desafio no CuboGuia', 'CuboGuia challenge'), text, url });
        closeShare();
      } catch {
        /* a pessoa cancelou */
      }
      return;
    }
    let ok = false;
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      ok = true;
    } catch {
      linkInput.select();
      ok = document.execCommand('copy');
    }
    toast(ok ? tr('Link copiado! Mande para o seu amigo.', 'Link copied! Send it to your friend.') : tr('Não deu para copiar sozinho — o link está selecionado, copie na mão.', 'Couldn’t copy automatically — the link is selected, copy it by hand.'));
  });

  app.querySelector('.tm-times')!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const i = Number(t.closest<HTMLElement>('[data-i]')?.dataset.i);
    if (Number.isNaN(i)) return;
    const b = t.closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.pen) setPenalty(i, b.dataset.pen === 'dnf' ? 'dnf' : 2);
    else if (b.hasAttribute('data-del')) remove(i);
    else if (b.hasAttribute('data-share-i')) openShare(solves[i]);
  });
  lastEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-last]');
    if (!b || !solves.length) return;
    const i = solves.length - 1;
    if (b.dataset.last === 'share') return openShare(solves[i]);
    if (b.dataset.last === 'del') remove(i);
    else setPenalty(i, b.dataset.last === 'dnf' ? 'dnf' : 2);
  });
  $<HTMLElement>('[data-act="new"]').addEventListener('click', () => {
    newScramble();
    renderChallenge();
  });
  // ---- exportar e importar (um arquivo .json; também lê o do csTimer)
  $<HTMLElement>('[data-act="export"]').addEventListener('click', () => {
    const all = Object.fromEntries(available.map((p) => [p.id, p.id === cfg.puzzle ? solves : loadSolves(p.id)]));
    const total = Object.values(all).reduce((a, l) => a + l.length, 0);
    if (!total) return toast(tr('Ainda não há tempos para exportar.', 'There are no times to export yet.'));
    const blob = new Blob([exportJson(all)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cuboguia-tempos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(tr(`${total} tempos exportados. Guarde o arquivo: ele traz os tempos de volta neste ou em outro aparelho.`, `${total} times exported. Keep the file: it brings your times back on this or another device.`));
  });
  const fileInput = $<HTMLInputElement>('.tm-file');
  $<HTMLElement>('[data-act="import"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast(tr('Arquivo grande demais.', 'File too large.'));
    try {
      const res = parseImport(await f.text(), available.map((p) => p.id));
      let added = 0;
      const where: string[] = [];
      for (const [id, list] of Object.entries(res.byPuzzle)) {
        const cur = id === cfg.puzzle ? solves : loadSolves(id);
        const m = mergeSolves(cur, list);
        if (!m.added) continue;
        added += m.added;
        where.push(puzzleName(id));
        saveSolves(id, m.merged);
        if (id === cfg.puzzle) solves = m.merged.slice(-MAX_SAVED);
      }
      hidePb();
      renderStats();
      paint();
      const from = res.source === 'cstimer' ? ' (csTimer)' : '';
      toast(
        added
          ? tr(`${added} tempos importados${from}: ${where.join(', ')}.`, `${added} times imported${from}: ${where.join(', ')}.`)
          : tr('Esses tempos já estavam aqui — nada novo para importar.', 'Those times were already here — nothing new to import.'),
      );
    } catch (e) {
      const r = e instanceof ImportError ? e.reason : 'format';
      toast(
        r === 'empty'
          ? tr('O arquivo não tem tempos de puzzles do CuboGuia.', 'The file has no times for CuboGuia puzzles.')
          : tr('Não reconheci esse arquivo. Use um arquivo exportado pelo CuboGuia ou pelo csTimer.', 'I didn’t recognize that file. Use a file exported from CuboGuia or csTimer.'),
      );
    }
  });
  $<HTMLElement>('[data-act="clear"]').addEventListener('click', () => {
    if (!solves.length || !confirm(tr(`Apagar os ${solves.length} tempos deste puzzle?`, `Delete all ${solves.length} times for this puzzle?`))) return;
    solves = [];
    saveSolves(cfg.puzzle, solves);
    hidePb();
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
      renderInfo();
      paint();
    }),
  );

  async function choose(id: string) {
    cfg.puzzle = id;
    saveCfg(cfg);
    hidePb();
    solves = loadSolves(id);
    timeEl.textContent = solves.length ? fmtSolve(solves[solves.length - 1]) : '0.00';
    renderOpts();
    renderStats();
    paint();
    scrText.textContent = tr('Carregando…', 'Loading…');
    const im = await loadPuzzle(id);
    if (!alive || cfg.puzzle !== id) return;
    impl = im;
    newScramble(challenge?.puzzle === id);
    renderChallenge();
    renderInfo();
  }

  // ---- ⓘ: o que é o embaralho, como segurar e o que cada movimento quer dizer
  function renderInfo() {
    if (!impl) return;
    info.querySelector('.tm-info-in')!.innerHTML = `
      <div class="tm-info-cols">
        <div>
          <h4>${tr('O que é o embaralho?', 'What is a scramble?')}</h4>
          <p>${tr(
            `É uma sequência de giros sorteada que deixa o ${puzzleName()} bagunçado de um jeito "justo" — o mesmo para todo mundo que fizer a mesma sequência. É assim nas competições, e é o que vai junto quando você desafia um amigo.`,
            `It’s a random sequence of turns that mixes up the ${puzzleName()} in a "fair" way — the same for everyone who does the same sequence. That’s how competitions work, and it’s what gets sent when you challenge a friend.`,
          )}</p>
          <h4>${tr('Como fazer', 'How to do it')}</h4>
          <ol>
            <li>${tr(`Comece com o ${puzzleName()} <b>resolvido</b>, ${scrambleHold(cfg.puzzle)}.`, `Start with the ${puzzleName()} <b>solved</b>, ${scrambleHold(cfg.puzzle)}.`)}</li>
            <li>${tr('Faça os giros na ordem, da esquerda para a direita, <b>sem virar o puzzle na mão</b> no meio do caminho.', 'Do the turns in order, left to right, <b>without rotating the whole puzzle</b> along the way.')}</li>
            <li>${tr(
              `Confira com o desenho${cfg.preview ? '' : ' (ligue a opção "Desenho")'}: ele mostra como o puzzle deve ter ficado, visto ${cfg.puzzle === 'pyraminx' || cfg.puzzle === 'megaminx' ? 'aberto' : 'aberto em cruz (a face de cima no alto, a da frente no meio)'}.`,
              `Check it against the preview${cfg.preview ? '' : ' (turn on the "Preview" option)'}: it shows how the puzzle should look, unfolded${cfg.puzzle === 'pyraminx' || cfg.puzzle === 'megaminx' ? '' : ' as a cross (top face at the top, front face in the middle)'}.`,
            )}</li>
          </ol>
        </div>
        <div>
          <h4>${tr('O que cada movimento quer dizer', 'What each move means')}</h4>
          ${notationHtml(impl)}
        </div>
      </div>`;
  }
  /** aberto pelo clique (fica) ou pelo mouse por cima (fecha ao sair) */
  let infoPinned = false;
  const setInfo = (open: boolean) => {
    info.classList.toggle('open', open);
    infoBtn.setAttribute('aria-expanded', String(open));
    infoBtn.classList.toggle('on', open);
  };
  infoBtn.addEventListener('click', () => {
    infoPinned = !infoPinned || !info.classList.contains('open');
    setInfo(infoPinned);
  });
  infoBtn.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' && !infoPinned) setInfo(true);
  });
  $<HTMLElement>('.tm-scramble').addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !infoPinned) setInfo(false);
  });
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
    chart.dispose();
  };
}
