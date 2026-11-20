import { describeNxNMove, faceNotation } from '../nxn/text';
import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { ANY_FACE_HINTS, buildNet, buildScan } from '../nxn/layout';
import { geo4 as geo } from './pieces';
import { validateCube4 } from './validate';
import { solveCube4 } from './solver';

/** sem centro fixo: começa por qualquer face (como no 2x2) */
const SCAN = buildScan(geo, CUBE3_COLORS, {
  hints: ANY_FACE_HINTS,
});

/** gira a imagem 4x4 de uma face ¼ de volta (sentido horário na tela) */
const turnImage = <T>(img: T[]) => Array.from({ length: 16 }, (_, k) => img[(3 - (k % 4)) * 4 + ((k / 4) | 0)]);
const pick = <T>(state: T[], order: number[]) => order.map((i) => state[i]);

/**
 * Se a leitura não formar um 4x4 possível, testa os enganos mais comuns — girou para a
 * direita (2ª e 4ª faces trocadas), mostrou o topo/a base girados ou trocados — do que
 * muda menos para o que muda mais, e fica com a primeira montagem válida.
 * Não há posição de referência: o cubo fica como foi lido (a 1ª face é a da frente).
 */
function scanOrder(state: string[]): number[] {
  const ids = state.map((_, i) => i);
  const ok = (s: string[]) => validateCube4(s).ok;
  if (ok(state)) return ids;
  const images = SCAN.map((f) => f.grid.flat());
  const tries: { cost: number; slots: number[][] }[] = [];
  for (const sides of [false, true])
    for (const swapUD of [false, true])
      for (let ru = 0; ru < 4; ru++)
        for (let rd = 0; rd < 4; rd++) {
          const slots = [...images];
          if (sides) [slots[1], slots[3]] = [images[3], images[1]];
          let up = swapUD ? images[5] : images[4], down = swapUD ? images[4] : images[5];
          for (let k = 0; k < ru; k++) up = turnImage(up);
          for (let k = 0; k < rd; k++) down = turnImage(down);
          slots[4] = up;
          slots[5] = down;
          tries.push({ cost: +sides + +swapUD + +(ru > 0) + +(rd > 0), slots });
        }
  for (const t of tries.sort((a, b) => a.cost - b.cost)) {
    const order = [...ids];
    SCAN.forEach((f, k) => f.grid.flat().forEach((i, j) => (order[i] = t.slots[k][j])));
    if (ok(pick(state, order))) return order;
  }
  return ids;
}

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
      'The 4x4 has no fixed center: hold it however you like, but <b>don’t rotate the cube</b> afterwards — the front face is the middle one in the flat layout. The tutorial builds white on the bottom and yellow on top in that position.',
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
  scramble,
  validate: validateCube4,
  repairScan: (state) => pick(state, scanOrder(state)),
  scanOrder,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Redução (iniciante)', 'Reduction (beginner)'),
        tagline: tr('Para aprender · ~250 movimentos', 'To learn · ~250 moves'),
        description: tr(
          'Monta os centros, junta as arestas, corrige as paridades do 4x4 e termina como um 3x3 pelo método de camadas.',
          'Builds the centers, pairs the edges, fixes the 4x4 parities and finishes like a 3x3 with the layer method.',
        ),
      },
      {
        id: 'cfop',
        name: tr('Redução + CFOP', 'Reduction + CFOP'),
        tagline: tr('Para quem já faz CFOP · ~200 movimentos', 'If you already know CFOP · ~200 moves'),
        description: tr(
          'Mesmos centros, arestas e paridades, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.',
          'Same centers, edges and parities, but the 3x3 part uses Cross, F2L, OLL and PLL.',
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
      "<p><code>R</code> turns just the face. <code>2R</code> turns just the <b>2nd layer</b> (the slice right behind the face), the same way as <code>R</code>. <code>Uw</code> turns the 2 top layers together; <code>3Rw</code> turns 3 layers together (everything but the opposite face). <code>'</code> = counterclockwise · <code>2</code> at the end = half turn.</p>",
    );
  },
  get notationHelp() {
    return [...faceNotation(false), { move: '2R', text: tr('2ª camada da direita', '2nd layer from the right') }, { move: 'Uw', text: tr('2 camadas de cima', '2 top layers') }];
  },
};

export default cube4;
