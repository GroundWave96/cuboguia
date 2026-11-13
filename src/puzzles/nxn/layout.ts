import type { ColorInfo, NetFace, ScanFace } from '../../core/types';
import { FACE_FRAME, FACE_ORDER, type FaceId, type NxNGeometry, type Vec3 } from './geometry';

const FACE_LABEL: Record<FaceId, string> = {
  U: 'Cima',
  D: 'Baixo',
  F: 'Frente',
  B: 'Trás',
  R: 'Direita',
  L: 'Esquerda',
};

function faceGrid(n: number, face: FaceId): number[][] {
  const fi = FACE_ORDER.indexOf(face);
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => fi * n * n + r * n + c));
}

/** Rede em cruz:      U
 *                   L F R B
 *                     D        */
export function buildNet(n: number): NetFace[] {
  const pos: Record<FaceId, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  return FACE_ORDER.map((face) => ({ face, label: FACE_LABEL[face], col: pos[face][0], row: pos[face][1], grid: faceGrid(n, face) }));
}

const faceByNormal = (v: Vec3): FaceId =>
  FACE_ORDER.find((f) => FACE_FRAME[f].n.every((x, i) => x === v[i]))!;
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];

/** Faces vizinhas de cada lado, como a face aparece de frente (cima/baixo/esquerda/direita). */
export function faceNeighbors(face: FaceId) {
  const { r, d } = FACE_FRAME[face];
  return { up: faceByNormal(neg(d)), down: faceByNormal(d), left: faceByNormal(neg(r)), right: faceByNormal(r) };
}

const POSITION_NAME: Record<FaceId, string> = { F: 'Frente', R: 'Direita', B: 'Trás', L: 'Esquerda', U: 'Topo', D: 'Base' };
const POSITION_SHORT: Record<FaceId, string> = { F: 'Fr', R: 'Dir', B: 'Trás', L: 'Esq', U: 'Topo', D: 'Base' };
const EVEN_UP_LABEL: Record<FaceId, string> = {
  F: 'TOPO DO CUBO',
  R: 'TOPO DO CUBO',
  B: 'TOPO DO CUBO',
  L: 'TOPO DO CUBO',
  U: 'LADO DE TRÁS',
  D: 'LADO DA FRENTE',
};

export interface ScanOptions {
  /** adesivos com cor conhecida além dos centros (ex.: canto de referência do 2x2) */
  fixed?: Map<number, string>;
  /** dica curta por face, para cubos sem centro */
  hints?: Partial<Record<FaceId, string>>;
}

/**
 * Ordem de captura pela câmera: frente, direita, trás, esquerda (girando o cubo para
 * a esquerda), depois topo e base. Funciona para qualquer NxN.
 */
export function buildScan(geo: NxNGeometry, colors: ColorInfo[], opts: ScanOptions = {}): ScanFace[] {
  const n = geo.n;
  const odd = n % 2 === 1;
  const color = (k: string) => colors.find((c) => c.key === k)!;
  const fixed = new Map(opts.fixed ?? []);
  if (odd) for (const f of FACE_ORDER) fixed.set(FACE_ORDER.indexOf(f) * n * n + ((n * n) >> 1), f);

  const stickerOn = (cubie2: Vec3, normal: Vec3) =>
    geo.stickers.find((s) => s.cubie2.every((v, i) => v === cubie2[i]) && s.normal.every((v, i) => v === normal[i]))!.index;

  const build = (face: FaceId): ScanFace => {
    const grid = faceGrid(n, face);
    const { r, d } = FACE_FRAME[face];
    const along = (cells: number[], normal: Vec3) => cells.map((i) => stickerOn(geo.stickers[i].cubie2, normal));
    const edges = {
      up: along(grid[0], neg(d)),
      down: along(grid[n - 1], d),
      left: along(grid.map((row) => row[0]), neg(r)),
      right: along(grid.map((row) => row[n - 1]), r),
    };
    const fixedCells = grid.flat().flatMap((st, cell) => (fixed.has(st) ? [{ cell, color: fixed.get(st)! }] : []));
    if (odd) {
      const nb = faceNeighbors(face);
      const up = color(nb.up);
      return {
        face,
        grid,
        title: `Face ${color(face).name}`,
        faceColor: face,
        hint: `<i class="dot" style="background:${up.hex}"></i>${up.name} em cima`,
        upLabel: `${up.name.toUpperCase()} EM CIMA`,
        upColor: nb.up,
        neighbors: nb,
        edges,
        fixedCells,
      };
    }
    return {
      face,
      grid,
      title: POSITION_NAME[face],
      faceColor: '',
      hint: opts.hints?.[face] ?? '',
      upLabel: EVEN_UP_LABEL[face],
      edges,
      fixedCells,
    };
  };
  return (['F', 'R', 'B', 'L', 'U', 'D'] as FaceId[]).map(build);
}

export const scanShortName = (face: string) => POSITION_SHORT[face as FaceId] ?? face;
