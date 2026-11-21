import { faceNotation } from '../nxn/text';
import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { NxNGeometry, invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { ANY_FACE_HINTS, buildNet, buildScan } from '../nxn/layout';
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
function normalizeOrder(state: string[]): number[] {
  const solved = geo.solved();
  const ids = state.map((_, i) => String(i));
  for (const seq of ROTATIONS) {
    const s = seq.reduce((acc, m) => geo.apply(acc, m), state);
    if (REFERENCE.every((i) => s[i] === solved[i])) return seq.reduce((acc, m) => geo.apply(acc, m), ids).map(Number);
  }
  return ids.map(Number); // não achou o canto: a validação explica o que está errado
}
/** de onde vem cada adesivo (resultado[j] = estado[ordem[j]]) */
const pick = <T>(state: T[], order: number[]) => order.map((i) => state[i]);
const normalizeScan = (state: string[]) => pick(state, normalizeOrder(state));

const validate2 = makeValidate2(geo);

/** sem canto fixo na câmera: começa por qualquer face e o site acha a posição no fim */
const SCAN = buildScan(geo, CUBE3_COLORS, {
  hints: ANY_FACE_HINTS,
});

/** gira a imagem 2x2 de uma face ¼ de volta (sentido horário na tela) */
const turnImage = <T>(img: T[]) => [img[2], img[0], img[3], img[1]];

/**
 * Se a leitura não formar um 2x2 possível, testa os enganos mais comuns — girou para a
 * direita (2ª e 4ª faces trocadas), mostrou o topo/a base girados ou trocados — do que
 * muda menos para o que muda mais, e fica com a primeira montagem válida.
 */
function repairOrder(state: string[]): number[] {
  const ids = state.map((_, i) => i);
  const ok = (s: string[]) => validate2(normalizeScan(s)).ok;
  if (ok(state)) return ids;
  // cada "imagem" é a lista de adesivos lidos numa face (a cor sai do estado)
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
const repairScan = (state: string[]) => pick(state, repairOrder(state));

/** leitura da câmera → posição de referência, dizendo de onde veio cada adesivo */
function scanOrder(state: string[]): number[] {
  const first = repairOrder(state);
  return pick(first, normalizeOrder(pick(state, first)));
}

const cube2: PuzzleImpl = {
  colors: CUBE3_COLORS,
  get holdHint() {
    return tr(
      'Segure o cubo com o canto <b>branco-azul-vermelho</b> atrás, embaixo, à esquerda — com o <b>branco para baixo</b>. Ele é a referência e não sai do lugar.',
      'Hold the cube with the <b>white-blue-red</b> corner at the back, bottom, left — with <b>white facing down</b>. It’s the reference and never moves.', 'Sujeta el cubo con la esquina <b>blanca-azul-roja</b> atrás, abajo, a la izquierda, con el <b>blanco hacia abajo</b>. Es la referencia y nunca se mueve.',
    );
  },
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
  validate: validate2,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Iniciante (camadas)', 'Beginner (layers)', 'Principiante (capas)'),
        tagline: tr('Para aprender · ~60 movimentos', 'To learn · ~60 moves', 'Para aprender · ~60 movimientos'),
        description: tr(
          'Face branca, depois face amarela (Sune) e por fim trocar os cantos (T-perm). Só 3 algoritmos.',
          'White face, then yellow face (Sune) and finally swap the corners (T-perm). Only 3 algorithms.', 'Cara blanca, después cara amarilla (Sune) y al final intercambiar las esquinas (T-perm). Solo 3 algoritmos.',
        ),
      },
      {
        id: 'optimal',
        name: tr('Avançado (ótimo)', 'Advanced (optimal)', 'Avanzado (óptimo)'),
        tagline: tr('A menor solução · ≤ 11 movimentos', 'The shortest solution · ≤ 11 moves', 'La solución más corta · ≤ 11 movimientos'),
        description: tr(
          'O computador calcula o caminho mais curto possível. Ótimo para comparar e descobrir atalhos.',
          'The computer finds the shortest possible path. Great for comparing and discovering shortcuts.', 'El ordenador encuentra el camino más corto posible. Ideal para comparar y descubrir atajos.',
        ),
      },
    ];
  },
  solve: (state, methodId) => (methodId === 'optimal' ? solveOptimal2(state) : solveBeginner2(state)),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(2),
  scan: SCAN,
  get scanHint() {
    return tr(
      'Pode começar por <b>qualquer face</b>, segurando o cubo do jeito que quiser — só não troque a posição entre uma face e outra: gire para a esquerda como as setas indicam. No fim, o site descobre sozinho como o cubo estava virado.',
      'You can start with <b>any face</b>, holding the cube however you like — just don’t change your grip between faces: turn it to the left as the arrows show. At the end, the site works out by itself how the cube was held.', 'Puedes empezar por <b>cualquier cara</b>, sujetando el cubo como quieras; solo no cambies la forma de sujetarlo entre una cara y otra: gíralo hacia la izquierda como indican las flechas. Al final, la web descubre sola cómo estaba sujeto el cubo.',
    );
  },
  normalize: normalizeScan,
  repairScan,
  scanOrder,
  get notationHelp() {
    return faceNotation(false, ['U', 'R', 'F', 'D', 'L', 'B']);
  },
};

export default cube2;
