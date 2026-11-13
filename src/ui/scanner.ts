import type { PuzzleImpl } from '../core/types';
import { scanShortName } from '../puzzles/nxn/layout';
import { balancedAssign, classifyCubeColor, hexToRgb, nearest, rgbToHsv, rgbToLab, type Lab, type RGB } from '../core/color';

/** Cores típicas vistas por uma câmera (mais escuras/menos saturadas que a cor "ideal"). */
const CAMERA_REFS: Record<string, RGB> = {
  amarelo: [205, 195, 45],
  laranja: [235, 115, 35],
  verde: [35, 165, 85],
  branco: [205, 210, 210],
  vermelho: [185, 30, 45],
  azul: [25, 75, 175],
};

/** Fração do menor lado do vídeo ocupada pela grade (o CSS do rótulo "em cima" usa o mesmo valor). */
const GRID_FRACTION = 0.66;

/** captura automática: cores paradas por STABLE_MS, depois contagem de COUNT_MS */
const STABLE_MS = 500;
const COUNT_MS = 1500;
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

export class CameraScanner {
  readonly root: HTMLElement;
  private video!: HTMLVideoElement;
  private overlay!: HTMLCanvasElement;
  private work = document.createElement('canvas');
  private stream: MediaStream | null = null;
  private devices: MediaDeviceInfo[] = [];
  private deviceIdx = -1;
  private current = 0;
  private captured: (RGB[] | null)[];
  private live: RGB[] = [];
  /** últimos quadros, para capturar a mediana (menos borrão/ruído) */
  private history: RGB[][] = [];
  private debug = /[?&]debug/.test(location.hash) || /[?&]debug/.test(location.search);
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

  constructor(
    container: HTMLElement,
    private impl: PuzzleImpl,
    private onDone: (state: string[]) => void,
    private onFace?: (stickers: number[]) => void,
  ) {
    impl.scan.forEach((f, fi) => f.grid.flat().forEach((st, k) => this.where.set(st, [fi, k])));
    this.defaultRefs = impl.colors.map((c) => ({ key: c.key, lab: rgbToLab(CAMERA_REFS[c.name] ?? hexToRgb(c.hex)) }));
    this.captured = impl.scan.map(() => null);
    this.root = document.createElement('div');
    this.root.className = 'scanner';
    container.appendChild(this.root);
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

  private defaultRefs: { key: string; lab: Lab }[];

  /** Cor (chave) de uma amostra: pelo matiz quando o puzzle usa as cores padrão; senão, a mais próxima. */
  private classify(rgb: RGB): string {
    if (this.impl.scanColorModel === 'nearest') return nearest(rgbToLab(rgb), this.defaultRefs);
    const name = classifyCubeColor(rgb);
    const c = this.impl.colors.find((x) => x.name === name);
    return c ? c.key : nearest(rgbToLab(rgb), this.defaultRefs);
  }

  private render() {
    const face = this.impl.scan[this.current];
    const done = this.captured.filter(Boolean).length;
    this.onFace?.(face.grid.flat());
    const upHex = face.upColor ? this.hex(face.upColor) : 'var(--accent-2)';
    this.lastWarn = ''; // o aviso é recriado junto com o HTML
    this.autoMsg = '';
    this.root.innerHTML = `
      <div class="scan-head">
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
        <div class="scan-warn" aria-live="polite"></div>
        <div class="scan-auto ${this.running && this.auto ? '' : 'hidden'}"></div>
        <div class="scan-placeholder ${this.running ? 'hidden' : ''}">
          <div class="cam-icon">📷</div>
          <p>${this.impl.holdHint} Em cada face, as marcas ao redor da grade mostram como segurar o cubo.${this.auto ? ' Com a captura automática ligada, é só segurar cada face parada por 2 segundos.' : ''}</p>
          <button class="btn primary" data-act="start">Ativar câmera</button>
          <p class="scan-info"></p>
          <p class="scan-error"></p>
        </div>
      </div>
      <div class="scan-actions">
        <button class="btn ghost icon-only" data-act="switch" title="Trocar câmera" aria-label="Trocar câmera" ${this.running ? '' : 'disabled'}>🔄</button>
        <button class="btn ghost auto-btn ${this.auto ? 'on' : ''}" data-act="auto" aria-pressed="${this.auto}" title="Capturar sozinho quando as cores ficarem paradas"><span class="sw" aria-hidden="true"></span>Auto</button>
        <button class="btn primary big" data-act="capture" ${this.running ? '' : 'disabled'}>${this.auto && this.running ? 'Capturar agora' : `Capturar ${face.title.toLowerCase()}`}</button>
      </div>
      <div class="scan-thumbs ${this.impl.scan.length > 6 ? 'many' : ''}">
        ${this.impl.scan
          .map(
            (s, i) => `<button class="thumb ${i === this.current ? 'active' : ''} ${this.captured[i] ? 'ok' : ''}" data-face="${i}" title="${s.title}">
              ${
                s.cells
                  ? `<svg class="mini-svg" viewBox="0.12 0.14 0.76 0.76">${this.cellsOf(i)
                      .map((c, k) => {
                        const rgb = this.captured[i]?.[k];
                        return `<polygon points="${c.poly.map((p) => p.join(',')).join(' ')}" fill="${rgb ? this.hex(this.classify(rgb)) : '#1b2030'}"/>`;
                      })
                      .join('')}</svg>`
                  : `<div class="mini" style="grid-template-columns:repeat(${s.grid.length},1fr)">${Array.from({ length: s.grid.length ** 2 }, (_, k) => {
                      const c = this.captured[i]?.[k];
                      return `<i style="background:${c ? this.hex(this.classify(c)) : 'transparent'}"></i>`;
                    }).join('')}</div>`
              }
              <span>${s.faceColor ? `<i class="dot" style="background:${this.hex(s.faceColor)}"></i>` : `<small>${scanShortName(s.face)}</small>`}</span>
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
    this.root.querySelector('[data-act="switch"]')?.addEventListener('click', () => this.switchCamera());
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
      this.showError('Este navegador não liberou a câmera. Ela só funciona em sites com <b>HTTPS</b> (ou localhost).');
      return;
    }
    const btn = this.root.querySelector<HTMLButtonElement>('[data-act="start"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Aguardando a câmera…';
    }
    this.showError('');
    this.setInfo('Se o navegador perguntar, clique em <b>Permitir</b> para usar a câmera.');
    // alguns navegadores embutidos nunca respondem ao pedido de câmera
    const slow = window.setTimeout(
      () =>
        this.setInfo(
          'A câmera não respondeu. Verifique se apareceu um pedido de permissão na barra de endereço. ' +
            'Navegadores embutidos em aplicativos costumam bloquear a câmera — abra o site no <b>Chrome</b>, <b>Edge</b> ou <b>Safari</b>.',
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
          ? 'A câmera foi bloqueada. Clique no ícone de cadeado/câmera na barra de endereço, permita a câmera e tente de novo. ' +
              'Se você está num navegador embutido em outro aplicativo, abra o site no Chrome, Edge ou Safari.'
          : name === 'NotFoundError'
            ? 'Nenhuma câmera encontrada neste dispositivo.'
            : name === 'NotReadableError'
              ? 'A câmera está sendo usada por outro programa (Zoom, Teams, OBS…). Feche-o e tente de novo.'
              : `Não foi possível abrir a câmera (${name}).`,
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Tentar de novo';
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
    for (const cell of this.cellsOf()) {
        const half = Math.max(1, Math.round(cell.r * m));
        const x = Math.round(ox + cell.center[0] * m) - half, y = Math.round(oy + cell.center[1] * m) - half;
        const s = 2 * half;
        const data = ctx.getImageData(x, y, s, s).data;
        // mediana por canal: ignora reflexos e bordas
        const R: number[] = [], G: number[] = [], B: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          R.push(data[i]); G.push(data[i + 1]); B.push(data[i + 2]);
        }
        const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
        live.push([med(R), med(G), med(B)]);
      }
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
      const ref = this.lastSig;
      const diff = ref && ref.length === sig.length ? sig.filter((k, i) => k !== ref[i]).length : sig.length;
      if (diff < Math.max(2, Math.ceil(sig.length * 0.25))) return this.setAutoMsg('Gire o cubo para a próxima face');
      this.armed = true;
    }
    // a face certa: centro (ou canto de referência) com a cor pedida
    const face = this.impl.scan[this.current];
    if (!face.fixedCells.every((fc) => sig[fc.cell] === fc.color)) {
      this.countStart = 0;
      return this.setAutoMsg('');
    }
    if (now - this.stableSince < STABLE_MS) return this.setAutoMsg('Segure a face parada…');
    if (!this.countStart) this.countStart = now;
    if (now - this.countStart >= COUNT_MS) {
      this.countStart = 0;
      this.capture();
      return;
    }
    this.setAutoMsg('Capturando… segure firme');
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
      const got = this.classify(this.live[fc.cell]);
      if (got === fc.color) continue;
      msg =
        fc.cell === center
          ? `O centro está sendo lido como <b>${name(got)}</b>, mas esta etapa pede a face <b>${name(fc.color)}</b>.`
          : `O adesivo contornado deveria ser <b>${name(fc.color)}</b> (canto de referência) — confira a posição do cubo.`;
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
    const face = this.impl.scan[this.current];
    const cells = this.cellsOf();
    // escurece fora da face
    const outline = hull(cells.flatMap((c) => c.poly)).map(P);
    ctx.fillStyle = 'rgba(5,8,18,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, dw, dh);
    outline.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fill('evenodd');
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
      // faces poligonais: um traço colorido por fora de cada aresta
      for (const mk of face.marks) {
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
      }
    } else {
      const g = this.gridRect(dw, dh);
      const n = face.grid.length;
      const cell = g.side / n;
      const gap = 6, thick = 12, thin = 7, inset = cell * 0.2;
      const nb = face.neighbors;
      if (nb) {
        // cubos com centro: barras com a cor de cada face vizinha
        bar(nb.up, g.x + inset, g.y - gap - thick, g.side - 2 * inset, thick);
        bar(nb.down, g.x + inset, g.y + g.side + gap, g.side - 2 * inset, thin);
        bar(nb.left, g.x - gap - thin, g.y + inset, thin, g.side - 2 * inset);
        bar(nb.right, g.x + g.side + gap, g.y + inset, thin, g.side - 2 * inset);
      } else {
        // sem centro: mostra as cores JÁ capturadas que encostam em cada borda
        const seg = (stickers: number[], horizontal: boolean, x0: number, y0: number, t: number) =>
          stickers.forEach((st, k) => {
            const key = this.capturedKey(st);
            if (!key) return;
            const a = k * cell + cell * 0.12, len = cell * 0.76;
            if (horizontal) bar(key, x0 + a, y0, len, t);
            else bar(key, x0, y0 + a, t, len);
          });
        seg(face.edges.up, true, g.x, g.y - gap - thick, thick);
        seg(face.edges.down, true, g.x, g.y + g.side + gap, thin + 3);
        seg(face.edges.left, false, g.x - gap - thin - 3, g.y, thin + 3);
        seg(face.edges.right, false, g.x + g.side + gap, g.y, thin + 3);
      }
    }
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
      const key = this.classify(rgb);
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
      this.finish();
      return;
    }
    this.current = next >= 0 ? next : anyMissing;
    setTimeout(() => this.render(), 180);
  }

  private finish() {
    const state = new Array<string>(this.impl.stickerCount).fill('?');
    const samples: Lab[] = new Array(this.impl.stickerCount);
    this.impl.scan.forEach((face, fi) => {
      face.grid.flat().forEach((idx, k) => (samples[idx] = rgbToLab(this.captured[fi]![k])));
    });
    const fixed = new Map<number, string>();
    for (const i of this.impl.fixedStickers) fixed.set(i, this.impl.solvedState()[i]);
    // 1º palpite pelo matiz; depois cada cor vira a média das amostras dela
    // e a atribuição é refeita garantindo exatamente N×N adesivos de cada cor.
    const rgbs: RGB[] = new Array(this.impl.stickerCount);
    this.impl.scan.forEach((face, fi) => face.grid.flat().forEach((idx, k) => (rgbs[idx] = this.captured[fi]![k])));
    const guess = rgbs.map((c) => this.classify(c));
    const refs = this.impl.colors.map((c) => {
      const members = samples.filter((_, i) => guess[i] === c.key);
      if (!members.length) return this.defaultRefs.find((r) => r.key === c.key)!;
      const m = members.reduce((a, l) => [a[0] + l[0], a[1] + l[1], a[2] + l[2]] as Lab, [0, 0, 0] as Lab);
      return { key: c.key, lab: [m[0] / members.length, m[1] / members.length, m[2] / members.length] as Lab };
    });
    const keys = balancedAssign(samples, refs, Math.round(this.impl.stickerCount / this.impl.colors.length), fixed);
    keys.forEach((k, i) => (state[i] = k || '?'));
    this.stop();
    this.onDone(state);
  }

  private stopStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  stop() {
    clearInterval(this.timer);
    this.stopStream();
    this.running = false;
  }

  dispose() {
    this.stop();
    this.root.remove();
  }
}
