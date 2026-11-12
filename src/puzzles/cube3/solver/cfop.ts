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
    'Cruz branca (de uma vez)',
    `No CFOP a cruz é planejada inteira antes de começar: são <b>${moves.length} movimentos</b> que levam as 4 arestas brancas para baixo, ` +
      'cada uma alinhada com o centro da sua cor. Tente enxergar a sequência toda olhando o cubo antes de girar — é o primeiro hábito de quem resolve rápido.',
    [{ label: 'Cruz', moves }],
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
      if (m.kind === 'adjust') return { label: 'Ajuste U', moves: m.moves };
      const vName = cname(SIDE[meta.view as number]);
      if (meta.kind === 'trigger') return { label: `${meta.alg} (frente ${vName})`, moves: m.moves };
      if (meta.kind === 'extract') return { label: `Tirar peça presa (frente ${vName})`, moves: m.moves };
      if (meta.kind === 'sexy') return { label: `(R U R' U') × ${meta.n} (frente ${vName})`, moves: m.moves };
      return { label: `Encaixar aresta (frente ${vName})`, moves: m.moves };
    });
    const triggers = seq.filter((m) => m.meta?.kind === 'trigger').length;
    const extracted = seq.some((m) => m.meta?.kind === 'extract');
    const moves = seq.flatMap((m) => m.moves);
    if (moves.length) {
      pushStep(
        ctx,
        'f2l',
        `Par ${edgeName}`,
        fallback
          ? `O canto <b>${cornerName}</b> e a aresta <b>${edgeName}</b> estão numa posição chata. Aqui vamos colocá-los um de cada vez: ` +
              `primeiro o canto (repetindo R U R' U') e depois a aresta, como no método de iniciante — sem desmontar o resto.`
          : (extracted ? 'Uma das peças está presa em outro espaço, então primeiro a tiramos de lá. ' : '') +
              `Junte o canto <b>${cornerName}</b> com a aresta <b>${edgeName}</b> na camada de cima e encaixe os dois de uma vez ` +
              `no espaço entre os centros ${pieceName(slot.edge)} (olhando com a face <b>${front}</b> de frente, é o espaço da frente-direita). ` +
              `Isso foi feito com ${triggers} gatilho${triggers === 1 ? '' : 's'} de 3 movimentos — as partes mostradas abaixo.`,
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
      const shape = n === 0 ? 'ponto' : before[3] === U && before[5] === U ? 'linha horizontal' : before[1] === U && before[7] === U ? 'linha' : '“L”';
      return {
        title: `OLL · cruz amarela (${shape})`,
        text:
          setupText(setup) +
          `Primeira parte da OLL: orientar as arestas amarelas. O topo mostra um <b>${shape}</b>. ` +
          `Com a face verde de frente, aplique <code>${m.meta!.alg}</code>` +
          (m.meta!.name === 'L' ? ' (o “L” deve apontar para trás e para a esquerda).' : '.'),
        algLabel: `OLL arestas — ${m.meta!.name}`,
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
      title: `OLL · caso ${m.meta!.name}`,
      text:
        setupText(setup) +
        `Segunda parte da OLL: deixar a face amarela inteira. Reconheça o caso <b>${m.meta!.name}</b> pelo desenho dos cantos amarelos ` +
        `(e pelas cores amarelas viradas para os lados) e aplique, com a face verde de frente: <code>${m.meta!.alg}</code>.` +
        (String(m.meta!.alg).includes('r') ? ' <i>(“r” minúsculo = girar as duas camadas da direita juntas.)</i>' : ''),
      algLabel: `OLL — ${m.meta!.name}`,
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
      title: `PLL · cantos com ${m.meta!.name}`,
      text:
        setupText(setup) +
        `Primeira parte da PLL: colocar os cantos nos lugares. Procure os “faróis” (dois cantos da mesma cor num lado). ` +
        `Com a face verde de frente, aplique o <b>${m.meta!.name}</b>: <code>${m.meta!.alg}</code>.`,
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
        title: `PLL · arestas com ${m.meta!.name}`,
        text:
          setupText(setup) +
          `Última parte! Só faltam as arestas. Segure o cubo com a face <b>${vName}</b> de frente e aplique o <b>${m.meta!.name}</b>: ` +
          `<code>${m.meta!.alg}</code>.`,
        algLabel: `PLL — ${m.meta!.name}`,
      };
    },
    llFocus,
  );
}

export const CFOP_STAGES: SolutionStage[] = [
  { id: 'cross', name: 'Cross', goal: 'Montar a cruz branca inteira de uma vez, planejando antes de girar.' },
  { id: 'f2l', name: 'F2L', goal: 'Completar as duas primeiras camadas encaixando canto + aresta juntos (4 pares).' },
  { id: 'oll', name: 'OLL', goal: 'Deixar toda a face de cima amarela (em 2 etapas: arestas e cantos).' },
  { id: 'pll', name: 'PLL', goal: 'Colocar as peças da última camada no lugar (em 2 etapas: cantos e arestas).' },
];

export function solveCFOP(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  for (let f = 0; f < 6; f++) if (ctx.s[f * 9 + 4] !== f) throw new Error('Os centros não estão na orientação padrão (amarelo em cima, verde na frente).');
  solveCross(ctx);
  solveF2L(ctx);
  solveLastLayer(ctx);
  if (!allSolved(ctx.s, ALL_FACELETS)) throw new Error('O solucionador CFOP não terminou o cubo.');
  return { method: 'CFOP (Cross, F2L, OLL e PLL em 2 etapas)', stages: CFOP_STAGES, steps: ctx.steps };
}
