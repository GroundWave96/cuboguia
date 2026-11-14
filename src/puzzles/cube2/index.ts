import type { PuzzleImpl } from '../../core/types';
import { NxNGeometry, invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { cornerFacelets } from '../nxn/pieces';
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

/** as 24 posições do cubo inteiro (Rw e Uw giram as duas camadas = o cubo todo) */
const ROTATIONS: string[][] = (() => {
  const ids = Array.from({ length: geo.count }, (_, i) => String(i));
  const seen = new Map<string, string[]>([[ids.join(','), []]]);
  let frontier: [string[], string[]][] = [[ids, []]];
  while (frontier.length) {
    const next: [string[], string[]][] = [];
    for (const [st, seq] of frontier)
      for (const m of ['Rw', 'Uw']) {
        const n = geo.apply(st, m);
        const k = n.join(',');
        if (seen.has(k)) continue;
        seen.set(k, [...seq, m]);
        next.push([n, [...seq, m]]);
      }
    frontier = next;
  }
  return [...seen.values()];
})();

/**
 * A câmera pode começar por qualquer face; depois disso, gira o cubo lido até o canto
 * de referência (branco-azul-vermelho) ficar atrás-embaixo-esquerda com o branco embaixo.
 */
function normalizeScan(state: string[]): string[] {
  const solved = geo.solved();
  for (const seq of ROTATIONS) {
    const s = seq.reduce((acc, m) => geo.apply(acc, m), state);
    if (REFERENCE.every((i) => s[i] === solved[i])) return s;
  }
  return state; // não achou o canto: a validação explica o que está errado
}

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
  // sem canto fixo na câmera: começa por qualquer face e o site acha a posição no fim
  scan: buildScan(geo, CUBE3_COLORS, {
    hints: {
      F: 'Comece por <b>qualquer face</b>',
      R: 'Gire o cubo ¼ de volta para a esquerda',
      B: 'Mais ¼ para a esquerda',
      L: 'Mais ¼ para a esquerda',
      U: 'Volte à primeira face e incline: topo para a câmera',
      D: 'Agora a base para a câmera',
    },
  }),
  scanHint:
    'Pode começar por <b>qualquer face</b>, segurando o cubo do jeito que quiser — só não troque a posição entre uma face e outra: gire para a esquerda como as setas indicam. No fim, o site descobre sozinho como o cubo estava virado.',
  normalize: normalizeScan,
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
