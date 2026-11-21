import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { getBigCube, scrambleBig, solveBig, validateBig } from '../nxn/big';
import { evenScanOrder, pickOrder } from '../nxn/evenscan';
import { invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { ANY_FACE_HINTS, buildNet, buildScan } from '../nxn/layout';
import { describeNxNMove, faceNotation } from '../nxn/text';

const { geo } = getBigCube(6);
const validate = (s: string[]) => validateBig(6, s);
/** sem centro fixo: começa por qualquer face (como no 4x4) */
const SCAN = buildScan(geo, CUBE3_COLORS, { hints: ANY_FACE_HINTS });
const scanOrder = evenScanOrder(6, SCAN, (s) => validate(s).ok);

const cube6: PuzzleImpl = {
  colors: CUBE3_COLORS,
  get holdHint() {
    return tr(
      'O 6x6 não tem centro fixo: segure do jeito que quiser, mas <b>não vire o cubo na mão</b> depois — a face de frente é a do meio da planificação. O tutorial monta o branco embaixo e o amarelo em cima nessa posição.',
      'The 6x6 has no fixed center: hold it however you like, but <b>don’t rotate the cube</b> afterwards — the front face is the middle one in the flat layout. The tutorial builds white on the bottom and yellow on top in that position.',
    );
  },
  get scanHint() {
    return tr(
      'Pode começar por <b>qualquer face</b>, segurando o cubo do jeito que quiser — só não troque a posição entre uma face e outra: gire para a esquerda como as setas indicam. A primeira face lida é a da frente no tutorial.',
      'You can start with <b>any face</b>, holding the cube however you like — just don’t change your grip between faces: turn it to the left as the arrows show. The first face you scan becomes the front in the tutorial.',
    );
  },
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: [],
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 80) => scrambleBig(6, len),
  validate,
  repairScan: (state) => pickOrder(state, scanOrder(state)),
  scanOrder,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Redução (iniciante)', 'Reduction (beginner)'),
        tagline: tr('Para aprender · ~700 movimentos', 'To learn · ~700 moves'),
        description: tr(
          'Monta os centros, junta as arestas, corrige as paridades e termina como um 3x3 pelo método de camadas. É o mesmo caminho do 4x4, com mais peças.',
          'Builds the centers, pairs the edges, fixes the parities and finishes like a 3x3 with the layer method. It’s the same path as the 4x4, with more pieces.',
        ),
      },
      {
        id: 'cfop',
        name: tr('Redução + CFOP', 'Reduction + CFOP'),
        tagline: tr('Para quem já faz CFOP · ~650 movimentos', 'If you already know CFOP · ~650 moves'),
        description: tr('Mesmos centros, arestas e paridades, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.', 'Same centers, edges and parities, but the 3x3 part uses Cross, F2L, OLL and PLL.'),
      },
    ];
  },
  solve: (state, methodId) => solveBig(6, state, methodId === 'cfop' ? 'cfop' : 'beginner'),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(6),
  scan: SCAN,
  describeMove: (m) => describeNxNMove(m, false),
  get notationNote() {
    return tr(
      "<p><code>R</code> gira só a face. <code>2R</code> gira só a <b>2ª camada</b> (a fatia logo atrás da face) e <code>3R</code> só a <b>3ª</b>, no mesmo sentido do <code>R</code>. <code>3Uw</code> gira as 3 camadas de cima juntas; <code>5Rw</code> gira 5 camadas juntas (tudo menos a face oposta). <code>'</code> = anti-horário · <code>2</code> no fim = meia volta.</p>",
      "<p><code>R</code> turns just the face. <code>2R</code> turns just the <b>2nd layer</b> (the slice right behind the face) and <code>3R</code> just the <b>3rd</b>, the same way as <code>R</code>. <code>3Uw</code> turns the 3 top layers together; <code>5Rw</code> turns 5 layers together (everything but the opposite face). <code>'</code> = counterclockwise · <code>2</code> at the end = half turn.</p>",
    );
  },
  get notationHelp() {
    return [
      ...faceNotation(false),
      { move: '2R', text: tr('2ª camada da direita', '2nd layer from the right') },
      { move: '3R', text: tr('3ª camada da direita', '3rd layer from the right') },
    ];
  },
};

export default cube6;
