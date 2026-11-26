import { tr } from '../core/i18n';
import { getPuzzle, loadPuzzle } from '../core/registry';
import { encodeState, loadMethod, loadState, saveMethod, saveState } from '../core/store';
import { homePath, navigate, solvePath } from '../core/router';
import { UNKNOWN, type PuzzleImpl, type PuzzleState, type PuzzleView } from '../core/types';
import { CameraScanner, faceLabel, faceThumb } from './scanner';
import { dropSession, getSession, isActive, isComplete, peekSession, recordEdit, sampleCode, toReadPositions } from './scansession';
import { toast } from './toast';
import { icon } from './icons';

/** luz do ambiente nas amostras de treino (mesmos nomes das fotos marcadas à mão) */
const LIGHTS = () => [
  ['claro', tr('Clara', 'Bright', 'Clara')],
  ['medio', tr('Média', 'Medium', 'Media')],
  ['escuro', tr('Escura', 'Dark', 'Oscura')],
];

export async function renderInput(app: HTMLElement, puzzleId: string, params = new URLSearchParams()) {
  const def = getPuzzle(puzzleId);
  if (!def?.available) throw new Error(tr('Este puzzle ainda não está disponível.', 'This puzzle isn’t available yet.', 'Este puzzle todavía no está disponible.'));
  const impl: PuzzleImpl = await loadPuzzle(puzzleId);

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
  const debug = params.has('debug');
  let light = 'claro';

  // uma leitura completa só continua valendo se o editor ainda mostra o que ela montou
  {
    const s = peekSession(puzzleId);
    if (s && isComplete(s) && !isActive(s, state)) dropSession(puzzleId);
  }
  /** o editor mudou por outro caminho (limpar, exemplo...): a leitura da câmera não vale mais */
  const forgetScan = () => dropSession(puzzleId);

  app.innerHTML = `
  <section class="page workspace">
    <div class="ws-header">
      <a class="back" href="${homePath()}">← ${tr('Início', 'Home', 'Inicio')}</a>
      <h1>${tr(`Como está o seu ${def.name}?`, `What does your ${def.name} look like?`, `¿Cómo está tu ${def.name}?`)}</h1>
      <p>${impl.holdHint}${impl.fixedStickers.length ? tr(' As peças de referência já vêm pintadas — elas nunca mudam de lugar.', ' The reference pieces come already painted — they never move.', ' Las piezas de referencia ya vienen pintadas: nunca cambian de lugar.') : ''}</p>
    </div>
    <div class="ws-grid">
      <div class="ws-view card">
        <div class="view-host" id="view-host"></div>
        <div class="view-hint">${matchMedia('(pointer: coarse)').matches ? tr('Arraste para girar · toque num adesivo para pintar', 'Drag to rotate · tap a sticker to paint', 'Arrastra para girar · toca una pegatina para pintar') : tr('Arraste para girar · clique num adesivo para pintar', 'Drag to rotate · click a sticker to paint', 'Arrastra para girar · haz clic en una pegatina para pintar')}</div>
        <button class="icon-btn view-reset" title="${tr('Voltar à vista inicial', 'Reset the view', 'Volver a la vista inicial')}" aria-label="${tr('Voltar à vista inicial', 'Reset the view', 'Volver a la vista inicial')}">${icon('resetView')}</button>
      </div>
      <div class="ws-panel card">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="paint">${icon('palette')}${tr('Pintar', 'Paint', 'Pintar')}</button>
          <button role="tab" data-tab="camera">${icon('camera')}${tr('Câmera', 'Camera', 'Cámara')}</button>
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
      toast(tr('Esta peça é a referência: ela define a cor de cada face e já vem pintada.', 'This piece is the reference: it defines the color of each face and comes already painted.', 'Esta pieza es la referencia: define el color de cada cara y ya viene pintada.'));
      return;
    }
    const scan = peekSession(puzzleId);
    const fromScan = isActive(scan, state);
    state[i] = state[i] === selected ? UNKNOWN : selected;
    if (fromScan) {
      // guarda a correção: se uma face for escaneada de novo, as correções nas outras continuam
      recordEdit(scan, i, state[i]);
      scan.result = [...state];
    }
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
    const netHtml = impl.netSvg
      ? `<svg class="net-svg" viewBox="${impl.netSvg.viewBox}" role="group" aria-label="${tr('Planificação', 'Flat layout', 'Plano')}">
          ${impl.netSvg.decor ? `<g aria-hidden="true" pointer-events="none">${impl.netSvg.decor}</g>` : ''}
          ${impl.netSvg.stickers
            .map((s) => `<polygon class="st ${impl.fixedStickers.includes(s.index) ? 'fixed' : ''}" data-i="${s.index}" points="${s.points}"/>`)
            .join('')}
        </svg>`
      : (() => {
          const cols = Math.max(...net.map((f) => f.col)) + 1;
          const rows = Math.max(...net.map((f) => f.row)) + 1;
          const n = net[0].grid.length;
          return `<div class="net" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},auto)">
            ${net
              .map(
                (f) => `<div class="net-face" style="grid-column:${f.col + 1};grid-row:${f.row + 1};grid-template-columns:repeat(${n},1fr)" title="${f.label}">
                  ${f.grid.flat().map((i) => `<button class="st ${impl.fixedStickers.includes(i) ? 'fixed' : ''}" data-i="${i}" aria-label="${f.label}"></button>`).join('')}
                </div>`,
              )
              .join('')}
          </div>`;
        })();
    body.innerHTML = `
      <div class="scan-card-host"></div>
      <div class="palette" role="radiogroup" aria-label="${tr('Cor do pincel', 'Brush color', 'Color del pincel')}">
        ${impl.colors
          .map(
            (c, i) => `<button class="swatch" role="radio" data-color="${c.key}" title="${c.name} (${tr('tecla', 'key', 'tecla')} ${i + 1})">
              <i style="background:${c.hex}"></i><span>${c.name}</span><small data-count="${c.key}"></small></button>`,
          )
          .join('')}
      </div>
      ${netHtml}
      <div class="row-actions">
        <button class="btn ghost sm" data-act="clear">${tr('Limpar', 'Clear', 'Borrar')}</button>
        <button class="btn ghost sm" data-act="solved">${tr('Resolvido', 'Solved', 'Resuelto')}</button>
        <button class="btn ghost sm" data-act="random">${tr('Exemplo embaralhado', 'Scrambled example', 'Ejemplo mezclado')}</button>
      </div>
      <div class="errors" aria-live="polite"></div>
      <fieldset class="methods" ${impl.methods.length < 2 ? 'hidden' : ''}>
        <legend>${tr('Como você quer aprender?', 'How do you want to learn?', '¿Cómo quieres aprender?')}</legend>
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
      <button class="btn primary big full" data-act="solve">${tr('Ver a solução', 'See the solution', 'Ver la solución')} →</button>`;

    body.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) =>
      b.addEventListener('click', () => {
        selected = b.dataset.color!;
        updatePaintUI();
      }),
    );
    body.querySelectorAll<HTMLElement>('.st').forEach((b) => b.addEventListener('click', () => paint(Number(b.dataset.i))));
    body.querySelector('[data-act="clear"]')!.addEventListener('click', () => {
      forgetScan();
      state = blank();
      commit();
    });
    body.querySelector('[data-act="solved"]')!.addEventListener('click', () => {
      forgetScan();
      state = impl.solvedState();
      commit();
    });
    body.querySelector('[data-act="random"]')!.addEventListener('click', () => {
      forgetScan();
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
    body.querySelectorAll<HTMLElement>('.st').forEach((b) => {
      const c = state[Number(b.dataset.i)];
      if (b instanceof SVGElement) b.style.fill = hex(c) ?? '';
      else b.style.background = hex(c) ?? '';
      b.classList.toggle('unknown', c === UNKNOWN);
    });
    const errBox = body.querySelector('.errors');
    if (errBox) errBox.innerHTML = '';
    updateScanCard();
  }

  // ---- cartão "Leitura da câmera": refazer uma face depois de já ter lido todas
  function updateScanCard() {
    const host = body.querySelector<HTMLElement>('.scan-card-host');
    if (!host) return;
    const scan = peekSession(puzzleId);
    if (!isActive(scan, state)) {
      host.innerHTML = '';
      return;
    }
    if (!host.firstElementChild) {
      host.innerHTML = `
        <div class="scan-card">
          <div class="scan-card-head">${icon('camera')}<div><b>${tr('Leitura da câmera', 'Camera reading', 'Lectura de la cámara')}</b><small>${tr('Alguma face errada? Toque nela para escanear só ela de novo.', 'A face came out wrong? Tap it to scan just that face again.', '¿Alguna cara salió mal? Tócala para escanear solo esa cara otra vez.')}</small></div></div>
          <div class="scan-thumbs ${impl.scan.length > 6 ? 'many' : ''}"></div>
          ${
            debug
              ? `<details class="debug-sample">
                  <summary>${tr('Amostra para treino', 'Training sample', 'Muestra para entrenamiento')} <small>debug</small></summary>
                  <p>${tr('Corrija antes as cores erradas pintando: o código usa as cores de agora como as certas.', 'First fix the wrong colors by painting: the code takes the current colors as the right ones.', 'Primero corrige los colores equivocados pintando: el código toma los colores actuales como los correctos.')}</p>
                  <label class="dbg-light">${tr('Luz do ambiente', 'Room lighting', 'Luz del ambiente')}
                    <select>${LIGHTS().map(([v, t]) => `<option value="${v}" ${v === light ? 'selected' : ''}>${t}</option>`).join('')}</select>
                  </label>
                  <textarea readonly rows="4" spellcheck="false" aria-label="${tr('Código da amostra', 'Sample code', 'Código de la muestra')}"></textarea>
                  <div class="row-actions">
                    <button class="btn primary sm" data-dbg="copy">${tr('Copiar código', 'Copy code', 'Copiar código')}</button>
                    <button class="btn ghost sm" data-dbg="download">${tr('Baixar .txt', 'Download .txt', 'Descargar .txt')}</button>
                  </div>
                </details>`
              : ''
          }
        </div>`;
      host.onclick = onScanCardClick;
      host.querySelector('select')?.addEventListener('change', (e) => {
        light = (e.target as HTMLSelectElement).value;
        updateSample();
      });
      host.querySelector('details')?.addEventListener('toggle', updateSample);
    }
    const read = toReadPositions(state, scan.order!);
    host.querySelector('.scan-thumbs')!.innerHTML = impl.scan
      .map(
        (f, i) => `<button class="thumb" data-rescan="${i}" title="${tr('Escanear de novo', 'Scan again', 'Escanear otra vez')}: ${f.title}" aria-label="${tr('Escanear de novo', 'Scan again', 'Escanear otra vez')}: ${f.title}">
          ${faceThumb(impl, i, f.grid.flat().map((idx) => read[idx]))}<span>${faceLabel(impl, i)}</span></button>`,
      )
      .join('');
    updateSample();
  }

  const currentSample = () => {
    const scan = peekSession(puzzleId);
    return isActive(scan, state) ? sampleCode(impl, puzzleId, scan, state, light) : '';
  };

  function updateSample() {
    const box = body.querySelector<HTMLTextAreaElement>('.debug-sample textarea');
    if (box && box.closest('details')!.open) box.value = currentSample();
  }

  async function onScanCardClick(e: Event) {
    const t = e.target as HTMLElement;
    const face = t.closest<HTMLElement>('[data-rescan]')?.dataset.rescan;
    if (face !== undefined) return setTab('camera', Number(face));
    const act = t.closest<HTMLElement>('[data-dbg]')?.dataset.dbg;
    const code = act ? currentSample() : '';
    if (!code) return;
    if (act === 'copy') {
      const box = body.querySelector<HTMLTextAreaElement>('.debug-sample textarea')!;
      box.value = code;
      let ok = false;
      try {
        await navigator.clipboard.writeText(code);
        ok = true;
      } catch {
        // sem acesso à área de transferência: seleciona o texto e tenta o jeito antigo
        box.select();
        ok = document.execCommand('copy');
      }
      toast(ok ? tr('Código copiado! Cole no chat para usar no treino da câmera.', 'Code copied! Paste it in the chat to use it for camera training.', '¡Código copiado! Pégalo en el chat para usarlo en el entrenamiento de la cámara.') : tr('Não deu para copiar sozinho — o código está selecionado, copie na mão.', 'Couldn’t copy automatically — the code is selected, copy it by hand.', 'No se pudo copiar automáticamente: el código está seleccionado, cópialo a mano.'));
    } else if (act === 'download') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' }));
      a.download = `amostra-${puzzleId}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  }

  function goSolve() {
    // segurou o puzzle em outra posição? gira o desenho para a posição de referência
    const turned = impl.normalize?.(state);
    if (turned && turned.join() !== state.join()) {
      state = turned;
      commit();
      toast(tr('Seu puzzle estava em outra posição — giramos o desenho para a posição de referência. No tutorial, segure igual ao desenho 3D.', 'Your puzzle was held in another position — we rotated the drawing to the reference position. In the tutorial, hold it like the 3D drawing.', 'Tu puzzle estaba sujeto en otra posición: giramos el dibujo a la posición de referencia. En el tutorial, sujétalo como en el dibujo 3D.'), 7000);
    }
    const res = impl.validate(state);
    const errBox = body.querySelector('.errors');
    if (!res.ok) {
      if (errBox) errBox.innerHTML = `<div class="alert">${res.errors.map((e) => `<p>${icon('warning')}<span>${e}</span></p>`).join('')}</div>`;
      return;
    }
    saveState(puzzleId, state);
    navigate(solvePath(puzzleId, method, encodeState(state, impl.colors.map((c) => c.key))));
  }

  function renderCamera(startFace?: number) {
    body.innerHTML = '';
    scanner = new CameraScanner(body, impl, getSession(puzzleId, impl), {
      startFace,
      onDone: (scanned) => {
        state = scanned;
        scanner = null;
        setTab('paint');
        commit();
        toast(tr('Cores lidas! Se algo estiver errado, pinte por cima ou refaça só a face.', 'Colors read! If something is wrong, paint over it or redo just that face.', '¡Colores leídos! Si algo está mal, píntalo encima o vuelve a hacer solo esa cara.'), 5000);
      },
      onFace: (stickers) => {
        view.setHighlight(stickers);
        view.focusCamera?.(stickers);
      },
      // na revisão, o 3D mostra o puzzle montado com a leitura
      onPreview: (preview) => {
        view.setHighlight([]);
        view.setState(preview);
        view.resetCamera();
      },
    });
  }

  function setTab(t: typeof tab, startFace?: number) {
    tab = t;
    scanner?.dispose();
    scanner = null;
    app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === t);
      b.setAttribute('aria-selected', String(b.dataset.tab === t));
    });
    view.setInteractive(t === 'paint');
    app.querySelector('.workspace')?.classList.toggle('scanning', t === 'camera');
    if (t === 'camera' && matchMedia('(max-width: 900px)').matches) window.scrollTo(0, 0);
    if (t === 'paint') {
      view.setState(state); // a revisão da câmera pode ter mostrado outra montagem
      view.setHighlight([]);
      view.resetCamera();
      renderPaint();
    } else renderCamera(startFace);
  }
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab as typeof tab)));

  const onKey = (e: KeyboardEvent) => {
    if (tab !== 'paint') return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') return;
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
