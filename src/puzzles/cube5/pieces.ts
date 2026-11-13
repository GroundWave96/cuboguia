/**
 * Peças do 5x5 (índices de adesivos 0..149, faces U R F D L B com 25 adesivos cada,
 * linha a linha — mesma convenção do 3x3).
 *
 *   centro fixo       (2,2) de cada face — não se mexe, é a referência de cor
 *   centros em X      (1,1) (1,3) (3,1) (3,3)
 *   centros em cruz   (1,2) (2,1) (2,3) (3,2)
 *   meio da aresta    o adesivo do meio de cada aresta ("midge")
 *   pontas da aresta  os dois adesivos ao lado do meio ("wings")
 */
import { NxNGeometry } from '../nxn/geometry';
import { CORNER_FACELETS, EDGE_FACELETS } from '../cube3/pieces';

export const geo5 = new NxNGeometry(5);
export const N5 = geo5.count;
export const FACES5 = ['U', 'R', 'F', 'D', 'L', 'B'];
export const faceOf5 = (i: number) => (i / 25) | 0;

/** adesivo do 3x3 → adesivo correspondente do 5x5 (cantos, meio das arestas, centro) */
const MAP = [0, 2, 4];
export const to5 = (i3: number) => {
  const f = (i3 / 9) | 0, r = ((i3 % 9) / 3) | 0, c = i3 % 3;
  return f * 25 + MAP[r] * 5 + MAP[c];
};

export const MID_CENTERS = [0, 1, 2, 3, 4, 5].map((f) => f * 25 + 12);
const X_CELLS = [6, 8, 16, 18];
const T_CELLS = [7, 11, 13, 17];
export const X_CENTERS = [0, 1, 2, 3, 4, 5].flatMap((f) => X_CELLS.map((c) => f * 25 + c));
export const T_CENTERS = [0, 1, 2, 3, 4, 5].flatMap((f) => T_CELLS.map((c) => f * 25 + c));
/** os 8 centros que se mexem, por face */
export const FACE_CENTERS = [0, 1, 2, 3, 4, 5].map((f) => [...X_CELLS, ...T_CELLS].map((c) => f * 25 + c));
export const isCenter = (i: number) => {
  const c = i % 25, r = (c / 5) | 0, k = c % 5;
  return r >= 1 && r <= 3 && k >= 1 && k <= 3;
};

export const CORNERS5 = CORNER_FACELETS.map((c) => c.map(to5));
export const MIDGES = EDGE_FACELETS.map((e) => e.map(to5));

/** o outro adesivo da mesma peça (para peças de 2 adesivos) */
const partnerOf = new Int32Array(N5).fill(-1);
for (const s of geo5.stickers) {
  const other = geo5.stickers.filter((t) => t !== s && t.cubie2.every((v, i) => v === s.cubie2[i]));
  if (other.length === 1) partnerOf[s.index] = other[0].index;
}
export const partner = (i: number) => partnerOf[i];

/** os dois adesivos de ponta vizinhos de um adesivo do meio da aresta, na mesma face */
export function wingNeighbors(m: number): [number, number] {
  const f = faceOf5(m), c = m % 25, r = (c / 5) | 0, k = c % 5;
  return r === 0 || r === 4 ? [f * 25 + r * 5 + 1, f * 25 + r * 5 + 3] : [f * 25 + 1 * 5 + k, f * 25 + 3 * 5 + k];
}

/**
 * Classe de orientação dos adesivos de ponta: uma ponta nunca "vira" no lugar, então
 * cada adesivo só alcança metade das 48 posições. Calculado pelos movimentos.
 */
const wingStickers = MIDGES.flatMap((m) => m.flatMap((x) => wingNeighbors(x)));
export const WING_CLASS = new Int8Array(N5).fill(-1);
{
  const moves = FACES5.flatMap((f) => [f, '2' + f]);
  const maps = moves.map((m) => geo5.locationMap(m));
  const start = wingStickers[0];
  WING_CLASS[start] = 0;
  const queue = [start];
  while (queue.length) {
    const p = queue.pop()!;
    for (const mp of maps) {
      const q = mp[p];
      if (WING_CLASS[q] < 0) {
        WING_CLASS[q] = 0;
        queue.push(q);
      }
    }
  }
  for (const w of wingStickers) if (WING_CLASS[w] < 0) WING_CLASS[w] = 1;
}

/** 24 pontas: [adesivo da classe 0, adesivo parceiro] */
export const WINGS: [number, number][] = [...new Set(wingStickers)]
  .filter((w) => WING_CLASS[w] === 0)
  .map((w) => [w, partner(w)]);

/** o adesivo de ponta (classe 0) vizinho de um adesivo do meio, na mesma face */
export const wingSlotNextTo = (m: number) => wingNeighbors(m).find((w) => WING_CLASS[w] === 0)!;

/** estado do 5x5 → estado do 3x3 equivalente (cantos, meio das arestas e centros) */
export const project3 = (state: string[]) => Array.from({ length: 54 }, (_, i) => state[to5(i)]);

/** adesivos do 5x5 que formam a peça do 3x3 (para destacar no tutorial) */
export function expand3(i3: number): number[] {
  const i5 = to5(i3);
  const c = i5 % 25;
  if (c === 12) return FACE_CENTERS[faceOf5(i5)].concat(i5);
  const r = (c / 5) | 0, k = c % 5;
  const isEdge = (r === 0 || r === 4) !== (k === 0 || k === 4);
  return isEdge ? [i5, ...wingNeighbors(i5)] : [i5];
}
