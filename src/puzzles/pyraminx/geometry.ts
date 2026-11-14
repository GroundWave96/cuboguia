/**
 * Geometria do Pyraminx: tetraedro com 4 faces de 9 triângulos (36 adesivos).
 *
 * Vértices: U (cima), L (frente-esquerda), R (frente-direita), B (trás), com a
 * face D apoiada embaixo. Faces (chave = cor):
 *   F = (U, L, R) frente     D = (L, R, B) base
 *   L = (U, B, L) trás-esq.  R = (U, R, B) trás-dir.
 *
 * Peças: 4 pontas (3 adesivos), 4 centros (3 adesivos, só giram no lugar),
 * 6 arestas (2 adesivos). Movimentos de 120°:
 *   U L R B  = camada grande do vértice (ponta + centro + 3 arestas)
 *   u l r b  = só a ponta
 */
export type V3 = [number, number, number];

export const FACE_KEYS = ['F', 'D', 'L', 'R'] as const;
export const VERTS = ['U', 'L', 'R', 'B'] as const;
export const STICKERS = 36;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));

function rotate(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  const k = dot(axis, v);
  const cr = cross(axis, v);
  return [v[0] * c + cr[0] * s + axis[0] * k * (1 - c), v[1] * c + cr[1] * s + axis[1] * k * (1 - c), v[2] * c + cr[2] * s + axis[2] * k * (1 - c)];
}

/** profundidade dos cortes ao longo do eixo de um vértice (vértice em 1, face oposta em -1/3) */
export const LAYER_CUT = 1 / 9;
export const TIP_CUT = 5 / 9;

export interface PyraSticker {
  index: number;
  face: number;
  kind: 'tip' | 'center' | 'edge';
  poly: V3[];
  centroid: V3;
  /** vértice (pontas e centros) ou par de vértices (arestas) */
  verts: number[];
}

class PyraminxGeometry {
  readonly vertices: V3[];
  /** vértices de cada face, anti-horário visto de fora */
  readonly faceVerts: number[][];
  readonly normals: V3[];
  readonly stickers: PyraSticker[] = [];
  readonly tips: number[][] = [];
  readonly centers: number[][] = [];
  readonly edges: number[][] = [];
  private permCache = new Map<string, Int32Array>();

  constructor() {
    const r = Math.sqrt(8) / 3;
    const s60 = Math.sin(Math.PI / 3), c60 = Math.cos(Math.PI / 3);
    this.vertices = [
      [0, 1, 0], // U
      [-r * s60, -1 / 3, r * c60], // L
      [r * s60, -1 / 3, r * c60], // R
      [0, -1 / 3, -r], // B
    ];
    const raw = [
      [0, 1, 2], // F
      [1, 2, 3], // D
      [0, 3, 1], // L (trás-esquerda)
      [0, 2, 3], // R (trás-direita)
    ];
    // ordena cada face no sentido anti-horário visto de fora
    this.faceVerts = raw.map((f) => {
      const [a, b, c] = f.map((i) => this.vertices[i]);
      const n = cross(sub(b, a), sub(c, a));
      const center = mul(add(add(a, b), c), 1 / 3);
      return dot(n, center) > 0 ? f : [f[0], f[2], f[1]];
    });
    this.normals = this.faceVerts.map((f) => {
      const [a, b, c] = f.map((i) => this.vertices[i]);
      return norm(cross(sub(b, a), sub(c, a)));
    });

    // 9 triângulos por face (subdivisão 3x3)
    this.faceVerts.forEach((fv, f) => {
      const [A, Bv, C] = fv.map((i) => this.vertices[i]);
      const P = (i: number, j: number): V3 => add(A, add(mul(sub(Bv, A), i / 3), mul(sub(C, A), j / 3)));
      const tris: V3[][] = [];
      for (let i = 0; i <= 2; i++) for (let j = 0; i + j <= 2; j++) tris.push([P(i, j), P(i + 1, j), P(i, j + 1)]);
      for (let i = 0; i <= 1; i++) for (let j = 0; i + j <= 1; j++) tris.push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
      tris.forEach((poly, k) => {
        const centroid = mul(poly.reduce((a, p) => add(a, p), [0, 0, 0] as V3), 1 / 3);
        const ds = this.vertices.map((v) => dot(centroid, norm(v)));
        const order = [0, 1, 2, 3].sort((x, y) => ds[y] - ds[x]);
        const up = k < 6;
        const kind: PyraSticker['kind'] = ds[order[0]] > TIP_CUT ? 'tip' : up ? 'edge' : 'center';
        this.stickers.push({ index: f * 9 + k, face: f, kind, poly, centroid, verts: kind === 'edge' ? order.slice(0, 2).sort() : [order[0]] });
      });
    });
    // agrupa as peças (cantos ordenados no sentido horário visto de fora)
    for (let v = 0; v < 4; v++) {
      this.tips.push(this.orderAround(this.stickers.filter((s) => s.kind === 'tip' && s.verts[0] === v).map((s) => s.index), v));
      this.centers.push(this.orderAround(this.stickers.filter((s) => s.kind === 'center' && s.verts[0] === v).map((s) => s.index), v));
    }
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) this.edges.push(this.stickers.filter((s) => s.kind === 'edge' && s.verts[0] === a && s.verts[1] === b).map((s) => s.index));
  }

  private orderAround(st: number[], v: number): number[] {
    const axis = norm(this.vertices[v]);
    const c = mul(st.reduce((a, i) => add(a, this.stickers[i].centroid), [0, 0, 0] as V3), 1 / st.length);
    const u = norm(sub(this.stickers[st[0]].centroid, c));
    const w = cross(axis, u);
    // horário visto de fora = ângulo decrescente em torno do eixo
    return [...st].sort((a, b) => {
      const da = sub(this.stickers[a].centroid, c), db = sub(this.stickers[b].centroid, c);
      return Math.atan2(dot(db, w), dot(db, u)) - Math.atan2(dot(da, w), dot(da, u));
    });
  }

  parse(move: string): { vert: number; tip: boolean; clicks: 1 | 2 } {
    const m = /^([ULRBulrb])('?)$/.exec(move.trim());
    if (!m) throw new Error(`Movimento inválido: ${move}`);
    return { vert: VERTS.indexOf(m[1].toUpperCase() as never), tip: m[1] !== m[1].toUpperCase(), clicks: m[2] ? 2 : 1 };
  }

  axis(vert: number): V3 {
    return norm(this.vertices[vert]);
  }

  layer(move: string): number[] {
    const { vert, tip } = this.parse(move);
    const ax = this.axis(vert);
    return this.stickers.filter((s) => dot(s.centroid, ax) > (tip ? TIP_CUT : LAYER_CUT)).map((s) => s.index);
  }

  /** ângulo do giro: horário visto de fora (negativo) */
  moveAngle(move: string) {
    return this.parse(move).clicks === 1 ? (-2 * Math.PI) / 3 : (2 * Math.PI) / 3;
  }

  permutation(move: string): Int32Array {
    const hit = this.permCache.get(move);
    if (hit) return hit;
    const { vert } = this.parse(move);
    const ax = this.axis(vert);
    const ang = this.moveAngle(move);
    const layer = this.layer(move);
    const perm = Int32Array.from({ length: STICKERS }, (_, i) => i);
    for (const src of layer) {
      const p = rotate(this.stickers[src].centroid, ax, ang);
      let best = -1, bd = Infinity;
      for (const t of layer) {
        const q = this.stickers[t].centroid;
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (bd > 1e-8) throw new Error('geometria do pyraminx inconsistente');
      perm[best] = src;
    }
    this.permCache.set(move, perm);
    return perm;
  }

  /** rotação do puzzle inteiro em torno de um vértice (para testes/reorientação) */
  wholeRotation(vert: number): Int32Array {
    const ax = this.axis(vert);
    const perm = Int32Array.from({ length: STICKERS }, (_, i) => i);
    for (const s of this.stickers) {
      const p = rotate(s.centroid, ax, (-2 * Math.PI) / 3);
      const t = this.stickers.find((q) => Math.hypot(...sub(q.centroid, p)) < 1e-6)!;
      perm[t.index] = s.index;
    }
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
    return this.stickers.map((s) => FACE_KEYS[s.face]);
  }

  /** embaralho no estilo WCA: giros grandes nos 4 eixos e depois as pontas */
  randomScramble(len = 11): string[] {
    const out: string[] = [];
    let last = '';
    while (out.length < len) {
      const v = 'ULRB'[Math.floor(Math.random() * 4)];
      if (v === last) continue;
      out.push(v + (Math.random() < 0.5 ? '' : "'"));
      last = v;
    }
    for (const t of 'ulrb') {
      const k = Math.floor(Math.random() * 3);
      if (k) out.push(t + (k === 2 ? "'" : ''));
    }
    return out;
  }
}

export const pyraGeo = new PyraminxGeometry();

/** as 12 posições do pyraminx inteiro (permutações: novo[i] = antigo[p[i]]) */
export const PYRA_ROTATIONS: Int32Array[] = (() => {
  const gens = [0, 1, 2, 3].map((v) => pyraGeo.wholeRotation(v));
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

/**
 * Gira o estado (o pyraminx inteiro) até os centros ficarem na posição de referência:
 * centro sem amarelo em cima e centro sem verde atrás. Assim dá para pintar ou ler pela
 * câmera segurando de qualquer jeito.
 */
export function normalizePyra(state: string[]): string[] {
  if (state.some((c) => !(FACE_KEYS as readonly string[]).includes(c))) return state;
  const key = (i: number) => FACE_KEYS[Math.floor(i / 9)];
  const fits = (s: string[]) =>
    pyraGeo.centers.every((pos) => [...pos.map(key)].sort().join() === [...pos.map((i) => s[i])].sort().join());
  if (fits(state)) return state;
  for (const p of PYRA_ROTATIONS) {
    const s = Array.from(p, (j) => state[j]);
    if (fits(s)) return s;
  }
  return state;
}

export const invertPyraMove = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");
