import { describeNxNMove, faceNotation } from '../nxn/text';
import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { MID_CENTERS, geo5 as geo } from './pieces';
import { validateCube5 } from './validate';
import { solveCube5 } from './solver';

/** embaralho com faces e fatias internas (a fatia do meio fica parada: centros fixos) */
function scramble(len = 60): string[] {
  const out: string[] = [];
  const axis: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
  let lastAxis = -1;
  const used = new Set<string>();
  while (out.length < len) {
    const f = 'URFDLB'[Math.floor(Math.random() * 6)];
    const layer = Math.random() < 0.5 ? f : '2' + f;
    if (axis[f] !== lastAxis) used.clear();
    if (used.has(layer)) continue; // não repete a mesma camada no mesmo eixo
    used.add(layer);
    lastAxis = axis[f];
    out.push(layer + ['', "'", '2'][Math.floor(Math.random() * 3)]);
  }
  return out;
}

const cube5: PuzzleImpl = {
  colors: CUBE3_COLORS,
  get holdHint() {
    return tr(
      'Segure o cubo com o <b>amarelo</b> em cima e o <b>verde</b> de frente (olhe o adesivo do meio de cada face).',
      'Hold the cube with <b>yellow</b> on top and <b>green</b> in front (look at the middle sticker of each face).',
    );
  },
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: MID_CENTERS,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble,
  validate: validateCube5,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Redução (iniciante)', 'Reduction (beginner)'),
        tagline: tr('Para aprender · ~400 movimentos', 'To learn · ~400 moves'),
        description: tr(
          'Monta os centros, junta as arestas e termina como um 3x3 pelo método de camadas. É o caminho que quase todo mundo usa no 5x5.',
          'Builds the centers, pairs the edges and finishes like a 3x3 with the layer method. It’s how almost everyone solves the 5x5.',
        ),
      },
      {
        id: 'cfop',
        name: tr('Redução + CFOP', 'Reduction + CFOP'),
        tagline: tr('Para quem já faz CFOP · ~350 movimentos', 'If you already know CFOP · ~350 moves'),
        description: tr('Mesmos centros e arestas, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.', 'Same centers and edges, but the 3x3 part uses Cross, F2L, OLL and PLL.'),
      },
    ];
  },
  solve: (state, methodId) => solveCube5(state, methodId === 'cfop' ? 'cfop' : 'beginner'),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(5),
  scan: buildScan(geo, CUBE3_COLORS),
  describeMove: (m) => describeNxNMove(m, true),
  get notationNote() {
    return tr(
      "<p><code>R</code> gira só a face. <code>2R</code> gira só a <b>2ª camada</b> (a fatia logo atrás da face), no mesmo sentido do <code>R</code>. <code>M</code> é a fatia do meio, no sentido do <code>L</code>. <code>4Rw</code> gira 4 camadas juntas (tudo menos a face oposta). <code>'</code> = anti-horário · <code>2</code> no fim = meia volta.</p>",
      "<p><code>R</code> turns just the face. <code>2R</code> turns just the <b>2nd layer</b> (the slice right behind the face), the same way as <code>R</code>. <code>M</code> is the middle slice, the same way as <code>L</code>. <code>4Rw</code> turns 4 layers together (everything but the opposite face). <code>'</code> = counterclockwise · <code>2</code> at the end = half turn.</p>",
    );
  },
  get notationHelp() {
    return [...faceNotation(true), { move: '2R', text: tr('2ª camada da direita', '2nd layer from the right') }, { move: 'M', text: tr('Fatia do meio', 'Middle slice') }];
  },
};

export default cube5;
