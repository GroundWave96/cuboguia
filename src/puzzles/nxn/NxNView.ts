import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { PuzzleState, PuzzleView } from '../../core/types';
import { FACE_FRAME, NxNGeometry, parseMove } from './geometry';

const UNKNOWN_HEX = '#3b4152';

function roundedSquare(size: number, radius: number): THREE.ShapeGeometry {
  const s = size / 2;
  const r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  return new THREE.ShapeGeometry(shape, 6);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Cubie {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  pos2: [number, number, number];
}

/** Renderizador 3D de qualquer cubo NxN, com pintura por clique e animação de movimentos. */
export class NxNView implements PuzzleView {
  readonly element: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private cubies: Cubie[] = [];
  private stickerMeshes: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>[] = [];
  private state: PuzzleState;
  private highlight = new Set<number>();
  private clickCb: ((i: number) => void) | null = null;
  private interactive = false;
  private raf = 0;
  private ro: ResizeObserver;
  private queue: Promise<void> = Promise.resolve();
  private raycaster = new THREE.Raycaster();
  private hovered = -1;
  private disposed = false;
  private readonly defaultCamPos: THREE.Vector3;

  constructor(
    container: HTMLElement,
    private geo: NxNGeometry,
    private palette: Record<string, string>,
  ) {
    this.state = geo.solved();
    this.element = document.createElement('div');
    this.element.className = 'puzzle-view';
    container.appendChild(this.element);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.element.appendChild(this.renderer.domElement);

    const n = geo.n;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.defaultCamPos = new THREE.Vector3(4.6, 4.2, 6.6).multiplyScalar(n / 3);
    this.camera.position.copy(this.defaultCamPos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minDistance = n * 2.2;
    this.controls.maxDistance = n * 5;
    this.controls.rotateSpeed = 0.8;
    this.controls.autoRotateSpeed = 1.2;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-6, -3, -4);
    this.scene.add(fill);
    this.scene.add(this.root);

    this.build();
    this.setState(this.state);

    const el = this.renderer.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 6 && performance.now() - down.t < 600 && this.clickCb) {
        const idx = this.pick(e);
        if (idx >= 0) this.clickCb(idx);
      }
      down = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.interactive) return;
      const idx = this.pick(e);
      if (idx !== this.hovered) {
        this.hovered = idx;
        el.style.cursor = idx >= 0 ? 'pointer' : 'grab';
        this.refreshColors();
      }
    });
    el.addEventListener('pointerleave', () => {
      if (this.hovered !== -1) {
        this.hovered = -1;
        this.refreshColors();
      }
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.element);
    this.resize();
    this.loop();
  }

  private build() {
    const body = new RoundedBoxGeometry(0.97, 0.97, 0.97, 3, 0.1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.55, metalness: 0.1 });
    const stickerGeo = roundedSquare(0.84, 0.13);
    const byKey = new Map<string, Cubie>();
    const getCubie = (p: [number, number, number]) => {
      const k = p.join(',');
      let c = byKey.get(k);
      if (!c) {
        const mesh = new THREE.Mesh(body, bodyMat);
        const home = new THREE.Vector3(p[0] / 2, p[1] / 2, p[2] / 2);
        mesh.position.copy(home);
        this.root.add(mesh);
        c = { mesh, home, pos2: p };
        byKey.set(k, c);
        this.cubies.push(c);
      }
      return c;
    };
    // garante que peças internas visíveis em cortes também existam (só superfície é necessária)
    for (const s of this.geo.stickers) {
      const c = getCubie(s.cubie2);
      const mat = new THREE.MeshStandardMaterial({ color: UNKNOWN_HEX, roughness: 0.32, metalness: 0.02 });
      const m = new THREE.Mesh(stickerGeo, mat);
      const nv = new THREE.Vector3(...s.normal);
      m.position.copy(nv.clone().multiplyScalar(0.488));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nv);
      m.userData.index = s.index;
      c.mesh.add(m);
      this.stickerMeshes[s.index] = m;
    }
  }

  private pick(e: PointerEvent): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hits = this.raycaster.intersectObjects(this.cubies.map((c) => c.mesh), true);
    for (const h of hits) {
      const idx = h.object.userData.index;
      if (typeof idx === 'number') return idx;
      return -1; // atingiu o corpo preto primeiro
    }
    return -1;
  }

  private resize() {
    const w = this.element.clientWidth || 1;
    const h = this.element.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // em telas estreitas, afasta a câmera para caber
    const fit = w / h < 1 ? 1 / Math.max(w / h, 0.55) : 1;
    this.camera.zoom = 1 / Math.min(fit, 1.6);
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.updateCamTween();
    this.controls.update();
    if (this.highlight.size) {
      const t = performance.now() / 1000;
      const k = 0.18 + 0.17 * (0.5 + 0.5 * Math.sin(t * 4.5));
      for (const i of this.highlight) this.stickerMeshes[i].material.emissive.setRGB(k, k, k);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private refreshColors() {
    const dim = this.highlight.size > 0;
    this.stickerMeshes.forEach((m, i) => {
      const key = this.state[i];
      const hex = this.palette[key] ?? UNKNOWN_HEX;
      m.material.color.set(hex);
      m.material.emissive.setRGB(0, 0, 0);
      if (dim && !this.highlight.has(i)) m.material.color.multiplyScalar(0.33);
      if (i === this.hovered) m.material.emissive.setRGB(0.25, 0.25, 0.25);
    });
  }

  setState(state: PuzzleState) {
    this.state = [...state];
    this.refreshColors();
  }

  getState() {
    return [...this.state];
  }

  setHighlight(stickers: number[]) {
    this.highlight = new Set(stickers);
    this.refreshColors();
  }

  onStickerClick(cb: ((i: number) => void) | null) {
    this.clickCb = cb;
  }

  setInteractive(paint: boolean) {
    this.interactive = paint;
    this.renderer.domElement.style.cursor = paint ? 'grab' : '';
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  /** Gira a câmera suavemente para mostrar os adesivos indicados (mantendo a frente reconhecível). */
  focusCamera(stickers: number[]) {
    const sum = new THREE.Vector3();
    for (const i of stickers) sum.add(new THREE.Vector3(...this.geo.stickers[i].normal));
    const base = this.defaultCamPos.clone().normalize();
    const dir = sum.lengthSq() > 0.01 ? base.add(sum.normalize().multiplyScalar(0.75)).normalize() : base;
    if (dir.lengthSq() < 0.01) dir.copy(this.defaultCamPos).normalize();
    const dist = this.camera.position.length();
    // se a câmera já está praticamente nessa direção, não gira (evita esperas à toa)
    if (this.camera.position.clone().normalize().angleTo(dir) < 0.07) return;
    this.camTween = { from: this.camera.position.clone(), to: dir.multiplyScalar(dist), t0: performance.now(), dur: 650 };
  }

  private camTween: { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number } | null = null;
  private camWaiters: (() => void)[] = [];

  /** Resolve quando a câmera termina de girar (+ uma pausa curta para o olho acompanhar). */
  private cameraSettled(): Promise<void> {
    if (!this.camTween) return Promise.resolve();
    return new Promise((resolve) => this.camWaiters.push(() => setTimeout(resolve, 180)));
  }

  private releaseCamWaiters() {
    const w = this.camWaiters;
    this.camWaiters = [];
    w.forEach((f) => f());
  }

  private updateCamTween() {
    const tw = this.camTween;
    if (!tw) return;
    const t = Math.min(1, (performance.now() - tw.t0) / tw.dur);
    const k = easeInOut(t);
    const len = tw.from.length() + (tw.to.length() - tw.from.length()) * k;
    const p = tw.from.clone().normalize().lerp(tw.to.clone().normalize(), k);
    if (p.lengthSq() < 1e-4) p.set(0, 1, 0);
    this.camera.position.copy(p.normalize().multiplyScalar(len));
    this.controls.target.set(0, 0, 0);
    if (t >= 1) {
      this.camTween = null;
      this.releaseCamWaiters();
    }
  }

  resetCamera() {
    this.camTween = null;
    this.releaseCamWaiters();
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  animateMove(move: string, durationMs: number): Promise<void> {
    // primeiro a câmera termina de girar; só depois o movimento é animado
    this.queue = this.queue.then(() => (durationMs > 0 ? this.cameraSettled() : undefined)).then(() => this.runMove(move, durationMs));
    return this.queue;
  }

  private runMove(move: string, durationMs: number): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const mv = parseMove(move);
    const finish = () => {
      const map = this.geo.locationMap(move);
      this.state = this.geo.apply(this.state, move);
      this.highlight = new Set([...this.highlight].map((i) => map[i]));
      this.refreshColors();
    };
    if (durationMs <= 0) {
      finish();
      return Promise.resolve();
    }
    const axisArr = FACE_FRAME[mv.face].n;
    const axis = new THREE.Vector3(...axisArr);
    const h = this.geo.n - 1;
    const layer = this.cubies.filter((c) => c.pos2[0] * axisArr[0] + c.pos2[1] * axisArr[1] + c.pos2[2] * axisArr[2] >= h - 2 * (mv.depth - 1));
    const pivot = new THREE.Group();
    this.root.add(pivot);
    for (const c of layer) pivot.attach(c.mesh);
    const total = mv.turns === 3 ? Math.PI / 2 : (-Math.PI / 2) * mv.turns;
    const dur = mv.turns === 2 ? durationMs * 1.5 : durationMs;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        if (this.disposed) return resolve();
        const t = Math.min(1, (performance.now() - t0) / dur);
        pivot.quaternion.setFromAxisAngle(axis, total * easeInOut(t));
        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        for (const c of layer) {
          this.root.add(c.mesh);
          c.mesh.position.copy(c.home);
          c.mesh.quaternion.identity();
        }
        this.root.remove(pivot);
        finish();
        resolve();
      };
      requestAnimationFrame(step);
    });
  }

  dispose() {
    this.disposed = true;
    this.releaseCamWaiters();
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.element.remove();
  }
}
