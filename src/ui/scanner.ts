import type { PuzzleImpl } from '../core/types';
import { balancedAssign, hexToRgb, nearest, rgbCss, rgbToLab, type Lab, type RGB } from '../core/color';

/** Cores típicas vistas por uma câmera (mais escuras/menos saturadas que a cor "ideal"). */
const CAMERA_REFS: Record<string, RGB> = {
  amarelo: [205, 195, 45],
  laranja: [235, 115, 35],
  verde: [35, 165, 85],
  branco: [205, 210, 210],
  vermelho: [185, 30, 45],
  azul: [25, 75, 175],
};

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
  private timer = 0;
  private running = false;
  private n: number;

  constructor(
    container: HTMLElement,
    private impl: PuzzleImpl,
    private onDone: (state: string[]) => void,
    private onFace?: (stickers: number[]) => void,
  ) {
    this.n = impl.scan[0].grid.length;
    this.captured = impl.scan.map(() => null);
    this.root = document.createElement('div');
    this.root.className = 'scanner';
    container.appendChild(this.root);
    this.render();
  }

  private hex(key: string) {
    return this.impl.colors.find((c) => c.key === key)!.hex;
  }

  private refs(): { key: string; lab: Lab }[] {
    // usa os centros já capturados como referência; senão, cores típicas de câmera
    return this.impl.colors.map((c) => {
      const si = this.impl.scan.findIndex((s) => s.centerColor === c.key);
      const cap = si >= 0 ? this.captured[si] : null;
      const mid = Math.floor(this.n / 2);
      const rgb = cap && this.n % 2 === 1 ? cap[mid * this.n + mid] : CAMERA_REFS[c.name] ?? hexToRgb(c.hex);
      return { key: c.key, lab: rgbToLab(rgb) };
    });
  }

  private render() {
    const face = this.impl.scan[this.current];
    const done = this.captured.filter(Boolean).length;
    this.onFace?.(face.grid.flat());
    this.root.innerHTML = `
      <div class="scan-head">
        <div class="scan-progress"><span style="width:${(done / this.captured.length) * 100}%"></span></div>
        <div class="scan-step">Face ${this.current + 1} de ${this.impl.scan.length}</div>
        <h3><i class="dot" style="background:${this.hex(face.centerColor)}"></i>${face.title}</h3>
        <p>${face.instruction}</p>
      </div>
      <div class="scan-stage">
        <div class="video-wrap ${this.running ? '' : 'off'}"><video playsinline muted autoplay></video><canvas class="overlay"></canvas></div>
        <div class="scan-placeholder ${this.running ? 'hidden' : ''}">
          <div class="cam-icon">📷</div>
          <p>Aponte a câmera para o cubo. Cada face aparece com uma grade; encaixe os adesivos nela e toque em <b>Capturar</b>.</p>
          <button class="btn primary" data-act="start">Ativar câmera</button>
          <p class="scan-info"></p>
          <p class="scan-error"></p>
        </div>
      </div>
      <div class="scan-actions">
        <button class="btn ghost" data-act="switch" ${this.running ? '' : 'disabled'}>Trocar câmera</button>
        <button class="btn primary big" data-act="capture" ${this.running ? '' : 'disabled'}>Capturar</button>
      </div>
      <div class="scan-thumbs">
        ${this.impl.scan
          .map(
            (s, i) => `<button class="thumb ${i === this.current ? 'active' : ''} ${this.captured[i] ? 'ok' : ''}" data-face="${i}" title="${s.title}">
              <div class="mini" style="grid-template-columns:repeat(${this.n},1fr)">${Array.from({ length: this.n * this.n }, (_, k) => {
                const c = this.captured[i]?.[k];
                return `<i style="background:${c ? rgbCss(c) : 'transparent'}"></i>`;
              }).join('')}</div>
              <span><i class="dot" style="background:${this.hex(s.centerColor)}"></i></span>
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
    this.root.querySelectorAll<HTMLButtonElement>('[data-face]').forEach((b) =>
      b.addEventListener('click', () => {
        this.current = Number(b.dataset.face);
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
    const side = Math.min(vw, vh) * 0.62;
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
    const g = this.gridRect(w, h);
    const cell = g.side / this.n;
    const live: RGB[] = [];
    for (let r = 0; r < this.n; r++)
      for (let c = 0; c < this.n; c++) {
        const inset = cell * 0.3;
        const x = Math.round(g.x + c * cell + inset), y = Math.round(g.y + r * cell + inset);
        const s = Math.max(2, Math.round(cell - 2 * inset));
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
    this.drawOverlay();
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
    const g = this.gridRect(dw, dh);
    const cell = g.side / this.n;
    // escurece fora da grade
    ctx.fillStyle = 'rgba(5,8,18,0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, dw, dh);
    ctx.roundRect(g.x, g.y, g.side, g.side, 14);
    ctx.fill('evenodd');
    const refs = this.refs();
    this.live.forEach((rgb, i) => {
      const r = Math.floor(i / this.n), c = i % this.n;
      const x = g.x + c * cell, y = g.y + r * cell;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, cell - 8, cell - 8, 10);
      ctx.stroke();
      const key = nearest(rgbToLab(rgb), refs);
      const dot = cell * 0.26;
      ctx.fillStyle = this.hex(key);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(x + cell / 2 - dot / 2, y + cell / 2 - dot / 2, dot, dot, 6);
      ctx.fill();
      ctx.stroke();
    });
  }

  private capture() {
    if (this.live.length !== this.n * this.n) return;
    this.captured[this.current] = this.live.map((c) => [...c] as RGB);
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
    const keys = balancedAssign(samples, this.refs(), this.n * this.n, fixed);
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
