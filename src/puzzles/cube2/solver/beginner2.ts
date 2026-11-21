import { tr } from '../../../core/i18n';
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
  { colors: [D, F, R], alg: "R U R' U'", view: 0 },
  { colors: [D, L, F], alg: "F U F' U'", view: 0 },
  { colors: [D, R, B], alg: "R' U' R U", view: 0 },
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
        const reps = n === 1 ? tr('uma vez', 'once', 'una vez') : tr(`${n} vezes`, `${n} times`, `${n} veces`);
        if (allSolved(after, target))
          return {
            title: tr(`Canto ${name}`, `${name} corner`, `Esquina ${name}`),
            text:
              setupText(setup) +
              tr(
                `Deixe o canto <b>${name}</b> logo acima do lugar dele e, com a face verde de frente, repita <b>${sl.alg}</b> ${reps}. ` +
                  'A cada repetição o canto gira; ele encaixa quando o branco fica para baixo e as cores combinam com os vizinhos.',
                `Put the <b>${name}</b> corner right above its slot and, with the green face toward you, repeat <b>${sl.alg}</b> ${reps}. ` +
                  'Each repetition twists the corner; it’s in when white faces down and the colors match its neighbors.',
                `Deja la esquina <b>${name}</b> justo encima de su lugar y, con la cara verde hacia ti, repite <b>${sl.alg}</b> ${reps}. ` +
                  'Cada repetición gira la esquina; entra cuando el blanco queda hacia abajo y los colores coinciden con los vecinos.',
              ),
            algLabel: n === 1 ? sl.alg : `(${sl.alg}) × ${n}`,
          };
        return {
          title: tr(`Retirar o canto ${name}`, `Take out the ${name} corner`, `Saca la esquina ${name}`),
          text:
            setupText(setup) +
            tr(`O canto <b>${name}</b> está embaixo, no lugar errado. Faça <b>${sl.alg}</b> ${reps} para levá-lo para cima.`, `The <b>${name}</b> corner is at the bottom, in the wrong spot. Do <b>${sl.alg}</b> ${reps} to bring it up.`, `La esquina <b>${name}</b> está abajo, en el lugar equivocado. Haz <b>${sl.alg}</b> ${reps} para subirla.`),
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
          ? tr('Há <b>um</b> canto com amarelo para cima (o “peixinho”): ele deve ficar na <b>frente-esquerda</b>.', 'There’s <b>one</b> corner with yellow facing up (the “fish”): it must be at the <b>front-left</b>.', 'Hay <b>una</b> esquina con el amarillo hacia arriba (el “pez”): debe quedar <b>delante a la izquierda</b>.')
          : n === 0
            ? tr('Nenhum canto tem amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>esquerda</b>.', 'No corner has yellow facing up: put a corner with yellow facing <b>left</b> at the <b>front-left</b>.', 'Ninguna esquina tiene el amarillo hacia arriba: pon una esquina con el amarillo hacia la <b>izquierda</b> <b>delante a la izquierda</b>.')
            : tr(`Há ${n} cantos com amarelo para cima: deixe na <b>frente-esquerda</b> um canto com o amarelo virado para a <b>frente</b>.`, `${n} corners have yellow facing up: put a corner with yellow facing the <b>front</b> at the <b>front-left</b>.`, `${n} esquinas tienen el amarillo hacia arriba: pon una esquina con el amarillo hacia el <b>frente</b> <b>delante a la izquierda</b>.`);
      return {
        title: tr('Completar a face amarela', 'Finish the yellow face', 'Termina la cara amarilla'),
        text: setupText(setup) + hint + tr(` Com a face verde de frente, aplique o <b>Sune</b>: <code>${SUNE}</code>.`, ` With the green face toward you, apply the <b>Sune</b>: <code>${SUNE}</code>.`, ` Con la cara verde hacia ti, aplica el <b>Sune</b>: <code>${SUNE}</code>.`),
        algLabel: 'Sune',
      };
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
        title: tr(`Trocar cantos com ${m.meta!.name}`, `Swap corners with ${m.meta!.name}`, `Intercambia esquinas con ${m.meta!.name}`),
        text:
          setupText(setup) +
          (t
            ? tr(
                'Procure os “faróis”: dois cantos de cima com a mesma cor do mesmo lado. Deixe os faróis <b>na esquerda</b> e, com a face verde de frente, aplique o <b>T-perm</b> — ele troca os dois cantos da direita.',
                'Look for “headlights”: two top corners with the same color on the same side. Put the headlights <b>on the left</b> and, with the green face toward you, apply the <b>T-perm</b> — it swaps the two right corners.', 'Busca “faros”: dos esquinas de arriba con el mismo color en el mismo lado. Pon los faros <b>a la izquierda</b> y, con la cara verde hacia ti, aplica la <b>T-perm</b>: intercambia las dos esquinas de la derecha.',
              )
            : tr(
                'Não há faróis em nenhum lado: dois cantos em diagonal precisam trocar. Com a face verde de frente, aplique o <b>Y-perm</b>.',
                'There are no headlights on any side: two diagonal corners need to swap. With the green face toward you, apply the <b>Y-perm</b>.', 'No hay faros en ningún lado: hay que intercambiar dos esquinas en diagonal. Con la cara verde hacia ti, aplica la <b>Y-perm</b>.',
              )) +
          ` <code>${t ? T_PERM : Y_PERM}</code>`,
        algLabel: String(m.meta!.name),
      };
    },
    () => LAST_LAYER,
  );
}

export const BEGINNER2_STAGES = (): SolutionStage[] => [
  { id: 'first', name: tr('Face branca', 'White face', 'Cara blanca'), goal: tr('Completar a camada de baixo: face branca com as laterais combinando.', 'Finish the bottom layer: white face with matching sides.', 'Termina la capa de abajo: cara blanca con los lados que coinciden.') },
  { id: 'yellow', name: tr('Face amarela', 'Yellow face', 'Cara amarilla'), goal: tr('Deixar toda a face de cima amarela.', 'Make the whole top face yellow.', 'Haz toda la cara de arriba amarilla.') },
  { id: 'perm', name: tr('Cantos do topo', 'Top corners', 'Esquinas de arriba'), goal: tr('Colocar os cantos de cima nos lugares certos e terminar o cubo.', 'Put the top corners in their right places and finish the cube.', 'Pon las esquinas de arriba en su lugar y termina el cubo.') },
];

export function solveBeginner2(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  if (!allSolved(ctx.s, CORNERS[6])) throw new Error('O canto branco-azul-vermelho precisa estar atrás, embaixo, à esquerda.');
  solveFirstLayer(ctx);
  solveLastLayer(ctx);
  if (!allSolved(ctx.s, ALL)) throw new Error('O solucionador não terminou o cubo.');
  return { method: tr('Método de iniciante (camadas)', 'Beginner method (layers)', 'Método para principiantes (capas)'), stages: BEGINNER2_STAGES(), steps: ctx.steps };
}

