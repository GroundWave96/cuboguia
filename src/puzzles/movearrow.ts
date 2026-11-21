/**
 * Seta curva que mostra o próximo giro no 3D (cubos e poliedros).
 *
 *  - giro de uma face: o arco fica deitado sobre a face
 *  - fatia interna, ponta, metade do Skewb: o arco é um anel em volta do puzzle, na altura da camada
 *  - meia volta (ou 2 cliques do Megaminx): duas pontas
 *
 * O arco é desenhado no 3D: visto pela câmera, ele aponta exatamente para onde as peças vão
 * andar. Uma cópia apagada aparece através do puzzle quando a face está do outro lado.
 */
import * as THREE from 'three';

export interface ArrowSpec {
  /** eixo do giro (unitário) */
  axis: THREE.Vector3;
  /** ângulo do giro: negativo = horário visto de fora (do lado do +eixo) */
  angle: number;
  /** a camada tem a face de cima do eixo? (arco sobre a face) */
  onFace: boolean;
  /** altura do arco ao longo do eixo */
  height: number;
  radius: number;
  /** espessura da linha */
  thickness: number;
}

/** curva dada por uma função t (0..1) → ponto */
class FnCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private fn: (t: number) => THREE.Vector3) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    return target.copy(this.fn(t));
  }
}

const CORE = 0x3fd0c9;
const EDGE = 0x061016;

export class MoveArrow {
  readonly group = new THREE.Group();
  private axis = new THREE.Vector3(0, 1, 0);
  private dir = 1;
  private disposables: { dispose(): void }[] = [];

  /** remonta a seta; a câmera decide de que lado o arco fica (o meio dele virado para ela) */
  set(spec: ArrowSpec | null, viewPos: THREE.Vector3) {
    this.clear();
    if (!spec) return;
    const axis = spec.axis.clone().normalize();
    this.axis = axis;
    this.dir = spec.angle < 0 ? -1 : 1;
    const double = Math.abs(spec.angle) > 2.3; // 144° do Megaminx e 180° dos cubos
    // u: direção da câmera projetada no plano do giro (o arco fica do lado que se vê)
    const toCam = viewPos.clone().normalize();
    let u = toCam.clone().sub(axis.clone().multiplyScalar(toCam.dot(axis)));
    if (u.lengthSq() < 1e-4) u = new THREE.Vector3(1, 0, 0).sub(axis.clone().multiplyScalar(axis.x));
    u.normalize();
    const w = new THREE.Vector3().crossVectors(axis, u); // ângulo crescente = anti-horário visto de fora
    const center = axis.clone().multiplyScalar(spec.height);
    const span = spec.onFace ? Math.PI * 1.25 : Math.PI * 0.95;
    const a0 = -this.dir * span / 2;
    const pointAt = (t: number) => {
      const a = a0 + this.dir * span * t;
      return center.clone().add(u.clone().multiplyScalar(Math.cos(a) * spec.radius)).add(w.clone().multiplyScalar(Math.sin(a) * spec.radius));
    };
    const curve = new FnCurve(pointAt);
    const tangentAt = (t: number) => pointAt(Math.min(1, t + 0.002)).sub(pointAt(Math.max(0, t - 0.002))).normalize();

    const th = spec.thickness;
    const mats = {
      // o contorno não grava profundidade: o miolo colorido, desenhado depois, aparece por dentro dele
      edge: new THREE.MeshBasicMaterial({ color: EDGE, depthWrite: false }),
      core: new THREE.MeshBasicMaterial({ color: CORE }),
      // a cópia que aparece através do puzzle
      ghost: new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0.28, depthTest: false, depthWrite: false }),
    };
    const headLen = th * 7, headR = th * 3.2;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, order = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = order;
      this.group.add(m);
      this.disposables.push(geo);
      return m;
    };
    // o arco termina antes da ponta (a ponta fica no fim)
    const bodyEnd = 1 - headLen / (span * spec.radius) * (double ? 1.6 : 0.85);
    const body = new FnCurve((t) => pointAt(t * bodyEnd));
    add(new THREE.TubeGeometry(body, 64, th * 1.7, 8, false), mats.edge, 1);
    add(new THREE.TubeGeometry(body, 64, th, 8, false), mats.core, 2);
    add(new THREE.TubeGeometry(body, 64, th, 8, false), mats.ghost, 10);
    const heads = double ? [1, 1 - (headLen * 0.95) / (span * spec.radius)] : [1];
    for (const t of heads) {
      const tip = curve.getPoint(t);
      const tan = tangentAt(t);
      for (const [geo, mat, order] of [
        [new THREE.ConeGeometry(headR * 1.35, headLen * 1.18, 20), mats.edge, 1],
        [new THREE.ConeGeometry(headR, headLen, 20), mats.core, 2],
        [new THREE.ConeGeometry(headR, headLen, 20), mats.ghost, 10],
      ] as const) {
        const m = add(geo, mat, order);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
        m.position.copy(tip).sub(tan.clone().multiplyScalar(headLen / 2));
      }
    }
    this.disposables.push(mats.edge, mats.core, mats.ghost);
  }

  /** a seta está na tela (e mexendo) */
  get active() {
    return this.group.children.length > 0;
  }

  /** um empurrãozinho no sentido do giro (chamado a cada quadro) */
  tick(timeMs: number) {
    if (!this.group.children.length) return;
    const k = 0.5 - 0.5 * Math.cos((timeMs / 1000) * 3.2);
    this.group.quaternion.setFromAxisAngle(this.axis, this.dir * 0.16 * k);
  }

  clear() {
    for (const c of [...this.group.children]) this.group.remove(c);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.group.quaternion.identity();
  }
}

/**
 * Onde desenhar a seta a partir dos adesivos da camada (posição e normal no 3D).
 * @param size raio aproximado do puzzle
 */
export function arrowFor(axis: THREE.Vector3, angle: number, layer: { pos: THREE.Vector3; normal: THREE.Vector3 }[], size: number): ArrowSpec {
  const ax = axis.clone().normalize();
  const radial = (p: THREE.Vector3) => p.clone().sub(ax.clone().multiplyScalar(p.dot(ax))).length();
  const top = layer.filter((s) => s.normal.dot(ax) > 0.99);
  const thickness = size * 0.026;
  if (top.length) {
    const h = Math.max(...top.map((s) => s.pos.dot(ax)));
    const r = Math.max(...top.map((s) => radial(s.pos)));
    return { axis: ax, angle, onFace: true, height: h + size * 0.06, radius: Math.max(r * 0.78, size * 0.25), thickness };
  }
  const h = layer.reduce((a, s) => a + s.pos.dot(ax), 0) / layer.length;
  const r = Math.max(...layer.map((s) => radial(s.pos)));
  // camadas pequenas (a ponta do Pyraminx): o anel não pode ficar minúsculo
  return { axis: ax, angle, onFace: false, height: h, radius: Math.max(r + size * 0.12, size * 0.42), thickness };
}
