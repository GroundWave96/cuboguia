import { getPuzzle, loadPuzzle } from '../core/registry';
import { encodeState, loadMethod, loadState, saveMethod, saveState } from '../core/store';
import { UNKNOWN, type PuzzleImpl, type PuzzleState, type PuzzleView } from '../core/types';
import { CameraScanner } from './scanner';
import { toast } from './toast';

export async function renderInput(app: HTMLElement, puzzleId: string) {
  const def = getPuzzle(puzzleId);
  if (!def?.available) throw new Error('Este puzzle ainda não está disponível.');
  const impl: PuzzleImpl = await loadPuzzle(puzzleId);
  const name = (k: string) => impl.colors.find((c) => c.key === k)?.name ?? k;

  const blank = (): PuzzleState => {
    const solved = impl.solvedState();
    return solved.map((c, i) => (impl.fixedStickers.includes(i) ? c : UNKNOWN));
  };
  let state: PuzzleState = loadState(puzzleId) ?? blank();
  if (state.length !== impl.stickerCount) state = blank();
  let selected = impl.colors[0].key;
  let tab: 'paint' | 'camera' = 'paint';
  let method = loadMethod(impl.methods.map((m) => m.id));
  let scanner: CameraScanner | null = null;

  app.innerHTML = `
  <section class="page workspace">
    <div class="ws-header">
      <a class="back" href="#/">← Início</a>
      <h1>${def.name}: como está o seu cubo?</h1>
      <p>Segure o cubo com o <b>${name('U')}</b> em cima e o <b>${name('F')}</b> de frente. Os centros já vêm pintados — eles nunca mudam de lugar.</p>
    </div>
    <div class="ws-grid">
      <div class="ws-view card">
        <div class="view-host" id="view-host"></div>
        <div class="view-hint">Arraste para girar · clique num adesivo para pintar</div>
        <button class="icon-btn view-reset" title="Voltar à vista inicial" aria-label="Voltar à vista inicial">⟲</button>
      </div>
      <div class="ws-panel card">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="paint">🎨 Pintar</button>
          <button role="tab" data-tab="camera">📷 Câmera</button>
        </div>
        <div class="tab-body"></div>
      </div>
    </div>
  </section>`;

  const view: PuzzleView = impl.createView(app.querySelector('#view-host')!);
  view.setInteractive(true);
  view.setState(state);
  app.querySelector('.view-reset')!.addEventListener('click', () => view.resetCamera());

  const body = app.querySelector<HTMLElement>('.tab-body')!;

  const paint = (i: number) => {
    if (impl.fixedStickers.includes(i)) {
      toast('Os centros são fixos: eles definem a cor de cada face.');
      return;
    }
    state[i] = state[i] === selected ? UNKNOWN : selected;
    commit();
  };
  view.onStickerClick((i) => tab === 'paint' && paint(i));

  function commit() {
    view.setState(state);
    saveState(puzzleId, state);
    if (tab === 'paint') updatePaintUI();
  }

  function counts() {
    const m = new Map<string, number>();
    for (const c of state) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }

  function renderPaint() {
    const net = impl.net;
    const cols = Math.max(...net.map((f) => f.col)) + 1;
    const rows = Math.max(...net.map((f) => f.row)) + 1;
    const n = net[0].grid.length;
    body.innerHTML = `
      <div class="palette" role="radiogroup" aria-label="Cor do pincel">
        ${impl.colors
          .map(
            (c, i) => `<button class="swatch" role="radio" data-color="${c.key}" title="${c.name} (tecla ${i + 1})">
              <i style="background:${c.hex}"></i><span>${c.name}</span><small data-count="${c.key}"></small></button>`,
          )
          .join('')}
      </div>
      <div class="net" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},auto)">
        ${net
          .map(
            (f) => `<div class="net-face" style="grid-column:${f.col + 1};grid-row:${f.row + 1};grid-template-columns:repeat(${n},1fr)" title="${f.label}">
              ${f.grid.flat().map((i) => `<button class="st ${impl.fixedStickers.includes(i) ? 'fixed' : ''}" data-i="${i}" aria-label="${f.label}"></button>`).join('')}
            </div>`,
          )
          .join('')}
      </div>
      <div class="row-actions">
        <button class="btn ghost sm" data-act="clear">Limpar</button>
        <button class="btn ghost sm" data-act="solved">Cubo resolvido</button>
        <button class="btn ghost sm" data-act="random">Exemplo embaralhado</button>
      </div>
      <div class="errors" aria-live="polite"></div>
      <fieldset class="methods">
        <legend>Como você quer aprender?</legend>
        ${impl.methods
          .map(
            (m) => `<label class="method ${m.id === method ? 'sel' : ''}">
              <input type="radio" name="method" value="${m.id}" ${m.id === method ? 'checked' : ''}>
              <span class="m-name">${m.name}</span>
              <span class="m-tag">${m.tagline}</span>
              <span class="m-desc">${m.description}</span>
            </label>`,
          )
          .join('')}
      </fieldset>
      <button class="btn primary big full" data-act="solve">Ver a solução →</button>`;

    body.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) =>
      b.addEventListener('click', () => {
        selected = b.dataset.color!;
        updatePaintUI();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('.st').forEach((b) => b.addEventListener('click', () => paint(Number(b.dataset.i))));
    body.querySelector('[data-act="clear"]')!.addEventListener('click', () => {
      state = blank();
      commit();
    });
    body.querySelector('[data-act="solved"]')!.addEventListener('click', () => {
      state = impl.solvedState();
      commit();
    });
    body.querySelector('[data-act="random"]')!.addEventListener('click', () => {
      state = impl.scramble().reduce((s, m) => impl.applyMove(s, m), impl.solvedState());
      commit();
    });
    body.querySelector('[data-act="solve"]')!.addEventListener('click', goSolve);
    body.querySelectorAll<HTMLInputElement>('input[name="method"]').forEach((r) =>
      r.addEventListener('change', () => {
        method = r.value;
        saveMethod(method);
        body.querySelectorAll('.method').forEach((l) => l.classList.toggle('sel', l.contains(r)));
      }),
    );
    updatePaintUI();
  }

  function updatePaintUI() {
    const hex = (k: string) => impl.colors.find((c) => c.key === k)?.hex;
    const cnt = counts();
    const per = impl.stickerCount / impl.colors.length;
    body.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => {
      const k = b.dataset.color!;
      b.classList.toggle('sel', k === selected);
      b.setAttribute('aria-checked', String(k === selected));
      const n = cnt.get(k) ?? 0;
      const el = b.querySelector('small')!;
      el.textContent = `${n}/${per}`;
      el.className = n > per ? 'over' : n === per ? 'full' : '';
    });
    body.querySelectorAll<HTMLButtonElement>('.st').forEach((b) => {
      const c = state[Number(b.dataset.i)];
      b.style.background = hex(c) ?? '';
      b.classList.toggle('unknown', c === UNKNOWN);
    });
    const errBox = body.querySelector('.errors');
    if (errBox) errBox.innerHTML = '';
  }

  function goSolve() {
    const res = impl.validate(state);
    const errBox = body.querySelector('.errors');
    if (!res.ok) {
      if (errBox) errBox.innerHTML = `<div class="alert">${res.errors.map((e) => `<p>⚠️ ${e}</p>`).join('')}</div>`;
      return;
    }
    saveState(puzzleId, state);
    location.hash = `/p/${puzzleId}/solve?m=${method}&s=${encodeState(state)}`;
  }

  function renderCamera() {
    body.innerHTML = '';
    scanner = new CameraScanner(body, impl, (scanned) => {
      state = scanned;
      scanner = null;
      setTab('paint');
      commit();
      toast('Cores lidas! Confira no cubo e corrija o que estiver errado.', 5000);
    }, (stickers) => {
      view.setHighlight(stickers);
      view.focusCamera?.(stickers);
    });
  }

  function setTab(t: typeof tab) {
    tab = t;
    scanner?.dispose();
    scanner = null;
    app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === t);
      b.setAttribute('aria-selected', String(b.dataset.tab === t));
    });
    view.setInteractive(t === 'paint');
    if (t === 'paint') {
      view.setHighlight([]);
      view.resetCamera();
      renderPaint();
    }
    else renderCamera();
  }
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab as typeof tab)));

  const onKey = (e: KeyboardEvent) => {
    if (tab !== 'paint') return;
    const k = Number(e.key);
    if (k >= 1 && k <= impl.colors.length) {
      selected = impl.colors[k - 1].key;
      updatePaintUI();
    }
  };
  window.addEventListener('keydown', onKey);

  setTab('paint');

  return () => {
    window.removeEventListener('keydown', onKey);
    scanner?.dispose();
    view.dispose();
  };
}
