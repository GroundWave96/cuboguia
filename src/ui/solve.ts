import { getPuzzle, loadPuzzle } from '../core/registry';
import { decodeState, encodeState, loadSpeed, loadState, saveMethod, saveSpeed } from '../core/store';
import type { PuzzleImpl, PuzzleState, PuzzleView, Solution } from '../core/types';
import { icon } from './icons';
import { keepScreenOn } from './wakelock';

interface FlatMove {
  move: string;
  step: number;
  seg: number;
}

export async function renderSolve(app: HTMLElement, puzzleId: string, params: URLSearchParams) {
  const def = getPuzzle(puzzleId);
  if (!def?.available) throw new Error('Este puzzle ainda não está disponível.');
  const impl: PuzzleImpl = await loadPuzzle(puzzleId);

  const initial: PuzzleState | null = decodeState(params.get('s') ?? '', impl.stickerCount, impl.colors.map((c) => c.key)) ?? loadState(puzzleId);
  if (!initial) {
    location.hash = `/p/${puzzleId}`;
    return () => {};
  }
  const valid = impl.validate(initial);
  if (!valid.ok) throw new Error('O cubo informado não é válido: ' + valid.errors.join(' '));

  const methodId = impl.methods.some((m) => m.id === params.get('m')) ? params.get('m')! : impl.methods[0].id;
  // aviso enquanto calcula (o Megaminx leva 1–3 s)
  app.innerHTML = `<section class="page narrow"><div class="card loading-card"><div class="spinner" aria-hidden="true"></div><h2>Calculando a solução…</h2><p>Montando o passo a passo para o seu ${def.name}.</p></div></section>`;
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

  const faceText = Object.fromEntries(impl.notationHelp.map((h) => [h.move, h.text]));
  const describeMove = (m: string) => {
    if (impl.describeMove) return impl.describeMove(m);
    const wide = m[0] !== m[0].toUpperCase() || m.includes('w');
    const f = (faceText[m[0].toUpperCase()] ?? m[0]) + (wide ? ' + meio (2 camadas)' : '');
    const dir = m.endsWith("'") ? 'anti-horário ↺' : m.endsWith('2') ? 'meia volta (180°)' : 'horário ↻';
    return `${f} · ${dir}`;
  };

  let cur = 0; // passo exibido
  let pos = 0; // movimentos já aplicados
  let busy = false;
  let playing = false;
  let speed = loadSpeed();
  // 1× = 700 ms por quarto de volta (meia volta leva 1,5×)
  const moveMs = () => 700 / speed;

  app.innerHTML = `
  <section class="page workspace solve">
    <div class="ws-header">
      <a class="back" href="#/p/${puzzleId}">← Editar cores</a>
      <h1>Tutorial: resolvendo seu ${def.name.replace('Cubo ', '')}</h1>
      <p>${sol.method} · <b>${steps.length}</b> passo${steps.length === 1 ? '' : 's'} · <b>${flat.length}</b> movimento${flat.length === 1 ? '' : 's'}. ${impl.holdHint} Mantenha essa posição o tempo todo.</p>
      <div class="method-switch" role="group" aria-label="Método">
        ${impl.methods
          .map(
            (m) =>
              `<a class="${m.id === methodId ? 'on' : ''}" href="#/p/${puzzleId}/solve?m=${m.id}&s=${encodeState(initial, impl.colors.map((c) => c.key))}" ${m.id === methodId ? 'aria-current="true"' : ''}>${m.name}<small>${m.tagline}</small></a>`,
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
        <button class="icon-btn view-reset" title="Voltar à vista inicial" aria-label="Voltar à vista inicial">${icon('resetView')}</button>
      </div>
      <div class="ws-panel card step-panel">
        <div class="step-body"></div>
        <div class="step-ok" hidden>${icon('checkCircle')}<span>Passo concluído! Avance para o <b>próximo passo</b>.</span></div>
        <!-- controles: ficam presos na parte de baixo da tela enquanto o painel passa por ela -->
        <div class="step-dock">
          <div class="controls">
            <button class="ctl" data-act="prevStep" title="Passo anterior (PageUp)" aria-label="Passo anterior">${icon('stepPrev')}</button>
            <button class="ctl" data-act="prevMove" title="Desfazer movimento (←)" aria-label="Desfazer movimento">${icon('movePrev')}</button>
            <button class="ctl main" data-act="main"></button>
            <button class="ctl" data-act="nextMove" title="Próximo movimento (→)" aria-label="Próximo movimento">${icon('moveNext')}</button>
            <button class="ctl" data-act="nextStep" title="Próximo passo (PageDown)" aria-label="Próximo passo">${icon('stepNext')}</button>
          </div>
        </div>
        <div class="step-foot">
          <label class="speed">Velocidade <input type="range" min="0.4" max="2.5" step="0.1" value="${speed}"><span>${speed.toFixed(1)}×</span></label>
          <details class="notation">
            <summary>Como ler os movimentos?</summary>
            <p>${impl.notationIntro ?? 'Cada letra é uma face. Gire-a olhando <b>de frente para ela</b>:'}</p>
            <ul>${impl.notationHelp.map((h) => `<li><code>${h.move}</code> ${h.text}</li>`).join('')}</ul>
            ${impl.notationNote ?? `<p><code>R</code> = sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = meia volta.</p>
            <p>Letra minúscula (<code>r</code>) = a face <b>e</b> a camada do meio juntas (duas camadas).</p>`}
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
      <div class="step-meta"><span class="pill">Etapa ${stageIndex(st.stageId) + 1} · ${stage.name}</span><span>Passo ${cur + 1} de ${steps.length}</span></div>
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
        <h2>${steps.length ? 'Cubo resolvido!' : 'Seu cubo já está resolvido!'}</h2>
        <p>${steps.length ? `Foram ${steps.length} passos e ${flat.length} movimentos. Com a prática, os algoritmos ficam automáticos — tente de novo embaralhando o cubo!` : 'Embaralhe o cubo e informe as cores de novo para ver o tutorial.'}</p>
        <div class="row-actions center">
          ${steps.length ? '<button class="btn ghost" data-act="restart">Rever do início</button>' : ''}
          <a class="btn primary" href="#/p/${puzzleId}">Resolver outro cubo</a>
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

  function render() {
    // etapas
    const curStage = steps[cur] ? stageIndex(steps[cur].stageId) : sol.stages.length;
    app.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b, i) => {
      const hasSteps = steps.some((s) => s.stageId === b.dataset.stage);
      const isDone = finished() || i < curStage;
      b.classList.toggle('done', isDone && i !== curStage);
      b.classList.toggle('current', !finished() && i === curStage);
      b.classList.toggle('empty', !hasSteps);
    });

    // selo do movimento atual/próximo
    if (busy && pos < flat.length) {
      badge.querySelector('strong')!.textContent = flat[pos].move;
      badge.querySelector('span')!.textContent = describeMove(flat[pos].move);
      badge.classList.add('show', 'active');
    } else if (pos < stepEnd(cur)) {
      badge.querySelector('strong')!.textContent = flat[pos].move;
      badge.querySelector('span')!.textContent = 'Próximo: ' + describeMove(flat[pos].move);
      badge.classList.add('show');
      badge.classList.remove('active');
    } else {
      badge.classList.remove('show', 'active');
    }

    if (finished()) {
      if (built !== -1) buildDone();
      return;
    }
    if (built !== cur) buildStep();

    body.querySelector<HTMLElement>('.progress span')!.style.width = `${(pos / flat.length) * 100}%`;
    body.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => {
      const i = Number(b.dataset.p);
      b.classList.toggle('done', i < pos);
      b.classList.toggle('next', i === pos);
    });
    const done = stepDone();
    stepOk.hidden = !done;
    prevMoveBtn.disabled = pos === 0;
    if (playing) setMain('pause', 'Pausar (espaço)', icon('pause'));
    else if (done) setMain('play', 'Próximo passo (espaço)', `${icon('stepNext')}<span>Próximo passo</span>`, true);
    else setMain('play', 'Animar o passo (espaço)', icon('play'));
  }

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
    if (act === 'prevStep') prevStep();
    else if (act === 'prevMove') prevMove();
    else if (act === 'nextMove') nextMove();
    else if (act === 'nextStep') nextStep();
    else if (act === 'play') play();
    else if (act === 'pause') pause();
    else if (act === 'restart') goToStep(0);
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
  if (steps.length) goToStep(0);
  else render();

  return () => {
    playing = false;
    releaseScreen();
    window.removeEventListener('keydown', onKey);
    view.dispose();
  };
}
