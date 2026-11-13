import type { PuzzleImpl } from '../../core/types';
import { PolyView } from '../poly/PolyView';
import { FACES, invertMegaMove, megaGeo as geo, type V3 } from './geometry';
import { MEGA_COLORS, MEGA_COLOR_HEX, MEGA_COLOR_NAME } from './colors';
import { buildMegaNet, buildMegaScan } from './layout';
import { solveMegaminx, solveMegaminxAdvanced } from './solver';
import { validateMegaminx } from './validate';

const FACE_TEXT: Record<string, string> = {
  U: 'Cima',
  F: 'Frente',
  R: 'Direita',
  L: 'Esquerda',
  BR: 'Trás-direita',
  BL: 'Trás-esquerda',
  DR: 'Baixo-direita',
  DL: 'Baixo-esquerda',
  DBR: 'Baixo-trás-direita',
  DBL: 'Baixo-trás-esquerda',
  B: 'Trás (embaixo)',
  D: 'Baixo',
};

const megaminx: PuzzleImpl = {
  colors: MEGA_COLORS,
  holdHint: `Segure o megaminx com o <b>${MEGA_COLOR_NAME.U}</b> em cima, o <b>${MEGA_COLOR_NAME.D}</b> embaixo e o <b>${MEGA_COLOR_NAME.F}</b> de frente.`,
  stickerCount: 132,
  solvedState: () => geo.solved(),
  fixedStickers: FACES.map((_, f) => f * 11),
  applyMove: (s, m) => geo.apply(s, m),
  invertMove: invertMegaMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 45) => geo.randomScramble(len),
  validate: validateMegaminx,
  methods: [
    {
      id: 'beginner',
      name: 'Iniciante (camadas)',
      tagline: 'Camada por camada · ~300 movimentos',
      description: 'Face branca, depois as camadas do meio e por fim a face cinza — como o 3x3, com mais peças.',
    },
    {
      id: 'advanced',
      name: 'Avançado (pares)',
      tagline: 'Estilo speedcuber · ~250 movimentos',
      description: 'Estrela planejada de 2 em 2, F2L e S2L com canto + aresta juntos e a última face em 2 olhares.',
    },
  ],
  solve: (state, methodId) => (methodId === 'advanced' ? solveMegaminxAdvanced(state) : solveMegaminx(state)),
  createView: (container) =>
    new PolyView(container, {
      stickers: geo.stickers.map((s) => ({ index: s.index, poly: s.poly, normal: geo.normals[s.face] })),
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
    const dir = m.endsWith("'") ? 'anti-horário ↺' : 'horário ↻';
    return `${FACE_TEXT[FACES[face]]} (${MEGA_COLOR_NAME[FACES[face]]}) · ${dir}${two ? ' · 2 cliques (144°)' : ''}`;
  },
  notationNote:
    "<p><code>R</code> = 1 clique (72°) no sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = 2 cliques (144°) · <code>R2'</code> = 2 cliques anti-horário.</p>",
  notationHelp: FACES.map((f) => ({ move: f, text: `${FACE_TEXT[f]} (${MEGA_COLOR_NAME[f]})` })),
};

export default megaminx;
