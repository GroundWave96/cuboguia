import { i18nMap } from '../../core/i18n';
/** Peças 3D, planificação (rede em cruz) e moldes da câmera do Skewb. */
import type { PuzzleImpl, ScanFace } from '../../core/types';
import { neighborMarks } from '../../core/scanmarks';
import { clipPolyhedron, shrinkPolyhedron } from '../poly/clip';
import { FACE_FRAME, FACE_ORDER, type FaceId } from '../nxn/geometry';
import { H, MOVE_CORNERS, skewbGeo as geo, type V3 } from './geometry';

type P = [number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const GAP = 0.965;

/** as 4 diagonais do cubo (os 4 planos de corte passam pelo centro, perpendiculares a elas) */
const DIAGONALS: V3[] = Object.values(MOVE_CORNERS).map((v) => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
});

// ---------------------------------------------------------------------------
// Peças: cada peça é o pedaço do cubo de um lado de cada um dos 4 planos
export function skewbPieces() {
  const cube = geo.bodyFaces;
  const cut = (point: V3) => DIAGONALS.reduce((fs, a) => clipPolyhedron(fs, a, 0, dot(point, a) > 0 ? 1 : -1), cube);
  const pieces = [
    ...geo.corners.map((c) => ({ faces: cut(c.vertex), stickers: c.stickers })),
    ...geo.centers.map((i) => ({ faces: cut(geo.stickers[i].normal), stickers: [i] })),
  ];
  const stickers: { index: number; poly: V3[]; normal: V3 }[] = [];
  const shrunk = pieces.map((pc) => {
    const pts = pc.faces.flat();
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length] as V3, [0, 0, 0] as V3);
    for (const i of pc.stickers) {
      const st = geo.stickers[i];
      stickers.push({ index: i, poly: st.poly.map((p) => [c[0] + (p[0] - c[0]) * GAP, c[1] + (p[1] - c[1]) * GAP, c[2] + (p[2] - c[2]) * GAP] as V3), normal: st.normal });
    }
    return { faces: shrinkPolyhedron(pc.faces, GAP), stickers: pc.stickers };
  });
  stickers.sort((a, b) => a.index - b.index);
  // todos os cortes passam pelo centro: o "núcleo" é só um ponto (as próprias peças fecham as frestas)
  return { pieces: shrunk, stickers, stickerRound: 0.22, pieceRound: 0.025, core: shrinkPolyhedron(cube, 0.02) };
}

// ---------------------------------------------------------------------------
/** os 5 polígonos de uma face (mesma ordem dos adesivos) num quadrado de lado S com canto em (x, y) */
function facePolys(x: number, y: number, S: number): P[][] {
  const h = S / 2;
  return [
    [[x + h, y], [x + S, y + h], [x + h, y + S], [x, y + h]],
    [[x, y], [x + h, y], [x, y + h]],
    [[x + S, y], [x + S, y + h], [x + h, y]],
    [[x + S, y + S], [x + h, y + S], [x + S, y + h]],
    [[x, y + S], [x, y + h], [x + h, y + S]],
  ];
}

/** Rede em cruz (como a dos cubos):  U / L F R B / D */
export function buildSkewbNet(): NonNullable<PuzzleImpl['netSvg']> {
  const pos: Record<FaceId, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  const S = 100, G = 6;
  const stickers: { index: number; points: string }[] = [];
  FACE_ORDER.forEach((fk, f) => {
    const [c, r] = pos[fk];
    facePolys(G + c * (S + G), G + r * (S + G), S).forEach((poly, k) => stickers.push({ index: f * 5 + k, points: poly.map((p) => p.join(',')).join(' ') }));
  });
  return { viewBox: `0 0 ${4 * (S + G) + G} ${3 * (S + G) + G}`, stickers };
}

// ---------------------------------------------------------------------------
// Câmera: como no 2x2 (sem centro fixo), começa por qualquer face e o site acha a posição no fim
const HINTS = i18nMap({
  F: ['Comece por <b>qualquer face</b>', 'Start with <b>any face</b>'],
  R: ['Gire o Skewb ¼ de volta para a esquerda', 'Turn the Skewb ¼ to the left'],
  B: ['Mais ¼ para a esquerda', 'Another ¼ to the left'],
  L: ['Mais ¼ para a esquerda', 'Another ¼ to the left'],
  U: ['Volte à primeira face e incline: topo para a câmera', 'Back to the first face, then tilt: top toward the camera'],
  D: ['Agora a base para a câmera', 'Now the bottom toward the camera'],
}) as Record<FaceId, string>;
const TITLE = i18nMap({ F: ['Frente', 'Front'], R: ['Direita', 'Right'], B: ['Trás', 'Back'], L: ['Esquerda', 'Left'], U: ['Topo', 'Top'], D: ['Base', 'Bottom'] }) as Record<FaceId, string>;
const UP_LABEL = i18nMap({
  F: ['TOPO', 'TOP'],
  R: ['TOPO', 'TOP'],
  B: ['TOPO', 'TOP'],
  L: ['TOPO', 'TOP'],
  U: ['LADO DE TRÁS', 'BACK SIDE'],
  D: ['LADO DA FRENTE', 'FRONT SIDE'],
}) as Record<FaceId, string>;

export function buildSkewbScan(): ScanFace[] {
  const box = 0.66, x0 = (1 - box) / 2;
  return (['F', 'R', 'B', 'L', 'U', 'D'] as FaceId[]).map((fk) => {
    const f = FACE_ORDER.indexOf(fk);
    const { r, d } = FACE_FRAME[fk];
    // 3D → quadro da câmera (a face vista de frente, com o mesmo "direita/baixo" da planificação)
    const to2 = (p: V3): P => [0.5 + (dot(p, r as V3) / (2 * H)) * box, 0.5 + (dot(p, d as V3) / (2 * H)) * box];
    const cells = facePolys(x0, x0, box).map((poly) => {
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      // um pouco menor que o polígono: a fresta preta entre as peças fica de fora
      return { poly: poly.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.9] as P), center: [cx, cy] as P };
    });
    const corners3 = geo.bodyFaces[f];
    return {
      face: fk,
      grid: [[0, 1, 2, 3, 4].map((k) => f * 5 + k)],
      get title() {
        return TITLE[fk];
      },
      faceColor: '',
      get hint() {
        return HINTS[fk];
      },
      get upLabel() {
        return UP_LABEL[fk];
      },
      arrow: fk === 'U' || fk === 'D' || fk === 'F' ? '▲' : '↶',
      edges: { up: [], down: [], left: [], right: [] },
      fixedCells: [],
      cells,
      marks: [],
      neighborMarks: neighborMarks(corners3, corners3.map(to2), (e) => {
        const a = corners3[e], b = corners3[(e + 1) % 4];
        const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        // a face vizinha é a que tem o meio desta borda e não é esta face
        const g = geo.bodyFaces.findIndex((fs, gi) => gi !== f && fs.some((p, k) => {
          const q = fs[(k + 1) % 4];
          return Math.hypot(...[0, 1, 2].map((i) => (p[i] + q[i]) / 2 - mid[i])) < 1e-6;
        }));
        return geo.stickers.filter((s) => s.face === g);
      }),
    };
  });
}
