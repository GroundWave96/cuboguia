/**
 * Geometria genérica de cubos NxN (2x2, 3x3, 4x4, 5x5...).
 *
 * Ordem das faces e dos adesivos segue a convenção de Kociemba:
 *   U(0) R(1) F(2) D(3) L(4) B(5); cada face com N*N adesivos, linha a linha,
 *   como vistos olhando de frente para a face (U com F embaixo, D com F em cima,
 *   faces laterais com U em cima).
 *
 * As permutações dos movimentos são calculadas geometricamente: rotacionamos as
 * posições 3D dos adesivos da camada e vemos onde cada um cai. Isso funciona para
 * qualquer N sem tabelas manuais.
 */

export type Vec3 = [number, number, number];

export const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type FaceId = (typeof FACE_ORDER)[number];

/** normal (n), direção "direita" (r) e "para baixo" (d) de cada face. x→direita, y→cima, z→frente */
export const FACE_FRAME: Record<FaceId, { n: Vec3; r: Vec3; d: Vec3 }> = {
  U: { n: [0, 1, 0], r: [1, 0, 0], d: [0, 0, 1] },
  R: { n: [1, 0, 0], r: [0, 0, -1], d: [0, -1, 0] },
  F: { n: [0, 0, 1], r: [1, 0, 0], d: [0, -1, 0] },
  D: { n: [0, -1, 0], r: [1, 0, 0], d: [0, 0, -1] },
  L: { n: [-1, 0, 0], r: [0, 0, 1], d: [0, -1, 0] },
  B: { n: [0, 0, -1], r: [-1, 0, 0], d: [0, -1, 0] },
};

export interface StickerGeo {
  index: number;
  face: FaceId;
  row: number;
  col: number;
  /** posição do centro da peça (cubie), em unidades de peça, multiplicada por 2 (inteiros) */
  cubie2: Vec3;
  normal: Vec3;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Rotação de -90° (horário visto de fora) em torno do eixo unitário a. */
function rotCW(v: Vec3, a: Vec3): Vec3 {
  const c = cross(a, v);
  const k = dot(a, v);
  return [-c[0] + a[0] * k, -c[1] + a[1] * k, -c[2] + a[2] * k];
}

const key = (p: Vec3, n: Vec3) => `${p.join(',')}|${n.join(',')}`;

export interface ParsedMove {
  face: FaceId;
  /** quartos de volta no sentido horário: 1, 2 ou 3 */
  turns: 1 | 2 | 3;
  /** primeira camada girada, contando a partir da face (1 = a face externa; 0 = fatia do meio) */
  from: number;
  /** última camada girada (from..depth) */
  depth: number;
}

/**
 * Notação:
 *   R      só a face
 *   Rw, r  duas camadas (face + a de dentro)
 *   3Rw    três camadas a partir da face
 *   2R     só a 2ª camada (fatia interna), sem a face
 *   M E S  fatia do meio (cubos ímpares), no sentido de L, D e F
 */
const MIDDLE: Record<string, FaceId> = { M: 'L', E: 'D', S: 'F' };

export function parseMove(move: string): ParsedMove {
  const mid = /^([MES])(['2]?)$/.exec(move.trim());
  if (mid) return { face: MIDDLE[mid[1]], turns: mid[2] === "'" ? 3 : mid[2] === '2' ? 2 : 1, from: 0, depth: 0 };
  const m = /^(\d*)([URFDLBurfdlb])(w?)(['2]?)$/.exec(move.trim());
  if (!m) throw new Error(`Movimento inválido: ${move}`);
  const face = m[2].toUpperCase() as FaceId;
  const wide = m[3] === 'w' || m[2] !== m[2].toUpperCase();
  const num = m[1] ? parseInt(m[1], 10) : 0;
  const turns = m[4] === "'" ? 3 : m[4] === '2' ? 2 : 1;
  if (wide) return { face, turns, from: 1, depth: num || 2 };
  if (num) return { face, turns, from: num, depth: num };
  return { face, turns, from: 1, depth: 1 };
}

/** a peça (pela posição ×2 ao longo do eixo da face) está nas camadas do movimento? */
export function layerHit(along: number, n: number, mv: ParsedMove) {
  if (mv.from === 0) return along === 0;
  const h = n - 1;
  return along >= h - 2 * (mv.depth - 1) && along <= h - 2 * (mv.from - 1);
}

export function invertMove(move: string): string {
  if (move.endsWith("'")) return move.slice(0, -1);
  if (move.endsWith('2')) return move;
  return move + "'";
}

export class NxNGeometry {
  readonly n: number;
  readonly stickers: StickerGeo[];
  private readonly lookup = new Map<string, number>();
  private readonly permCache = new Map<string, Int32Array>();

  constructor(n: number) {
    this.n = n;
    this.stickers = [];
    const h = n - 1;
    FACE_ORDER.forEach((face, fi) => {
      const { n: nv, r, d } = FACE_FRAME[face];
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const a = 2 * col - h;
          const b = 2 * row - h;
          const cubie2: Vec3 = [
            nv[0] * h + r[0] * a + d[0] * b,
            nv[1] * h + r[1] * a + d[1] * b,
            nv[2] * h + r[2] * a + d[2] * b,
          ];
          const index = fi * n * n + row * n + col;
          this.stickers.push({ index, face, row, col, cubie2, normal: nv });
          this.lookup.set(key(cubie2, nv), index);
        }
      }
    });
  }

  get count() {
    return this.stickers.length;
  }

  faceOf(index: number): FaceId {
    return FACE_ORDER[Math.floor(index / (this.n * this.n))];
  }

  /** Adesivos que pertencem à camada movida. */
  inLayer(s: StickerGeo, mv: ParsedMove): boolean {
    return layerHit(dot(s.cubie2, FACE_FRAME[mv.face].n), this.n, mv);
  }

  /** perm tal que novoEstado[i] = estadoAntigo[perm[i]] */
  permutation(move: string): Int32Array {
    const cached = this.permCache.get(move);
    if (cached) return cached;
    const mv = parseMove(move);
    const axis = FACE_FRAME[mv.face].n;
    const perm = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) perm[i] = i;
    for (const s of this.stickers) {
      if (!this.inLayer(s, mv)) continue;
      let p = s.cubie2;
      let nv = s.normal;
      for (let t = 0; t < mv.turns; t++) {
        p = rotCW(p, axis);
        nv = rotCW(nv, axis);
      }
      const dest = this.lookup.get(key(p, nv));
      if (dest === undefined) throw new Error('geometria inconsistente');
      perm[dest] = s.index;
    }
    this.permCache.set(move, perm);
    return perm;
  }

  /** map[orig] = dest */
  locationMap(move: string): Int32Array {
    const perm = this.permutation(move);
    const map = new Int32Array(perm.length);
    for (let i = 0; i < perm.length; i++) map[perm[i]] = i;
    return map;
  }

  apply<T>(state: T[], move: string): T[] {
    const perm = this.permutation(move);
    const out = new Array<T>(state.length);
    for (let i = 0; i < perm.length; i++) out[i] = state[perm[i]];
    return out;
  }

  solved(): string[] {
    return this.stickers.map((s) => s.face);
  }

  randomScramble(length: number): string[] {
    const faces = FACE_ORDER;
    const opposite: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
    const out: string[] = [];
    let last = '';
    let prev = '';
    while (out.length < length) {
      const f = faces[Math.floor(Math.random() * 6)];
      if (f === last) continue;
      if (f === prev && opposite[f] === last) continue;
      const suf = ['', "'", '2'][Math.floor(Math.random() * 3)];
      out.push(f + suf);
      prev = last;
      last = f;
    }
    return out;
  }
}
