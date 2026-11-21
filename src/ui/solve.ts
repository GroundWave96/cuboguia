import { getPuzzle, loadPuzzle } from '../core/registry';
import { decodeState, encodeState, loadSpeed, loadState, saveMethod, saveSpeed } from '../core/store';
import { navigate, puzzlePath, solvePath } from '../core/router';
import { plural, tr } from '../core/i18n';
import type { PuzzleImpl, PuzzleState, PuzzleView, Solution } from '../core/types';
import { icon } from './icons';
import { toast } from './toast';
import { notationHtml } from './notation';
import { keepScreenOn } from './wakelock';
import { loadProgress, movesSignature, saveProgress } from '../core/progress';
import { canSpeak, loadHandsFree, saveHandsFree, speak, stopSpeaking } from './handsfree';

interface FlatMove {
  move: string;
  step: number;
  seg: number;
}

export async function renderSolve(app: HTMLElement, puzzleId: string, params: URLSearchParams) {
  const def = getPuzzle(puzzleId);
  if (!def?.available) throw new Error(tr('Este puzzle ainda não está disponível.', 'This puzzle isn’t available yet.'));
  const impl: PuzzleImpl = await loadPuzzle(puzzleId);

  const initial: PuzzleState | null = decodeState(params.get('s') ?? '', impl.stickerCount, impl.colors.map((c) => c.key)) ?? loadState(puzzleId);
  if (!initial) {
    navigate(puzzlePath(puzzleId), true);
    return () => {};
  }
  const valid = impl.validate(initial);
  if (!valid.ok) throw new Error(tr('O cubo informado não é válido: ', 'The puzzle you entered isn’t valid: ') + valid.errors.join(' '));

  const methodId = impl.methods.some((m) => m.id === params.get('m')) ? params.get('m')! : impl.methods[0].id;
  // aviso enquanto calcula (o Megaminx leva 1–3 s)
  app.innerHTML = `<section class="page narrow"><div class="card loading-card"><div class="spinner" aria-hidden="true"></div><h2>${tr('Calculando a solução…', 'Working out the solution…')}</h2><p>${tr(`Montando o passo a passo para o seu ${def.name}.`, `Building the step-by-step guide for your ${def.name}.`)}</p></div></section>`;
  await new Promise((r) => setTimeout(r, 40));
  const sol: Solution = impl.solve(initial, methodId);
  saveMethod(methodId);
  const steps = sol.steps;
  const flat: FlatMove[] = [];
  const stepStart: number[] = [];
  steps.forEach((st, si) => {
    stepStart.push(flat.length);
    st.segments.forEach((sg, gi) => sg.moves.forEach((m) => flat.push({ move: m, step: si, seg: gi })));
  });
  stepStart.push(flat.length);
  const startStates: PuzzleState[] = [];
  {
    let s = initial;
    steps.forEach((_, si) => {
      startStates.push(s);
      for (let p = stepStart[si]; p < stepStart[si + 1]; p++) s = impl.applyMove(s, flat[p].move);
    });
  }

  // progresso salvo: o mesmo cubo e método sempre geram a mesma solução
  const stateCode = encodeState(initial, impl.colors.map((c) => c.key));
  const sig = movesSignature(flat.map((f) => f.move));
  const saved = steps.length ? loadProgress(puzzleId, methodId, stateCode, sig) : null;
  // veio da troca de idioma: continua no mesmo passo, sem o aviso "continuando de onde parou"
  let langSwitch = false;
  try {
    langSwitch = sessionStorage.getItem('cubo:langSwitch') === '1';
    sessionStorage.removeItem('cubo:langSwitch');
  } catch {
    /* sem armazenamento */
  }

  const faceText = Object.fromEntries(impl.notationHelp.map((h) => [h.move, h.text]));
  const describeMove = (m: string) => {
    if (impl.describeMove) return impl.describeMove(m);
    const wide = m[0] !== m[0].toUpperCase() || m.includes('w');
    const f = (faceText[m[0].toUpperCase()] ?? m[0]) + (wide ? tr(' + meio (2 camadas)', ' + middle (2 layers)') : '');
    const dir = m.endsWith("'") ? tr('anti-horário ↺', 'counterclockwise ↺') : m.endsWith('2') ? tr('meia volta (180°)', 'half turn (180°)') : tr('horário ↻', 'clockwise ↻');
    return `${f} · ${dir}`;
  };

  let cur = 0; // passo exibido
  let pos = 0; // movimentos já aplicados
  let busy = false;
  let playing = false;
  let speed = loadSpeed();
  // mãos livres: o site fala o próximo movimento e um toque no cubo avança
  let handsFree = canSpeak() && loadHandsFree();
  /** os navegadores só deixam falar depois de um toque/clique na página */
  let interacted = false;
  let lastSpoken = '';
  // 1× = 700 ms por quarto de volta (meia volta leva 1,5×)
  const moveMs = () => 700 / speed;

  app.innerHTML = `
  <section class="page workspace solve">
    <div class="ws-header">
      <div class="ws-toprow">
        <a class="back" href="${puzzlePath(puzzleId)}">← ${tr('Editar cores', 'Edit colors')}</a>
        ${steps.length ? `<button type="button" class="btn ghost sm share-tut" data-act="share" title="${tr('Mandar o link deste tutorial (o mesmo cubo e a mesma solução)', 'Send a link to this tutorial (same cube, same solution)')}">${icon('share')}<span>${tr('Compartilhar', 'Share')}</span></button>` : ''}
      </div>
      <h1>${tr(`Tutorial: resolvendo seu ${def.short}`, `Tutorial: solving your ${def.short}`)}</h1>
      <p>${sol.method} · <b>${steps.length}</b> ${plural(steps.length, 'passo', 'passos', 'step', 'steps')} · <b>${flat.length}</b> ${plural(flat.length, 'movimento', 'movimentos', 'move', 'moves')}. ${impl.holdHint} ${tr('Mantenha essa posição o tempo todo.', 'Keep it in this position the whole time.')}</p>
      <div class="method-switch" role="group" aria-label="${tr('Método', 'Method')}">
        ${impl.methods
          .map(
            (m) =>
              `<a class="${m.id === methodId ? 'on' : ''}" href="${solvePath(puzzleId, m.id, stateCode)}" ${m.id === methodId ? 'aria-current="true"' : ''}>${m.name}<small>${m.tagline}</small></a>`,
          )
          .join('')}
      </div>
    </div>
    <ol class="stages">
      ${sol.stages
        .map((s, i) => `<li><button data-stage="${s.id}" title="${s.goal}"><b>${i + 1}</b><span>${s.name}</span></button></li>`)
        .join('')}
    </ol>
    <div class="ws-grid">
      <div class="ws-view card">
        <div class="view-host" id="view-host"></div>
        <div class="move-badge" aria-live="polite"><strong></strong><span></span></div>
        <div class="hf-hint" ${handsFree ? '' : 'hidden'}>${icon('voice')}<span>${tr('Toque no cubo para o próximo movimento', 'Tap the cube for the next move')}</span></div>
        <button class="icon-btn view-reset" title="${tr('Voltar à vista inicial', 'Reset the view')}" aria-label="${tr('Voltar à vista inicial', 'Reset the view')}">${icon('resetView')}</button>
      </div>
      <div class="ws-panel card step-panel">
        <div class="resume-note" hidden>${icon('history')}<span></span><button class="btn ghost sm" data-act="restart">${tr('Começar do início', 'Start over')}</button><button class="icon-btn" data-act="hideResume" aria-label="${tr('Fechar', 'Close')}" title="${tr('Fechar', 'Close')}">${icon('close')}</button></div>
        <div class="step-body"></div>
        <div class="step-ok" hidden>${icon('checkCircle')}<span>${tr('Passo concluído! Avance para o <b>próximo passo</b>.', 'Step done! Move on to the <b>next step</b>.')}</span></div>
        <!-- controles: ficam presos na parte de baixo da tela enquanto o painel passa por ela -->
        <div class="step-dock">
          <div class="controls">
            <button class="ctl" data-act="prevStep" title="${tr('Passo anterior', 'Previous step')} (PageUp)" aria-label="${tr('Passo anterior', 'Previous step')}">${icon('stepPrev')}</button>
            <button class="ctl" data-act="prevMove" title="${tr('Desfazer movimento', 'Undo move')} (←)" aria-label="${tr('Desfazer movimento', 'Undo move')}">${icon('movePrev')}</button>
            <button class="ctl main" data-act="main"></button>
            <button class="ctl" data-act="nextMove" title="${tr('Próximo movimento', 'Next move')} (→)" aria-label="${tr('Próximo movimento', 'Next move')}">${icon('moveNext')}</button>
            <button class="ctl" data-act="nextStep" title="${tr('Próximo passo', 'Next step')} (PageDown)" aria-label="${tr('Próximo passo', 'Next step')}">${icon('stepNext')}</button>
          </div>
        </div>
        <div class="step-foot">
          <div class="foot-row">
            <label class="speed">${tr('Velocidade', 'Speed')} <input type="range" min="0.4" max="2.5" step="0.1" value="${speed}"><span>${speed.toFixed(1)}×</span></label>
            ${
              canSpeak()
                ? `<button type="button" class="btn ghost sm hf-toggle" data-act="handsfree" aria-pressed="${handsFree}" title="${tr('O site fala cada movimento e um toque no cubo avança', 'The site reads each move aloud and a tap on the cube moves on')}">${icon('voice')}<span>${tr('Mãos livres', 'Hands-free')}</span></button>`
                : ''
            }
          </div>
          <p class="hf-note" ${handsFree ? '' : 'hidden'}>${tr(
            'Mãos livres ligado: o site fala cada movimento em voz alta. Faça o movimento no seu cubo e <b>toque no cubo da tela</b> para ir ao próximo (arrastar continua girando a vista). Aumente o volume do aparelho.',
            'Hands-free is on: the site reads each move aloud. Do the move on your cube and <b>tap the cube on the screen</b> for the next one (dragging still turns the view). Turn up your device’s volume.',
          )}</p>
          <details class="notation">
            <summary>${tr('Como ler os movimentos?', 'How to read the moves?')}</summary>
            ${notationHtml(impl, puzzleId)}
          </details>
        </div>
        <div class="done-host" hidden></div>
      </div>
    </div>
  </section>`;

  const view: PuzzleView = impl.createView(app.querySelector('#view-host')!);
  app.querySelector('.view-reset')!.addEventListener('click', () => view.resetCamera());
  const viewCard = app.querySelector<HTMLElement>('.ws-view')!;
  const panel = app.querySelector<HTMLElement>('.step-panel')!;
  const body = panel.querySelector<HTMLElement>('.step-body')!;
  const foot = panel.querySelector<HTMLElement>('.step-foot')!;
  const dock = panel.querySelector<HTMLElement>('.step-dock')!;
  const doneHost = panel.querySelector<HTMLElement>('.done-host')!;
  const stepOk = panel.querySelector<HTMLElement>('.step-ok')!;
  const mainBtn = panel.querySelector<HTMLButtonElement>('[data-act="main"]')!;
  const prevMoveBtn = panel.querySelector<HTMLButtonElement>('[data-act="prevMove"]')!;
  const badge = app.querySelector<HTMLElement>('.move-badge')!;
  const resumeNote = panel.querySelector<HTMLElement>('.resume-note')!;

  const stageIndex = (id: string) => sol.stages.findIndex((s) => s.id === id);
  const stepEnd = (i: number) => stepStart[i + 1];
  const finished = () => steps.length === 0 || pos >= flat.length;
  const stepDone = () => pos >= stepEnd(cur);

  function focusAt(): number[] {
    const st = steps[cur];
    if (!st) return [];
    let f = st.focus;
    for (let p = stepStart[cur]; p < pos; p++) {
      const map = impl.locationMap(flat[p].move);
      f = f.map((i) => map[i]);
    }
    return f;
  }

  /** abre um passo (sem animar nada): o usuário lê a explicação e decide quando começar */
  function goToStep(i: number) {
    if (!steps.length) return;
    cur = Math.max(0, Math.min(steps.length - 1, i));
    pos = stepStart[cur];
    view.setState(startStates[cur]);
    showFocus();
    render();
  }

  function showFocus() {
    view.setHighlight(focusAt());
    view.focusCamera?.(focusAt());
  }

  async function animate(move: string) {
    busy = true;
    render();
    await view.animateMove(move, moveMs());
    busy = false;
  }

  async function nextMove() {
    if (busy || finished()) return;
    // passo concluído: o primeiro toque só abre o próximo passo; o movimento fica para o toque seguinte
    if (stepDone()) return goToStep(cur + 1);
    await animate(flat[pos].move);
    pos++;
    view.setHighlight(focusAt());
    render();
  }

  async function prevMove() {
    if (busy || pos === 0) return;
    if (pos <= stepStart[cur]) {
      // início do passo: primeiro volta a mostrar o passo anterior (já concluído); o toque seguinte desfaz
      cur--;
      showFocus();
      render();
      return;
    }
    await animate(impl.invertMove(flat[pos - 1].move));
    pos--;
    view.setHighlight(focusAt());
    render();
  }

  async function play() {
    if (busy || finished()) return;
    if (stepDone()) return goToStep(cur + 1);
    playing = true;
    render();
    while (playing && pos < stepEnd(cur)) await nextMove();
    playing = false;
    render();
  }

  function pause() {
    playing = false;
    render();
  }

  function nextStep() {
    if (busy) return;
    if (cur < steps.length - 1) goToStep(cur + 1);
    else if (!finished()) {
      // último passo: pula para o fim
      pos = flat.length;
      view.setState(impl.solvedState());
      view.setHighlight([]);
      render();
    }
  }

  function prevStep() {
    if (busy) return;
    if (pos > stepStart[cur]) goToStep(cur);
    else goToStep(cur - 1);
  }

  // ---- painel: a parte do passo só é montada quando o passo muda; o resto é atualizado no lugar
  /** passo montado no painel (-1 = tela final, null = nada ainda) */
  let built: number | null = null;

  function buildStep() {
    const st = steps[cur];
    const stage = sol.stages[stageIndex(st.stageId)];
    let k = stepStart[cur];
    const segHtml = st.segments
      .map((sg) => {
        const chips = sg.moves
          .map(() => {
            const i = k++;
            return `<button class="chip" data-p="${i}" title="${describeMove(flat[i].move)}">${flat[i].move}</button>`;
          })
          .join('');
        return `<div class="seg"><div class="seg-label">${sg.label}</div><div class="chips">${chips}</div></div>`;
      })
      .join('');
    body.innerHTML = `
      <div class="step-meta"><span class="pill">${tr('Etapa', 'Stage')} ${stageIndex(st.stageId) + 1} · ${stage.name}</span><span>${tr(`Passo ${cur + 1} de ${steps.length}`, `Step ${cur + 1} of ${steps.length}`)}</span></div>
      <div class="progress"><span></span></div>
      <h2 class="step-title">${st.title}</h2>
      <p class="stage-goal">${icon('target')}<span>${stage.goal}</span></p>
      <div class="step-desc">${st.description}</div>
      <div class="moves">${segHtml}</div>`;
    const wasBuilt = built !== null;
    built = cur;
    body.hidden = foot.hidden = dock.hidden = false;
    doneHost.hidden = true;
    doneHost.innerHTML = '';
    if (wasBuilt) revealTitle();
  }

  /** celular: o cubo fica fixo no topo; se o título do passo novo ficou escondido atrás dele, rola até o título */
  function revealTitle() {
    if (getComputedStyle(viewCard).position !== 'sticky') return;
    const title = body.querySelector<HTMLElement>('.step-title');
    if (!title) return;
    const top = body.getBoundingClientRect().top;
    const limit = viewCard.getBoundingClientRect().bottom + 8;
    if (top < limit) window.scrollBy({ top: top - limit, behavior: 'smooth' });
  }

  function buildDone() {
    built = -1;
    body.hidden = foot.hidden = dock.hidden = stepOk.hidden = true;
    doneHost.hidden = false;
    doneHost.innerHTML = `
      <div class="done-panel">
        <div class="confetti" aria-hidden="true">${'<i></i>'.repeat(24)}</div>
        <div class="trophy">${icon('trophy')}</div>
        <h2>${steps.length ? tr('Cubo resolvido!', 'Solved!') : tr('Seu cubo já está resolvido!', 'Your puzzle is already solved!')}</h2>
        <p>${
          steps.length
            ? tr(
                `Foram ${steps.length} passos e ${flat.length} movimentos. Com a prática, os algoritmos ficam automáticos — tente de novo embaralhando o cubo!`,
                `That was ${steps.length} steps and ${flat.length} moves. With practice the algorithms become automatic — scramble it and try again!`,
              )
            : tr('Embaralhe o cubo e informe as cores de novo para ver o tutorial.', 'Scramble it and enter the colors again to see the tutorial.')
        }</p>
        <div class="row-actions center">
          ${steps.length ? `<button class="btn ghost" data-act="restart">${tr('Rever do início', 'Watch again from the start')}</button>` : ''}
          ${steps.length ? `<button class="btn ghost" data-act="share">${icon('share')}${tr('Compartilhar', 'Share')}</button>` : ''}
          <a class="btn primary" href="${puzzlePath(puzzleId)}">${tr('Resolver outro cubo', 'Solve another one')}</a>
        </div>
      </div>`;
  }

  function setMain(act: string, label: string, html: string, wide = false) {
    mainBtn.dataset.act = act;
    mainBtn.setAttribute('aria-label', label);
    mainBtn.title = label;
    mainBtn.innerHTML = html;
    mainBtn.classList.toggle('wide', wide);
  }

  /** guarda onde parou (só quando muda; no início e no fim o registro é apagado) */
  let lastSaved = '';
  function persist() {
    if (!steps.length || busy) return;
    const k = `${cur}:${pos}`;
    if (k === lastSaved) return;
    lastSaved = k;
    saveProgress({ puzzle: puzzleId, method: methodId, state: stateCode, step: cur, pos, steps: steps.length, total: flat.length, sig, t: Date.now() });
  }

  function render() {
    persist();
    // etapas
    const curStage = steps[cur] ? stageIndex(steps[cur].stageId) : sol.stages.length;
    app.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b, i) => {
      const hasSteps = steps.some((s) => s.stageId === b.dataset.stage);
      const isDone = finished() || i < curStage;
      b.classList.toggle('done', isDone && i !== curStage);
      b.classList.toggle('current', !finished() && i === curStage);
      b.classList.toggle('empty', !hasSteps);
    });

    // seta no 3D: o próximo giro, quando parado (a animação e o "play" não precisam dela)
    view.showMoveHint?.(!busy && !playing && pos < stepEnd(cur) ? flat[pos].move : null);

    // selo do movimento atual/próximo
    if (busy && pos < flat.length) {
      badge.querySelector('strong')!.textContent = flat[pos].move;
      badge.querySelector('span')!.textContent = describeMove(flat[pos].move);
      badge.classList.add('show', 'active');
    } else if (pos < stepEnd(cur)) {
      badge.querySelector('strong')!.textContent = flat[pos].move;
      badge.querySelector('span')!.textContent = tr('Próximo: ', 'Next: ') + describeMove(flat[pos].move);
      badge.classList.add('show');
      badge.classList.remove('active');
    } else {
      badge.classList.remove('show', 'active');
    }

    if (finished()) {
      if (built !== -1) buildDone();
      announce();
      return;
    }
    if (built !== cur) buildStep();
    announce();

    body.querySelector<HTMLElement>('.progress span')!.style.width = `${(pos / flat.length) * 100}%`;
    body.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => {
      const i = Number(b.dataset.p);
      b.classList.toggle('done', i < pos);
      b.classList.toggle('next', i === pos);
    });
    const done = stepDone();
    stepOk.hidden = !done;
    prevMoveBtn.disabled = pos === 0;
    const space = tr('espaço', 'space');
    if (playing) setMain('pause', `${tr('Pausar', 'Pause')} (${space})`, icon('pause'));
    else if (done) setMain('play', `${tr('Próximo passo', 'Next step')} (${space})`, `${icon('stepNext')}<span>${tr('Próximo passo', 'Next step')}</span>`, true);
    else setMain('play', `${tr('Animar o passo', 'Play the step')} (${space})`, icon('play'));
  }

  /** o que falar agora (mãos livres) */
  function announcement(): string {
    if (finished()) return steps.length ? tr('Cubo resolvido! Parabéns!', 'Solved! Well done!') : '';
    if (stepDone()) return tr('Passo concluído. Toque no cubo para abrir o próximo passo.', 'Step done. Tap the cube to open the next step.');
    const mv = describeMove(flat[pos].move);
    if (pos === stepStart[cur])
      return tr(`Passo ${cur + 1} de ${steps.length}: ${steps[cur].title}. Primeiro movimento: ${mv}`, `Step ${cur + 1} of ${steps.length}: ${steps[cur].title}. First move: ${mv}`);
    return mv;
  }

  /** fala uma vez cada situação nova (não durante a animação nem no "play", que vai rápido demais) */
  function announce(force = false) {
    if (!handsFree || !interacted || busy || playing) return;
    const key = finished() ? 'end' : `${cur}:${pos}`;
    if (key === lastSpoken && !force) return;
    lastSpoken = key;
    const text = announcement();
    if (text) speak(text);
  }

  function setHandsFree(on: boolean) {
    handsFree = on;
    saveHandsFree(on);
    panel.querySelector('.hf-toggle')?.setAttribute('aria-pressed', String(on));
    panel.querySelector<HTMLElement>('.hf-note')!.hidden = !on;
    viewCard.querySelector<HTMLElement>('.hf-hint')!.hidden = !on;
    if (on) announce(true);
    else stopSpeaking();
  }

  // mãos livres: um toque (sem arrastar) no cubo avança; arrastar continua girando a vista
  let down: { x: number; y: number; t: number } | null = null;
  viewCard.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  viewCard.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    if (!handsFree || !d || (e.target as HTMLElement).closest('button')) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 600) return;
    interacted = true;
    resumeNote.hidden = true;
    if (playing) pause();
    else nextMove();
  });
  app.addEventListener('pointerdown', () => (interacted = true), { capture: true, once: true });

  /** manda o link deste tutorial: quem abrir vê o mesmo cubo e a mesma solução, desde o passo 1 */
  async function share() {
    const url = location.origin + solvePath(puzzleId, methodId, stateCode);
    const text = tr(`Tutorial passo a passo para resolver este ${def!.short} no CuboGuia:`, `Step-by-step tutorial to solve this ${def!.short} on CuboGuia:`);
    if (navigator.share) {
      try {
        await navigator.share({ title: tr(`Tutorial do ${def!.short} no CuboGuia`, `${def!.short} tutorial on CuboGuia`), text, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return; // a pessoa cancelou
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast(tr('Link copiado! Quem abrir vê o mesmo cubo e a mesma solução.', 'Link copied! Whoever opens it sees the same cube and solution.'));
    } catch {
      toast(tr(`Copie o link: ${url}`, `Copy the link: ${url}`), 8000);
    }
  }
  app.querySelector('[data-act="share"]')?.addEventListener('click', share);

  // um só ouvinte para os botões do painel (os botões do passo são recriados a cada passo)
  panel.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const chip = t.closest<HTMLButtonElement>('.chip');
    if (chip) {
      // clicar num chip avança/volta até ele (sempre dentro do passo atual)
      const target = Number(chip.dataset.p);
      if (busy || playing) return;
      while (pos > target && pos > stepStart[cur]) await prevMove();
      while (pos < target) await nextMove();
      return;
    }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act) resumeNote.hidden = true;
    interacted = true;
    if (act === 'handsfree') setHandsFree(!handsFree);
    else if (act === 'prevStep') prevStep();
    else if (act === 'prevMove') prevMove();
    else if (act === 'nextMove') nextMove();
    else if (act === 'nextStep') nextStep();
    else if (act === 'play') play();
    else if (act === 'pause') pause();
    else if (act === 'restart') goToStep(0);
    else if (act === 'share') share();
  });
  const range = panel.querySelector<HTMLInputElement>('.speed input')!;
  range.addEventListener('input', () => {
    speed = Number(range.value);
    saveSpeed(speed);
    panel.querySelector('.speed span')!.textContent = `${speed.toFixed(1)}×`;
  });

  app.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = steps.findIndex((s) => s.stageId === b.dataset.stage);
      if (i >= 0 && !busy) {
        playing = false;
        goToStep(i);
      }
    }),
  );

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    interacted = true;
    if (e.key === 'ArrowRight') nextMove();
    else if (e.key === 'ArrowLeft') prevMove();
    else if (e.key === 'PageDown') nextStep();
    else if (e.key === 'PageUp') prevStep();
    else if (e.key === ' ') {
      // espaço é sempre animar/pausar (mesmo com um botão focado depois de um clique)
      e.preventDefault();
      if (playing) pause();
      else play();
    } else return;
  };
  window.addEventListener('keydown', onKey);

  // tela sempre acesa durante o tutorial (as mãos estão no cubo)
  const releaseScreen = keepScreenOn();

  view.setState(initial);
  if (saved && saved.step < steps.length && saved.pos >= stepStart[saved.step] && saved.pos <= stepEnd(saved.step)) {
    // continua de onde parou: o estado do passo + os movimentos já feitos dentro dele
    cur = saved.step;
    let s = startStates[cur];
    for (let p = stepStart[cur]; p < saved.pos; p++) s = impl.applyMove(s, flat[p].move);
    pos = saved.pos;
    view.setState(s);
    showFocus();
    render();
    resumeNote.querySelector('span')!.innerHTML = tr(
      `Continuando de onde você parou: <b>passo ${cur + 1} de ${steps.length}</b>.`,
      `Picking up where you left off: <b>step ${cur + 1} of ${steps.length}</b>.`,
    );
    resumeNote.hidden = langSwitch;
    // celular: o cubo fica fixo no topo; rola até o aviso aparecer logo abaixo dele
    requestAnimationFrame(() => {
      if (langSwitch || getComputedStyle(viewCard).position !== 'sticky') return;
      const stuckTop = parseFloat(getComputedStyle(viewCard).top) || 0;
      const y = window.scrollY + resumeNote.getBoundingClientRect().top - (stuckTop + viewCard.offsetHeight + 8);
      if (y > window.scrollY) window.scrollTo({ top: y });
    });
  } else if (steps.length) goToStep(0);
  else render();

  return () => {
    playing = false;
    stopSpeaking();
    releaseScreen();
    window.removeEventListener('keydown', onKey);
    view.dispose();
  };
}
