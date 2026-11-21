import { i18nMap, tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { COLOR_HEX, CUBE3_COLORS } from '../cube3/colors';
import { PolyView } from '../poly/PolyView';
import { H, MOVE_CORNERS, REFERENCE_CORNER, SKEWB_ROTATIONS, invertSkewbMove, randomScramble, skewbGeo as geo, type V3 } from './geometry';
import { buildSkewbNet, buildSkewbScan, skewbPieces } from './layout';
import { SKEWB_SOLVED as SOLVED, solveSkewbBeginner, solveSkewbOptimal } from './solver';
import { validateSkewb } from './validate';

const SCAN = buildSkewbScan();
const pick = <T>(state: T[], order: number[]) => order.map((i) => state[i]);

/**
 * Segurou o Skewb de outro jeito? Gira o puzzle inteiro até o canto amarelo-verde-laranja
 * ficar em cima-frente-direita. Devolve de onde vem cada adesivo.
 */
function normalizeOrder(state: string[]): number[] {
  for (const p of SKEWB_ROTATIONS) if (REFERENCE_CORNER.stickers.every((i) => state[p[i]] === SOLVED[i])) return Array.from(p);
  return state.map((_, i) => i); // não achou o canto: a validação explica o que está errado
}
const normalize = (state: string[]) => pick(state, normalizeOrder(state));

/** gira a imagem de uma face ¼ de volta (o centro fica, os triângulos andam) */
const turnImage = <T>(img: T[]) => [img[0], img[4], img[1], img[2], img[3]];

/**
 * Se a leitura não formar um Skewb possível, testa os enganos mais comuns — girou para a
 * direita (2ª e 4ª faces trocadas), mostrou o topo/a base girados ou trocados — do que
 * muda menos para o que muda mais, e fica com a primeira montagem válida.
 */
function repairOrder(state: string[]): number[] {
  const ids = state.map((_, i) => i);
  const ok = (s: string[]) => validateSkewb(normalize(s)).ok;
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

/** leitura da câmera → posição de referência, dizendo de onde veio cada adesivo */
function scanOrder(state: string[]): number[] {
  const first = repairOrder(state);
  return pick(first, normalizeOrder(pick(state, first)));
}

const CORNER_TEXT = i18nMap({
  R: ['Canto de baixo-trás-direita', 'Bottom-back-right corner', 'Esquina de abajo, atrás a la derecha'],
  U: ['Canto de cima-trás-esquerda', 'Top-back-left corner', 'Esquina de arriba, atrás a la izquierda'],
  L: ['Canto de baixo-frente-esquerda', 'Bottom-front-left corner', 'Esquina de abajo, delante a la izquierda'],
  B: ['Canto de baixo-trás-esquerda', 'Bottom-back-left corner', 'Esquina de abajo, atrás a la izquierda'],
});

const skewb: PuzzleImpl = {
  colors: CUBE3_COLORS,
  get holdHint() {
    return tr(
      'Segure o Skewb com o canto <b>amarelo-verde-laranja</b> em cima, na frente, à direita — <b>amarelo em cima</b> e <b>verde na frente</b>. Ele é a referência: nenhum movimento do tutorial mexe nele.',
      'Hold the Skewb with the <b>yellow-green-orange</b> corner at the top front right — <b>yellow on top</b> and <b>green in front</b>. It’s the reference: no move in the tutorial touches it.', 'Sujeta el Skewb con la esquina <b>amarilla-verde-naranja</b> arriba, delante a la derecha: <b>amarillo arriba</b> y <b>verde al frente</b>. Es la referencia: ningún movimiento del tutorial la toca.',
    );
  },
  get scanHint() {
    return tr(
      'Pode começar por <b>qualquer face</b>, segurando o Skewb do jeito que quiser — só não troque a posição entre uma face e outra: gire para a esquerda como as setas indicam. No fim, o site descobre sozinho como ele estava virado.',
      'You can start with <b>any face</b>, holding the Skewb however you like — just don’t change your grip between faces: turn it to the left as the arrows show. At the end, the site works out by itself how it was held.', 'Puedes empezar por <b>cualquier cara</b>, sujetando el Skewb como quieras; solo no cambies la forma de sujetarlo entre una cara y otra: gíralo hacia la izquierda como indican las flechas. Al final, la web descubre sola cómo estaba sujeto.',
    );
  },
  stickerCount: geo.stickers.length,
  solvedState: () => geo.solved(),
  fixedStickers: REFERENCE_CORNER.stickers,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove: invertSkewbMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 11) => randomScramble(len),
  validate: validateSkewb,
  normalize,
  repairScan: (state) => pick(state, repairOrder(state)),
  scanOrder,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Iniciante (camadas)', 'Beginner (layers)', 'Principiante (capas)'),
        tagline: tr('Para aprender · ~25 movimentos', 'To learn · ~25 moves', 'Para aprender · ~25 movimientos'),
        description: tr('Face branca (o centro e um canto por vez), depois os cantos de cima e por fim os centros.', 'White face (the center, then one corner at a time), then the top corners and finally the centers.', 'Cara blanca (el centro y después una esquina cada vez), después las esquinas de arriba y al final los centros.'),
      },
      {
        id: 'optimal',
        name: tr('Avançado (ótimo)', 'Advanced (optimal)', 'Avanzado (óptimo)'),
        tagline: tr('A menor solução · ≤ 11 movimentos', 'The shortest solution · ≤ 11 moves', 'La solución más corta · ≤ 11 movimientos'),
        description: tr('O computador calcula o caminho mais curto possível. Ótimo para comparar e descobrir atalhos.', 'The computer finds the shortest possible path. Great for comparing and discovering shortcuts.', 'El ordenador encuentra el camino más corto posible. Ideal para comparar y descubrir atajos.'),
      },
    ];
  },
  solve: (state, methodId) => (methodId === 'optimal' ? solveSkewbOptimal(state) : solveSkewbBeginner(state)),
  createView: (container) =>
    new PolyView(container, {
      ...skewbPieces(),
      bodyFaces: geo.bodyFaces,
      palette: COLOR_HEX,
      solved: geo.solved(),
      apply: (s, m) => geo.apply(s, m),
      locationMap: (m) => geo.locationMap(m),
      moveInfo: (m) => ({ axis: geo.axis(m), angle: geo.moveAngle(m), layer: geo.layer(m), cut: 0 }),
      // diagonal mostrando cima, frente e direita (o canto de referência no meio)
      defaultDir: [0.85, 0.75, 1],
      // vistas candidatas: faces, cantos e meios das arestas do cubo
      viewDirs: [
        ...geo.stickers.filter((s) => s.kind === 'center').map((s) => s.normal),
        ...geo.corners.map((c) => c.vertex),
        ...[0, 1, 2].flatMap((zero) =>
          [1, -1].flatMap((a) => [1, -1].map((b) => {
            const v: V3 = [0, 0, 0];
            const others = [0, 1, 2].filter((i) => i !== zero);
            v[others[0]] = a;
            v[others[1]] = b;
            return v;
          })),
        ),
      ],
      radius: H * 1.25,
    }),
  net: [],
  netSvg: buildSkewbNet(),
  scan: SCAN,
  describeMove: (m) => {
    const dir = m.endsWith("'") ? tr('anti-horário ↺', 'counterclockwise ↺', 'antihorario ↺') : tr('horário ↻', 'clockwise ↻', 'horario ↻');
    return `${CORNER_TEXT[m[0]]} · ${dir} (${tr('⅓ de volta', '⅓ turn', '⅓ de vuelta')})`;
  },
  get notationIntro() {
    return tr(
      'Cada letra é um <b>canto</b>. Gire a metade do Skewb que tem esse canto, olhando o canto <b>de fora</b>:',
      'Each letter is a <b>corner</b>. Turn the half of the Skewb that has that corner, looking at the corner <b>from outside</b>:', 'Cada letra es una <b>esquina</b>. Gira la mitad del Skewb que tiene esa esquina, mirando la esquina <b>desde fuera</b>:',
    );
  },
  get notationNote() {
    return tr(
      "<p>Cada giro é <b>⅓ de volta</b>. Sem apóstrofo = horário · <code>'</code> = anti-horário. Nenhum giro mexe no canto amarelo-verde-laranja (cima-frente-direita).</p>",
      "<p>Each turn is <b>⅓ of a rotation</b>. No apostrophe = clockwise · <code>'</code> = counterclockwise. No turn touches the yellow-green-orange corner (top-front-right).</p>", "<p>Cada giro es <b>⅓ de vuelta</b>. Sin apóstrofo = horario · <code>'</code> = antihorario. Ningún giro toca la esquina amarilla-verde-naranja (arriba, delante a la derecha).</p>",
    );
  },
  get notationHelp() {
    return Object.keys(MOVE_CORNERS).map((k) => ({ move: k, text: CORNER_TEXT[k] }));
  },
};

export default skewb;
