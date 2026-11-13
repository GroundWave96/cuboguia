import { getPuzzle, loadPuzzle } from '../core/registry';
import { decodeState, encodeState, loadState, saveMethod } from '../core/store';
import type { PuzzleImpl, PuzzleState, PuzzleView, Solution } from '../core/types';

interface FlatMove {
  move: string;
  step: number;
  seg: number;
}

export async function renderSolve(app: HTMLElement, puzzleId: string, params: URLSearchParams) {
  const def = getPuzzle(puzzleId);
  if (!def?.available) throw new Error('Este puzzle ainda não está disponível.');
  const impl: PuzzleImpl = await loadPuzzle(puzzleId);

  const initial: PuzzleState | null = decodeState(params.get('s') ?? '', impl.stickerCount) ?? loadState(puzzleId);
  if (!initial) {
    location.hash = `/p/${puzzleId}`;
    return () => {};
  }
  const valid = impl.validate(initial);
  if (!valid.ok) throw new Error('O cubo informado não é válido: ' + valid.errors.join(' '));

  const methodId = impl.methods.some((m) => m.id === params.get('m')) ? params.get('m')! : impl.methods[0].id;
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
    const wide = m[0] !== m[0].toUpperCase() || m.includes('w');
    const f = (faceText[m[0].toUpperCase()] ?? m[0]) + (wide ? ' + meio (2 camadas)' : '');
    const dir = m.endsWith("'") ? 'anti-horário ↺' : m.endsWith('2') ? 'meia volta (180°)' : 'horário ↻';
    return `${f} · ${dir}`;
  };

  let cur = 0; // passo exibido
  let pos = 0; // movimentos já aplicados
  let busy = false;
  let playing = false;
  let speed = 1;
  // 1× = 700 ms por quarto de volta (meia volta leva 1,5×)
  const moveMs = () => 700 / speed;

  app.innerHTML = `
  <section class="page workspace solve">
    <div class="ws-header">
      <a class="back" href="#/p/${puzzleId}">← Editar cores</a>
      <h1>Tutorial: resolvendo seu ${def.name.replace('Cubo ', '')}</h1>
      <p>${sol.method} · <b>${steps.length}</b> passos · <b>${flat.length}</b> movimentos. Mantenha o cubo com o amarelo em cima e o verde de frente o tempo todo.</p>
      <div class="method-switch" role="group" aria-label="Método">
        ${impl.methods
          .map(
            (m) =>
              `<a class="${m.id === methodId ? 'on' : ''}" href="#/p/${puzzleId}/solve?m=${m.id}&s=${encodeState(initial)}" ${m.id === methodId ? 'aria-current="true"' : ''}>${m.name}<small>${m.tagline}</small></a>`,
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
        <button class="icon-btn view-reset" title="Voltar à vista inicial" aria-label="Voltar à vista inicial">⟲</button>
      </div>
      <div class="ws-panel card step-panel"></div>
    </div>
  </section>`;

  const view: PuzzleView = impl.createView(app.querySelector('#view-host')!);
  app.querySelector('.view-reset')!.addEventListener('click', () => view.resetCamera());
  const panel = app.querySelector<HTMLElement>('.step-panel')!;
  const badge = app.querySelector<HTMLElement>('.move-badge')!;

  const stageIndex = (id: string) => sol.stages.findIndex((s) => s.id === id);
  const stepEnd = (i: number) => stepStart[i + 1];
  const finished = () => steps.length === 0 || pos >= flat.length;

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

  function goToStep(i: number) {
    if (!steps.length) return;
    cur = Math.max(0, Math.min(steps.length - 1, i));
    pos = stepStart[cur];
    view.setState(startStates[cur]);
    view.setHighlight(focusAt());
    view.focusCamera?.(focusAt());
    render();
  }

  async function animate(move: string) {
    busy = true;
    render();
    await view.animateMove(move, moveMs());
    busy = false;
  }

  async function nextMove() {
    if (busy || finished()) return;
    if (pos >= stepEnd(cur)) {
      cur++;
      view.setHighlight(focusAt());
      view.focusCamera?.(focusAt());
    }
    const m = flat[pos].move;
    await animate(m);
    pos++;
    view.setHighlight(focusAt());
    render();
  }

  async function prevMove() {
    if (busy || pos === 0) return;
    if (pos <= stepStart[cur]) {
      cur--;
    }
    const m = impl.invertMove(flat[pos - 1].move);
    await animate(m);
    pos--;
    view.setHighlight(focusAt());
    render();
  }

  async function play() {
    if (busy) return;
    if (finished()) return;
    if (pos >= stepEnd(cur)) goToStep(cur + 1);
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

  function render() {
    // etapas
    const curStage = steps[cur] ? stageIndex(steps[cur].stageId) : sol.stages.length;
    app.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b, i) => {
      const hasSteps = steps.some((s) => s.stageId === b.dataset.stage);
      const isDone = finished() || i < curStage || (!hasSteps && i < curStage);
      b.classList.toggle('done', isDone && i !== curStage);
      b.classList.toggle('current', !finished() && i === curStage);
      b.classList.toggle('empty', !hasSteps);
    });

    // selo do movimento atual/próximo
    const nextIdx = pos < flat.length ? pos : -1;
    if (busy && pos < flat.length) {
      badge.querySelector('strong')!.textContent = flat[pos].move;
      badge.querySelector('span')!.textContent = describeMove(flat[pos].move);
      badge.classList.add('show', 'active');
    } else if (nextIdx >= 0 && nextIdx < stepEnd(cur)) {
      badge.querySelector('strong')!.textContent = flat[nextIdx].move;
      badge.querySelector('span')!.textContent = 'Próximo: ' + describeMove(flat[nextIdx].move);
      badge.classList.add('show');
      badge.classList.remove('active');
    } else {
      badge.classList.remove('show', 'active');
    }

    if (finished()) {
      panel.innerHTML = `
        <div class="done-panel">
          <div class="confetti" aria-hidden="true">${'<i></i>'.repeat(24)}</div>
          <div class="trophy">🎉</div>
          <h2>${steps.length ? 'Cubo resolvido!' : 'Seu cubo já está resolvido!'}</h2>
          <p>${steps.length ? `Foram ${steps.length} passos e ${flat.length} movimentos. Com a prática, os algoritmos ficam automáticos — tente de novo embaralhando o cubo!` : 'Embaralhe o cubo e informe as cores de novo para ver o tutorial.'}</p>
          <div class="row-actions center">
            ${steps.length ? '<button class="btn ghost" data-act="restart">Rever do início</button>' : ''}
            <a class="btn primary" href="#/p/${puzzleId}">Resolver outro cubo</a>
          </div>
        </div>`;
      panel.querySelector('[data-act="restart"]')?.addEventListener('click', () => goToStep(0));
      return;
    }

    const st = steps[cur];
    const stage = sol.stages[stageIndex(st.stageId)];
    const stepDone = pos >= stepEnd(cur);
    let k = stepStart[cur];
    const segHtml = st.segments
      .map((sg) => {
        const chips = sg.moves
          .map(() => {
            const i = k++;
            const cls = i < pos ? 'done' : i === pos ? 'next' : '';
            return `<button class="chip ${cls}" data-p="${i}" title="${describeMove(flat[i].move)}">${flat[i].move}</button>`;
          })
          .join('');
        return `<div class="seg"><div class="seg-label">${sg.label}</div><div class="chips">${chips}</div></div>`;
      })
      .join('');

    panel.innerHTML = `
      <div class="step-meta"><span class="pill">Etapa ${stageIndex(st.stageId) + 1} · ${stage.name}</span><span>Passo ${cur + 1} de ${steps.length}</span></div>
      <div class="progress"><span style="width:${(pos / flat.length) * 100}%"></span></div>
      <h2 class="step-title">${st.title}</h2>
      <p class="stage-goal">🎯 ${stage.goal}</p>
      <div class="step-desc">${st.description}</div>
      <div class="moves">${segHtml}</div>
      ${stepDone ? '<div class="step-ok">✓ Passo concluído! Vá para o próximo.</div>' : ''}
      <div class="controls">
        <button class="ctl" data-act="prevStep" title="Passo anterior (PageUp)" aria-label="Passo anterior">⏮</button>
        <button class="ctl" data-act="prevMove" title="Desfazer movimento (←)" aria-label="Movimento anterior" ${pos === 0 ? 'disabled' : ''}>◀</button>
        ${
          playing
            ? '<button class="ctl main" data-act="pause" title="Pausar (espaço)" aria-label="Pausar">⏸</button>'
            : `<button class="ctl main" data-act="play" title="Animar o passo (espaço)" aria-label="Animar passo">${stepDone ? '⏭' : '▶'}</button>`
        }
        <button class="ctl" data-act="nextMove" title="Próximo movimento (→)" aria-label="Próximo movimento">▶︎|</button>
        <button class="ctl" data-act="nextStep" title="Próximo passo (PageDown)" aria-label="Próximo passo">⏭</button>
      </div>
      <label class="speed">Velocidade <input type="range" min="0.4" max="2.5" step="0.1" value="${speed}"><span>${speed.toFixed(1)}×</span></label>
      <details class="notation">
        <summary>Como ler os movimentos?</summary>
        <p>Cada letra é uma face. Gire-a olhando <b>de frente para ela</b>:</p>
        <ul>${impl.notationHelp.map((h) => `<li><code>${h.move}</code> ${h.text}</li>`).join('')}</ul>
        <p><code>R</code> = sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = meia volta.</p>
        <p>Letra minúscula (<code>r</code>) = a face <b>e</b> a camada do meio juntas (duas camadas).</p>
      </details>`;

    const on = (act: string, fn: () => void) => panel.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn);
    on('prevStep', prevStep);
    on('prevMove', prevMove);
    on('nextMove', nextMove);
    on('nextStep', nextStep);
    on('play', play);
    on('pause', pause);
    const range = panel.querySelector<HTMLInputElement>('.speed input')!;
    range.addEventListener('input', () => {
      speed = Number(range.value);
      panel.querySelector('.speed span')!.textContent = `${speed.toFixed(1)}×`;
    });
    panel.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) =>
      b.addEventListener('click', async () => {
        // clicar num chip avança/volta até ele
        const target = Number(b.dataset.p);
        if (busy) return;
        while (pos > target && pos > stepStart[cur]) await prevMove();
        while (pos < target) await nextMove();
      }),
    );
  }

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
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') nextMove();
    else if (e.key === 'ArrowLeft') prevMove();
    else if (e.key === 'PageDown') nextStep();
    else if (e.key === 'PageUp') prevStep();
    else if (e.key === ' ') {
      e.preventDefault();
      if (playing) pause();
      else play();
    } else return;
  };
  window.addEventListener('keydown', onKey);

  view.setState(initial);
  if (steps.length) goToStep(0);
  else render();

  return () => {
    playing = false;
    window.removeEventListener('keydown', onKey);
    view.dispose();
  };
}
