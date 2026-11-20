import type { PuzzleImpl } from '../../core/types';
import { COLOR_HEX, CUBE3_COLORS, FACE_NAME } from '../cube3/colors';
import { invertMove, parseMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { geo4 as geo } from './pieces';
import { validateCube4 } from './validate';
import { solveCube4 } from './solver';

const FACE_TEXT: Record<string, string> = {
  U: 'Cima',
  D: 'Baixo',
  F: 'Frente',
  B: 'Trás',
  R: 'Direita',
  L: 'Esquerda',
};

/** sem centro fixo: começa por qualquer face (como no 2x2) */
const SCAN = buildScan(geo, CUBE3_COLORS, {
  hints: {
    F: 'Comece por <b>qualquer face</b>',
    R: 'Gire o cubo ¼ de volta para a esquerda',
    B: 'Mais ¼ para a esquerda',
    L: 'Mais ¼ para a esquerda',
    U: 'Volte à primeira face e incline: topo para a câmera',
    D: 'Agora a base para a câmera',
  },
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
  holdHint:
    'O 4x4 não tem centro fixo: segure do jeito que quiser, mas <b>não vire o cubo na mão</b> depois — a face de frente é a do meio da planificação. O tutorial monta o branco embaixo e o amarelo em cima nessa posição.',
  scanHint:
    'Pode começar por <b>qualquer face</b>, segurando o cubo do jeito que quiser — só não troque a posição entre uma face e outra: gire para a esquerda como as setas indicam. A primeira face lida é a da frente no tutorial.',
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
  methods: [
    {
      id: 'beginner',
      name: 'Redução (iniciante)',
      tagline: 'Para aprender · ~250 movimentos',
      description:
        'Monta os centros, junta as arestas, corrige as paridades do 4x4 e termina como um 3x3 pelo método de camadas.',
    },
    {
      id: 'cfop',
      name: 'Redução + CFOP',
      tagline: 'Para quem já faz CFOP · ~200 movimentos',
      description: 'Mesmos centros, arestas e paridades, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.',
    },
  ],
  solve: (state, methodId) => solveCube4(state, methodId === 'cfop' ? 'cfop' : 'beginner'),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(4),
  scan: SCAN,
  describeMove: (m) => {
    const dir = m.endsWith("'") ? 'anti-horário ↺' : m.endsWith('2') && !/^2[URFDLB]$/.test(m) ? 'meia volta (180°)' : 'horário ↻';
    const mv = parseMove(m);
    const what =
      mv.from === 2 && mv.depth === 2
        ? `2ª camada da ${FACE_NAME[mv.face].toLowerCase()} (fatia de dentro)`
        : mv.depth > 1
          ? `${FACE_TEXT[mv.face]} + ${mv.depth - 1} camada${mv.depth > 2 ? 's' : ''} de dentro (${mv.depth} camadas juntas)`
          : FACE_TEXT[mv.face];
    return `${what} · ${dir}`;
  },
  notationNote:
    "<p><code>R</code> gira só a face. <code>2R</code> gira só a <b>2ª camada</b> (a fatia logo atrás da face), no mesmo sentido do <code>R</code>. <code>Uw</code> gira as 2 camadas de cima juntas; <code>3Rw</code> gira 3 camadas juntas (tudo menos a face oposta). <code>'</code> = anti-horário · <code>2</code> no fim = meia volta.</p>",
  notationHelp: [
    { move: 'U', text: 'Cima' },
    { move: 'D', text: 'Baixo' },
    { move: 'F', text: 'Frente' },
    { move: 'B', text: 'Trás' },
    { move: 'R', text: 'Direita' },
    { move: 'L', text: 'Esquerda' },
    { move: '2R', text: '2ª camada da direita' },
    { move: 'Uw', text: '2 camadas de cima' },
  ],
};

export default cube4;
