import type { PuzzleImpl } from '../../core/types';
import { invertMove, parseMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { COLOR_HEX, CUBE3_COLORS, FACE_NAME } from '../cube3/colors';
import { MID_CENTERS, geo5 as geo } from './pieces';
import { validateCube5 } from './validate';
import { solveCube5 } from './solver';

const FACE_TEXT: Record<string, string> = {
  U: 'Cima (amarelo)',
  D: 'Baixo (branco)',
  F: 'Frente (verde)',
  B: 'Trás (azul)',
  R: 'Direita (laranja)',
  L: 'Esquerda (vermelho)',
};
const MIDDLE_TEXT: Record<string, string> = {
  M: 'Fatia do meio vertical (sentido da esquerda)',
  E: 'Fatia do meio horizontal (sentido de baixo)',
  S: 'Fatia do meio da frente (sentido da frente)',
};

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
  holdHint: 'Segure o cubo com o <b>amarelo</b> em cima e o <b>verde</b> de frente (olhe o adesivo do meio de cada face).',
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: MID_CENTERS,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble,
  validate: validateCube5,
  methods: [
    {
      id: 'beginner',
      name: 'Redução (iniciante)',
      tagline: 'Para aprender · ~400 movimentos',
      description:
        'Monta os centros, junta as arestas e termina como um 3x3 pelo método de camadas. É o caminho que quase todo mundo usa no 5x5.',
    },
    {
      id: 'cfop',
      name: 'Redução + CFOP',
      tagline: 'Para quem já faz CFOP · ~350 movimentos',
      description: 'Mesmos centros e arestas, mas a parte de 3x3 é feita com Cross, F2L, OLL e PLL.',
    },
  ],
  solve: (state, methodId) => solveCube5(state, methodId === 'cfop' ? 'cfop' : 'beginner'),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(5),
  scan: buildScan(geo, CUBE3_COLORS),
  describeMove: (m) => {
    const dir = m.endsWith("'") ? 'anti-horário ↺' : m.endsWith('2') && !/^2[URFDLB]$/.test(m) ? 'meia volta (180°)' : 'horário ↻';
    const letter = m.replace(/[^URFDLBMES]/g, '');
    if (MIDDLE_TEXT[letter]) return `${MIDDLE_TEXT[letter]} · ${dir}`;
    const mv = parseMove(m);
    const what =
      mv.from === 2 && mv.depth === 2
        ? `2ª camada da ${FACE_NAME[mv.face].toLowerCase()} (fatia de dentro)`
        : mv.depth > 1
          ? `${FACE_TEXT[mv.face]} + ${mv.depth - 1} camadas de dentro (${mv.depth} camadas juntas)`
          : FACE_TEXT[mv.face];
    return `${what} · ${dir}`;
  },
  notationNote:
    "<p><code>R</code> gira só a face. <code>2R</code> gira só a <b>2ª camada</b> (a fatia logo atrás da face), no mesmo sentido do <code>R</code>. <code>M</code> é a fatia do meio, no sentido do <code>L</code>. <code>4Rw</code> gira 4 camadas juntas (tudo menos a face oposta). <code>'</code> = anti-horário · <code>2</code> no fim = meia volta.</p>",
  notationHelp: [
    { move: 'U', text: 'Cima (amarelo)' },
    { move: 'D', text: 'Baixo (branco)' },
    { move: 'F', text: 'Frente (verde)' },
    { move: 'B', text: 'Trás (azul)' },
    { move: 'R', text: 'Direita (laranja)' },
    { move: 'L', text: 'Esquerda (vermelho)' },
    { move: '2R', text: '2ª camada da direita' },
    { move: 'M', text: 'Fatia do meio' },
  ],
};

export default cube5;
