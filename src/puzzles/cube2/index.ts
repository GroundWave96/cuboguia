import type { PuzzleImpl } from '../../core/types';
import { NxNGeometry, invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { cornerFacelets, faceKeyOf } from '../nxn/pieces';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { makeValidate2 } from './validate';
import { solveBeginner2 } from './solver/beginner2';
import { solveOptimal2 } from './solver/optimal2';

const geo = new NxNGeometry(2);

/**
 * O 2x2 não tem centros. A referência é o canto branco-azul-vermelho, que fica
 * sempre atrás-embaixo-esquerda (DBL) — já vem pintado, como os centros do 3x3.
 */
const REFERENCE = cornerFacelets(geo)[6];

const cube2: PuzzleImpl = {
  colors: CUBE3_COLORS,
  holdHint:
    'Segure o cubo com o canto <b>branco-azul-vermelho</b> atrás, embaixo, à esquerda — com o <b>branco para baixo</b>. Ele é a referência e não sai do lugar.',
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: REFERENCE,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  // embaralha só com U, R e F para não tirar o canto de referência do lugar
  scramble: (len = 15) => {
    const out: string[] = [];
    let last = '';
    while (out.length < len) {
      const f = 'URF'[Math.floor(Math.random() * 3)];
      if (f === last) continue;
      out.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
      last = f;
    }
    return out;
  },
  validate: makeValidate2(geo),
  methods: [
    {
      id: 'beginner',
      name: 'Iniciante (camadas)',
      tagline: 'Para aprender · ~60 movimentos',
      description: 'Face branca, depois face amarela (Sune) e por fim trocar os cantos (T-perm). Só 3 algoritmos.',
    },
    {
      id: 'optimal',
      name: 'Avançado (ótimo)',
      tagline: 'A menor solução · ≤ 11 movimentos',
      description: 'O computador calcula o caminho mais curto possível. Ótimo para comparar e descobrir atalhos.',
    },
  ],
  solve: (state, methodId) => (methodId === 'optimal' ? solveOptimal2(state) : solveBeginner2(state)),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(2),
  scan: buildScan(geo, CUBE3_COLORS, {
    fixed: new Map(REFERENCE.map((i) => [i, faceKeyOf(geo, i)])),
    hints: {
      F: 'Canto <b>branco-azul-vermelho</b> atrás, embaixo, à esquerda',
      R: 'Gire o cubo ¼ de volta para a esquerda',
      B: 'Mais ¼ para a esquerda',
      L: 'Mais ¼ para a esquerda',
      U: 'Volte à frente e incline: topo para a câmera',
      D: 'Agora a base para a câmera',
    },
  }),
  notationHelp: [
    { move: 'U', text: 'Cima' },
    { move: 'R', text: 'Direita' },
    { move: 'F', text: 'Frente' },
    { move: 'D', text: 'Baixo' },
    { move: 'L', text: 'Esquerda' },
    { move: 'B', text: 'Trás' },
  ],
};

export default cube2;
