/**
 * Geometria do Skewb: um cubo cortado por 4 planos que passam pelo centro
 * (perpendiculares às diagonais). Cada face tem 5 adesivos: o quadrado do meio
 * (girado 45°) e 4 triângulos nos cantos — 30 adesivos.
 *
 * Peças: 8 cantos (3 adesivos) e 6 centros (1 adesivo). Os centros MUDAM de lugar.
 *
 * Faces na ordem do 3x3 (U R F D L B); adesivo f*5 + k com k = 0 centro,
 * 1 sup-esq, 2 sup-dir, 3 inf-dir, 4 inf-esq, como a face é vista de frente
 * (mesmo "direita/baixo" das faces dos cubos NxN).
 *
 * Movimentos (notação WCA): giro de 120° da metade do puzzle em volta de um canto,
 * no sentido horário olhando o canto de fora (' = anti-horário):
 *   R = canto de baixo-trás-direita   U = canto de cima-trás-esquerda
 *   L = canto de baixo-frente-esquerda B = canto de baixo-trás-esquerda
 * Nenhum deles mexe no canto de cima-frente-direita: ele é a referência.
 */
import { FACE_FRAME, FACE_ORDER } from '../nxn/geometry';

export type V3 = [number, number, number];

export const STICKERS = 30;
/** meia aresta do cubo: os vértices ficam a distância 1 do centro */
export const H = 1 / Math.sqrt(3);
export const MOVE_CORNERS: Record<string, V3> = {
  R: [1, -1, -1],
  U: [-1, 1, -1],
  L: [-1, -1, 1],
  B: [-1, -1, -1],
};
export const MOVES = ['R', "R'", 'U', "U'", 'L', "L'", 'B', "B'"];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (...vs: V3[]): V3 => vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0] as V3);
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));
const close = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;

function rotate(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  const k = dot(axis, v);
  const cr = cross(axis, v);
  return [v[0] * c + cr[0] * s + axis[0] * k * (1 - c), v[1] * c + cr[1] * s + axis[1] * k * (1 - c), v[2] * c + cr[2] * s + axis[2] * k * (1 - c)];
}

export interface SkewbSticker {
  index: number;
  face: number;
  kind: 'center' | 'corner';
  /** canto do cubo (sinais ±1) dos triângulos */
  corner?: V3;
  poly: V3[];
  centroid: V3;
  normal: V3;
}

export class SkewbGeometry {
  readonly stickers: SkewbSticker[] = [];
  /** cantos: vértice (sinais) e os 3 adesivos, em volta do vértice no sentido horário visto de fora */
  readonly corners: { vertex: V3; stickers: number[] }[] = [];
  readonly centers: number[] = [];
  /** faces do cubo (para o corpo do visual 3D) */
  readonly bodyFaces: V3[][];
  private permCache = new Map<string, Int32Array>();

  constructor() {
    FACE_ORDER.forEach((fk, f) => {
      const { n, r, d } = FACE_FRAME[fk];
      const P = (a: number, b: number): V3 => mul(add(n, mul(r, a), mul(d, b)), H);
      const polys: V3[][] = [
        [P(0, -1), P(1, 0), P(0, 1), P(-1, 0)], // centro (losango)
        [P(-1, -1), P(0, -1), P(-1, 0)], // sup-esq
        [P(1, -1), P(1, 0), P(0, -1)], // sup-dir
        [P(1, 1), P(0, 1), P(1, 0)], // inf-dir
        [P(-1, 1), P(-1, 0), P(0, 1)], // inf-esq
      ];
      const cornerOf = [null, [-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
      polys.forEach((poly, k) => {
        const centroid = mul(add(...poly), 1 / poly.length);
        const c = cornerOf[k];
        this.stickers.push({
          index: f * 5 + k,
          face: f,
          kind: k ? 'corner' : 'center',
          corner: c ? (add(n, mul(r, c[0]), mul(d, c[1])) as V3) : undefined,
          poly,
          centroid,
          normal: n as V3,
        });
      });
      this.centers.push(f * 5);
    });
    for (const x of [1, -1])
      for (const y of [1, -1])
        for (const z of [1, -1]) {
          const vertex: V3 = [x, y, z];
          const st = this.stickers.filter((s) => s.corner && close(s.corner, vertex)).map((s) => s.index);
          this.corners.push({ vertex, stickers: this.orderAround(st, vertex) });
        }
    this.bodyFaces = FACE_ORDER.map((fk) => {
      const { n, r, d } = FACE_FRAME[fk];
      const P = (a: number, b: number): V3 => mul(add(n, mul(r, a), mul(d, b)), H);
      return [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
    });
  }

  /** adesivos de um canto em volta do vértice, no sentido horário visto de fora */
  private orderAround(st: number[], vertex: V3): number[] {
    const axis = norm(vertex);
    const u = norm(this.stickers[st[0]].normal);
    const w = cross(axis, u);
    const ang = (i: number) => {
      const p = this.stickers[i].normal;
      return Math.atan2(dot(p, w), dot(p, u));
    };
    return [...st].sort((a, b) => ang(b) - ang(a));
  }

  parse(move: string): { corner: V3; clicks: 1 | 2 } {
    const m = /^([RULB])('?)$/.exec(move.trim());
    if (!m) throw new Error(`Movimento inválido: ${move}`);
    return { corner: MOVE_CORNERS[m[1]], clicks: m[2] ? 2 : 1 };
  }

  axis(move: string): V3 {
    return norm(this.parse(move).corner);
  }

  /** ângulo do giro: horário visto de fora do canto = negativo */
  moveAngle(move: string) {
    return this.parse(move).clicks === 1 ? (-2 * Math.PI) / 3 : (2 * Math.PI) / 3;
  }

  /** a metade do puzzle que gira (o lado do canto) */
  layer(move: string): number[] {
    const ax = this.axis(move);
    return this.stickers.filter((s) => dot(s.centroid, ax) > 0).map((s) => s.index);
  }

  /** novo[i] = antigo[perm[i]] para uma rotação dos adesivos `which` */
  private rotationPerm(which: number[], axis: V3, ang: number): Int32Array {
    const perm = Int32Array.from({ length: STICKERS }, (_, i) => i);
    for (const src of which) {
      const s = this.stickers[src];
      const p = rotate(s.centroid, axis, ang);
      const nrm = rotate(s.normal, axis, ang);
      const t = which.find((q) => close(this.stickers[q].centroid, p) && close(this.stickers[q].normal, nrm));
      if (t === undefined) throw new Error('geometria do skewb inconsistente');
      perm[t] = src;
    }
    return perm;
  }

  permutation(move: string): Int32Array {
    let p = this.permCache.get(move);
    if (!p) this.permCache.set(move, (p = this.rotationPerm(this.layer(move), this.axis(move), this.moveAngle(move))));
    return p;
  }

  /** gira o puzzle inteiro ¼ de volta em torno de x, y ou z (para achar a posição de referência) */
  wholeTurn(axis: V3): Int32Array {
    return this.rotationPerm(
      this.stickers.map((s) => s.index),
      axis,
      -Math.PI / 2,
    );
  }

  locationMap(move: string): Int32Array {
    const p = this.permutation(move);
    const m = new Int32Array(STICKERS);
    for (let i = 0; i < STICKERS; i++) m[p[i]] = i;
    return m;
  }

  apply<T>(state: T[], move: string): T[] {
    const p = this.permutation(move);
    return Array.from({ length: STICKERS }, (_, i) => state[p[i]]);
  }

  solved(): string[] {
    return this.stickers.map((s) => FACE_ORDER[s.face]);
  }
}

export const skewbGeo = new SkewbGeometry();

/** as 24 posições do puzzle inteiro (novo[i] = antigo[p[i]]) */
export const SKEWB_ROTATIONS: Int32Array[] = (() => {
  const gens = [skewbGeo.wholeTurn([1, 0, 0]), skewbGeo.wholeTurn([0, 1, 0])];
  const id = Int32Array.from({ length: STICKERS }, (_, i) => i);
  const seen = new Map<string, Int32Array>([[id.join(), id]]);
  let frontier = [id];
  while (frontier.length) {
    const next: Int32Array[] = [];
    for (const p of frontier)
      for (const g of gens) {
        const r = Int32Array.from(g, (gi) => p[gi]);
        const k = r.join();
        if (!seen.has(k)) {
          seen.set(k, r);
          next.push(r);
        }
      }
    frontier = next;
  }
  return [...seen.values()];
})();

/** o canto de referência (cima-frente-direita), que nenhum movimento do tutorial mexe */
export const REFERENCE_CORNER = skewbGeo.corners.find((c) => c.vertex[0] === 1 && c.vertex[1] === 1 && c.vertex[2] === 1)!;

export const invertSkewbMove = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");

export function randomScramble(len = 11): string[] {
  const out: string[] = [];
  let last = '';
  while (out.length < len) {
    const v = 'RULB'[Math.floor(Math.random() * 4)];
    if (v === last) continue;
    out.push(v + (Math.random() < 0.5 ? '' : "'"));
    last = v;
  }
  return out;
}
