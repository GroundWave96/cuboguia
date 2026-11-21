import { describeNxNMove, faceNotation } from '../nxn/text';
import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { evenScanOrder, pickOrder } from '../nxn/evenscan';
import { ANY_FACE_HINTS, buildNet, buildScan } from '../nxn/layout';
import { geo4 as geo } from './pieces';
import { validateCube4 } from './validate';
import { solveCube4 } from './solver';

/** sem centro fixo: começa por qualquer face (como no 2x2) */
const SCAN = buildScan(geo, CUBE3_COLORS, {
  hints: ANY_FACE_HINTS,
});

const scanOrder = evenScanOrder(4, SCAN, (s) => validateCube4(s).ok);

/** embaralho com faces e fatias internas */
function scramble(len = 40): string[] {
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

const cube4: PuzzleImpl = {
  colors: CUBE3_COLORS,
  get holdHint() {
    return tr(
      'O 4x4 não tem centro fixo: segure do jeito que quiser, mas <b>não vire o cubo na mão</b> depois — a face de frente é a do meio da planificação. O tutorial monta o branco embaixo e o amarelo em cima nessa posição.',
      'The 4x4 has no fixed center: hold it however you like, but <b>don’t rotate the cube</b> afterwards — the front face is the middle one in the flat layout. The tutorial builds white on the bottom and yellow on top in that position.', 'El 4x4 no tiene centro fijo: sujétalo como quieras, pero <b>no gires el cubo</b> después; la cara del frente es la del medio en el plano. El tutorial arma el blanco abajo y el amarillo arriba en esa posición.',
    );
  },
  get scanHint() {
    return tr(
      'Pode começar por <b>qualquer face</b>, segurando o cubo do jeito que quiser — só não troque a posição entre uma face e outra: gire para a esquerda como as setas indicam. A primeira face lida é a da frente no tutorial.',
      'You can start with <b>any face</b>, holding the cube however you like — just don’t change your grip between faces: turn it to the left as the arrows show. The first face you scan becomes the front in the tutorial.', 'Puedes empezar por <b>cualquier cara</b>, sujetando el cubo como quieras; solo no cambies la forma de sujetarlo entre una cara y otra: gíralo hacia la izquierda como indican las flechas. La primera cara que escanees será el frente en el tutorial.',
    );
  },
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: [],
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble,
  validate: validateCube4,
  repairScan: (state) => pickOrder(state, scanOrder(state)),
  scanOrder,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Redução (iniciante)', 'Reduction (beginner)', 'Reducción (principiante)'),
        tagline: tr('Para aprender · ~250 movimentos', 'To learn · ~250 moves', 'Para aprender · ~250 movimientos'),
        description: tr(
          'Monta os centros, junta as arestas, corrige as paridades do 4x4 e termina como um 3x3 pelo método de camadas.',
          'Builds the centers, pairs the edges, fixes the 4x4 parities and finishes like a 3x3 with the layer method.', 'Arma los centros, junta las aristas, corrige las paridades del 4x4 y termina como un 3x3 con el método de capas.',
        ),
      },
      {
        id: 'cfop',
        name: tr('Redução + CFOP', 'Reduction + CFOP', 'Reducción + CFOP'),
        tagline: tr('Para quem já faz CFOP · ~200 movimentos', 'If you already know CFOP · ~200 moves', 'Si ya sabes CFOP · ~200 movimientos'),
        description: tr(
          'Mesmos centros, arestas e paridades, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.',
          'Same centers, edges and parities, but the 3x3 part uses Cross, F2L, OLL and PLL.', 'Los mismos centros, aristas y paridades, pero la parte de 3x3 usa Cruz, F2L, OLL y PLL.',
        ),
      },
    ];
  },
  solve: (state, methodId) => solveCube4(state, methodId === 'cfop' ? 'cfop' : 'beginner'),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(4),
  scan: SCAN,
  describeMove: (m) => describeNxNMove(m, false),
  get notationNote() {
    return tr(
      "<p><code>R</code> gira só a face. <code>2R</code> gira só a <b>2ª camada</b> (a fatia logo atrás da face), no mesmo sentido do <code>R</code>. <code>Uw</code> gira as 2 camadas de cima juntas; <code>3Rw</code> gira 3 camadas juntas (tudo menos a face oposta). <code>'</code> = anti-horário · <code>2</code> no fim = meia volta.</p>",
      "<p><code>R</code> turns just the face. <code>2R</code> turns just the <b>2nd layer</b> (the slice right behind the face), the same way as <code>R</code>. <code>Uw</code> turns the 2 top layers together; <code>3Rw</code> turns 3 layers together (everything but the opposite face). <code>'</code> = counterclockwise · <code>2</code> at the end = half turn.</p>", "<p><code>R</code> gira solo la cara. <code>2R</code> gira solo la <b>2.ª capa</b> (la que está justo detrás de la cara), en el mismo sentido que <code>R</code>. <code>Uw</code> gira las 2 capas de arriba juntas; <code>3Rw</code> gira 3 capas juntas (todo menos la cara opuesta). <code>'</code> = antihorario · <code>2</code> al final = media vuelta.</p>",
    );
  },
  get notationHelp() {
    return [...faceNotation(false), { move: '2R', text: tr('2ª camada da direita', '2nd layer from the right', '2.ª capa desde la derecha') }, { move: 'Uw', text: tr('2 camadas de cima', '2 top layers', '2 capas de arriba') }];
  },
};

export default cube4;
