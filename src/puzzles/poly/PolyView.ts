import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PuzzleState, PuzzleView } from '../../core/types';

type V3 = [number, number, number];

export interface PolyMoveInfo {
  axis: V3;
  /** radianos; negativo = horário visto de fora */
  angle: number;
  layer: number[];
  /** o plano de corte é dot(p, axis) = cut */
  cut: number;
}

export interface PolyViewOptions {
  stickers: { index: number; poly: V3[]; normal: V3 }[];
  bodyFaces: V3[][];
  palette: Record<string, string>;
  solved: PuzzleState;
  apply: (state: PuzzleState, move: string) => PuzzleState;
  locationMap: (move: string) => Int32Array;
  moveInfo: (move: string) => PolyMoveInfo;
  /** direção padrão da câmera e candidatas a "vista diagonal" */
  defaultDir: V3;
  viewDirs: V3[];
  radius: number;
  /**
   * Peças separadas (opcional): cada uma é um sólido convexo com seus adesivos.
   * Com elas o visual ganha frestas entre as peças e o giro move as peças de verdade.
   */
  pieces?: { faces: V3[][]; stickers: number[] }[];
  /** cantos arredondados dos adesivos (fração da menor aresta) */
  stickerRound?: number;
}

const UNKNOWN_HEX = '#3b4152';
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const v3 = (p: V3) => new THREE.Vector3(...p);

/** triangulação em leque de um polígono convexo */
function polyGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 1; i < points.length - 1; i++) pos.push(...points[0].toArray(), ...points[i].toArray(), ...points[i + 1].toArray());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** adesivo com cantos arredondados, desenhado no plano da face (frame u, w, n) */
function roundedSticker(points: THREE.Vector3[], normal: THREE.Vector3, scale: number, roundFrac: number) {
  const c = points.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
  const u = points[0].clone().sub(c).normalize();
  const w = new THREE.Vector3().crossVectors(normal, u).normalize();
  let pts = points.map((p) => {
    const d = p.clone().sub(c);
    return new THREE.Vector2(d.dot(u) * scale, d.dot(w) * scale);
  });
  // garante sentido anti-horário no plano
  let area = 0;
  for (let i = 0; i < pts.length; i++) area += pts[i].x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * pts[i].y;
  if (area < 0) pts = pts.reverse();
  const edges = pts.map((p, i) => p.distanceTo(pts[(i + 1) % pts.length]));
  const r0 = Math.min(...edges) * roundFrac;
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const r = Math.min(r0, p.distanceTo(prev) * 0.45, p.distanceTo(next) * 0.45);
    const a = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(r));
    const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r));
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 5);
  const basis = new THREE.Matrix4().makeBasis(u, w, normal);
  return { geo, center: c, quat: new THREE.Quaternion().setFromRotationMatrix(basis) };
}

/** corta um polígono convexo pelo semiespaço dot(p, n) * sign >= c * sign */
function clip(poly: THREE.Vector3[], n: THREE.Vector3, c: number, keepAbove: boolean): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const side = (p: THREE.Vector3) => (p.dot(n) - c) * (keepAbove ? 1 : -1);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa * sb < 0) out.push(a.clone().lerp(b, sa / (sa - sb)));
  }
  return out;
}

/** Visual 3D de um poliedro com adesivos (Megaminx, Pyraminx...). */
export class PolyView implements PuzzleView {
  readonly element: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private body: THREE.Mesh;
  private pieceMeshes: THREE.Mesh[] = [];
  private pieceHomes: { pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
  private pieceOfSticker = new Map<number, number>();
  private bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
  private stickerMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  private homes: { pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
  private state: PuzzleState;
  private highlight = new Set<number>();
  private clickCb: ((i: number) => void) | null = null;
  private interactive = false;
  private hovered = -1;
  private raf = 0;
  private ro: ResizeObserver;
  private queue: Promise<void> = Promise.resolve();
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private readonly defaultCamPos: THREE.Vector3;
  private camTween: { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number } | null = null;
  private camWaiters: (() => void)[] = [];

  constructor(container: HTMLElement, private o: PolyViewOptions) {
    this.state = [...o.solved];
    this.element = document.createElement('div');
    this.element.className = 'puzzle-view';
    container.appendChild(this.element);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.element.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
    this.defaultCamPos = v3(o.defaultDir).normalize().multiplyScalar(o.radius * 5.4);
    this.camera.position.copy(this.defaultCamPos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
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

    this.body = this.buildBody(o.bodyFaces.map((f) => f.map(v3)));
    if (o.pieces) {
      // núcleo escuro (aparece nas frestas) + uma malha por peça
      this.body.scale.setScalar(0.9);
      o.pieces.forEach((pc, pi) => {
        const mesh = this.buildBody(pc.faces.map((f) => f.map(v3)));
        this.root.add(mesh);
        this.pieceMeshes.push(mesh);
        this.pieceHomes.push({ pos: mesh.position.clone(), quat: mesh.quaternion.clone() });
        pc.stickers.forEach((i) => this.pieceOfSticker.set(i, pi));
      });
    }
    this.root.add(this.body);
    for (const st of o.stickers) {
      const n = v3(st.normal);
      const pts = st.poly.map(v3);
      const mat = new THREE.MeshStandardMaterial({ color: UNKNOWN_HEX, roughness: 0.32, metalness: 0.02, side: THREE.DoubleSide });
      let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      if (o.stickerRound) {
        const r = roundedSticker(pts, n, 0.9, o.stickerRound);
        mesh = new THREE.Mesh(r.geo, mat);
        mesh.position.copy(r.center.clone().add(n.clone().multiplyScalar(o.radius * 0.004)));
        mesh.quaternion.copy(r.quat);
      } else {
        const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
        const local = pts.map((p) => p.clone().sub(c).multiplyScalar(0.91));
        mesh = new THREE.Mesh(polyGeometry(local), mat);
        mesh.position.copy(c.clone().add(n.clone().multiplyScalar(o.radius * 0.006)));
      }
      mesh.userData.index = st.index;
      this.root.add(mesh);
      this.stickerMeshes[st.index] = mesh;
      this.homes[st.index] = { pos: mesh.position.clone(), quat: mesh.quaternion.clone() };
    }
    this.setState(this.state);

    const el = this.renderer.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 600 && this.clickCb) {
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

  private buildBody(faces: THREE.Vector3[][]) {
    const geos = faces.map((f) => polyGeometry(f.map((p) => p.clone().multiplyScalar(0.995))));
    const merged = new THREE.BufferGeometry();
    const pos: number[] = [];
    geos.forEach((g) => pos.push(...(g.getAttribute('position').array as Float32Array)));
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.computeVertexNormals();
    return new THREE.Mesh(merged, this.bodyMat);
  }

  /** corpo cortado pelo plano: parte que gira (cap) e o resto, cada um com a tampa do corte */
  private splitBody(n: THREE.Vector3, c: number) {
    const faces = this.o.bodyFaces.map((f) => f.map(v3));
    const capFaces = faces.map((f) => clip(f, n, c, true)).filter((f) => f.length >= 3);
    const restFaces = faces.map((f) => clip(f, n, c, false)).filter((f) => f.length >= 3);
    // tampa do corte: pontos sobre o plano, em ordem angular
    const onPlane = capFaces.flat().filter((p) => Math.abs(p.dot(n) - c) < 1e-6);
    const center = onPlane.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, onPlane.length));
    const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const w = new THREE.Vector3().crossVectors(n, u);
    const uniq: THREE.Vector3[] = [];
    for (const p of onPlane) if (!uniq.some((q) => q.distanceToSquared(p) < 1e-10)) uniq.push(p);
    uniq.sort((a, b) => Math.atan2(a.clone().sub(center).dot(w), a.clone().sub(center).dot(u)) - Math.atan2(b.clone().sub(center).dot(w), b.clone().sub(center).dot(u)));
    if (uniq.length >= 3) {
      capFaces.push(uniq);
      restFaces.push(uniq);
    }
    return { cap: this.buildBody(capFaces), rest: this.buildBody(restFaces) };
  }

  private pick(e: PointerEvent): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hits = this.raycaster.intersectObjects([this.body, ...this.pieceMeshes, ...this.stickerMeshes], false);
    const h = hits[0];
    return h && typeof h.object.userData.index === 'number' ? h.object.userData.index : -1;
  }

  private resize() {
    const w = this.element.clientWidth || 1, h = this.element.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
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
      for (const i of this.highlight) this.stickerMeshes[i]?.material.emissive.setRGB(k, k, k);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private refreshColors() {
    const dim = this.highlight.size > 0;
    this.stickerMeshes.forEach((m, i) => {
      m.material.color.set(this.o.palette[this.state[i]] ?? UNKNOWN_HEX);
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

  /** escolhe, entre as vistas diagonais, a que mostra melhor os adesivos em foco */
  focusCamera(stickers: number[]) {
    if (!stickers.length) return;
    const normals = stickers.map((i) => v3(this.o.stickers.find((s) => s.index === i)!.normal));
    const cur = this.camera.position.clone().normalize();
    let best = this.defaultCamPos.clone().normalize(), bestScore = -Infinity;
    for (const d0 of this.o.viewDirs) {
      const d = v3(d0).normalize();
      const seen = normals.reduce((a, n) => a + Math.max(0, n.dot(d)), 0) / normals.length;
      const score = seen * 3 + (d.z > 0 ? 0.35 : 0) + (d.y > 0 ? 0.25 : 0) + (d.dot(cur) > 0.97 ? 0.15 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    if (cur.angleTo(best) < 0.07) return;
    const dist = this.camera.position.length();
    this.camTween = { from: this.camera.position.clone(), to: best.multiplyScalar(dist), t0: performance.now(), dur: 650 };
  }

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
    const a = tw.from.clone().normalize();
    const full = new THREE.Quaternion().setFromUnitVectors(a, tw.to.clone().normalize());
    const q = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), full, k);
    this.camera.position.copy(a.applyQuaternion(q).multiplyScalar(len));
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
    this.queue = this.queue.then(() => (durationMs > 0 ? this.cameraSettled() : undefined)).then(() => this.runMove(move, durationMs));
    return this.queue;
  }

  private runMove(move: string, durationMs: number): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const finish = () => {
      const map = this.o.locationMap(move);
      this.state = this.o.apply(this.state, move);
      this.highlight = new Set([...this.highlight].map((i) => map[i]));
      this.refreshColors();
    };
    if (durationMs <= 0) {
      finish();
      return Promise.resolve();
    }
    const info = this.o.moveInfo(move);
    const axis = v3(info.axis).normalize();
    const pivot = new THREE.Group();
    this.root.add(pivot);
    const layer = info.layer.map((i) => this.stickerMeshes[i]);
    const usePieces = this.pieceMeshes.length > 0;
    const movingPieces = usePieces ? [...new Set(info.layer.map((i) => this.pieceOfSticker.get(i)!))].map((pi) => this.pieceMeshes[pi]) : [];
    let cap: THREE.Mesh | null = null, rest: THREE.Mesh | null = null;
    if (usePieces) for (const pm of movingPieces) pivot.attach(pm);
    else {
      ({ cap, rest } = this.splitBody(axis, info.cut));
      this.body.visible = false;
      this.root.add(rest);
      pivot.add(cap);
    }
    for (const m of layer) pivot.attach(m);
    const dur = Math.abs(info.angle) > 1.5 ? durationMs * 1.4 : durationMs;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        if (this.disposed) return resolve();
        const t = Math.min(1, (performance.now() - t0) / dur);
        pivot.quaternion.setFromAxisAngle(axis, info.angle * easeInOut(t));
        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        for (const m of layer) {
          this.root.add(m);
          const h = this.homes[m.userData.index as number];
          m.position.copy(h.pos);
          m.quaternion.copy(h.quat);
        }
        // peças voltam para casa: pela simetria, cada uma tem o mesmo formato da que estava lá
        for (const pm of movingPieces) {
          this.root.add(pm);
          const h = this.pieceHomes[this.pieceMeshes.indexOf(pm)];
          pm.position.copy(h.pos);
          pm.quaternion.copy(h.quat);
        }
        this.root.remove(pivot);
        if (cap && rest) {
          this.root.remove(rest);
          cap.geometry.dispose();
          rest.geometry.dispose();
        }
        this.body.visible = true;
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
