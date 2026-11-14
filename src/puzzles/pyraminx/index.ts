import type { PuzzleImpl } from '../../core/types';
import { PolyView } from '../poly/PolyView';
import { LAYER_CUT, TIP_CUT, VERTS, invertPyraMove, normalizePyra, pyraGeo as geo, type V3 } from './geometry';
import { PYRA_COLORS, PYRA_COLOR_HEX } from './colors';
import { buildPyraNet, buildPyraScan, pyraPieces } from './layout';
import { solvePyraBeginner, solvePyraOptimal } from './solver';
import { validatePyraminx } from './validate';

const VERT_TEXT: Record<string, string> = { U: 'Cima', L: 'Esquerda', R: 'Direita', B: 'Trás' };

const pyraminx: PuzzleImpl = {
  colors: PYRA_COLORS,
  holdHint:
    'Segure o pyraminx igual ao desenho 3D: em cima, a <b>ponta sem amarelo</b>; atrás, a <b>ponta sem verde</b> (cada ponta tem 3 cores). Assim a face da frente é a verde e a base, a amarela.',
  scanHint:
    'Pode começar com <b>qualquer face</b> de frente para a câmera e <b>qualquer ponta</b> para cima — no fim o site descobre sozinho como o pyraminx estava. Depois é só girar como as setas mandam.',
  normalize: normalizePyra,
  stickerCount: 36,
  solvedState: () => geo.solved(),
  fixedStickers: [],
  applyMove: (s, m) => geo.apply(s, m),
  invertMove: invertPyraMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 11) => geo.randomScramble(len),
  validate: validatePyraminx,
  methods: [
    {
      id: 'beginner',
      name: 'Iniciante (camadas)',
      tagline: 'Para aprender · ~20 movimentos',
      description: 'Pontas, centros, a base amarela e por fim o topo com poucos algoritmos.',
    },
    {
      id: 'optimal',
      name: 'Avançado (ótimo)',
      tagline: 'A menor solução · ≤ 11 + pontas',
      description: 'O computador calcula o caminho mais curto possível. Ótimo para comparar e descobrir atalhos.',
    },
  ],
  solve: (state, methodId) => (methodId === 'optimal' ? solvePyraOptimal(state) : solvePyraBeginner(state)),
  createView: (container) =>
    new PolyView(container, {
      ...pyraPieces(),
      bodyFaces: geo.faceVerts.map((f) => f.map((v) => geo.vertices[v])),
      palette: PYRA_COLOR_HEX,
      solved: geo.solved(),
      apply: (s, m) => geo.apply(s, m),
      locationMap: (m) => geo.locationMap(m),
      moveInfo: (m) => {
        const { vert, tip } = geo.parse(m);
        return { axis: geo.axis(vert), angle: geo.moveAngle(m), layer: geo.layer(m), cut: tip ? TIP_CUT : LAYER_CUT };
      },
      // diagonal entre a frente e a face de trás-direita (mostra duas faces)
      defaultDir: [0.75, 0.7, 0.62],
      // vistas candidatas: normais das faces, meios das arestas e vértices
      viewDirs: [
        ...geo.normals,
        ...geo.vertices,
        ...[0, 1, 2, 3].flatMap((a) => [0, 1, 2, 3].filter((b) => b > a).map((b) => geo.vertices[a].map((x, i) => x + geo.vertices[b][i]) as V3)),
      ],
      radius: 0.66,
    }),
  net: [],
  netSvg: buildPyraNet(),
  scan: buildPyraScan(PYRA_COLORS),
  describeMove: (m) => {
    const { vert, tip } = geo.parse(m);
    const dir = m.endsWith("'") ? 'anti-horário ↺' : 'horário ↻';
    return `${tip ? 'Só a ponta' : 'Camada'} ${VERT_TEXT[VERTS[vert]].toLowerCase()} · ${dir} (120°)`;
  },
  notationNote:
    '<p><code>U L R B</code> = camada grande do vértice (ponta + centro + 3 arestas) · <code>u l r b</code> = só a ponta · <code>\'</code> = anti-horário. Cada giro é ⅓ de volta (120°), olhando o vértice de fora.</p>',
  notationHelp: [
    { move: 'U', text: 'vértice de cima' },
    { move: 'L', text: 'vértice da frente-esquerda' },
    { move: 'R', text: 'vértice da frente-direita' },
    { move: 'B', text: 'vértice de trás' },
  ],
};

export default pyraminx;
