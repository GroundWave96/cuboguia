import type { ColorInfo, NetFace, ScanFace } from '../../core/types';
import { FACE_ORDER, type FaceId } from './geometry';

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

/** Ordem de captura pela câmera e instruções de como segurar o cubo. */
export function buildScan(n: number, colors: ColorInfo[]): ScanFace[] {
  const name = (k: string) => colors.find((c) => c.key === k)!.name;
  const up = name('U');
  const front = name('F');
  const side = (face: FaceId, intro: string): ScanFace => ({
    face,
    grid: faceGrid(n, face),
    title: `Face ${name(face)}`,
    instruction: `${intro} Mostre a face <b>${name(face)}</b> para a câmera, com o <b>${up}</b> para cima.`,
    centerColor: face,
    upColor: 'U',
  });
  return [
    side('F', `Segure o cubo com o ${up} em cima e o ${front} de frente.`),
    side('R', 'Gire o cubo um quarto de volta para a esquerda.'),
    side('B', 'Gire mais um quarto de volta para a esquerda.'),
    side('L', 'Gire mais um quarto de volta para a esquerda.'),
    {
      face: 'U',
      grid: faceGrid(n, 'U'),
      title: `Face ${up}`,
      instruction: `Volte o ${front} para a frente e incline o cubo: mostre a face <b>${up}</b> para a câmera, com o <b>${front}</b> na parte de baixo da imagem.`,
      centerColor: 'U',
      upColor: 'B',
    },
    {
      face: 'D',
      grid: faceGrid(n, 'D'),
      title: `Face ${name('D')}`,
      instruction: `Agora mostre a face <b>${name('D')}</b> para a câmera, com o <b>${front}</b> na parte de cima da imagem.`,
      centerColor: 'D',
      upColor: 'F',
    },
  ];
}
