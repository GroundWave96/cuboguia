/**
 * Mastermorphix: um 3x3 em forma de tetraedro (4 cores). Pinta-se (ou lê-se pela câmera) com
 * a forma de pirâmide; a solução usa o 3x3 que existe dentro (veja model.ts e solver.ts).
 */
import { i18nMap, tr } from '../../core/i18n';
import type { PuzzleImpl, PuzzleState } from '../../core/types';
import { FACE_FRAME, invertMove, parseMove } from '../nxn/geometry';
import { PolyView } from '../poly/PolyView';
import { PYRA_COLORS, PYRA_COLOR_HEX } from '../pyraminx/colors';
import { buildMorphNet, buildMorphScan, morphPieces, tetraFaces } from './layout';
import { NORMALS, ROTS, VERTEX, applyPieces, isPieces, movingPieces, pieceColors, rotsOf, solvedPieces, solvedPyramid, toPyramid, type V3 } from './model';
import { solveMorph, toPieces } from './solver';
import { validateMorph } from './validate';

/** um giro: no formato "pirâmide" lê as peças primeiro; volta a ser "pirâmide" quando a forma volta */
export function morphApply(state: PuzzleState, move: string): PuzzleState {
  const next = applyPieces(toPieces(state), move);
  return toPyramid(next) ?? next;
}

const SCAN = buildMorphScan();

/** a câmera leu as faces em outra ordem ou giradas: tenta as outras montagens possíveis */
function repairOrder(state: string[]): number[] {
  const ids = state.map((_, i) => i);
  const ok = (s: string[]) => validateMorph(s).ok;
  if (ok(state)) return ids;
  const centroid = (slot: number) => {
    const cs = SCAN[slot].cells!;
    return [cs.reduce((a, c) => a + c.center[0], 0) / cs.length, cs.reduce((a, c) => a + c.center[1], 0) / cs.length];
  };
  const mapping = (from: number, to: number, theta: number): number[] | null => {
    const [fx, fy] = centroid(from), [tx, ty] = centroid(to);
    const c = Math.cos(theta), s = Math.sin(theta);
    const out: number[] = [];
    for (const cell of SCAN[to].cells!) {
      const dx = cell.center[0] - tx, dy = cell.center[1] - ty;
      const px = fx + dx * c - dy * s, py = fy + dx * s + dy * c;
      const k = SCAN[from].cells!.findIndex((q) => Math.hypot(q.center[0] - px, q.center[1] - py) < 0.02);
      if (k < 0) return null;
      out.push(k);
    }
    return out;
  };
  const image = (slot: number) => SCAN[slot].grid.flat();
  const perms = [[1, 2, 3], [2, 1, 3], [1, 3, 2], [3, 2, 1], [2, 3, 1], [3, 1, 2]];
  const angles = [0, 1, 2, 3, 4, 5].map((k) => (k * Math.PI) / 3);
  for (const perm of perms)
    for (const rots of angles.flatMap((a) => angles.flatMap((b) => angles.map((c) => [a, b, c]))).sort((x, y) => x.filter(Boolean).length - y.filter(Boolean).length)) {
      const order = [...ids];
      let fine = true;
      for (let t = 0; t < 3 && fine; t++) {
        const m = mapping(perm[t], t + 1, rots[t]);
        if (!m) {
          fine = false;
          break;
        }
        const img = image(perm[t]);
        SCAN[t + 1].grid.flat().forEach((idx, k) => (order[idx] = img[m[k]]));
      }
      if (fine && ok(order.map((i) => state[i]))) return order;
    }
  return ids;
}

const SIDE = i18nMap({
  U: ['Cima', 'Top', 'Arriba'],
  D: ['Baixo', 'Bottom', 'Abajo'],
  F: ['Frente', 'Front', 'Frente'],
  B: ['Trás', 'Back', 'Atrás'],
  R: ['Direita', 'Right', 'Derecha'],
  L: ['Esquerda', 'Left', 'Izquierda'],
});
const dirText = (turns: number) =>
  turns === 2 ? tr('meia volta', 'half turn', 'media vuelta') : turns === 3 ? tr('anti-horário ↺', 'counterclockwise ↺', 'antihorario ↺') : tr('horário ↻', 'clockwise ↻', 'horario ↻');

/** embaralho que mantém a forma de pirâmide: só meias voltas */
function scramble(len = 22): string[] {
  const out: string[] = [];
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  while (out.length < len) {
    const f = faces[Math.floor(Math.random() * 6)];
    const last = out[out.length - 1]?.[0];
    const opp = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' } as Record<string, string>;
    // sem a mesma face seguida (nem a oposta depois de a mesma, que comutam)
    if (f === last || (out.length > 1 && f === out[out.length - 2][0] && opp[f] === last)) continue;
    out.push(f + '2');
  }
  return out;
}

const mastermorphix: PuzzleImpl = {
  colors: PYRA_COLORS,
  get holdHint() {
    return tr(
      'Segure o Mastermorphix igual ao desenho 3D: com uma <b>aresta deitada em cima</b> e outra embaixo, cruzadas. Os giros são os do 3x3 que existe dentro dele.',
      'Hold the Mastermorphix like the 3D drawing: with one <b>edge lying flat on top</b> and another at the bottom, crossed. The turns are those of the 3x3 inside it.',
      'Sujeta el Mastermorphix como en el dibujo 3D: con una <b>arista horizontal arriba</b> y otra abajo, cruzadas. Los giros son los del 3x3 que tiene dentro.',
    );
  },
  get scanHint() {
    return tr(
      'Ele precisa estar com a <b>forma de pirâmide</b> (se estiver torto, embaralhe só com meias voltas ou use o embaralho do cronômetro). Pode começar com <b>qualquer face</b> de frente e <b>qualquer ponta</b> para cima — depois é só girar como as setas mandam.',
      'It must be in its <b>pyramid shape</b> (if it’s out of shape, scramble with half turns only or use the timer’s scramble). You can start with <b>any face</b> toward the camera and <b>any tip</b> up — then just turn it as the arrows say.',
      'Tiene que estar con la <b>forma de pirámide</b> (si está deformado, mezcla solo con medias vueltas o usa la mezcla del cronómetro). Puedes empezar con <b>cualquier cara</b> hacia la cámara y <b>cualquier punta</b> hacia arriba; después solo gíralo como indican las flechas.',
    );
  },
  repairScan: (s) => repairOrder(s).map((i) => s[i]),
  scanOrder: repairOrder,
  stickerCount: 40,
  solvedState: () => solvedPyramid(),
  fixedStickers: [],
  applyMove: morphApply,
  invertMove,
  locationMap: () => Int32Array.from({ length: 40 }, (_, i) => i),
  scramble,
  validate: validateMorph,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Como um 3x3 (camadas)', 'Like a 3x3 (layers)', 'Como un 3x3 (capas)'),
        tagline: tr('Para aprender · ~150 movimentos', 'To learn · ~150 moves', 'Para aprender · ~150 movimientos'),
        description: tr(
          'Resolve o 3x3 de dentro camada por camada; no fim, acerta os meios das arestas.',
          'Solves the 3x3 inside layer by layer; at the end, fixes the edge middles.',
          'Resuelve el 3x3 de dentro capa por capa; al final, arregla los medios de las aristas.',
        ),
      },
      {
        id: 'cfop',
        name: tr('Como um 3x3 (CFOP)', 'Like a 3x3 (CFOP)', 'Como un 3x3 (CFOP)'),
        tagline: tr('Mais curto · ~90 movimentos', 'Shorter · ~90 moves', 'Más corto · ~90 movimientos'),
        description: tr(
          'Cruz, pares e a última camada em 2 etapas, como no CFOP do 3x3; no fim, os meios das arestas.',
          'Cross, pairs and a 2-look last layer, like 3x3 CFOP; at the end, the edge middles.',
          'Cruz, pares y la última capa en 2 pasos, como en el CFOP del 3x3; al final, los medios de las aristas.',
        ),
      },
    ];
  },
  solve: (state, methodId) => solveMorph(state, methodId ?? 'beginner'),
  createView: (container) =>
    new PolyView(container, {
      ...morphPieces(),
      bodyFaces: tetraFaces(),
      palette: PYRA_COLOR_HEX,
      solved: solvedPyramid(),
      apply: morphApply,
      locationMap: () => Int32Array.from({ length: 40 }, (_, i) => i),
      moveInfo: (m) => {
        const mv = parseMove(m);
        return { axis: FACE_FRAME[mv.face].n as V3, angle: mv.turns === 3 ? Math.PI / 2 : (-Math.PI / 2) * mv.turns, layer: [], cut: 0 };
      },
      // de frente, um pouco de cima e da direita (como o cubo)
      defaultDir: [-0.55, 0.75, 1],
      viewDirs: [...NORMALS, ...VERTEX, [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.62, 0.5, 1]],
      radius: 0.9,
      morph: {
        layout: (s) => (isPieces(s) ? { rots: rotsOf(s).map((r) => ROTS[r]), colors: pieceColors(s) } : null),
        moving: (s, m) => movingPieces(isPieces(s) ? s : solvedPieces(), m),
      },
    }),
  net: [],
  netSvg: buildMorphNet(),
  scan: SCAN,
  get notationIntro() {
    return tr(
      'Por dentro ele é um 3x3: cada letra é uma <b>camada</b>, como no cubo, com o Mastermorphix segurado igual ao desenho 3D. Gire olhando de frente para aquele lado:',
      'Inside it’s a 3x3: each letter is a <b>layer</b>, like on the cube, holding the Mastermorphix like the 3D drawing. Turn it while looking straight at that side:',
      'Por dentro es un 3x3: cada letra es una <b>capa</b>, como en el cubo, sujetando el Mastermorphix como en el dibujo 3D. Gírala mirando ese lado de frente:',
    );
  },
  get notationNote() {
    return tr(
      "<p><code>R</code> = ¼ de volta no sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = meia volta. Com ¼ de volta a forma muda (as peças trocam de formato de lugar); com meia volta, a pirâmide continua.</p>",
      "<p><code>R</code> = a ¼ turn clockwise · <code>R'</code> = counterclockwise · <code>R2</code> = half turn. A ¼ turn changes the shape (pieces of different shapes swap places); with a half turn, the pyramid stays.</p>",
      "<p><code>R</code> = ¼ de vuelta en sentido horario · <code>R'</code> = antihorario · <code>R2</code> = media vuelta. Con ¼ de vuelta la forma cambia (piezas de formas distintas cambian de lugar); con media vuelta, la pirámide se mantiene.</p>",
    );
  },
  describeMove: (m) => {
    const mv = parseMove(m);
    return `${SIDE[mv.face]} · ${dirText(mv.turns)}`;
  },
  get notationHelp() {
    return ['U', 'D', 'R', 'L', 'F', 'B'].map((f) => ({ move: f, text: SIDE[f] }));
  },
};

export default mastermorphix;
