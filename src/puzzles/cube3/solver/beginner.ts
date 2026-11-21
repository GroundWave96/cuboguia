import { tr } from '../../../core/i18n';
/**
 * Solucionador pelo MÉTODO DE INICIANTE (camada por camada), pensado para ensinar.
 *
 * Orientação fixa: AMARELO em cima (U), VERDE na frente (F), BRANCO embaixo (D).
 *
 * Etapas:
 *  1. Cruz branca          – busca em largura sobre as arestas da cruz (ótima por aresta)
 *  2. Cantos brancos       – "repita R U R' U'" (macros)
 *  3. Segunda camada       – algoritmos para direita/esquerda (macros)
 *  4. Cruz amarela         – F R U R' U' F'
 *  5. Face amarela         – Sune (R U R' U R U2 R')
 *  6. Cantos amarelos      – A-perm
 *  7. Arestas amarelas     – U-perm
 *
 * Em cada etapa (exceto a cruz) uma busca iterativa sobre "macros" (algoritmos que
 * o usuário aprende + giros do topo) encontra a menor sequência que atinge o objetivo
 * sem desfazer o que já está pronto. Assim o resultado é sempre correto e ensinável.
 */
import type { PuzzleState, Solution, SolutionStage } from '../../../core/types';
import {
  ADJUSTS, ALL_FACELETS, B, CROSS_TARGETS, D, EDGE_IDX, F, F2L, FIRST_LAYER, L, LAST_LAYER, R, U, U_CORNER_FACELETS, U_FACE,
  allSolved, bfsEdges, cname, cornerFaceletsOf, crossFacelets, edgeFaceletsOf, findCorner, findEdge, macro, pieceName,
  pushStep, remap, searchMacros, setupText, stepsFromMacros, toS, whiteLoc, type Ctx, type Macro, type S,
} from './common';

function solveCross(ctx: Ctx) {
  const placed: { color: number; target: number }[] = [];
  let remaining = [...CROSS_TARGETS];
  while (remaining.length) {
    let best: { t: (typeof remaining)[0]; moves: string[] } | null = null;
    for (const t of remaining) {
      const all = [...placed, t];
      const moves = bfsEdges(
        all.map((x) => whiteLoc(ctx.s, x.color)),
        all.map((x) => EDGE_IDX.get(x.target)!),
      );
      if (!best || moves.length < best.moves.length) best = { t, moves };
    }
    const { t, moves } = best!;
    const name = cname(t.color);
    const focus = findEdge(ctx.s, [D, t.color]);
    const already = moves.length === 0;
    if (!already) {
      pushStep(
        ctx,
        'cross',
        tr(`Aresta branco-${name}`, `White-${name} edge`, `Arista blanco-${name}`),
        tr(
          `Leve a aresta <b>branco-${name}</b> para a face de baixo, com o branco virado para baixo e o ${name} alinhado com o centro ${name}. ` +
            (placed.length
              ? `Os movimentos foram escolhidos para não desmontar as ${placed.length === 1 ? 'aresta' : 'arestas'} da cruz que já estão no lugar.`
              : 'Esta é a primeira aresta: só precisamos levá-la até o lugar certo.'),
          `Bring the <b>white-${name}</b> edge to the bottom face, with white facing down and ${name} lined up with the ${name} center. ` +
            (placed.length
              ? `The moves were chosen so they don’t break the cross ${placed.length === 1 ? 'edge' : 'edges'} already in place.`
              : 'This is the first edge: we just need to bring it to the right spot.'),
          `Lleva la arista <b>blanco-${name}</b> a la cara de abajo, con el blanco hacia abajo y el ${name} alineado con el centro ${name}. ` +
            (placed.length
              ? `Los movimientos se eligieron para no romper ${placed.length === 1 ? 'la arista' : 'las aristas'} de la cruz que ya están en su lugar.`
              : 'Esta es la primera arista: solo hay que llevarla al lugar correcto.'),
        ),
        [{ label: tr('Movimentos', 'Moves', 'Movimientos'), moves }],
        focus,
      );
    }
    placed.push(t);
    remaining = remaining.filter((x) => x !== t);
  }
}

// ---------------------------------------------------------------------------
// 2. Cantos brancos
const CORNER_SLOTS = [
  { view: 0, colors: [D, F, R] }, // DFR
  { view: 1, colors: [D, R, B] }, // DRB
  { view: 2, colors: [D, B, L] }, // DBL
  { view: 3, colors: [D, L, F] }, // DLF
];
const CORNER_MACROS: Macro[] = [
  ...ADJUSTS,
  ...CORNER_SLOTS.flatMap((slot) =>
    [1, 2, 3, 4, 5].map((n) =>
      macro('alg', Array.from({ length: n }, () => remap("R U R' U'", slot.view)).flat(), `c${slot.view}`, { view: slot.view, n }),
    ),
  ),
];

function solveCorners(ctx: Ctx) {
  const placed: number[][] = [];
  let remaining = [...CORNER_SLOTS];
  while (remaining.length) {
    let best: { slot: (typeof remaining)[0]; seq: Macro[]; len: number } | null = null;
    for (const slot of remaining) {
      const keep = [...crossFacelets, ...placed.flat()];
      const target = cornerFaceletsOf(slot.colors);
      const seq = searchMacros(ctx.s, CORNER_MACROS, (s) => allSolved(s, target) && allSolved(s, keep), 4);
      if (!seq) continue;
      const len = seq.reduce((a, m) => a + m.moves.length, 0);
      if (!best || len < best.len) best = { slot, seq, len };
    }
    if (!best) throw new Error('falha nos cantos');
    const { slot, seq } = best;
    const target = cornerFaceletsOf(slot.colors);
    const name = pieceName(slot.colors);
    stepsFromMacros(
      ctx,
      seq,
      'corners',
      (m, setup, _b, after) => {
        const v = m.meta!.view as number;
        const vName = cname([F, R, B, L][v]);
        const n = m.meta!.n as number;
        const done = allSolved(after, target);
        if (done) {
          return {
            title: tr(`Canto ${name}`, `${name} corner`, `Esquina ${name}`),
            text:
              setupText(setup) +
              tr(
                (setup.length ? `Assim o canto <b>${name}</b> fica logo acima do seu lugar (entre os centros ${pieceName(slot.colors.slice(1))}). ` : `O canto <b>${name}</b> já está na posição certa para entrar. `) +
                  `Agora, olhando com a face <b>${vName}</b> de frente, repita <b>R U R' U'</b> ${n === 1 ? 'uma vez' : `${n} vezes`}. ` +
                  `A cada repetição o canto gira; ele encaixa quando o branco fica para baixo.`,
                (setup.length ? `That puts the <b>${name}</b> corner right above its slot (between the ${pieceName(slot.colors.slice(1))} centers). ` : `The <b>${name}</b> corner is already in position to go in. `) +
                  `Now, with the <b>${vName}</b> face toward you, repeat <b>R U R' U'</b> ${n === 1 ? 'once' : `${n} times`}. ` +
                  `Each repetition twists the corner; it’s in when white faces down.`,
                (setup.length ? `Así la esquina <b>${name}</b> queda justo encima de su lugar (entre los centros ${pieceName(slot.colors.slice(1))}). ` : `La esquina <b>${name}</b> ya está en posición para entrar. `) +
                  `Ahora, con la cara <b>${vName}</b> hacia ti, repite <b>R U R' U'</b> ${n === 1 ? 'una vez' : `${n} veces`}. ` +
                  `Cada repetición gira la esquina; entra cuando el blanco queda hacia abajo.`,
              ),
            algLabel: n === 1 ? "R U R' U'" : `(R U R' U') × ${n}`,
          };
        }
        return {
          title: tr(`Retirar o canto ${name}`, `Take out the ${name} corner`, `Saca la esquina ${name}`),
          text:
            setupText(setup) +
            tr(
              `O canto <b>${name}</b> está preso na camada de baixo, no lugar errado. Olhando com a face <b>${vName}</b> de frente, ` +
                `faça <b>R U R' U'</b> ${n === 1 ? 'uma vez' : `${n} vezes`} para levá-lo para a camada de cima.`,
              `The <b>${name}</b> corner is stuck in the bottom layer, in the wrong spot. With the <b>${vName}</b> face toward you, ` +
                `do <b>R U R' U'</b> ${n === 1 ? 'once' : `${n} times`} to bring it up to the top layer.`,
              `La esquina <b>${name}</b> está atascada en la capa de abajo, en el lugar equivocado. Con la cara <b>${vName}</b> hacia ti, ` +
                `haz <b>R U R' U'</b> ${n === 1 ? 'una vez' : `${n} veces`} para subirla a la capa de arriba.`,
            ),
          algLabel: "R U R' U'",
        };
      },
      () => findCorner(ctx.s, slot.colors),
    );
    placed.push(target);
    remaining = remaining.filter((x) => x !== slot);
  }
}

// ---------------------------------------------------------------------------
// 3. Segunda camada
const RIGHT_ALG = "U R U' R' U' F' U F";
const LEFT_ALG = "U' L' U L U F U' F'";
const MIDDLE_MACROS: Macro[] = [
  ...ADJUSTS,
  ...[0, 1, 2, 3].flatMap((v) => [
    macro('alg', remap(RIGHT_ALG, v), undefined, { view: v, side: 'right', alg: RIGHT_ALG }),
    macro('alg', remap(LEFT_ALG, v), undefined, { view: v, side: 'left', alg: LEFT_ALG }),
  ]),
];
const MIDDLE_SLOTS = [
  [F, R],
  [R, B],
  [B, L],
  [L, F],
];

function solveMiddle(ctx: Ctx) {
  const placed: number[][] = [];
  let remaining = [...MIDDLE_SLOTS];
  while (remaining.length) {
    let best: { slot: number[]; seq: Macro[]; len: number } | null = null;
    for (const slot of remaining) {
      const keep = [...FIRST_LAYER, ...placed.flat()];
      const target = edgeFaceletsOf(slot);
      const seq = searchMacros(ctx.s, MIDDLE_MACROS, (s) => allSolved(s, target) && allSolved(s, keep), 4);
      if (!seq) continue;
      const len = seq.reduce((a, m) => a + m.moves.length, 0);
      if (!best || len < best.len) best = { slot, seq, len };
    }
    if (!best) throw new Error('falha na segunda camada');
    const { slot, seq } = best;
    const target = edgeFaceletsOf(slot);
    const name = pieceName(slot);
    stepsFromMacros(
      ctx,
      seq,
      'middle',
      (m, setup, _b, after) => {
        const vName = cname([F, R, B, L][m.meta!.view as number]);
        const side = m.meta!.side === 'right' ? tr('direita', 'right', 'derecha') : tr('esquerda', 'left', 'izquierda');
        const alg = m.meta!.alg as string;
        if (allSolved(after, target)) {
          return {
            title: tr(`Aresta ${name}`, `${name} edge`, `Arista ${name}`),
            text:
              setupText(setup) +
              tr(
                `A aresta <b>${name}</b> fica na camada de cima formando um “T” com o centro <b>${vName}</b> (a cor da frente da aresta igual ao centro). ` +
                  `Ela precisa descer para a <b>${side}</b>. Olhando com a face <b>${vName}</b> de frente, aplique: <code>${alg}</code>.`,
                `The <b>${name}</b> edge sits in the top layer making a “T” with the <b>${vName}</b> center (the edge’s front color matches the center). ` +
                  `It has to go down to the <b>${side}</b>. With the <b>${vName}</b> face toward you, apply: <code>${alg}</code>.`,
                `La arista <b>${name}</b> está en la capa de arriba formando una “T” con el centro <b>${vName}</b> (el color del frente de la arista igual al centro). ` +
                  `Tiene que bajar hacia la <b>${side}</b>. Con la cara <b>${vName}</b> hacia ti, aplica: <code>${alg}</code>.`,
              ),
            algLabel: tr(`Algoritmo (${side})`, `Algorithm (${side})`, `Algoritmo (${side})`),
          };
        }
        return {
          title: tr(`Retirar a aresta ${name}`, `Take out the ${name} edge`, `Saca la arista ${name}`),
          text:
            setupText(setup) +
            tr(
              `A aresta <b>${name}</b> está presa na segunda camada (no lugar errado ou invertida). Olhando com a face <b>${vName}</b> de frente, ` +
                `aplique <code>${alg}</code> para trocá-la por uma peça da camada de cima — assim ela sobe e depois pode ser encaixada.`,
              `The <b>${name}</b> edge is stuck in the middle layer (wrong slot or flipped). With the <b>${vName}</b> face toward you, ` +
                `apply <code>${alg}</code> to swap it with a top-layer piece — that brings it up so it can be inserted afterwards.`,
              `La arista <b>${name}</b> está atascada en la capa del medio (en el lugar equivocado o volteada). Con la cara <b>${vName}</b> hacia ti, ` +
                `aplica <code>${alg}</code> para cambiarla por una pieza de la capa de arriba: así sube y después se puede colocar.`,
            ),
          algLabel: tr('Retirar', 'Take out', 'Sacar'),
        };
      },
      () => findEdge(ctx.s, slot),
    );
    placed.push(target);
    remaining = remaining.filter((x) => x !== slot);
  }
}

// ---------------------------------------------------------------------------
// 4-7. Última camada
const OLL_EDGES = "F R U R' U' F'";
const SUNE = "R U R' U R U2 R'";
const A_PERM = "R' F R' B2 R F' R' B2 R2";
const A_PERM_INV = "R2 B2 R F R' B2 R F' R";
const U_PERM_A = "R U' R U R U R U' R' U' R2";
const U_PERM_B = "R2 U R U R' U' R' U' R' U R'";

const yellowEdgesUp = (s: S) => [1, 3, 5, 7].filter((f) => s[f] === U).length;
const yellowCornersUp = (s: S) => [0, 2, 6, 8].filter((f) => s[f] === U).length;

function solveLastLayer(ctx: Ctx) {
  const llFocus = () => LAST_LAYER;

  // 4. Cruz amarela
  const ycSeq = searchMacros(ctx.s, [...ADJUSTS, macro('alg', remap(OLL_EDGES, 0))], (s) => allSolved(s, F2L) && yellowEdgesUp(s) === 4, 8);
  if (!ycSeq) throw new Error('falha na cruz amarela');
  stepsFromMacros(
    ctx,
    ycSeq,
    'ycross',
    (_m, setup, before) => {
      const n = yellowEdgesUp(before);
      const up = [1, 3, 5, 7].map((f) => before[f] === U);
      // 1=trás 3=esq 5=dir 7=frente
      let shape: string;
      if (n === 0) shape = tr('Só o centro está amarelo (um <b>ponto</b>). Aplique o algoritmo; depois aparecerá um “L” ou uma linha.', 'Only the center is yellow (a <b>dot</b>). Apply the algorithm; afterwards an “L” or a line will show up.', 'Solo el centro es amarillo (un <b>punto</b>). Aplica el algoritmo; después aparecerá una “L” o una línea.');
      else if (up[1] && up[2]) shape = tr('Há uma <b>linha</b> amarela na horizontal (esquerda–direita) — é a posição certa para o algoritmo.', 'There’s a horizontal yellow <b>line</b> (left–right) — the right position for the algorithm.', 'Hay una <b>línea</b> amarilla horizontal (de izquierda a derecha): la posición correcta para el algoritmo.');
      else if (up[0] && up[3]) shape = tr('Há uma <b>linha</b> amarela; ela precisa estar na horizontal antes do algoritmo.', 'There’s a yellow <b>line</b>; it has to be horizontal before the algorithm.', 'Hay una <b>línea</b> amarilla; tiene que quedar horizontal antes del algoritmo.');
      else shape = tr('Há um <b>“L”</b> amarelo (duas arestas vizinhas). Ele deve apontar para <b>trás e para a esquerda</b>, como os ponteiros às 9h e 12h.', 'There’s a yellow <b>“L”</b> (two neighboring edges). It must point <b>back and to the left</b>, like clock hands at 9 and 12.', 'Hay una <b>“L”</b> amarilla (dos aristas vecinas). Debe apuntar <b>hacia atrás y a la izquierda</b>, como las agujas del reloj a las 9 y a las 12.');
      return {
        title: tr('Formar a cruz amarela', 'Make the yellow cross', 'Haz la cruz amarilla'),
        text: setupText(setup) + shape + tr(` Com a face <b>verde</b> de frente, aplique <code>${OLL_EDGES}</code>.`, ` With the <b>green</b> face toward you, apply <code>${OLL_EDGES}</code>.`, ` Con la cara <b>verde</b> hacia ti, aplica <code>${OLL_EDGES}</code>.`),
        algLabel: OLL_EDGES,
      };
    },
    llFocus,
  );

  // 5. Face amarela (Sune)
  const ocSeq = searchMacros(ctx.s, [...ADJUSTS, macro('alg', remap(SUNE, 0))], (s) => allSolved(s, F2L) && allSolved(s, U_FACE), 9);
  if (!ocSeq) throw new Error('falha na face amarela');
  stepsFromMacros(
    ctx,
    ocSeq,
    'oll',
    (_m, setup, before) => {
      const n = yellowCornersUp(before);
      const hint =
        n === 1
          ? tr('Há <b>um</b> canto com amarelo para cima (o “peixinho”): ele deve ficar na posição <b>frente-esquerda</b>.', 'There’s <b>one</b> corner with yellow facing up (the “fish”): it must be at the <b>front-left</b>.', 'Hay <b>una</b> esquina con el amarillo hacia arriba (el “pez”): debe quedar <b>delante a la izquierda</b>.')
          : n === 0
            ? tr('Nenhum canto tem amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>esquerda</b>.', 'No corner has yellow facing up: put a corner with yellow facing <b>left</b> at the <b>front-left</b>.', 'Ninguna esquina tiene el amarillo hacia arriba: pon una esquina con el amarillo hacia la <b>izquierda</b> <b>delante a la izquierda</b>.')
            : tr(`Há ${n} cantos com amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>frente</b>.`, `${n} corners have yellow facing up: put a corner with yellow facing the <b>front</b> at the <b>front-left</b>.`, `${n} esquinas tienen el amarillo hacia arriba: pon una esquina con el amarillo hacia el <b>frente</b> <b>delante a la izquierda</b>.`);
      return {
        title: tr('Completar a face amarela', 'Finish the yellow face', 'Termina la cara amarilla'),
        text: setupText(setup) + hint + tr(` Com a face <b>verde</b> de frente, aplique o <b>Sune</b>: <code>${SUNE}</code>.`, ` With the <b>green</b> face toward you, apply the <b>Sune</b>: <code>${SUNE}</code>.`, ` Con la cara <b>verde</b> hacia ti, aplica el <b>Sune</b>: <code>${SUNE}</code>.`),
        algLabel: 'Sune',
      };
    },
    llFocus,
  );

  // 6. Cantos amarelos no lugar
  const cpSeq = searchMacros(
    ctx.s,
    [...ADJUSTS, macro('alg', remap(A_PERM, 0), undefined, { inv: 0 }), macro('alg', remap(A_PERM_INV, 0), undefined, { inv: 1 })],
    (s) => allSolved(s, F2L) && allSolved(s, U_FACE) && allSolved(s, U_CORNER_FACELETS),
    7,
  );
  if (!cpSeq) throw new Error('falha nos cantos amarelos');
  stepsFromMacros(
    ctx,
    cpSeq,
    'cperm',
    (m, setup) => {
      const alg = m.meta!.inv ? A_PERM_INV : A_PERM;
      return {
        title: tr('Posicionar os cantos amarelos', 'Place the yellow corners', 'Coloca las esquinas amarillas'),
        text:
          setupText(setup) +
          tr(
            `Os cantos precisam combinar com as cores das laterais. Com a face <b>verde</b> de frente, aplique o <b>A-perm</b>${m.meta!.inv ? ' (versão inversa)' : ''}: ` +
              `<code>${alg}</code>. Ele troca três cantos de lugar sem estragar a face amarela.`,
            `The corners have to match the side colors. With the <b>green</b> face toward you, apply the <b>A-perm</b>${m.meta!.inv ? ' (inverse version)' : ''}: ` +
              `<code>${alg}</code>. It cycles three corners without breaking the yellow face.`,
            `Las esquinas tienen que coincidir con los colores de los lados. Con la cara <b>verde</b> hacia ti, aplica la <b>A-perm</b>${m.meta!.inv ? ' (versión inversa)' : ''}: ` +
              `<code>${alg}</code>. Mueve tres esquinas sin romper la cara amarilla.`,
          ),
        algLabel: m.meta!.inv ? tr('A-perm (inverso)', 'A-perm (inverse)', 'A-perm (inversa)') : 'A-perm',
      };
    },
    llFocus,
  );

  // 7. Arestas amarelas no lugar
  const epMacros = [0, 1, 2, 3].flatMap((v) => [
    macro('alg', remap(U_PERM_A, v), undefined, { view: v, a: 1 }),
    macro('alg', remap(U_PERM_B, v), undefined, { view: v, a: 0 }),
  ]);
  const epSeq = searchMacros(ctx.s, [...ADJUSTS, ...epMacros], (s) => allSolved(s, ALL_FACELETS), 3);
  if (!epSeq) throw new Error('falha nas arestas amarelas');
  stepsFromMacros(
    ctx,
    epSeq,
    'eperm',
    (m, setup) => {
      const v = m.meta!.view as number;
      const vName = cname([F, R, B, L][v]);
      const backName = cname([F, R, B, L][(v + 2) % 4]);
      const alg = m.meta!.a ? U_PERM_A : U_PERM_B;
      return {
        title: tr('Posicionar as arestas amarelas', 'Place the yellow edges', 'Coloca las aristas amarillas'),
        text:
          setupText(setup) +
          tr(
            `Os cantos já estão certos; faltam as arestas. Segure o cubo com a face <b>${vName}</b> de frente (a lateral <b>${backName}</b>, atrás, ` +
              `fica como está ou é a menos mexida) e aplique o <b>U-perm</b>: <code>${alg}</code>. Ele gira três arestas do topo.`,
            `The corners are right; only the edges are left. Hold the cube with the <b>${vName}</b> face toward you (the <b>${backName}</b> side, at the back, ` +
              `stays as is or is the least disturbed) and apply the <b>U-perm</b>: <code>${alg}</code>. It cycles three top edges.`,
            `Las esquinas ya están bien; faltan las aristas. Sujeta el cubo con la cara <b>${vName}</b> hacia ti (el lado <b>${backName}</b>, atrás, ` +
              `queda como está o es el menos movido) y aplica la <b>U-perm</b>: <code>${alg}</code>. Mueve tres aristas de arriba.`,
          ),
        algLabel: m.meta!.a ? 'U-perm (a)' : 'U-perm (b)',
      };
    },
    llFocus,
  );
}

export const BEGINNER_STAGES = (): SolutionStage[] => [
  { id: 'cross', name: tr('Cruz branca', 'White cross', 'Cruz blanca'), goal: tr('Montar uma cruz branca na face de baixo, com cada aresta combinando com o centro da lateral.', 'Build a white cross on the bottom face, with each edge matching its side center.', 'Haz una cruz blanca en la cara de abajo, con cada arista coincidiendo con el centro de su lado.') },
  { id: 'corners', name: tr('Cantos brancos', 'White corners', 'Esquinas blancas'), goal: tr('Completar a primeira camada colocando os 4 cantos brancos.', 'Finish the first layer by placing the 4 white corners.', 'Termina la primera capa colocando las 4 esquinas blancas.') },
  { id: 'middle', name: tr('Segunda camada', 'Second layer', 'Segunda capa'), goal: tr('Encaixar as 4 arestas do meio (sem amarelo).', 'Insert the 4 middle edges (the ones without yellow).', 'Coloca las 4 aristas del medio (las que no tienen amarillo).') },
  { id: 'ycross', name: tr('Cruz amarela', 'Yellow cross', 'Cruz amarilla'), goal: tr('Formar uma cruz amarela no topo.', 'Make a yellow cross on top.', 'Haz una cruz amarilla arriba.') },
  { id: 'oll', name: tr('Face amarela', 'Yellow face', 'Cara amarilla'), goal: tr('Deixar toda a face de cima amarela.', 'Make the whole top face yellow.', 'Haz toda la cara de arriba amarilla.') },
  { id: 'cperm', name: tr('Cantos do topo', 'Top corners', 'Esquinas de arriba'), goal: tr('Colocar os cantos amarelos nos lugares certos.', 'Put the yellow corners in their right places.', 'Pon las esquinas amarillas en su lugar.') },
  { id: 'eperm', name: tr('Arestas do topo', 'Top edges', 'Aristas de arriba'), goal: tr('Colocar as arestas amarelas no lugar e terminar o cubo.', 'Put the yellow edges in place and finish the cube.', 'Pon las aristas amarillas en su lugar y termina el cubo.') },
];

export function solveBeginner(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  // garante que os centros estão na orientação padrão
  for (let f = 0; f < 6; f++) if (ctx.s[f * 9 + 4] !== f) throw new Error('Os centros não estão na orientação padrão (amarelo em cima, verde na frente).');
  solveCross(ctx);
  solveCorners(ctx);
  solveMiddle(ctx);
  solveLastLayer(ctx);
  if (!allSolved(ctx.s, ALL_FACELETS)) throw new Error('O solucionador não terminou o cubo — estado inválido?');
  return { method: tr('Método de iniciante (camada por camada)', 'Beginner method (layer by layer)', 'Método para principiantes (capa por capa)'), stages: BEGINNER_STAGES(), steps: ctx.steps };
}
