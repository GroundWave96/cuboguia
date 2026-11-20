import { tr } from '../../../core/i18n';
/**
 * Solucionador pelo método CFOP (Fridrich), o usado por speedcubers.
 *
 *  C – Cross: cruz branca inteira planejada de uma vez (ótima, ≤ 8 movimentos)
 *  F – F2L: canto + aresta de cada "slot" entram juntos (pares), usando gatilhos
 *       de 3 movimentos (R U R', F' U F...) — o chamado F2L intuitivo
 *  O – OLL em 2 etapas: orientar arestas (cruz amarela) e depois cantos (7 casos)
 *  P – PLL em 2 etapas: permutar cantos (T/Y/A-perm) e depois arestas (U/H/Z-perm)
 *
 * Mesma ideia do método de iniciante: busca sobre macros ensináveis, que sempre
 * acha uma solução correta sem desfazer o que já está pronto.
 */
import type { PuzzleState, Solution, SolutionStage } from '../../../core/types';
import {
  ADJUSTS, ALL_FACELETS, B, CROSS_TARGETS, D, EDGE_IDX, F, F2L, L, LAST_LAYER, R, U, U_CORNER_FACELETS, U_FACE,
  allSolved, applyPerm, bfsEdges, cname, composePerm, cornerFaceletsOf, crossFacelets, edgeFaceletsOf, findCorner, findEdge,
  macro, pieceName, pushStep, remap, searchMacros, setupText, solvedS, stepsFromMacros, toS, whiteLoc, type Ctx, type Macro, type S,
} from './common';

const SIDE = [F, R, B, L];

// ---------------------------------------------------------------------------
// Algoritmos (validados ao carregar: um algoritmo errado nunca é usado)
export interface NamedAlg {
  name: string;
  alg: string;
}

export const OLL_EDGE_ALGS: NamedAlg[] = [
  { name: 'Linha', alg: "F R U R' U' F'" },
  { name: 'L', alg: "F U R U' R' F'" },
];
export const OLL_CORNER_ALGS: NamedAlg[] = [
  { name: 'Sune', alg: "R U R' U R U2 R'" },
  { name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { name: 'H', alg: "R U R' U R U' R' U R U2 R'" },
  { name: 'Pi', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { name: 'Faróis', alg: "R2 D R' U2 R D' R' U2 R'" },
  { name: 'T', alg: "r U R' U' r' F R F'" },
  { name: 'Gravata', alg: "F' r U R' U' r' F R" },
];
export const PLL_CORNER_ALGS: NamedAlg[] = [
  { name: 'T-perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Y-perm', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { name: 'Aa-perm', alg: "R' F R' B2 R F' R' B2 R2" },
  { name: 'Ab-perm', alg: "R2 B2 R F R' B2 R F' R" },
];
export const PLL_EDGE_ALGS: NamedAlg[] = [
  { name: 'Ua-perm', alg: "R U' R U R U R U' R' U' R2" },
  { name: 'Ub-perm', alg: "R2 U R U R' U' R' U' R' U R'" },
  { name: 'H-perm', alg: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2" },
  { name: 'Z-perm', alg: "R' U' R U' R U R U' R' U R U R2 U' R' U2" },
];

const split = (alg: string) => alg.split(' ').filter(Boolean);
/** nome do caso no idioma atual (os outros são nomes internacionais) */
const NAMES: Record<string, [string, string]> = { Linha: ['Linha', 'Line'], Faróis: ['Faróis', 'Headlights'], Gravata: ['Gravata', 'Bowtie'] };
const algName = (n: unknown) => (NAMES[String(n)] ? tr(...NAMES[String(n)]) : String(n));
const U_EDGES_UP = [1, 3, 5, 7];
const edgesOriented = (s: S) => U_EDGES_UP.every((f) => s[f] === U);

/** Um algoritmo é válido se, aplicado no cubo resolvido, preserva o que a etapa exige. */
export function algPreserves(alg: string, keep: (s: S) => boolean): boolean {
  return keep(applyPerm(solvedS, composePerm(split(alg))));
}
const validOllCorner = (s: S) => allSolved(s, F2L) && edgesOriented(s);
const validPllCorner = (s: S) => allSolved(s, F2L) && allSolved(s, U_FACE);
const validPllEdge = (s: S) => allSolved(s, F2L) && allSolved(s, U_FACE) && allSolved(s, U_CORNER_FACELETS);
export const ALG_CHECKS: [NamedAlg[], (s: S) => boolean][] = [
  [OLL_EDGE_ALGS, (s) => allSolved(s, F2L)],
  [OLL_CORNER_ALGS, validOllCorner],
  [PLL_CORNER_ALGS, validPllCorner],
  [PLL_EDGE_ALGS, validPllEdge],
];
const usable = (list: NamedAlg[], keep: (s: S) => boolean) => list.filter((a) => algPreserves(a.alg, keep));

// ---------------------------------------------------------------------------
// C — cruz inteira
function solveCross(ctx: Ctx) {
  const moves = bfsEdges(
    CROSS_TARGETS.map((x) => whiteLoc(ctx.s, x.color)),
    CROSS_TARGETS.map((x) => EDGE_IDX.get(x.target)!),
  );
  const focus = CROSS_TARGETS.flatMap((t) => findEdge(ctx.s, [D, t.color]));
  pushStep(
    ctx,
    'cross',
    tr('Cruz branca (de uma vez)', 'White cross (all at once)'),
    tr(
      `No CFOP a cruz é planejada inteira antes de começar: são <b>${moves.length} movimentos</b> que levam as 4 arestas brancas para baixo, ` +
        'cada uma alinhada com o centro da sua cor. Tente enxergar a sequência toda olhando o cubo antes de girar — é o primeiro hábito de quem resolve rápido.',
      `In CFOP the whole cross is planned before you start: <b>${moves.length} moves</b> that bring the 4 white edges down, ` +
        'each lined up with its color’s center. Try to see the whole sequence by looking at the cube before turning — it’s the first habit of fast solvers.',
    ),
    [{ label: tr('Cruz', 'Cross'), moves }],
    focus,
  );
}

// ---------------------------------------------------------------------------
// F — pares do F2L
const TRIGGERS = ["R U R'", "R U' R'", "R U2 R'", "F' U F", "F' U' F", "F' U2 F"];
const SEXY = "R U R' U'";
const RIGHT_ALG = "U R U' R' U' F' U F";
const LEFT_ALG = "U' L' U L U F U' F'";

interface Slot {
  view: number;
  corner: number[];
  edge: number[];
}
const SLOTS: Slot[] = [0, 1, 2, 3].map((v) => ({ view: v, corner: [D, SIDE[v], SIDE[(v + 1) % 4]], edge: [SIDE[v], SIDE[(v + 1) % 4]] }));
const slotFacelets = (sl: Slot) => [...cornerFaceletsOf(sl.corner), ...edgeFaceletsOf(sl.edge)];

function f2lMacros(slot: Slot, free: Slot[]): Macro[] {
  return [
    ...ADJUSTS,
    ...TRIGGERS.map((t) => macro('alg', remap(t, slot.view), undefined, { kind: 'trigger', alg: t, view: slot.view })),
    ...free.filter((o) => o !== slot).map((o) => macro('alg', remap("R U R'", o.view), undefined, { kind: 'extract', alg: "R U R'", view: o.view })),
  ];
}

/** Plano B (raro): canto e aresta separados, como no método de iniciante. */
function fallbackMacros(slot: Slot, free: Slot[]): Macro[] {
  const others = free.filter((o) => o !== slot);
  return [
    ...ADJUSTS,
    ...[1, 2, 3, 4, 5].map((n) => macro('alg', Array.from({ length: n }, () => remap(SEXY, slot.view)).flat(), 'sexy', { kind: 'sexy', n, view: slot.view })),
    ...others.map((o) => macro('alg', remap(SEXY, o.view), undefined, { kind: 'extract', alg: SEXY, view: o.view })),
    macro('alg', remap(RIGHT_ALG, slot.view), undefined, { kind: 'edge', alg: RIGHT_ALG, view: slot.view }),
    macro('alg', remap(LEFT_ALG, (slot.view + 1) % 4), undefined, { kind: 'edge', alg: LEFT_ALG, view: (slot.view + 1) % 4 }),
  ];
}

const seqLen = (seq: Macro[]) => seq.reduce((a, m) => a + m.moves.length, 0);

function solvePair(s: S, slot: Slot, free: Slot[], keep: number[]): { seq: Macro[]; fallback: boolean } | null {
  const target = slotFacelets(slot);
  const goal = (x: S) => allSolved(x, target) && allSolved(x, keep);
  const seq = searchMacros(s, f2lMacros(slot, free), goal, 9, { maxNodes: 250_000, pruneCancel: true });
  if (seq) return { seq, fallback: false };
  // plano B em duas partes: canto, depois aresta
  const corner = cornerFaceletsOf(slot.corner);
  const fm = fallbackMacros(slot, free);
  const a = searchMacros(s, fm, (x) => allSolved(x, corner) && allSolved(x, keep), 4);
  if (!a) return null;
  const s2 = applyPerm(s, composePerm(a.flatMap((m) => m.moves)));
  const b = searchMacros(s2, fm, goal, 4);
  if (!b) return null;
  return { seq: [...a, ...b], fallback: true };
}

function solveF2L(ctx: Ctx) {
  let free = [...SLOTS];
  const keep = [...crossFacelets];
  while (free.length) {
    let best: { slot: Slot; seq: Macro[]; fallback: boolean } | null = null;
    for (const slot of free) {
      const r = solvePair(ctx.s, slot, free, keep);
      if (r && (!best || seqLen(r.seq) < seqLen(best.seq))) best = { slot, ...r };
    }
    if (!best) throw new Error('falha no F2L');
    const { slot, seq, fallback } = best;
    const cornerName = pieceName(slot.corner);
    const edgeName = pieceName(slot.edge);
    const front = cname(SIDE[slot.view]);
    const focus = [...findCorner(ctx.s, slot.corner), ...findEdge(ctx.s, slot.edge)];
    const segments = seq.map((m) => {
      const meta = m.meta ?? {};
      if (m.kind === 'adjust') return { label: tr('Ajuste U', 'U adjustment'), moves: m.moves };
      const vName = cname(SIDE[meta.view as number]);
      const front = tr(`frente ${vName}`, `${vName} in front`);
      if (meta.kind === 'trigger') return { label: `${meta.alg} (${front})`, moves: m.moves };
      if (meta.kind === 'extract') return { label: `${tr('Tirar peça presa', 'Free a stuck piece')} (${front})`, moves: m.moves };
      if (meta.kind === 'sexy') return { label: `(R U R' U') × ${meta.n} (${front})`, moves: m.moves };
      return { label: `${tr('Encaixar aresta', 'Insert edge')} (${front})`, moves: m.moves };
    });
    const triggers = seq.filter((m) => m.meta?.kind === 'trigger').length;
    const extracted = seq.some((m) => m.meta?.kind === 'extract');
    const moves = seq.flatMap((m) => m.moves);
    if (moves.length) {
      pushStep(
        ctx,
        'f2l',
        tr(`Par ${edgeName}`, `${edgeName} pair`),
        fallback
          ? tr(
              `O canto <b>${cornerName}</b> e a aresta <b>${edgeName}</b> estão numa posição chata. Aqui vamos colocá-los um de cada vez: ` +
                `primeiro o canto (repetindo R U R' U') e depois a aresta, como no método de iniciante — sem desmontar o resto.`,
              `The <b>${cornerName}</b> corner and the <b>${edgeName}</b> edge are in an awkward spot. Here we’ll insert them one at a time: ` +
                `first the corner (repeating R U R' U') and then the edge, like in the beginner method — without breaking anything else.`,
            )
          : tr(
              (extracted ? 'Uma das peças está presa em outro espaço, então primeiro a tiramos de lá. ' : '') +
                `Junte o canto <b>${cornerName}</b> com a aresta <b>${edgeName}</b> na camada de cima e encaixe os dois de uma vez ` +
                `no espaço entre os centros ${pieceName(slot.edge)} (olhando com a face <b>${front}</b> de frente, é o espaço da frente-direita). ` +
                `Isso foi feito com ${triggers} gatilho${triggers === 1 ? '' : 's'} de 3 movimentos — as partes mostradas abaixo.`,
              (extracted ? 'One of the pieces is stuck in another slot, so we take it out first. ' : '') +
                `Pair up the <b>${cornerName}</b> corner with the <b>${edgeName}</b> edge in the top layer and insert both at once ` +
                `into the slot between the ${pieceName(slot.edge)} centers (with the <b>${front}</b> face toward you, it’s the front-right slot). ` +
                `This took ${triggers} three-move trigger${triggers === 1 ? '' : 's'} — the parts shown below.`,
            ),
        segments,
        focus,
      );
    }
    keep.push(...slotFacelets(slot));
    free = free.filter((x) => x !== slot);
  }
}

// ---------------------------------------------------------------------------
// O e P — última camada em 2 + 2 etapas
const caseMacros = (list: NamedAlg[], views = [0]) =>
  views.flatMap((v) => list.map((a) => macro('alg', remap(a.alg, v), undefined, { name: a.name, alg: a.alg, view: v })));

function solveLastLayer(ctx: Ctx) {
  const llFocus = () => LAST_LAYER;

  // OLL 1: arestas
  const e = searchMacros(ctx.s, [...ADJUSTS, ...caseMacros(usable(OLL_EDGE_ALGS, (s) => allSolved(s, F2L)))], (s) => allSolved(s, F2L) && edgesOriented(s), 6);
  if (!e) throw new Error('falha na OLL (arestas)');
  stepsFromMacros(
    ctx,
    e,
    'oll',
    (m, setup, before) => {
      const n = U_EDGES_UP.filter((f) => before[f] === U).length;
      const shape =
        n === 0 ? tr('ponto', 'dot') : before[3] === U && before[5] === U ? tr('linha horizontal', 'horizontal line') : before[1] === U && before[7] === U ? tr('linha', 'line') : '“L”';
      return {
        title: tr(`OLL · cruz amarela (${shape})`, `OLL · yellow cross (${shape})`),
        text:
          setupText(setup) +
          tr(
            `Primeira parte da OLL: orientar as arestas amarelas. O topo mostra um <b>${shape}</b>. ` +
              `Com a face verde de frente, aplique <code>${m.meta!.alg}</code>` +
              (m.meta!.name === 'L' ? ' (o “L” deve apontar para trás e para a esquerda).' : '.'),
            `First part of OLL: orient the yellow edges. The top shows a <b>${shape}</b>. ` +
              `With the green face toward you, apply <code>${m.meta!.alg}</code>` +
              (m.meta!.name === 'L' ? ' (the “L” must point back and to the left).' : '.'),
          ),
        algLabel: tr(`OLL arestas — ${algName(m.meta!.name)}`, `OLL edges — ${algName(m.meta!.name)}`),
      };
    },
    llFocus,
  );

  // OLL 2: cantos
  const c = searchMacros(ctx.s, [...ADJUSTS, ...caseMacros(usable(OLL_CORNER_ALGS, validOllCorner))], (s) => allSolved(s, F2L) && allSolved(s, U_FACE), 5);
  if (!c) throw new Error('falha na OLL (cantos)');
  stepsFromMacros(
    ctx,
    c,
    'oll',
    (m, setup) => ({
      title: tr(`OLL · caso ${algName(m.meta!.name)}`, `OLL · ${algName(m.meta!.name)} case`),
      text:
        setupText(setup) +
        tr(
          `Segunda parte da OLL: deixar a face amarela inteira. Reconheça o caso <b>${algName(m.meta!.name)}</b> pelo desenho dos cantos amarelos ` +
            `(e pelas cores amarelas viradas para os lados) e aplique, com a face verde de frente: <code>${m.meta!.alg}</code>.` +
            (String(m.meta!.alg).includes('r') ? ' <i>(“r” minúsculo = girar as duas camadas da direita juntas.)</i>' : ''),
          `Second part of OLL: make the whole face yellow. Recognize the <b>${algName(m.meta!.name)}</b> case by the pattern of the yellow corners ` +
            `(and the yellow colors facing the sides) and apply, with the green face toward you: <code>${m.meta!.alg}</code>.` +
            (String(m.meta!.alg).includes('r') ? ' <i>(lowercase “r” = turn the two right layers together.)</i>' : ''),
        ),
      algLabel: `OLL — ${algName(m.meta!.name)}`,
    }),
    llFocus,
  );

  // PLL 1: cantos
  const pc = searchMacros(
    ctx.s,
    [...ADJUSTS, ...caseMacros(usable(PLL_CORNER_ALGS, validPllCorner))],
    (s) => allSolved(s, F2L) && allSolved(s, U_FACE) && allSolved(s, U_CORNER_FACELETS),
    5,
  );
  if (!pc) throw new Error('falha na PLL (cantos)');
  stepsFromMacros(
    ctx,
    pc,
    'pll',
    (m, setup) => ({
      title: tr(`PLL · cantos com ${m.meta!.name}`, `PLL · corners with ${m.meta!.name}`),
      text:
        setupText(setup) +
        tr(
          `Primeira parte da PLL: colocar os cantos nos lugares. Procure os “faróis” (dois cantos da mesma cor num lado). ` +
            `Com a face verde de frente, aplique o <b>${m.meta!.name}</b>: <code>${m.meta!.alg}</code>.`,
          `First part of PLL: put the corners in place. Look for “headlights” (two corners of the same color on one side). ` +
            `With the green face toward you, apply the <b>${m.meta!.name}</b>: <code>${m.meta!.alg}</code>.`,
        ),
      algLabel: `PLL — ${m.meta!.name}`,
    }),
    llFocus,
  );

  // PLL 2: arestas
  const pe = searchMacros(ctx.s, [...ADJUSTS, ...caseMacros(usable(PLL_EDGE_ALGS, validPllEdge), [0, 1, 2, 3])], (s) => allSolved(s, ALL_FACELETS), 3);
  if (!pe) throw new Error('falha na PLL (arestas)');
  stepsFromMacros(
    ctx,
    pe,
    'pll',
    (m, setup) => {
      const vName = cname(SIDE[m.meta!.view as number]);
      return {
        title: tr(`PLL · arestas com ${m.meta!.name}`, `PLL · edges with ${m.meta!.name}`),
        text:
          setupText(setup) +
          tr(
            `Última parte! Só faltam as arestas. Segure o cubo com a face <b>${vName}</b> de frente e aplique o <b>${m.meta!.name}</b>: <code>${m.meta!.alg}</code>.`,
            `Last part! Only the edges are left. Hold the cube with the <b>${vName}</b> face toward you and apply the <b>${m.meta!.name}</b>: <code>${m.meta!.alg}</code>.`,
          ),
        algLabel: `PLL — ${m.meta!.name}`,
      };
    },
    llFocus,
  );
}

export const CFOP_STAGES = (): SolutionStage[] => [
  { id: 'cross', name: 'Cross', goal: tr('Montar a cruz branca inteira de uma vez, planejando antes de girar.', 'Build the whole white cross at once, planning it before turning.') },
  { id: 'f2l', name: 'F2L', goal: tr('Completar as duas primeiras camadas encaixando canto + aresta juntos (4 pares).', 'Finish the first two layers by inserting corner + edge together (4 pairs).') },
  { id: 'oll', name: 'OLL', goal: tr('Deixar toda a face de cima amarela (em 2 etapas: arestas e cantos).', 'Make the whole top face yellow (in 2 looks: edges and corners).') },
  { id: 'pll', name: 'PLL', goal: tr('Colocar as peças da última camada no lugar (em 2 etapas: cantos e arestas).', 'Put the last layer pieces in place (in 2 looks: corners and edges).') },
];

export function solveCFOP(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  for (let f = 0; f < 6; f++) if (ctx.s[f * 9 + 4] !== f) throw new Error('Os centros não estão na orientação padrão (amarelo em cima, verde na frente).');
  solveCross(ctx);
  solveF2L(ctx);
  solveLastLayer(ctx);
  if (!allSolved(ctx.s, ALL_FACELETS)) throw new Error('O solucionador CFOP não terminou o cubo.');
  return { method: tr('CFOP (Cross, F2L, OLL e PLL em 2 etapas)', 'CFOP (Cross, F2L, 2-look OLL and PLL)'), stages: CFOP_STAGES(), steps: ctx.steps };
}
