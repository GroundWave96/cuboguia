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
        `Aresta branco-${name}`,
        `Leve a aresta <b>branco-${name}</b> para a face de baixo, com o branco virado para baixo e o ${name} alinhado com o centro ${name}. ` +
          (placed.length
            ? `Os movimentos foram escolhidos para não desmontar as ${placed.length === 1 ? 'aresta' : 'arestas'} da cruz que já estão no lugar.`
            : 'Esta é a primeira aresta: só precisamos levá-la até o lugar certo.'),
        [{ label: 'Movimentos', moves }],
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
            title: `Canto ${name}`,
            text:
              setupText(setup) +
              (setup.length ? `Assim o canto <b>${name}</b> fica logo acima do seu lugar (entre os centros ${pieceName(slot.colors.slice(1))}). ` : `O canto <b>${name}</b> já está na posição certa para entrar. `) +
              `Agora, olhando com a face <b>${vName}</b> de frente, repita <b>R U R' U'</b> ${n === 1 ? 'uma vez' : `${n} vezes`}. ` +
              `A cada repetição o canto gira; ele encaixa quando o branco fica para baixo.`,
            algLabel: n === 1 ? "R U R' U'" : `(R U R' U') × ${n}`,
          };
        }
        return {
          title: `Retirar o canto ${name}`,
          text:
            setupText(setup) +
            `O canto <b>${name}</b> está preso na camada de baixo, no lugar errado. Olhando com a face <b>${vName}</b> de frente, ` +
            `faça <b>R U R' U'</b> ${n === 1 ? 'uma vez' : `${n} vezes`} para levá-lo para a camada de cima.`,
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
    macro('alg', remap(RIGHT_ALG, v), undefined, { view: v, side: 'direita', alg: RIGHT_ALG }),
    macro('alg', remap(LEFT_ALG, v), undefined, { view: v, side: 'esquerda', alg: LEFT_ALG }),
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
        const side = m.meta!.side as string;
        const alg = m.meta!.alg as string;
        if (allSolved(after, target)) {
          return {
            title: `Aresta ${name}`,
            text:
              setupText(setup) +
              `A aresta <b>${name}</b> fica na camada de cima formando um “T” com o centro <b>${vName}</b> (a cor da frente da aresta igual ao centro). ` +
              `Ela precisa descer para a <b>${side}</b>. Olhando com a face <b>${vName}</b> de frente, aplique: <code>${alg}</code>.`,
            algLabel: `Algoritmo (${side})`,
          };
        }
        return {
          title: `Retirar a aresta ${name}`,
          text:
            setupText(setup) +
            `A aresta <b>${name}</b> está presa na segunda camada (no lugar errado ou invertida). Olhando com a face <b>${vName}</b> de frente, ` +
            `aplique <code>${alg}</code> para trocá-la por uma peça da camada de cima — assim ela sobe e depois pode ser encaixada.`,
          algLabel: 'Retirar',
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
      if (n === 0) shape = 'Só o centro está amarelo (um <b>ponto</b>). Aplique o algoritmo; depois aparecerá um “L” ou uma linha.';
      else if (up[1] && up[2]) shape = 'Há uma <b>linha</b> amarela na horizontal (esquerda–direita) — é a posição certa para o algoritmo.';
      else if (up[0] && up[3]) shape = 'Há uma <b>linha</b> amarela; ela precisa estar na horizontal antes do algoritmo.';
      else shape = 'Há um <b>“L”</b> amarelo (duas arestas vizinhas). Ele deve apontar para <b>trás e para a esquerda</b>, como os ponteiros às 9h e 12h.';
      return {
        title: 'Formar a cruz amarela',
        text: setupText(setup) + shape + ` Com a face <b>verde</b> de frente, aplique <code>${OLL_EDGES}</code>.`,
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
          ? 'Há <b>um</b> canto com amarelo para cima (o “peixinho”): ele deve ficar na posição <b>frente-esquerda</b>.'
          : n === 0
            ? 'Nenhum canto tem amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>esquerda</b>.'
            : `Há ${n} cantos com amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>frente</b>.`;
      return {
        title: 'Completar a face amarela',
        text: setupText(setup) + hint + ` Com a face <b>verde</b> de frente, aplique o <b>Sune</b>: <code>${SUNE}</code>.`,
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
        title: 'Posicionar os cantos amarelos',
        text:
          setupText(setup) +
          `Os cantos precisam combinar com as cores das laterais. Com a face <b>verde</b> de frente, aplique o <b>A-perm</b>${m.meta!.inv ? ' (versão inversa)' : ''}: ` +
          `<code>${alg}</code>. Ele troca três cantos de lugar sem estragar a face amarela.`,
        algLabel: m.meta!.inv ? 'A-perm (inverso)' : 'A-perm',
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
        title: 'Posicionar as arestas amarelas',
        text:
          setupText(setup) +
          `Os cantos já estão certos; faltam as arestas. Segure o cubo com a face <b>${vName}</b> de frente (a lateral <b>${backName}</b>, atrás, ` +
          `fica como está ou é a menos mexida) e aplique o <b>U-perm</b>: <code>${alg}</code>. Ele gira três arestas do topo.`,
        algLabel: m.meta!.a ? 'U-perm (a)' : 'U-perm (b)',
      };
    },
    llFocus,
  );
}

export const BEGINNER_STAGES: SolutionStage[] = [
  { id: 'cross', name: 'Cruz branca', goal: 'Montar uma cruz branca na face de baixo, com cada aresta combinando com o centro da lateral.' },
  { id: 'corners', name: 'Cantos brancos', goal: 'Completar a primeira camada colocando os 4 cantos brancos.' },
  { id: 'middle', name: 'Segunda camada', goal: 'Encaixar as 4 arestas do meio (sem amarelo).' },
  { id: 'ycross', name: 'Cruz amarela', goal: 'Formar uma cruz amarela no topo.' },
  { id: 'oll', name: 'Face amarela', goal: 'Deixar toda a face de cima amarela.' },
  { id: 'cperm', name: 'Cantos do topo', goal: 'Colocar os cantos amarelos nos lugares certos.' },
  { id: 'eperm', name: 'Arestas do topo', goal: 'Colocar as arestas amarelas no lugar e terminar o cubo.' },
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
  return { method: 'Método de iniciante (camada por camada)', stages: BEGINNER_STAGES, steps: ctx.steps };
}
