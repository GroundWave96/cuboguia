import { i18nMap, tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { PolyView } from '../poly/PolyView';
import { megaPieces } from './pieces3d';
import { FACES, invertMegaMove, megaGeo as geo, type V3 } from './geometry';
import { MEGA_COLORS, MEGA_COLOR_HEX, MEGA_COLOR_NAME } from './colors';
import { buildMegaNet, buildMegaScan } from './layout';
import { solveMegaminx, solveMegaminxAdvanced } from './solver';
import { validateMegaminx } from './validate';

const FACE_TEXT = i18nMap({
  U: ['Cima', 'Top'],
  F: ['Frente', 'Front'],
  R: ['Direita', 'Right'],
  L: ['Esquerda', 'Left'],
  BR: ['Trás-direita', 'Back-right'],
  BL: ['Trás-esquerda', 'Back-left'],
  DR: ['Baixo-direita', 'Bottom-right'],
  DL: ['Baixo-esquerda', 'Bottom-left'],
  DBR: ['Baixo-trás-direita', 'Bottom-back-right'],
  DBL: ['Baixo-trás-esquerda', 'Bottom-back-left'],
  B: ['Trás (embaixo)', 'Back (lower)'],
  D: ['Baixo', 'Bottom'],
});

const megaminx: PuzzleImpl = {
  colors: MEGA_COLORS,
  get holdHint() {
    return tr(
      `Segure o megaminx com o <b>${MEGA_COLOR_NAME.U}</b> em cima, o <b>${MEGA_COLOR_NAME.D}</b> embaixo e o <b>${MEGA_COLOR_NAME.F}</b> de frente.`,
      `Hold the Megaminx with <b>${MEGA_COLOR_NAME.U}</b> on top, <b>${MEGA_COLOR_NAME.D}</b> on the bottom and <b>${MEGA_COLOR_NAME.F}</b> in front.`,
    );
  },
  stickerCount: 132,
  solvedState: () => geo.solved(),
  fixedStickers: FACES.map((_, f) => f * 11),
  applyMove: (s, m) => geo.apply(s, m),
  invertMove: invertMegaMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 45) => geo.randomScramble(len),
  validate: validateMegaminx,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Iniciante (camadas)', 'Beginner (layers)'),
        tagline: tr('Camada por camada · ~300 movimentos', 'Layer by layer · ~300 moves'),
        description: tr('Face branca, depois as camadas do meio e por fim a face cinza — como o 3x3, com mais peças.', 'White face, then the middle layers and finally the gray face — like the 3x3, with more pieces.'),
      },
      {
        id: 'advanced',
        name: tr('Avançado (pares)', 'Advanced (pairs)'),
        tagline: tr('Estilo speedcuber · ~250 movimentos', 'Speedcuber style · ~250 moves'),
        description: tr(
          'Estrela planejada de 2 em 2, F2L e S2L com canto + aresta juntos e a última face em 2 olhares.',
          'Star planned 2 at a time, F2L and S2L with corner + edge together, and a 2-look last face.',
        ),
      },
    ];
  },
  solve: (state, methodId) => (methodId === 'advanced' ? solveMegaminxAdvanced(state) : solveMegaminx(state)),
  createView: (container) =>
    new PolyView(container, {
      ...megaPieces(),
      bodyFaces: geo.faceVerts.map((vs) => vs.map((v) => geo.vertices[v])),
      palette: MEGA_COLOR_HEX,
      solved: geo.solved(),
      apply: (s, m) => geo.apply(s, m),
      locationMap: (m) => geo.locationMap(m),
      moveInfo: (m) => {
        const { face } = geo.parse(m);
        return { axis: geo.normals[face], angle: geo.moveAngle(m), layer: geo.layer(face), cut: geo.cutOf(face) };
      },
      // vértice entre U, F e R: vista diagonal padrão (mostra as três)
      defaultDir: (() => {
        const v = geo.vertices.findIndex((_, i) => [0, 1, 2].every((f) => geo.faceVerts[f].includes(i)));
        const p = geo.vertices[v];
        return [p[0] * 0.8, p[1] + 0.35, p[2] + 0.25] as V3;
      })(),
      viewDirs: geo.vertices,
      radius: 1,
    }),
  net: [],
  netSvg: buildMegaNet(),
  scan: buildMegaScan(MEGA_COLORS),
  scanColorModel: 'nearest',
  describeMove: (m) => {
    const { face } = geo.parse(m);
    const two = m.includes('2');
    const dir = m.endsWith("'") ? tr('anti-horário ↺', 'counterclockwise ↺') : tr('horário ↻', 'clockwise ↻');
    return `${FACE_TEXT[FACES[face]]} (${MEGA_COLOR_NAME[FACES[face]]}) · ${dir}${two ? tr(' · 2 cliques (144°)', ' · 2 clicks (144°)') : ''}`;
  },
  get notationNote() {
    return tr(
      "<p><code>R</code> = 1 clique (72°) no sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = 2 cliques (144°) · <code>R2'</code> = 2 cliques anti-horário.</p>",
      "<p><code>R</code> = 1 click (72°) clockwise · <code>R'</code> = counterclockwise · <code>R2</code> = 2 clicks (144°) · <code>R2'</code> = 2 clicks counterclockwise.</p>",
    );
  },
  get notationHelp() {
    return FACES.map((f) => ({ move: f, text: `${FACE_TEXT[f]} (${MEGA_COLOR_NAME[f]})` }));
  },
};

export default megaminx;
