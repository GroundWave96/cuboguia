/**
 * Kilominx: o "megaminx 2x2" — só os 20 cantos do Megaminx, sem centros nem arestas.
 * Cada face mostra 5 cantos em volta de uma estrela preta; são 60 adesivos (cores).
 *
 * Índice do adesivo: face * 5 + k, com k = vértice da face (mesma numeração do Megaminx,
 * onde esse adesivo é face * 11 + 1 + k). Os giros são os do Megaminx (72° por clique).
 *
 * Sem centros, a posição "resolvida" não é fixa: o puzzle pode ficar pronto em qualquer uma
 * das 60 rotações do dodecaedro. O solucionador escolhe uma delas (veja `ROTATIONS`).
 */
import { FACES, megaGeo as geo, type V3 } from '../megaminx/geometry';

export { FACES };
export const STICKERS = 60;

export const faceOf = (i: number) => Math.floor(i / 5);
/** adesivo do Kilominx → adesivo do Megaminx */
export const toMega = (i: number) => faceOf(i) * 11 + 1 + (i % 5);
const FROM_MEGA = new Int32Array(132).fill(-1);
for (let i = 0; i < STICKERS; i++) FROM_MEGA[toMega(i)] = i;

/** os 20 cantos (3 adesivos cada, em sentido horário visto de fora) */
export const CORNERS: number[][] = geo.corners.map((c) => c.map((m) => FROM_MEGA[m]));
/** canto (índice em CORNERS) de cada adesivo */
export const CORNER_OF = new Int32Array(STICKERS);
CORNERS.forEach((c, k) => c.forEach((i) => (CORNER_OF[i] = k)));

const permCache = new Map<string, Int32Array>();
/** perm tal que novoEstado[i] = estadoAntigo[perm[i]] */
export function permutation(move: string): Int32Array {
  const hit = permCache.get(move);
  if (hit) return hit;
  const mp = geo.permutation(move);
  const p = Int32Array.from({ length: STICKERS }, (_, i) => FROM_MEGA[mp[toMega(i)]]);
  permCache.set(move, p);
  return p;
}

export function locationMap(move: string): Int32Array {
  const p = permutation(move);
  const m = new Int32Array(STICKERS);
  for (let i = 0; i < STICKERS; i++) m[p[i]] = i;
  return m;
}

export function applyMove<T>(state: T[], move: string): T[] {
  const p = permutation(move);
  return Array.from({ length: STICKERS }, (_, i) => state[p[i]]);
}

export const solvedState = (): string[] => Array.from({ length: STICKERS }, (_, i) => FACES[faceOf(i)]);

/** camada de uma face (os 15 adesivos dos 5 cantos dela) */
export function layerOf(face: number): number[] {
  const vs = geo.faceVerts[face];
  return CORNERS.filter((_, k) => vs.includes(k)).flat();
}

// ---------------------------------------------------------------------------
// As 60 rotações do puzzle inteiro
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const frame = (a: V3, b: V3): V3[] => {
  const k = dot(a, b);
  const bp: V3 = [b[0] - a[0] * k, b[1] - a[1] * k, b[2] - a[2] * k];
  const l = Math.hypot(...bp);
  const b2: V3 = [bp[0] / l, bp[1] / l, bp[2] / l];
  return [a, b2, cross(a, b2)];
};
const nearest = (list: V3[], p: V3) => {
  let best = -1, bd = Infinity;
  list.forEach((q, i) => {
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (bd > 1e-6) throw new Error('rotação do kilominx inconsistente');
  return best;
};

export interface Rotation {
  /** face para onde vai cada face */
  face: number[];
  /** adesivo para onde vai cada adesivo */
  loc: Int32Array;
}

/** as 60 rotações: a face U vai para a face `f` e a F para uma vizinha `g` de f */
export const ROTATIONS: Rotation[] = (() => {
  const out: Rotation[] = [];
  const src = frame(geo.normals[0], geo.normals[1]);
  for (let f = 0; f < 12; f++)
    for (const g of geo.neighbors[f]) {
      const dst = frame(geo.normals[f], geo.normals[g]);
      // M = dst · srcᵀ
      const M = (p: V3): V3 => {
        const c = src.map((s) => dot(s, p));
        return [0, 1, 2].map((k) => dst[0][k] * c[0] + dst[1][k] * c[1] + dst[2][k] * c[2]) as V3;
      };
      const face = geo.normals.map((n) => nearest(geo.normals, M(n)));
      const vert = geo.vertices.map((v) => nearest(geo.vertices, M(v)));
      const loc = new Int32Array(STICKERS);
      for (let i = 0; i < STICKERS; i++) {
        const fi = faceOf(i), v = geo.faceVerts[fi][i % 5];
        const f2 = face[fi];
        loc[i] = f2 * 5 + geo.faceVerts[f2].indexOf(vert[v]);
      }
      out.push({ face, loc });
    }
  return out;
})();

/** gira o estado inteiro (o mesmo puzzle, segurado de outro jeito) */
export function rotateState<T>(state: T[], r: Rotation): T[] {
  const out = new Array<T>(STICKERS);
  for (let i = 0; i < STICKERS; i++) out[r.loc[i]] = state[i];
  return out;
}

// ---------------------------------------------------------------------------
/**
 * Lê as peças: para cada lugar, qual canto está lá e girado quanto. Devolve null quando
 * alguma peça não existe ou aparece duas vezes. `twist` é a posição (0..2), dentro do lugar,
 * da 1ª cor da peça.
 */
export function readCorners(state: string[]): { piece: number[]; twist: number[] } | { error: 'piece' | 'dup'; slot: number } {
  const homeCols = CORNERS.map((c) => c.map((i) => FACES[faceOf(i)] as string));
  const piece: number[] = [], twist: number[] = [];
  const used = new Set<number>();
  for (let s = 0; s < CORNERS.length; s++) {
    const cols = CORNERS[s].map((i) => state[i]);
    let found = -1, tw = 0;
    for (let j = 0; j < homeCols.length && found < 0; j++)
      for (let r = 0; r < 3; r++)
        if (homeCols[j].every((c, k) => c === cols[(k + r) % 3])) {
          found = j;
          tw = r;
          break;
        }
    if (found < 0) return { error: 'piece', slot: s };
    if (used.has(found)) return { error: 'dup', slot: s };
    used.add(found);
    piece.push(found);
    twist.push(tw);
  }
  return { piece, twist };
}

export function parity(p: number[]): number {
  let s = 0;
  const seen = new Array(p.length).fill(false);
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = p[j]) {
      seen[j] = true;
      len++;
    }
    s += len - 1;
  }
  return s % 2;
}

export const parseMove = (m: string) => geo.parse(m);
export const moveAngle = (m: string) => geo.moveAngle(m);
export function invertMove(move: string): string {
  return move.endsWith("'") ? move.slice(0, -1) : move + "'";
}
export function randomScramble(len = 30): string[] {
  return geo.randomScramble(len);
}
