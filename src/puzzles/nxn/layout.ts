import { i18nMap, tr } from '../../core/i18n';
import type { ColorInfo, NetFace, ScanFace } from '../../core/types';
import { FACE_FRAME, FACE_ORDER, type FaceId, type NxNGeometry, type Vec3 } from './geometry';

const FACE_LABEL = i18nMap({
  U: ['Cima', 'Up', 'Arriba'],
  D: ['Baixo', 'Down', 'Abajo'],
  F: ['Frente', 'Front', 'Frente'],
  B: ['Trás', 'Back', 'Atrás'],
  R: ['Direita', 'Right', 'Derecha'],
  L: ['Esquerda', 'Left', 'Izquierda'],
}) as Record<FaceId, string>;

function faceGrid(n: number, face: FaceId): number[][] {
  const fi = FACE_ORDER.indexOf(face);
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => fi * n * n + r * n + c));
}

/** Rede em cruz:      U
 *                   L F R B
 *                     D        */
export function buildNet(n: number): NetFace[] {
  const pos: Record<FaceId, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  return FACE_ORDER.map((face) => ({
    face,
    get label() {
      return FACE_LABEL[face];
    },
    col: pos[face][0],
    row: pos[face][1],
    grid: faceGrid(n, face),
  }));
}

const faceByNormal = (v: Vec3): FaceId =>
  FACE_ORDER.find((f) => FACE_FRAME[f].n.every((x, i) => x === v[i]))!;
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];

/** Faces vizinhas de cada lado, como a face aparece de frente (cima/baixo/esquerda/direita). */
export function faceNeighbors(face: FaceId) {
  const { r, d } = FACE_FRAME[face];
  return { up: faceByNormal(neg(d)), down: faceByNormal(d), left: faceByNormal(neg(r)), right: faceByNormal(r) };
}

const POSITION_NAME = i18nMap({ F: ['Frente', 'Front', 'Frente'], R: ['Direita', 'Right', 'Derecha'], B: ['Trás', 'Back', 'Atrás'], L: ['Esquerda', 'Left', 'Izquierda'], U: ['Topo', 'Top', 'Arriba'], D: ['Base', 'Bottom', 'Abajo'] }) as Record<FaceId, string>;
const POSITION_SHORT = i18nMap({ F: ['Fr', 'Fr', 'Fr'], R: ['Dir', 'R', 'Der'], B: ['Trás', 'Back', 'Atrás'], L: ['Esq', 'L', 'Izq'], U: ['Topo', 'Top', 'Arriba'], D: ['Base', 'Bot', 'Ab'] }) as Record<FaceId, string>;
const EVEN_UP_LABEL = i18nMap({
  F: ['TOPO DO CUBO', 'TOP OF THE CUBE', 'ARRIBA DEL CUBO'],
  R: ['TOPO DO CUBO', 'TOP OF THE CUBE', 'ARRIBA DEL CUBO'],
  B: ['TOPO DO CUBO', 'TOP OF THE CUBE', 'ARRIBA DEL CUBO'],
  L: ['TOPO DO CUBO', 'TOP OF THE CUBE', 'ARRIBA DEL CUBO'],
  U: ['LADO DE TRÁS', 'BACK SIDE', 'LADO DE ATRÁS'],
  D: ['LADO DA FRENTE', 'FRONT SIDE', 'LADO DEL FRENTE'],
}) as Record<FaceId, string>;

export interface ScanOptions {
  /** adesivos com cor conhecida além dos centros (ex.: canto de referência do 2x2) */
  fixed?: Map<number, string>;
  /** dica curta por face, para cubos sem centro (no idioma atual: use getters ou i18nMap) */
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
    // na câmera: direita = r, para cima = -d (a grade desce em d), para a câmera = n (o giro
    // animado entre as faces usa isso)
    const pose = { pose: { right: [...r] as Vec3, up: neg(d), out: [...FACE_FRAME[face].n] as Vec3 } };
    if (odd) {
      const nb = faceNeighbors(face);
      const up = color(nb.up);
      return {
        face,
        grid,
        get title() {
          return tr(`Face ${color(face).name}`, `${cap(color(face).name)} face`, `Cara ${color(face).name}`);
        },
        faceColor: face,
        get hint() {
          return `<i class="dot" style="background:${up.hex}"></i>${tr(`${up.name} em cima`, `${up.name} on top`, `${up.name} arriba`)}`;
        },
        get upLabel() {
          return tr(`${up.name.toUpperCase()} EM CIMA`, `${up.name.toUpperCase()} ON TOP`, `${up.name.toUpperCase()} ARRIBA`);
        },
        upColor: nb.up,
        neighbors: nb,
        edges,
        fixedCells,
        ...pose,
      };
    }
    return {
      face,
      grid,
      get title() {
        return POSITION_NAME[face];
      },
      faceColor: '',
      get hint() {
        return opts.hints?.[face] ?? '';
      },
      get upLabel() {
        return EVEN_UP_LABEL[face];
      },
      edges,
      fixedCells,
      ...pose,
    };
  };
  return (['F', 'R', 'B', 'L', 'U', 'D'] as FaceId[]).map(build);
}

export const scanShortName = (face: string) => POSITION_SHORT[face as FaceId] ?? face;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** dicas da câmera para cubos sem centro fixo (2x2, 4x4): começa por qualquer face */
export const ANY_FACE_HINTS = i18nMap({
  F: ['Comece por <b>qualquer face</b>', 'Start with <b>any face</b>', 'Empieza por <b>cualquier cara</b>'],
  R: ['Gire o cubo ¼ de volta para a esquerda', 'Turn the cube ¼ to the left', 'Gira el cubo ¼ hacia la izquierda'],
  B: ['Mais ¼ para a esquerda', 'Another ¼ to the left', 'Otro ¼ hacia la izquierda'],
  L: ['Mais ¼ para a esquerda', 'Another ¼ to the left', 'Otro ¼ hacia la izquierda'],
  U: ['Volte à primeira face e incline: topo para a câmera', 'Back to the first face, then tilt: top toward the camera', 'Vuelve a la primera cara e inclínalo: la parte de arriba hacia la cámara'],
  D: ['Agora a base para a câmera', 'Now the bottom toward the camera', 'Ahora la parte de abajo hacia la cámara'],
}) as Partial<Record<FaceId, string>>;
