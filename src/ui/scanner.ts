import { tr } from '../core/i18n';
import type { PuzzleImpl } from '../core/types';
import { scanShortName } from '../puzzles/nxn/layout';
import { rgbToHsv, type RGB } from '../core/color';
import { cellNeighbors, isFlat, puzzleInView } from '../core/scanpresence';
import { icon } from './icons';
import { clearFaceEdits, compose, isComplete, resetSession, type ScanSession } from './scansession';
import { apply, poseMatrix, turnDuration, turnMatrix, turnSteps, type M3, type Pose, type TurnStep, type V3 } from './scanturn';

/** Fração do menor lado do vídeo ocupada pela grade (o CSS do rótulo "em cima" usa o mesmo valor). */
const GRID_FRACTION = 0.66;

/** captura automática: cores paradas por STABLE_MS, depois contagem de COUNT_MS */
const STABLE_MS = 500;
const COUNT_MS = 1500;
/** giro entre as faces: some as faixas, o cubinho gira, as faixas voltam (ms) */
const TURN_FADE_OUT = 240;
const TURN_FADE_IN = 380;
/** distância da câmera virtual (em meias-faces): perspectiva suave */
const TURN_CAM = 6;
const BODY_HEX = '#11141c';
const AUTO_KEY = 'cuboguia.autoCapture';
function loadAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}
function saveAuto(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    /* sem armazenamento: só não lembra a escolha */
  }
}

type Pt = [number, number];
interface Cell {
  poly: Pt[];
  center: Pt;
  /** tamanho da área amostrada (fração do quadro) */
  r: number;
}

/** envoltória convexa (contorno da face para escurecer o resto da imagem) */
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** miniatura de uma face: `colors[k]` = cor (chave) da célula k, ou null se ainda não foi lida */
export function faceThumb(impl: PuzzleImpl, i: number, colors: (string | null | undefined)[]): string {
  const s = impl.scan[i];
  const hex = (k: string | null | undefined) => (k ? impl.colors.find((c) => c.key === k)?.hex : undefined);
  if (s.cells)
    return `<svg class="mini-svg" viewBox="0.12 0.14 0.76 0.76">${s.cells
      .map((c, k) => `<polygon points="${c.poly.map((p) => p.join(',')).join(' ')}" fill="${hex(colors[k]) ?? '#1b2030'}"/>`)
      .join('')}</svg>`;
  const n = s.grid.length;
  return `<div class="mini" style="grid-template-columns:repeat(${n},1fr)">${Array.from(
    { length: n * n },
    (_, k) => `<i style="background:${hex(colors[k]) ?? 'transparent'}"></i>`,
  ).join('')}</div>`;
}

/** rótulo curto de uma face (bolinha com a cor do centro, ou o nome) */
export function faceLabel(impl: PuzzleImpl, i: number): string {
  const s = impl.scan[i];
  const hex = impl.colors.find((c) => c.key === s.faceColor)?.hex;
  return s.faceColor && hex ? `<i class="dot" style="background:${hex}"></i>` : `<small>${scanShortName(s.face)}</small>`;
}

export interface ScannerOptions {
  /** leitura confirmada pelo usuário (a sessão já guarda o resultado e a ordem) */
  onDone: (state: string[]) => void;
  /** adesivos da face mostrada agora (para destacar no 3D) */
  onFace?: (stickers: number[]) => void;
  /** puzzle montado com a leitura, mostrado na revisão */
  onPreview?: (state: string[]) => void;
  /** abre direto nesta face (escanear de novo só ela) */
  startFace?: number;
}

export class CameraScanner {
  readonly root: HTMLElement;
  private video!: HTMLVideoElement;
  private overlay!: HTMLCanvasElement;
  private work = document.createElement('canvas');
  private stream: MediaStream | null = null;
  private devices: MediaDeviceInfo[] = [];
  private deviceIdx = -1;
  private current = 0;
  /** 'review': todas as faces lidas, o usuário confere antes de usar */
  private mode: 'scan' | 'review' = 'scan';
  private review: ReturnType<typeof compose> | null = null;
  private get captured() {
    return this.session.captured;
  }
  private live: RGB[] = [];
  /** últimos quadros, para capturar a mediana (menos borrão/ruído) */
  private history: RGB[][] = [];
  private debug = new URLSearchParams(location.search).has('debug');
  private lastWarn = '';
  /** adesivo → [face capturada, posição na grade] */
  private where = new Map<number, [number, number]>();

  /** cor já capturada de um adesivo (se a face dele já foi lida) */
  private capturedKey(sticker: number): string | null {
    const w = this.where.get(sticker);
    const rgb = w ? this.captured[w[0]]?.[w[1]] : undefined;
    return rgb ? this.classify(rgb) : null;
  }
  private timer = 0;
  private running = false;

  // ---- captura automática
  private auto = loadAuto();
  /** cores (por maioria nos últimos quadros) e desde quando estão iguais */
  private sigKey = '';
  private stableSince = 0;
  /** início da contagem (0 = sem contagem) */
  private countStart = 0;
  /** depois de capturar, só volta a contar quando a imagem mudar (o cubo foi girado) */
  private armed = true;
  private lastSig: string[] | null = null;
  private autoMsg = '';
  /** tem um puzzle na grade? (últimos quadros) — sem puzzle, não conta */
  private presence: boolean[] = [];
  private pairsCache = new Map<number, [number, number][]>();

  // ---- giro animado entre uma face e a próxima (o "cubinho")
  private turn: { from: number; to: number; steps: TurnStep[]; start: number } | null = null;
  private turnRaf = 0;

  constructor(
    container: HTMLElement,
    private impl: PuzzleImpl,
    private session: ScanSession,
    private opts: ScannerOptions,
  ) {
    impl.scan.forEach((f, fi) => f.grid.flat().forEach((st, k) => this.where.set(st, [fi, k])));
    this.root = document.createElement('div');
    this.root.className = 'scanner';
    container.appendChild(this.root);
    if (opts.startFace !== undefined) this.current = opts.startFace;
    else if (isComplete(session)) {
      this.showReview();
      return;
    } else this.current = Math.max(0, session.captured.findIndex((c) => !c));
    this.render();
  }

  /** células da face atual, em coordenadas 0..1 do quadro quadrado */
  private cellsOf(i = this.current): Cell[] {
    const face = this.impl.scan[i];
    if (face.cells) return face.cells.map((c) => ({ poly: c.poly, center: c.center, r: 0.022 }));
    const n = face.grid.length;
    const x0 = (1 - GRID_FRACTION) / 2;
    const cs = GRID_FRACTION / n;
    const out: Cell[] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const x = x0 + c * cs, y = x0 + r * cs, e = cs * 0.06;
        out.push({ poly: [[x + e, y + e], [x + cs - e, y + e], [x + cs - e, y + cs - e], [x + e, y + cs - e]], center: [x + cs / 2, y + cs / 2], r: cs * 0.2 });
      }
    return out;
  }

  private hex(key: string) {
    return this.impl.colors.find((c) => c.key === key)!.hex;
  }

  /** cores aprendidas com os centros capturados (se adapta à luz e ao puzzle) */
  private get model() {
    return this.session.model;
  }
  /** pixels espalhados pelos adesivos de cor conhecida (centro), para aceitar logo */
  private fixedPixels = new Map<number, RGB[]>();

  private classify(rgb: RGB): string {
    return this.model.classify(rgb);
  }

  /** a célula de cor conhecida mostra essa cor? (centro com logo também vale) */
  private fixedOk(cell: number, color: string, rgb = this.live[cell]): boolean {
    return !!rgb && this.model.centerMatches(rgb, this.fixedPixels.get(cell), color);
  }

  private render() {
    if (this.mode === 'review') return this.renderReview();
    this.root.classList.remove('reviewing');
    const face = this.impl.scan[this.current];
    const done = this.captured.filter(Boolean).length;
    this.opts.onFace?.(face.grid.flat());
    const upHex = face.upColor ? this.hex(face.upColor) : 'var(--accent-2)';
    this.lastWarn = ''; // o aviso é recriado junto com o HTML
    this.autoMsg = '';
    this.root.innerHTML = `
      <div class="scan-head">
        ${isComplete(this.session) ? `<button class="btn ghost sm back-review" data-act="review">← ${tr('Voltar à revisão', 'Back to review', 'Volver al resumen')}</button>` : ''}
        <div class="scan-progress"><span style="width:${(done / this.captured.length) * 100}%"></span></div>
        <div class="scan-title">
          <span class="scan-step">${this.current + 1}/${this.impl.scan.length}</span>
          <h3>${face.faceColor ? `<i class="dot" style="background:${this.hex(face.faceColor)}"></i>` : ''}${face.title}</h3>
          <span class="scan-up-hint">${face.hint}</span>
        </div>
      </div>
      <div class="scan-stage">
        <div class="video-wrap ${this.running ? '' : 'off'}"><video playsinline muted autoplay></video><canvas class="overlay"></canvas></div>
        <div class="up-label ${this.running ? '' : 'hidden'}" style="--up:${upHex}">
          <span class="arrow">${face.arrow ?? '▲'}</span>${face.upLabel}
        </div>
        <button class="turn-replay ${this.running && this.canReplay() ? '' : 'hidden'}" data-act="replay" title="${tr('Mostrar de novo como girar o puzzle até esta face', 'Show again how to turn the puzzle to this face', 'Mostrar otra vez cómo girar el puzzle hasta esta cara')}">${icon('resetView')}<span>${tr('Ver o giro', 'Show the turn', 'Ver el giro')}</span></button>
        <div class="scan-warn" aria-live="polite"></div>
        <div class="scan-auto ${this.running && this.auto ? '' : 'hidden'}"></div>
        <div class="scan-placeholder ${this.running ? 'hidden' : ''}">
          <div class="cam-icon">${icon('camera')}</div>
          <p>${this.impl.scanHint ?? `${this.impl.holdHint} ${tr('Em cada face, as marcas ao redor da grade mostram como segurar o cubo.', 'On each face, the marks around the grid show how to hold the cube.', 'En cada cara, las marcas alrededor de la cuadrícula muestran cómo sujetar el cubo.')}`}${this.auto ? tr(' Com a captura automática ligada, é só segurar cada face parada por 2 segundos.', ' With auto capture on, just hold each face still for 2 seconds.', ' Con la captura automática activada, solo mantén cada cara quieta 2 segundos.') : ''}</p>
          <button class="btn primary" data-act="start">${tr('Ativar câmera', 'Turn on camera', 'Encender la cámara')}</button>
          <p class="scan-info"></p>
          <p class="scan-error"></p>
        </div>
      </div>
      <div class="scan-actions">
        <button class="btn ghost icon-only" data-act="switch" title="${tr('Trocar câmera', 'Switch camera', 'Cambiar de cámara')}" aria-label="${tr('Trocar câmera', 'Switch camera', 'Cambiar de cámara')}" ${this.running ? '' : 'disabled'}>${icon('switchCamera')}</button>
        <button class="btn ghost auto-btn ${this.auto ? 'on' : ''}" data-act="auto" aria-pressed="${this.auto}" title="${tr('Capturar sozinho quando as cores ficarem paradas', 'Capture automatically when the colors hold still', 'Capturar automáticamente cuando los colores se queden quietos')}"><span class="sw" aria-hidden="true"></span>Auto</button>
        <button class="btn primary big" data-act="capture" ${this.running ? '' : 'disabled'}>${this.auto && this.running ? tr('Capturar agora', 'Capture now', 'Capturar ahora') : tr(`Capturar ${face.title.toLowerCase()}`, `Capture ${face.title.toLowerCase()}`, `Capturar ${face.title.toLowerCase()}`)}</button>
      </div>
      <div class="scan-thumbs ${this.impl.scan.length > 6 ? 'many' : ''}">
        ${this.impl.scan
          .map(
            (s, i) => `<button class="thumb ${i === this.current ? 'active' : ''} ${this.captured[i] ? 'ok' : ''}" data-face="${i}" title="${s.title}">
              ${faceThumb(
                this.impl,
                i,
                s.grid.flat().map((_, k) => {
                  const rgb = this.captured[i]?.[k];
                  return rgb ? s.fixedCells.find((f) => f.cell === k)?.color ?? this.classify(rgb) : null;
                }),
              )}
              <span>${faceLabel(this.impl, i)}</span>
            </button>`,
          )
          .join('')}
      </div>`;
    this.video = this.root.querySelector('video')!;
    this.overlay = this.root.querySelector('canvas')!;
    if (this.stream) {
      this.video.srcObject = this.stream;
      this.video.play().catch(() => {});
      this.applyMirror();
    }
    this.root.querySelector('[data-act="start"]')?.addEventListener('click', () => this.start());
    this.root.querySelector('[data-act="capture"]')?.addEventListener('click', () => this.capture());
    this.root.querySelector('[data-act="replay"]')?.addEventListener('click', () => this.startTurn(this.current - 1, this.current));
    this.root.querySelector('[data-act="switch"]')?.addEventListener('click', () => this.switchCamera());
    this.root.querySelector('[data-act="review"]')?.addEventListener('click', () => this.showReview());
    this.root.querySelector('[data-act="auto"]')?.addEventListener('click', () => {
      this.auto = !this.auto;
      saveAuto(this.auto);
      this.countStart = 0;
      this.armed = true;
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-face]').forEach((b) =>
      b.addEventListener('click', () => {
        this.current = Number(b.dataset.face);
        this.stopTurn();
        // escolheu a face na mão: pode capturar sozinho de novo
        this.armed = true;
        this.countStart = 0;
        this.render();
      }),
    );
  }

  private showError(msg: string) {
    const el = this.root.querySelector('.scan-error');
    if (el) el.innerHTML = msg;
  }

  async start(deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.showError(tr('Este navegador não liberou a câmera. Ela só funciona em sites com <b>HTTPS</b> (ou localhost).', 'This browser didn’t allow the camera. It only works on <b>HTTPS</b> sites (or localhost).', 'Este navegador no permitió la cámara. Solo funciona en sitios <b>HTTPS</b> (o localhost).'));
      return;
    }
    const btn = this.root.querySelector<HTMLButtonElement>('[data-act="start"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = tr('Aguardando a câmera…', 'Waiting for the camera…', 'Esperando la cámara…');
    }
    this.showError('');
    this.setInfo(tr('Se o navegador perguntar, clique em <b>Permitir</b> para usar a câmera.', 'If your browser asks, click <b>Allow</b> to use the camera.', 'Si el navegador lo pide, haz clic en <b>Permitir</b> para usar la cámara.'));
    // alguns navegadores embutidos nunca respondem ao pedido de câmera
    const slow = window.setTimeout(
      () =>
        this.setInfo(
          tr(
            'A câmera não respondeu. Verifique se apareceu um pedido de permissão na barra de endereço. Navegadores embutidos em aplicativos costumam bloquear a câmera — abra o site no <b>Chrome</b>, <b>Edge</b> ou <b>Safari</b>.',
            'The camera didn’t respond. Check for a permission request in the address bar. Browsers built into other apps often block the camera — open the site in <b>Chrome</b>, <b>Edge</b> or <b>Safari</b>.', 'La cámara no respondió. Mira si hay una petición de permiso en la barra de direcciones. Los navegadores integrados en otras apps suelen bloquear la cámara: abre la web en <b>Chrome</b>, <b>Edge</b> o <b>Safari</b>.',
          ),
        ),
      6000,
    );
    try {
      this.stopStream();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      this.devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const id = this.stream.getVideoTracks()[0]?.getSettings().deviceId;
      this.deviceIdx = Math.max(0, this.devices.findIndex((d) => d.deviceId === id));
      this.running = true;
      this.render();
      this.loop();
    } catch (e) {
      const name = (e as DOMException).name;
      this.setInfo('');
      this.showError(
        name === 'NotAllowedError'
          ? tr(
              'A câmera foi bloqueada. Clique no ícone de cadeado/câmera na barra de endereço, permita a câmera e tente de novo. Se você está num navegador embutido em outro aplicativo, abra o site no Chrome, Edge ou Safari.',
              'The camera was blocked. Click the lock/camera icon in the address bar, allow the camera and try again. If you’re in a browser built into another app, open the site in Chrome, Edge or Safari.', 'La cámara está bloqueada. Haz clic en el icono del candado o de la cámara en la barra de direcciones, permite la cámara y vuelve a intentarlo. Si estás en un navegador integrado en otra app, abre la web en Chrome, Edge o Safari.',
            )
          : name === 'NotFoundError'
            ? tr('Nenhuma câmera encontrada neste dispositivo.', 'No camera found on this device.', 'No se encontró ninguna cámara en este dispositivo.')
            : name === 'NotReadableError'
              ? tr('A câmera está sendo usada por outro programa (Zoom, Teams, OBS…). Feche-o e tente de novo.', 'The camera is being used by another program (Zoom, Teams, OBS…). Close it and try again.', 'La cámara está siendo usada por otro programa (Zoom, Teams, OBS…). Ciérralo y vuelve a intentarlo.')
              : tr(`Não foi possível abrir a câmera (${name}).`, `Couldn’t open the camera (${name}).`, `No se pudo abrir la cámara (${name}).`),
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = tr('Tentar de novo', 'Try again', 'Intentar de nuevo');
      }
    } finally {
      clearTimeout(slow);
    }
  }

  private setInfo(msg: string) {
    const el = this.root.querySelector('.scan-info');
    if (el) el.innerHTML = msg;
  }

  private applyMirror() {
    const s = this.stream?.getVideoTracks()[0]?.getSettings();
    const touch = matchMedia('(pointer: coarse)').matches;
    const mirror = s?.facingMode ? s.facingMode === 'user' : !touch;
    this.root.querySelector('.video-wrap')?.classList.toggle('mirrored', mirror);
  }

  private async switchCamera() {
    if (this.devices.length < 2) return;
    this.deviceIdx = (this.deviceIdx + 1) % this.devices.length;
    await this.start(this.devices[this.deviceIdx].deviceId);
  }

  private loop() {
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.sample(), 90);
  }

  private gridRect(vw: number, vh: number) {
    const side = Math.min(vw, vh) * GRID_FRACTION;
    return { x: (vw - side) / 2, y: (vh - side) / 2, side };
  }

  private sample() {
    const v = this.video;
    if (!v || !v.videoWidth) return;
    const scale = 360 / Math.max(v.videoWidth, v.videoHeight);
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    if (this.work.width !== w) {
      this.work.width = w;
      this.work.height = h;
    }
    const ctx = this.work.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0, w, h);
    // o quadro quadrado mostra o centro do vídeo (object-fit: cover)
    const m = Math.min(w, h), ox = (w - m) / 2, oy = (h - m) / 2;
    const live: RGB[] = [];
    const fixedCells = new Set(this.impl.scan[this.current].fixedCells.map((f) => f.cell));
    this.fixedPixels.clear();
    this.cellsOf().forEach((cell, ci) => {
      if (!fixedCells.has(ci)) return;
      // grade 8×8 cobrindo quase todo o adesivo (o logo fica no meio; o fundo, nas bordas)
      const half = Math.max(2, Math.round(cell.r * m * 1.9));
      const x0 = Math.round(ox + cell.center[0] * m) - half, y0 = Math.round(oy + cell.center[1] * m) - half;
      const data = ctx.getImageData(x0, y0, 2 * half, 2 * half).data;
      const px: RGB[] = [];
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          const xx = Math.floor(((j + 0.5) / 8) * 2 * half), yy = Math.floor(((i + 0.5) / 8) * 2 * half);
          const o = (yy * 2 * half + xx) * 4;
          px.push([data[o], data[o + 1], data[o + 2]]);
        }
      this.fixedPixels.set(ci, px);
    });
    const flat: boolean[] = [];
    for (const cell of this.cellsOf()) {
        const half = Math.max(1, Math.round(cell.r * m));
        const x = Math.round(ox + cell.center[0] * m) - half, y = Math.round(oy + cell.center[1] * m) - half;
        const s = 2 * half;
        const data = ctx.getImageData(x, y, s, s).data;
        // mediana por canal: ignora reflexos e bordas
        const R: number[] = [], G: number[] = [], B: number[] = [], L: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          R.push(data[i]); G.push(data[i + 1]); B.push(data[i + 2]);
          L.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
        flat.push(isFlat(L));
        live.push([med(R), med(G), med(B)]);
      }
    // tem um puzzle ali? faixas escuras entre as células + células lisas
    const frame = ctx.getImageData(0, 0, w, h).data;
    const rgbAt = (fx: number, fy: number): RGB => {
      const xx = Math.min(w - 1, Math.max(0, Math.round(fx))), yy = Math.min(h - 1, Math.max(0, Math.round(fy)));
      const o = (yy * w + xx) * 4;
      return [frame[o], frame[o + 1], frame[o + 2]];
    };
    const centers = this.cellsOf().map((c): [number, number] => [ox + c.center[0] * m, oy + c.center[1] * m]);
    let pairs = this.pairsCache.get(this.current);
    if (!pairs) this.pairsCache.set(this.current, (pairs = cellNeighbors(this.cellsOf().map((c) => c.center))));
    this.presence.push(puzzleInView(centers, pairs, flat, rgbAt));
    if (this.presence.length > 5) this.presence.shift();
    this.live = live;
    this.history.push(live);
    if (this.history.length > 7) this.history.shift();
    this.updateAuto();
    this.drawOverlay();
    this.updateWarning();
  }

  /** cor de cada célula pela maioria dos últimos quadros (um quadro piscando não conta) */
  private majoritySig(): string[] {
    const frames = this.history.slice(-5);
    return this.live.map((_, i) => {
      const count = new Map<string, number>();
      for (const f of frames) {
        const k = this.classify(f[i]);
        count.set(k, (count.get(k) ?? 0) + 1);
      }
      let best = '', n = -1;
      for (const [k, c] of count)
        if (c > n) {
          best = k;
          n = c;
        }
      return best;
    });
  }

  private updateAuto() {
    if (this.turn) {
      // durante o giro animado não conta (a espera de 2 s começa quando ele termina)
      this.countStart = 0;
      this.stableSince = performance.now();
      return this.setAutoMsg('');
    }
    if (!this.auto || !this.running || this.live.length !== this.cellsOf().length) {
      this.countStart = 0;
      return this.setAutoMsg('');
    }
    const now = performance.now();
    const sig = this.majoritySig();
    const key = sig.join('|');
    if (key !== this.sigKey) {
      // alguma cor mudou: recomeça a espera (e cancela a contagem)
      this.sigKey = key;
      this.stableSince = now;
      this.countStart = 0;
    }
    if (!this.armed) {
      // girar o cubo muda a imagem: basta UM quadro bem diferente (o cubo de lado, no meio
      // do giro) — assim funciona mesmo se a próxima face tiver cores parecidas
      const ref = this.lastSig;
      const need = Math.max(2, Math.ceil(sig.length * 0.25));
      const diff = (s: string[]) => (ref && ref.length === s.length ? s.filter((k, i) => k !== ref[i]).length : s.length);
      const frame = this.live.map((c) => this.classify(c));
      if (diff(sig) < need && diff(frame) < need) return this.setAutoMsg(tr('Gire o cubo para a próxima face', 'Turn the cube to the next face', 'Gira el cubo a la siguiente cara'));
      this.armed = true;
    }
    // sem puzzle na grade (só o rosto, a parede...), não conta
    if (this.presence.filter(Boolean).length < 3) {
      this.countStart = 0;
      this.stableSince = now;
      return this.setAutoMsg(tr('Mostre o puzzle dentro da grade', 'Show the puzzle inside the grid', 'Muestra el puzzle dentro de la cuadrícula'));
    }
    // a face certa: centro (ou canto de referência) com a cor pedida
    const face = this.impl.scan[this.current];
    if (!face.fixedCells.every((fc) => this.fixedOk(fc.cell, fc.color))) {
      this.countStart = 0;
      return this.setAutoMsg('');
    }
    if (now - this.stableSince < STABLE_MS) return this.setAutoMsg(tr('Segure a face parada…', 'Hold the face still…', 'Mantén la cara quieta…'));
    if (!this.countStart) this.countStart = now;
    if (now - this.countStart >= COUNT_MS) {
      this.countStart = 0;
      this.capture();
      return;
    }
    this.setAutoMsg(tr('Capturando… segure firme', 'Capturing… hold steady', 'Capturando… no te muevas'));
  }

  private setAutoMsg(msg: string) {
    if (msg === this.autoMsg) return;
    this.autoMsg = msg;
    const el = this.root.querySelector('.scan-auto');
    if (el) el.textContent = msg;
  }

  private updateWarning() {
    const face = this.impl.scan[this.current];
    if (this.live.length !== this.cellsOf().length) return;
    const name = (k: string) => this.impl.colors.find((c) => c.key === k)?.name ?? k;
    const gn = face.grid.length;
    const center = face.cells ? 0 : gn % 2 === 1 ? (gn * gn) >> 1 : -1;
    let msg = '';
    for (const fc of face.fixedCells) {
      if (this.fixedOk(fc.cell, fc.color)) continue;
      const got = this.classify(this.live[fc.cell]);
      msg =
        fc.cell === center
          ? tr(`O centro está sendo lido como <b>${name(got)}</b>, mas esta etapa pede a face <b>${name(fc.color)}</b>.`, `The center reads as <b>${name(got)}</b>, but this step needs the <b>${name(fc.color)}</b> face.`, `El centro se lee como <b>${name(got)}</b>, pero este paso necesita la cara <b>${name(fc.color)}</b>.`)
          : tr(`O adesivo contornado deveria ser <b>${name(fc.color)}</b> (canto de referência) — confira a posição do cubo.`, `The outlined sticker should be <b>${name(fc.color)}</b> (reference corner) — check how you’re holding the cube.`, `La pegatina marcada debería ser <b>${name(fc.color)}</b> (esquina de referencia): revisa cómo estás sujetando el cubo.`);
      break;
    }
    if (msg === this.lastWarn) return;
    this.lastWarn = msg;
    const el = this.root.querySelector('.scan-warn');
    if (el) el.innerHTML = msg;
  }

  private drawOverlay() {
    const cv = this.overlay;
    const v = this.video;
    const dw = v.clientWidth, dh = v.clientHeight;
    const dpr = Math.min(devicePixelRatio, 2);
    if (cv.width !== Math.round(dw * dpr)) {
      cv.width = Math.round(dw * dpr);
      cv.height = Math.round(dh * dpr);
    }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dw, dh);
    const M = Math.min(dw, dh), OX = (dw - M) / 2, OY = (dh - M) / 2;
    const P = (p: Pt): Pt => [OX + p[0] * M, OY + p[1] * M];
    if (this.turn) return this.drawTurn(ctx, dw, dh, M, OX, OY, P);
    const face = this.impl.scan[this.current];
    const cells = this.cellsOf();
    const outline = this.dimOutside(ctx, this.current, dw, dh, P);
    this.drawStrips(ctx, this.current, 1, dw, dh, P);
    if (this.countStart) {
      // anel de progresso da contagem, sobre o contorno da face
      const k = Math.min(1, (performance.now() - this.countStart) / COUNT_MS);
      // um pouco para fora do contorno, para não cobrir os adesivos
      const cx = outline.reduce((a, p) => a + p[0], 0) / outline.length;
      const cy = outline.reduce((a, p) => a + p[1], 0) / outline.length;
      const ring = outline.map(([x, y]): Pt => {
        const d = Math.hypot(x - cx, y - cy) || 1;
        return [x + ((x - cx) / d) * 4, y + ((y - cy) / d) * 4];
      });
      let per = 0;
      ring.forEach((p, i) => {
        const q = ring[(i + 1) % ring.length];
        per += Math.hypot(q[0] - p[0], q[1] - p[1]);
      });
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(63,208,201,0.25)';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = '#3fd0c9';
      ctx.shadowColor = '#3fd0c9';
      ctx.shadowBlur = 10;
      ctx.setLineDash([per * k, per]);
      ctx.stroke();
      ctx.restore();
    }
    const fixedAt = new Map(face.fixedCells.map((f) => [f.cell, f.color]));
    this.live.forEach((rgb, i) => {
      const cell = cells[i];
      if (!cell) return;
      const fixedColor = fixedAt.get(i);
      const poly = cell.poly.map(P);
      ctx.strokeStyle = fixedColor ? this.hex(fixedColor) : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = fixedColor ? 3.5 : 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      poly.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();
      const [cx, cy] = P(cell.center);
      const key = fixedColor ?? this.classify(rgb);
      const dot = Math.max(10, cell.r * M * 1.3);
      ctx.fillStyle = this.hex(key);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(cx - dot / 2, cy - dot / 2, dot, dot, 5);
      ctx.fill();
      ctx.stroke();
      if (this.debug) {
        const { h, s, v } = rgbToHsv(rgb);
        ctx.font = '600 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        const lines = [`h${h.toFixed(0)} s${s.toFixed(2)} v${v.toFixed(2)}`, rgb.join(',')];
        lines.forEach((t, li) => {
          ctx.strokeText(t, cx, cy + dot + 10 + li * 12);
          ctx.fillText(t, cx, cy + dot + 10 + li * 12);
        });
      }
    });
  }

  /** escurece o vídeo fora da face (devolve o contorno da face na tela) */
  private dimOutside(ctx: CanvasRenderingContext2D, fi: number, dw: number, dh: number, P: (p: Pt) => Pt): Pt[] {
    const outline = hull(this.cellsOf(fi).flatMap((c) => c.poly)).map(P);
    ctx.fillStyle = 'rgba(5,8,18,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, dw, dh);
    outline.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fill('evenodd');
    return outline;
  }

  /** as faixas por fora das bordas: as cores já lidas das faces vizinhas (ou a cor do centro) */
  private drawStrips(ctx: CanvasRenderingContext2D, fi: number, alpha: number, dw: number, dh: number, P: (p: Pt) => Pt) {
    if (alpha <= 0) return;
    const face = this.impl.scan[fi];
    ctx.save();
    ctx.globalAlpha = alpha;
    const bar = (key: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = this.hex(key);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
      ctx.fill();
      ctx.stroke();
    };
    if (face.marks) {
      // faces poligonais: por fora de cada aresta, as cores já capturadas da face vizinha
      // (quando houver) ou um traço com a cor do centro vizinho
      const seen = (face.neighborMarks ?? []).map((m) => ({ ...m, key: this.capturedKey(m.sticker) }));
      const edgesWithColors = new Set(seen.filter((m) => m.key).map((m) => m.edge));
      for (const m of seen) {
        if (!m.key) continue;
        const a = P(m.a), b = P(m.b);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.strokeStyle = this.hex(m.key);
        ctx.lineWidth = 9;
        ctx.stroke();
      }
      face.marks.forEach((mk, i) => {
        if (edgesWithColors.has(i)) return;
        const a = P(mk.a), b = P(mk.b);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = mk.primary ? 15 : 11;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.strokeStyle = this.hex(mk.color);
        ctx.lineWidth = mk.primary ? 12 : 8;
        ctx.stroke();
      });
    } else {
      const g = this.gridRect(dw, dh);
      const n = face.grid.length;
      const cell = g.side / n;
      const gap = 6, thick = 12, thin = 7, inset = cell * 0.2;
      const nb = face.neighbors;
      // as cores JÁ capturadas que encostam em cada borda (a fileira da face vizinha)
      const seg = (stickers: number[], horizontal: boolean, x0: number, y0: number, t: number) =>
        stickers.forEach((st, k) => {
          const key = this.capturedKey(st);
          if (!key) return;
          const a = k * cell + cell * 0.12, len = cell * 0.76;
          if (horizontal) bar(key, x0 + a, y0, len, t);
          else bar(key, x0, y0 + a, t, len);
        });
      const has = (stickers: number[]) => stickers.some((st) => this.capturedKey(st));
      // cubos com centro: enquanto a vizinha não foi lida, a barra tem a cor do centro dela
      if (has(face.edges.up)) seg(face.edges.up, true, g.x, g.y - gap - thick, thick);
      else if (nb) bar(nb.up, g.x + inset, g.y - gap - thick, g.side - 2 * inset, thick);
      if (has(face.edges.down)) seg(face.edges.down, true, g.x, g.y + g.side + gap, thin + 3);
      else if (nb) bar(nb.down, g.x + inset, g.y + g.side + gap, g.side - 2 * inset, thin);
      if (has(face.edges.left)) seg(face.edges.left, false, g.x - gap - thin - 3, g.y, thin + 3);
      else if (nb) bar(nb.left, g.x - gap - thin, g.y + inset, thin, g.side - 2 * inset);
      if (has(face.edges.right)) seg(face.edges.right, false, g.x + g.side + gap, g.y, thin + 3);
      else if (nb) bar(nb.right, g.x + g.side + gap, g.y + inset, thin, g.side - 2 * inset);
    }
    ctx.restore();
  }

  // ---- giro animado entre as faces

  /** dá para animar o giro entre estas duas faces? (as duas com pose, molde em grade) */
  private turnable(a: number, b: number): boolean {
    const fa = this.impl.scan[a], fb = this.impl.scan[b];
    return !!fa?.pose && !!fb?.pose && !fa.cells && !fb.cells && a !== b;
  }
  private canReplay(): boolean {
    return this.mode === 'scan' && this.current > 0 && this.turnable(this.current - 1, this.current);
  }

  /** anima o puzzle girando da face `from` para a face `to` (o movimento que a pessoa faz) */
  private startTurn(from: number, to: number) {
    if (!this.turnable(from, to) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const steps = turnSteps(this.impl.scan[from].pose as Pose, this.impl.scan[to].pose as Pose);
    if (!steps?.length) return;
    this.turn = { from, to, steps, start: performance.now() };
    this.countStart = 0;
    cancelAnimationFrame(this.turnRaf);
    const total = TURN_FADE_OUT + turnDuration(steps) + TURN_FADE_IN;
    const tick = () => {
      if (!this.turn) return;
      if (performance.now() - this.turn.start >= total) {
        this.turn = null;
        this.stableSince = performance.now();
      }
      if (this.video?.isConnected) this.drawOverlay();
      if (this.turn) this.turnRaf = requestAnimationFrame(tick);
    };
    this.turnRaf = requestAnimationFrame(tick);
  }

  private stopTurn() {
    this.turn = null;
    cancelAnimationFrame(this.turnRaf);
  }

  /**
   * Um quadro do giro: (1) as faixas da face lida somem e a grade vira o cubinho, com as cores
   * capturadas; (2) o cubinho gira até a próxima face ficar de frente; (3) o cubinho some e as
   * faixas da nova face aparecem — daí em diante é a tela normal.
   */
  private drawTurn(ctx: CanvasRenderingContext2D, dw: number, dh: number, M: number, OX: number, OY: number, P: (p: Pt) => Pt) {
    const T = this.turn!;
    const t = performance.now() - T.start;
    const rotMs = turnDuration(T.steps);
    const from = this.impl.scan[T.from].pose as Pose, to = this.impl.scan[T.to].pose as Pose;
    const view = { k: (GRID_FRACTION * M) / 2, cx: OX + M / 2, cy: OY + M / 2 };
    if (t < TURN_FADE_OUT) {
      const a = t / TURN_FADE_OUT;
      this.dimOutside(ctx, T.from, dw, dh, P);
      this.drawCube(ctx, poseMatrix(from), a, view);
      this.drawStrips(ctx, T.from, 1 - a, dw, dh, P);
    } else if (t < TURN_FADE_OUT + rotMs) {
      ctx.fillStyle = 'rgba(5,8,18,0.5)';
      ctx.fillRect(0, 0, dw, dh);
      this.drawCube(ctx, turnMatrix(from, T.steps, t - TURN_FADE_OUT), 1, view);
    } else {
      const a = Math.min(1, (t - TURN_FADE_OUT - rotMs) / TURN_FADE_IN);
      this.dimOutside(ctx, T.to, dw, dh, P);
      this.drawCube(ctx, poseMatrix(to), 1 - a, view);
      this.drawStrips(ctx, T.to, a, dw, dh, P);
    }
  }

  /** o cubinho: cada face do molde com o corpo escuro e as cores já lidas (ou só o contorno) */
  private drawCube(ctx: CanvasRenderingContext2D, R: M3, bodyAlpha: number, view: { k: number; cx: number; cy: number }) {
    // tela: a face da frente fica em z = 1 e é desenhada do tamanho exato da grade
    const proj = (p: V3): Pt => {
      const v = apply(R, p);
      const s = TURN_CAM / (TURN_CAM - (v[2] - 1));
      return [view.cx + v[0] * view.k * s, view.cy - v[1] * view.k * s];
    };
    const at = (f: Pose, u: number, w: number): V3 => [f.out[0] + f.right[0] * u + f.up[0] * w, f.out[1] + f.right[1] * u + f.up[1] * w, f.out[2] + f.right[2] * u + f.up[2] * w];
    const light: V3 = [-0.35, 0.55, 0.76];
    const faces = this.impl.scan
      .map((f, fi) => ({ f, fi, pose: f.pose as Pose | undefined }))
      .filter((x): x is { f: (typeof x)['f']; fi: number; pose: Pose } => !!x.pose)
      .map((x) => {
        const n = apply(R, x.pose.out);
        // visível se aponta para a câmera (que fica em z = 1 + TURN_CAM)
        const facing = n[0] * -n[0] + n[1] * -n[1] + n[2] * (1 + TURN_CAM - n[2]);
        return { ...x, n, facing };
      })
      .filter((x) => x.facing > 1e-3)
      .sort((a, b) => a.n[2] - b.n[2]);
    for (const { f, fi, pose, n } of faces) {
      const lum = 0.55 + 0.45 * Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const shade = (1 - lum) * 0.85;
      const quad = (pts: Pt[]) => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
      };
      // corpo
      if (bodyAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = bodyAlpha;
        quad([at(pose, -1, 1), at(pose, 1, 1), at(pose, 1, -1), at(pose, -1, -1)].map(proj));
        ctx.fillStyle = BODY_HEX;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
      // adesivos (mesmo recuo das células da grade)
      const n2 = f.grid.length;
      const e = 0.06 * (2 / n2);
      f.grid.flat().forEach((_, cell) => {
        const r = Math.floor(cell / n2), c = cell % n2;
        const u0 = -1 + (2 * c) / n2 + e, u1 = -1 + (2 * (c + 1)) / n2 - e;
        const w0 = 1 - (2 * r) / n2 - e, w1 = 1 - (2 * (r + 1)) / n2 + e;
        quad([at(pose, u0, w0), at(pose, u1, w0), at(pose, u1, w1), at(pose, u0, w1)].map(proj));
        const rgb = this.captured[fi]?.[cell];
        if (rgb) {
          ctx.fillStyle = this.hex(f.fixedCells.find((x) => x.cell === cell)?.color ?? this.classify(rgb));
          ctx.fill();
          if (shade > 0.01) {
            ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(255,255,255,${(0.06 * bodyAlpha).toFixed(3)})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${(0.85 - shade * 0.5).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      });
    }
  }

  /** Mediana, por adesivo e canal, dos últimos quadros. */
  private stableSample(): RGB[] {
    const frames = this.history.length ? this.history : [this.live];
    return this.live.map((_, i) =>
      [0, 1, 2].map((ch) => {
        const vals = frames.map((f) => f[i][ch]).sort((a, b) => a - b);
        return vals[vals.length >> 1];
      }) as RGB,
    );
  }

  private capture() {
    if (this.live.length !== this.cellsOf().length) return;
    this.captured[this.current] = this.stableSample();
    for (const fc of this.impl.scan[this.current].fixedCells) {
      const rgb = this.captured[this.current]![fc.cell];
      const learnRgb = this.model.centerSample(rgb, this.fixedPixels.get(fc.cell), fc.color);
      this.model.learn(`${this.current}:${fc.cell}`, fc.color, learnRgb);
    }
    this.session.fixedPx[this.current] = Object.fromEntries(this.fixedPixels);
    // a face foi lida de novo: correções feitas à mão nela não valem mais
    clearFaceEdits(this.session, this.impl, this.current);
    // lembra as cores: só volta a contar depois que o cubo for girado
    this.lastSig = this.majoritySig();
    this.armed = false;
    this.countStart = 0;
    navigator.vibrate?.(60);
    this.history = [];
    this.lastWarn = '';
    this.root.querySelector('.video-wrap')?.classList.add('flash');
    const next = this.captured.findIndex((c, i) => !c && i > this.current);
    const anyMissing = this.captured.findIndex((c) => !c);
    if (anyMissing < 0) {
      // todas lidas: o usuário confere antes de usar (e pode refazer só uma face)
      setTimeout(() => this.showReview(), 180);
      return;
    }
    const prev = this.current;
    this.current = next >= 0 ? next : anyMissing;
    // mostra o movimento até a próxima face (o cubinho girando)
    this.startTurn(prev, this.current);
    setTimeout(() => this.render(), 180);
  }

  // ---- revisão: todas as faces lidas

  private showReview() {
    this.stopTurn();
    this.mode = 'review';
    clearInterval(this.timer); // a câmera continua aberta, mas sem ler (volta ao refazer uma face)
    this.countStart = 0;
    // cada cor aparece exatamente N vezes; puzzles sem centro descobrem como estavam virados
    this.review = compose(this.impl, this.session);
    this.opts.onFace?.([]);
    this.opts.onPreview?.(this.review.state);
    this.renderReview();
  }

  private renderReview() {
    const r = this.review!;
    const res = this.impl.validate(r.state);
    this.root.classList.add('reviewing');
    this.root.innerHTML = `
      <div class="scan-review">
        <div class="review-head">
          <h3>${icon('camera')}${tr('Confira as faces lidas', 'Check the scanned faces', 'Revisa las caras escaneadas')}</h3>
          <p>${tr('Alguma saiu errada? <b>Toque na face</b> para escanear só ela de novo.', 'Did one come out wrong? <b>Tap the face</b> to scan just that one again.', '¿Alguna salió mal? <b>Toca la cara</b> para escanear solo esa otra vez.')}</p>
        </div>
        <div class="review-faces ${this.impl.scan.length > 6 ? 'many' : ''}">
          ${this.impl.scan
            .map(
              (s, i) => `<button class="review-face" data-face="${i}" title="${tr('Escanear de novo', 'Scan again', 'Escanear otra vez')}: ${s.title}" aria-label="${tr('Escanear de novo', 'Scan again', 'Escanear otra vez')}: ${s.title}">
                ${faceThumb(this.impl, i, s.grid.flat().map((idx) => r.keys[idx]))}
                <span class="rf-label">${faceLabel(this.impl, i)}<span class="rf-redo">${icon('camera')}${tr('Refazer', 'Redo', 'Rehacer')}</span></span>
              </button>`,
            )
            .join('')}
        </div>
        ${
          res.ok
            ? `<div class="review-status ok">${icon('checkCircle')}<span>${tr('Tudo certo: as cores formam um puzzle possível.', 'All good: the colors form a possible puzzle.', 'Todo bien: los colores forman un puzzle posible.')}</span></div>`
            : `<div class="review-status bad">${icon('warning')}<div><b>${tr('Algo não bate:', 'Something doesn’t add up:', 'Algo no cuadra:')}</b>${res.errors
                .slice(0, 3)
                .map((e) => `<p>${e}</p>`)
                .join('')}${res.errors.length > 3 ? `<p>${tr(`… e mais ${res.errors.length - 3} problemas.`, `… and ${res.errors.length - 3} more problems.`, `… y ${res.errors.length - 3} problemas más.`)}</p>` : ''}
                <p class="hint">${tr('Refaça a face que parece errada — ou use as cores assim e corrija pintando.', 'Redo the face that looks wrong — or use these colors and fix them by painting.', 'Rehaz la cara que parece mal, o usa estos colores y corrígelos pintando.')}</p></div></div>`
        }
        <div class="review-actions">
          <button class="btn ghost" data-act="restart">${tr('Escanear tudo de novo', 'Scan everything again', 'Escanear todo de nuevo')}</button>
          <button class="btn primary big" data-act="use">${tr('Usar estas cores', 'Use these colors', 'Usar estos colores')} →</button>
        </div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-face]').forEach((b) => b.addEventListener('click', () => this.rescan(Number(b.dataset.face))));
    this.root.querySelector('[data-act="use"]')!.addEventListener('click', () => this.use());
    this.root.querySelector('[data-act="restart"]')!.addEventListener('click', () => {
      resetSession(this.session, this.impl);
      this.rescan(0);
    });
  }

  /** volta à câmera numa face (as outras continuam lidas) */
  private rescan(face: number) {
    this.mode = 'scan';
    this.review = null;
    this.current = face;
    this.armed = true;
    this.countStart = 0;
    this.history = [];
    this.render();
    if (this.running) this.loop();
  }

  private use() {
    const r = this.review ?? compose(this.impl, this.session);
    this.session.result = [...r.state];
    this.session.order = r.order;
    if (this.debug) (window as unknown as { __scan: unknown }).__scan = { keys: r.keys, order: r.order, captured: this.captured };
    this.stop();
    this.opts.onDone(r.state);
  }

  private stopStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  stop() {
    this.stopTurn();
    clearInterval(this.timer);
    this.stopStream();
    this.running = false;
  }

  dispose() {
    this.stop();
    this.root.remove();
  }
}
