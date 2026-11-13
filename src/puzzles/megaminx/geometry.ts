/**
 * Geometria do Megaminx: dodecaedro com 12 faces, cada uma com 11 adesivos
 * (1 centro, 5 cantos, 5 arestas) = 132 adesivos.
 *
 * Índice do adesivo: face * 11 + s
 *   s = 0        centro
 *   s = 1..5     canto no vértice i = s-1
 *   s = 6..10    aresta entre os vértices i e i+1 (i = s-6)
 *
 * Orientação: U (cima) com normal +y, F (frente) na direção +z.
 * Anel de cima (vizinhos de U), em azimute crescente (da frente para a direita):
 *   F 0°, R 72°, BR 144°, BL 216°, L 288°
 * Anel de baixo (vizinhos de D): DR 36°, DBR 108°, B 180°, DBL 252°, DL 324°
 *
 * Os movimentos são calculados geometricamente, girando os adesivos da camada.
 */
export type V3 = [number, number, number];

export const FACES = ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'D'] as const;
export type MegaFace = (typeof FACES)[number];
export const STICKERS = 132;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));
const lerp = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));
const det3 = (a: V3, b: V3, c: V3) => dot(a, cross(b, c));

/** rotação de um vetor em torno de um eixo unitário (regra da mão direita) */
export function rotate(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  const k = dot(axis, v);
  const cr = cross(axis, v);
  return [v[0] * c + cr[0] * s + axis[0] * k * (1 - c), v[1] * c + cr[1] * s + axis[1] * k * (1 - c), v[2] * c + cr[2] * s + axis[2] * k * (1 - c)];
}

export interface MegaSticker {
  index: number;
  face: number;
  kind: 'center' | 'corner' | 'edge';
  /** polígono 3D (no plano da face) */
  poly: V3[];
  centroid: V3;
}

export interface ParsedMegaMove {
  face: number;
  /** cliques de 72° no sentido horário (visto de fora): 1, 2, 3 (= -2) ou 4 (= -1) */
  clicks: number;
}

/** Proporções dos adesivos (iguais em todas as faces, então a simetria é exata). */
export const EDGE_T = 0.32; // onde a aresta é cortada
/** pentágono central do tamanho certo para os cortes serem planos (como no megaminx real) */
const C36 = Math.cos(Math.PI / 5), C108 = Math.cos((3 * Math.PI) / 5);
export const INNER = ((1 - EDGE_T) * C36 + EDGE_T * C108) / C36;

class MegaminxGeometry {
  readonly vertices: V3[] = [];
  readonly normals: V3[] = [];
  /** vértices de cada face, em sentido anti-horário visto de fora */
  readonly faceVerts: number[][] = [];
  readonly stickers: MegaSticker[] = [];
  /** cantos: 3 adesivos por vértice do dodecaedro; arestas: 2 adesivos por aresta */
  readonly corners: number[][] = [];
  readonly edges: number[][] = [];
  /** faces vizinhas de cada face */
  readonly neighbors: number[][] = [];
  private permCache = new Map<string, Int32Array>();
  private layers: number[][] = [];

  constructor() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const ip = 1 / phi;
    const raw: V3[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) raw.push([x, y, z]);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        raw.push([0, a * ip, b * phi]);
        raw.push([a * ip, b * phi, 0]);
        raw.push([a * phi, 0, b * ip]);
      }
    const rawNormals: V3[] = [];
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        rawNormals.push(norm([a, 0, b * phi]));
        rawNormals.push(norm([0, a * phi, b]));
        rawNormals.push(norm([a * phi, b, 0]));
      }
    // base: U para cima e F para a frente
    const nU = rawNormals[rawNormals.length - 1];
    const nF = rawNormals.find((n) => Math.abs(dot(n, nU) - 1 / Math.sqrt(5)) < 1e-6)!;
    const yAxis = nU;
    const zAxis = norm(sub(nF, mul(yAxis, dot(nF, yAxis))));
    const xAxis = cross(yAxis, zAxis);
    const toView = (p: V3): V3 => [dot(p, xAxis), dot(p, yAxis), dot(p, zAxis)];
    const verts = raw.map(toView);
    const scale = 1 / Math.hypot(...verts[0]); // raio circunscrito = 1
    verts.forEach((v) => this.vertices.push(mul(v, scale)));
    const ns = rawNormals.map(toView);

    // classifica as normais nas 12 faces nomeadas
    const az = (n: V3) => ((Math.atan2(n[0], n[2]) * 180) / Math.PI + 360) % 360;
    const pick = (y: number, azimuth: number) =>
      ns.find((n) => Math.abs(n[1] - y) < 1e-3 && Math.min(Math.abs(az(n) - azimuth), 360 - Math.abs(az(n) - azimuth)) < 1)!;
    const s5 = 1 / Math.sqrt(5);
    const byName: Record<MegaFace, V3> = {
      U: ns.find((n) => n[1] > 0.99)!,
      F: pick(s5, 0),
      R: pick(s5, 72),
      BR: pick(s5, 144),
      BL: pick(s5, 216),
      L: pick(s5, 288),
      DR: pick(-s5, 36),
      DBR: pick(-s5, 108),
      B: pick(-s5, 180),
      DBL: pick(-s5, 252),
      DL: pick(-s5, 324),
      D: ns.find((n) => n[1] < -0.99)!,
    };
    FACES.forEach((f) => this.normals.push(byName[f]));

    // vértices de cada face (os 5 mais alinhados com a normal), anti-horário visto de fora
    this.normals.forEach((n) => {
      const ids = this.vertices
        .map((v, i) => ({ i, d: dot(v, n) }))
        .sort((a, b) => b.d - a.d)
        .slice(0, 5)
        .map((x) => x.i);
      const c = mul(ids.reduce((acc, i) => add(acc, this.vertices[i]), [0, 0, 0] as V3), 1 / 5);
      // começa pelo vértice mais "alto" na vista natural da face (para numeração estável)
      const up = Math.abs(n[1]) > 0.99 ? ([0, 0, n[1] > 0 ? -1 : 1] as V3) : norm(sub([0, 1, 0], mul(n, n[1])));
      const right = cross(mul(n, -1), up);
      const ang = (i: number) => {
        const d = sub(this.vertices[i], c);
        return Math.atan2(dot(d, cross(n, up)), dot(d, up));
      };
      // anti-horário (regra da mão direita em torno de n) a partir do topo
      ids.sort((a, b) => ((ang(a) + 2 * Math.PI) % (2 * Math.PI)) - ((ang(b) + 2 * Math.PI) % (2 * Math.PI)));
      void right;
      this.faceVerts.push(ids);
    });

    // vizinhos: faces que compartilham 2 vértices
    this.faceVerts.forEach((vs, f) => {
      this.neighbors.push(this.faceVerts.map((ws, g) => (g !== f && ws.filter((w) => vs.includes(w)).length === 2 ? g : -1)).filter((g) => g >= 0));
    });

    // adesivos
    this.faceVerts.forEach((vs, f) => {
      const V = vs.map((i) => this.vertices[i]);
      const C = mul(V.reduce((a, v) => add(a, v), [0, 0, 0] as V3), 1 / 5);
      const P = V.map((v) => lerp(C, v, INNER));
      const e = (i: number, j: number) => lerp(V[i], V[j], EDGE_T);
      const mk = (s: number, kind: MegaSticker['kind'], poly: V3[]) => {
        const centroid = mul(poly.reduce((a, p) => add(a, p), [0, 0, 0] as V3), 1 / poly.length);
        this.stickers.push({ index: f * 11 + s, face: f, kind, poly, centroid });
      };
      mk(0, 'center', P);
      for (let i = 0; i < 5; i++) mk(1 + i, 'corner', [V[i], e(i, (i + 1) % 5), P[i], e(i, (i + 4) % 5)]);
      for (let i = 0; i < 5; i++) mk(6 + i, 'edge', [e(i, (i + 1) % 5), e((i + 1) % 5, i), P[(i + 1) % 5], P[i]]);
    });

    // peças: cantos por vértice e arestas por par de vértices
    this.vertices.forEach((_, vi) => {
      const st: number[] = [];
      this.faceVerts.forEach((vs, f) => {
        const k = vs.indexOf(vi);
        if (k >= 0) st.push(f * 11 + 1 + k);
      });
      this.corners.push(this.orderAround(st, this.vertices[vi]));
    });
    const seen = new Set<string>();
    this.faceVerts.forEach((vs, f) => {
      for (let i = 0; i < 5; i++) {
        const a = vs[i], b = vs[(i + 1) % 5];
        const key = [a, b].sort((x, y) => x - y).join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const g = this.faceVerts.findIndex((ws, gi) => gi !== f && ws.includes(a) && ws.includes(b));
        const ws = this.faceVerts[g];
        const j = ws.indexOf(b) === (ws.indexOf(a) + 1) % 5 ? ws.indexOf(a) : ws.indexOf(b);
        this.edges.push([f * 11 + 6 + i, g * 11 + 6 + j]);
      }
    });

    // camadas: os 26 adesivos mais próximos de cada face (11 da face + 15 vizinhos)
    this.normals.forEach((n) => {
      const ds = this.stickers.map((s) => ({ i: s.index, d: dot(s.centroid, n) })).sort((a, b) => b.d - a.d);
      this.layers.push(ds.slice(0, 26).map((x) => x.i));
    });
  }

  /** ordena os adesivos de um canto em sentido horário visto de fora (como no 3x3) */
  private orderAround(st: number[], v: V3): number[] {
    const [a, b, c] = st;
    const na = this.normals[Math.floor(a / 11)], nb = this.normals[Math.floor(b / 11)], nc = this.normals[Math.floor(c / 11)];
    void v;
    return det3(na, nb, nc) < 0 ? [a, b, c] : [a, c, b];
  }

  /** distância do plano de corte da camada de uma face ao centro */
  cutOf(face: number): number {
    const n = this.normals[face];
    const vs = this.faceVerts[face];
    const g = this.neighbors[face][0];
    const shared = this.faceVerts[g].filter((v) => vs.includes(v));
    const gv = this.faceVerts[g];
    const a = shared[0];
    const ia = gv.indexOf(a);
    const w = [gv[(ia + 1) % 5], gv[(ia + 4) % 5]].find((x) => !vs.includes(x))!;
    return dot(lerp(this.vertices[a], this.vertices[w], EDGE_T), n);
  }

  faceOf(i: number) {
    return Math.floor(i / 11);
  }

  layer(face: number) {
    return this.layers[face];
  }

  parse(move: string): ParsedMegaMove {
    const m = /^(U|F|R|L|BR|BL|DR|DL|DBR|DBL|B|D)(2?)('?)$/.exec(move.trim());
    if (!m) throw new Error(`Movimento inválido: ${move}`);
    const face = FACES.indexOf(m[1] as MegaFace);
    const k = (m[2] ? 2 : 1) * (m[3] ? -1 : 1);
    return { face, clicks: ((k % 5) + 5) % 5 };
  }

  /** perm tal que novoEstado[i] = estadoAntigo[perm[i]] */
  permutation(move: string): Int32Array {
    const hit = this.permCache.get(move);
    if (hit) return hit;
    const { face, clicks } = this.parse(move);
    const n = this.normals[face];
    const perm = Int32Array.from({ length: STICKERS }, (_, i) => i);
    const ang = (-2 * Math.PI * clicks) / 5; // horário visto de fora
    const layer = this.layers[face];
    for (const src of layer) {
      const p = rotate(this.stickers[src].centroid, n, ang);
      let best = -1, bd = Infinity;
      for (const t of layer) {
        const q = this.stickers[t].centroid;
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (bd > 1e-6) throw new Error('geometria do megaminx inconsistente');
      perm[best] = src;
    }
    this.permCache.set(move, perm);
    return perm;
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
    return this.stickers.map((s) => FACES[s.face]);
  }

  /** ângulo (rad) do movimento, horário visto de fora = negativo */
  moveAngle(move: string) {
    const { clicks } = this.parse(move);
    const signed = clicks <= 2 ? clicks : clicks - 5;
    return (-2 * Math.PI * signed) / 5;
  }

  randomScramble(len = 45): string[] {
    const out: string[] = [];
    let last = -1;
    while (out.length < len) {
      const f = Math.floor(Math.random() * 12);
      if (f === last) continue;
      out.push(FACES[f] + ['', "'", '2', "2'"][Math.floor(Math.random() * 4)]);
      last = f;
    }
    return out;
  }
}

export const megaGeo = new MegaminxGeometry();
export { MegaminxGeometry };

export function invertMegaMove(move: string): string {
  if (move.endsWith("'")) return move.slice(0, -1);
  return move + "'";
}
