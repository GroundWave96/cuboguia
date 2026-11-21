import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { getBigCube, scrambleBig, solveBig, validateBig } from '../nxn/big';
import { invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { describeNxNMove, faceNotation } from '../nxn/text';

const { geo, FIXED_CENTERS } = getBigCube(7);

const cube7: PuzzleImpl = {
  colors: CUBE3_COLORS,
  get holdHint() {
    return tr(
      'Segure o cubo com o <b>amarelo</b> em cima e o <b>verde</b> de frente (olhe o adesivo do meio de cada face).',
      'Hold the cube with <b>yellow</b> on top and <b>green</b> in front (look at the middle sticker of each face).',
    );
  },
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: FIXED_CENTERS,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 100) => scrambleBig(7, len),
  validate: (s) => validateBig(7, s),
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Redução (iniciante)', 'Reduction (beginner)'),
        tagline: tr('Para aprender · ~1000 movimentos', 'To learn · ~1000 moves'),
        description: tr(
          'Monta os centros, junta as arestas e termina como um 3x3 pelo método de camadas. É o mesmo caminho do 5x5, com mais peças.',
          'Builds the centers, pairs the edges and finishes like a 3x3 with the layer method. It’s the same path as the 5x5, with more pieces.',
        ),
      },
      {
        id: 'cfop',
        name: tr('Redução + CFOP', 'Reduction + CFOP'),
        tagline: tr('Para quem já faz CFOP · ~950 movimentos', 'If you already know CFOP · ~950 moves'),
        description: tr('Mesmos centros e arestas, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.', 'Same centers and edges, but the 3x3 part uses Cross, F2L, OLL and PLL.'),
      },
    ];
  },
  solve: (state, methodId) => solveBig(7, state, methodId === 'cfop' ? 'cfop' : 'beginner'),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(7),
  scan: buildScan(geo, CUBE3_COLORS),
  describeMove: (m) => describeNxNMove(m, true),
  get notationNote() {
    return tr(
      "<p><code>R</code> gira só a face. <code>2R</code> gira só a <b>2ª camada</b> (a fatia logo atrás da face) e <code>3R</code> só a <b>3ª</b>, no mesmo sentido do <code>R</code>. <code>M</code> é a fatia do meio, no sentido do <code>L</code> (só aparece dentro dos ciclos de centros, que devolvem os centros fixos ao lugar). <code>6Rw</code> gira 6 camadas juntas (tudo menos a face oposta). <code>'</code> = anti-horário · <code>2</code> no fim = meia volta.</p>",
      "<p><code>R</code> turns just the face. <code>2R</code> turns just the <b>2nd layer</b> (the slice right behind the face) and <code>3R</code> just the <b>3rd</b>, the same way as <code>R</code>. <code>M</code> is the middle slice, the same way as <code>L</code> (it only shows up inside center cycles, which put the fixed centers back). <code>6Rw</code> turns 6 layers together (everything but the opposite face). <code>'</code> = counterclockwise · <code>2</code> at the end = half turn.</p>",
    );
  },
  get notationHelp() {
    return [
      ...faceNotation(true),
      { move: '2R', text: tr('2ª camada da direita', '2nd layer from the right') },
      { move: '3R', text: tr('3ª camada da direita', '3rd layer from the right') },
      { move: 'M', text: tr('Fatia do meio', 'Middle slice') },
    ];
  },
};

export default cube7;
