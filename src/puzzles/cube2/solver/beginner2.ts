/**
 * 2x2 pelo método de iniciante (camadas). O canto branco-azul-vermelho (DBL) fica
 * parado como referência, então só usamos giros de U, R e F (que não o movem).
 *
 *  1. Face branca  — encaixar os outros 3 cantos brancos repetindo um "gatilho"
 *  2. Face amarela — Sune (R U R' U R U2 R')
 *  3. Cantos       — T-perm / Y-perm para trocar cantos de lugar
 */
import type { PuzzleState, Solution, SolutionStage } from '../../../core/types';
import {
  ADJUSTS, ALL, B, CORNERS, D, F, L, R, U, allSolved, findCorner, homeOf, macro, pieceName, remap,
  searchMacros, setupText, stepsFromMacros, toS, type Ctx, type Macro, type S,
} from './kit';

const D_FACE = [12, 13, 14, 15];
const SIDES_BOTTOM = [R, F, L, B].flatMap((f) => [f * 4 + 2, f * 4 + 3]);
const FIRST_LAYER = [...D_FACE, ...SIDES_BOTTOM];
const U_FACE = [0, 1, 2, 3];
const LAST_LAYER = [...U_FACE, ...[R, F, L, B].flatMap((f) => [f * 4, f * 4 + 1])];

export const SUNE = "R U R' U R U2 R'";
export const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
export const Y_PERM = "F R U' R' U' R U R' F' R U R' U' R' F R F'";

/**
 * Os 3 espaços da camada de baixo que podem ser trabalhados sem mexer no canto de
 * referência (atrás-embaixo-esquerda), cada um com seu gatilho.
 */
const SLOTS = [
  { colors: [D, F, R], alg: "R U R' U'", view: 0, how: 'com a face verde de frente' },
  { colors: [D, L, F], alg: "F U F' U'", view: 0, how: 'com a face verde de frente' },
  { colors: [D, R, B], alg: "R' U' R U", view: 0, how: 'com a face verde de frente' },
];

const CORNER_MACROS: Macro[] = [
  ...ADJUSTS,
  ...SLOTS.flatMap((slot, si) =>
    [1, 2, 3, 4, 5].map((n) => macro('alg', Array.from({ length: n }, () => remap(slot.alg, slot.view)).flat(), `s${si}`, { slot: si, n })),
  ),
];

function solveFirstLayer(ctx: Ctx) {
  const placed: number[][] = [CORNERS[6]]; // referência
  let remaining = [...SLOTS];
  while (remaining.length) {
    let best: { slot: (typeof SLOTS)[0]; seq: Macro[]; len: number } | null = null;
    for (const slot of remaining) {
      const target = homeOf(slot.colors);
      const keep = placed.flat();
      const seq = searchMacros(ctx.s, CORNER_MACROS, (s) => allSolved(s, target) && allSolved(s, keep), 4);
      if (!seq) continue;
      const len = seq.reduce((a, m) => a + m.moves.length, 0);
      if (!best || len < best.len) best = { slot, seq, len };
    }
    if (!best) throw new Error('falha na face branca');
    const { slot, seq } = best;
    const target = homeOf(slot.colors);
    const name = pieceName(slot.colors);
    stepsFromMacros(
      ctx,
      seq,
      'first',
      (m, setup, _b, after) => {
        const sl = SLOTS[m.meta!.slot as number];
        const n = m.meta!.n as number;
        const reps = n === 1 ? 'uma vez' : `${n} vezes`;
        if (allSolved(after, target))
          return {
            title: `Canto ${name}`,
            text:
              setupText(setup) +
              `Deixe o canto <b>${name}</b> logo acima do lugar dele e, ${sl.how}, repita <b>${sl.alg}</b> ${reps}. ` +
              'A cada repetição o canto gira; ele encaixa quando o branco fica para baixo e as cores combinam com os vizinhos.',
            algLabel: n === 1 ? sl.alg : `(${sl.alg}) × ${n}`,
          };
        return {
          title: `Retirar o canto ${name}`,
          text: setupText(setup) + `O canto <b>${name}</b> está embaixo, no lugar errado. Faça <b>${sl.alg}</b> ${reps} para levá-lo para cima.`,
          algLabel: sl.alg,
        };
      },
      () => findCorner(ctx.s, slot.colors),
    );
    placed.push(target);
    remaining = remaining.filter((x) => x !== slot);
  }
}

const yellowUp = (s: S) => U_FACE.filter((f) => s[f] === U).length;

function solveLastLayer(ctx: Ctx) {
  const oll = searchMacros(ctx.s, [...ADJUSTS, macro('alg', SUNE.split(' '))], (s) => allSolved(s, FIRST_LAYER) && allSolved(s, U_FACE), 9);
  if (!oll) throw new Error('falha na face amarela');
  stepsFromMacros(
    ctx,
    oll,
    'yellow',
    (_m, setup, before) => {
      const n = yellowUp(before);
      const hint =
        n === 1
          ? 'Há <b>um</b> canto com amarelo para cima (o “peixinho”): ele deve ficar na <b>frente-esquerda</b>.'
          : n === 0
            ? 'Nenhum canto tem amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>esquerda</b>.'
            : `Há ${n} cantos com amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>frente</b>.`;
      return { title: 'Completar a face amarela', text: setupText(setup) + hint + ` Com a face verde de frente, aplique o <b>Sune</b>: <code>${SUNE}</code>.`, algLabel: 'Sune' };
    },
    () => LAST_LAYER,
  );

  const pll = searchMacros(
    ctx.s,
    [...ADJUSTS, macro('alg', T_PERM.split(' '), undefined, { name: 'T-perm' }), macro('alg', Y_PERM.split(' '), undefined, { name: 'Y-perm' })],
    (s) => allSolved(s, ALL),
    5,
  );
  if (!pll) throw new Error('falha ao posicionar os cantos');
  stepsFromMacros(
    ctx,
    pll,
    'perm',
    (m, setup) => {
      const t = m.meta!.name === 'T-perm';
      return {
        title: `Trocar cantos com ${m.meta!.name}`,
        text:
          setupText(setup) +
          (t
            ? 'Procure os “faróis”: dois cantos de cima com a mesma cor do mesmo lado. Deixe os faróis <b>na esquerda</b> e, com a face verde de frente, aplique o <b>T-perm</b> — ele troca os dois cantos da direita.'
            : 'Não há faróis em nenhum lado: dois cantos em diagonal precisam trocar. Com a face verde de frente, aplique o <b>Y-perm</b>.') +
          ` <code>${t ? T_PERM : Y_PERM}</code>`,
        algLabel: String(m.meta!.name),
      };
    },
    () => LAST_LAYER,
  );
}

export const BEGINNER2_STAGES: SolutionStage[] = [
  { id: 'first', name: 'Face branca', goal: 'Completar a camada de baixo: face branca com as laterais combinando.' },
  { id: 'yellow', name: 'Face amarela', goal: 'Deixar toda a face de cima amarela.' },
  { id: 'perm', name: 'Cantos do topo', goal: 'Colocar os cantos de cima nos lugares certos e terminar o cubo.' },
];

export function solveBeginner2(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  if (!allSolved(ctx.s, CORNERS[6])) throw new Error('O canto branco-azul-vermelho precisa estar atrás, embaixo, à esquerda.');
  solveFirstLayer(ctx);
  solveLastLayer(ctx);
  if (!allSolved(ctx.s, ALL)) throw new Error('O solucionador não terminou o cubo.');
  return { method: 'Método de iniciante (camadas)', stages: BEGINNER2_STAGES, steps: ctx.steps };
}

