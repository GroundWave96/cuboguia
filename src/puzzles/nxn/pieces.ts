import { FACE_ORDER, type NxNGeometry, type Vec3 } from './geometry';

/** Ordem dos cantos (mesma do 3x3/Kociemba). Sinais: x→direita, y→cima, z→frente. */
export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const;
const CORNER_SIGNS: Vec3[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [-1, -1, -1],
  [1, -1, -1],
];

const det = (a: Vec3, b: Vec3, c: Vec3) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);

/**
 * Adesivos de cada canto de um cubo NxN, na convenção de Kociemba:
 * primeiro o adesivo de U/D, depois os outros dois em sentido horário.
 */
export function cornerFacelets(geo: NxNGeometry): number[][] {
  const h = geo.n - 1;
  return CORNER_SIGNS.map((sg) => {
    const pos: Vec3 = [sg[0] * h, sg[1] * h, sg[2] * h];
    const st = geo.stickers.filter((s) => s.cubie2.every((v, i) => v === pos[i]));
    const ud = st.find((s) => s.normal[1] !== 0)!;
    const [a, b] = st.filter((s) => s !== ud);
    const ordered = det(ud.normal, a.normal, b.normal) === -1 ? [ud, a, b] : [ud, b, a];
    return ordered.map((s) => s.index);
  });
}

/** Cor (face) de cada adesivo no cubo resolvido. */
export const faceKeyOf = (geo: NxNGeometry, i: number) => FACE_ORDER[Math.floor(i / (geo.n * geo.n))];
