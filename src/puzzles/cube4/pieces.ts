/**
 * Peças do 4x4 (índices 0..95, faces U R F D L B com 16 adesivos cada, linha a linha —
 * mesma convenção dos outros cubos).
 *
 *   centros   (1,1) (1,2) (2,1) (2,2) de cada face — 4 por face, todos se mexem
 *   pontas    os 2 adesivos do meio de cada borda ("wings"); cada aresta do 3x3 vira
 *             um par de pontas (uma "aresta dupla")
 *   cantos    como no 3x3
 */
import { CORNER_FACELETS, EDGE_FACELETS } from '../cube3/pieces';
import { NxNGeometry } from '../nxn/geometry';
import { cornerFacelets } from '../nxn/pieces';

export const geo4 = new NxNGeometry(4);
export const N4 = geo4.count;
export const FACES4 = ['U', 'R', 'F', 'D', 'L', 'B'];
export const faceOf4 = (i: number) => (i / 16) | 0;

const CENTER_CELLS = [5, 6, 9, 10];
/** os 4 centros de cada face */
export const FACE_CENTERS = [0, 1, 2, 3, 4, 5].map((f) => CENTER_CELLS.map((c) => f * 16 + c));
export const isCenter = (i: number) => CENTER_CELLS.includes(i % 16);
export const CORNERS4 = cornerFacelets(geo4);

/** adesivo do 3x3 → adesivo do 4x4 na mesma posição (cantos, uma das pontas, um centro) */
const MAP = [0, 1, 3];
export const to4 = (i3: number) => {
  const f = (i3 / 9) | 0, r = ((i3 % 9) / 3) | 0, c = i3 % 3;
  return f * 16 + MAP[r] * 4 + MAP[c];
};

/** o outro adesivo da mesma peça (peças de 2 adesivos: as pontas) */
const partnerOf = new Int32Array(N4).fill(-1);
for (const s of geo4.stickers) {
  const other = geo4.stickers.filter((t) => t !== s && t.cubie2.every((v, i) => v === s.cubie2[i]));
  if (other.length === 1) partnerOf[s.index] = other[0].index;
}
export const partner = (i: number) => partnerOf[i];

/** os 2 adesivos de ponta de uma borda, na mesma face, a partir do adesivo do 3x3 */
export function edgeCells(i3: number): [number, number] {
  const f = (i3 / 9) | 0, r = ((i3 % 9) / 3) | 0, c = i3 % 3;
  return r === 1 ? [f * 16 + 1 * 4 + MAP[c], f * 16 + 2 * 4 + MAP[c]] : [f * 16 + MAP[r] * 4 + 1, f * 16 + MAP[r] * 4 + 2];
}

/**
 * Classe dos adesivos de ponta: uma ponta nunca "vira" no lugar, então cada adesivo só
 * alcança metade das 48 posições. Calculado pelos movimentos.
 */
const wingStickers = EDGE_FACELETS.flatMap((e) => e.flatMap((x) => edgeCells(x)));
export const WING_CLASS = new Int8Array(N4).fill(-1);
{
  const maps = FACES4.flatMap((f) => [f, '2' + f]).map((m) => geo4.locationMap(m));
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

/** posição de uma ponta = o adesivo dela da classe 0 */
const wingPos = (sticker: number) => (WING_CLASS[sticker] === 0 ? sticker : partner(sticker));
/** as 24 posições de ponta */
export const WING_POSITIONS = [...new Set(wingStickers.map(wingPos))];

/** os 12 lugares de aresta: as 2 posições de ponta de cada aresta do 3x3 (na ordem de EDGE_FACELETS) */
export const SLOTS: [number, number][] = EDGE_FACELETS.map((e) => edgeCells(e[0]).map(wingPos) as [number, number]);
export const slotOf = new Int8Array(N4).fill(-1);
SLOTS.forEach((s, k) => s.forEach((p) => (slotOf[p] = k)));

/** estado do 4x4 → estado do 3x3 equivalente (depois de montar centros e arestas) */
export const project3 = (state: string[]) => Array.from({ length: 54 }, (_, i) => state[to4(i)]);

/** adesivos do 4x4 que formam a peça do 3x3 (para destacar no tutorial) */
export function expand3(i3: number): number[] {
  const c = i3 % 9;
  if (c === 4) return FACE_CENTERS[(i3 / 9) | 0];
  if (c % 2 === 1) return edgeCells(i3);
  return [to4(i3)];
}

/** confere: os cantos do 4x4 na mesma ordem dos cantos do 3x3 */
export const CORNER3_TO_4 = CORNER_FACELETS.map((c) => c.map(to4));
