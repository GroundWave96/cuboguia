/** Ferramentas do 2x2: estado em bytes, macros e busca (mesma ideia do 3x3). */
import type { PuzzleState, SolutionStep, StepSegment } from '../../../core/types';
import { FACE_ORDER, NxNGeometry } from '../../nxn/geometry';
import { cornerFacelets } from '../../nxn/pieces';
import { COLOR_NAME } from '../../cube3/colors';

export const geo2 = new NxNGeometry(2);
export const N = geo2.count; // 24
export type S = Uint8Array;
export const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;

export const CORNERS = cornerFacelets(geo2); // ordem URF UFL ULB UBR DFR DLF DBL DRB
export const DBL = 6;
export const ALL = Array.from({ length: N }, (_, i) => i);
export const faceOfSticker = (i: number) => (i / 4) | 0;

export const toS = (state: PuzzleState): S => Uint8Array.from(state, (c) => FACE_ORDER.indexOf(c as never));
export const solvedS: S = Uint8Array.from(ALL, faceOfSticker);
export const allSolved = (s: S, fs: number[]) => fs.every((f) => s[f] === faceOfSticker(f));
export const cname = (c: number) => COLOR_NAME[FACE_ORDER[c]];
export const pieceName = (cs: number[]) => cs.map(cname).join('-');

export function composePerm(moves: string[]): Int32Array {
  let c = Int32Array.from(ALL);
  for (const m of moves) {
    const p = geo2.permutation(m);
    const n = new Int32Array(N);
    for (let i = 0; i < N; i++) n[i] = c[p[i]];
    c = n;
  }
  return c;
}
export function applyPerm(s: S, p: Int32Array): S {
  const o = new Uint8Array(N);
  for (let i = 0; i < N; i++) o[i] = s[p[i]];
  return o;
}

/** Adesivos do canto que tem estas cores (em qualquer posição). */
export function findCorner(s: S, colors: number[]): number[] {
  for (const fs of CORNERS) {
    const cs = fs.map((f) => s[f]);
    if (colors.every((c) => cs.includes(c))) return fs;
  }
  throw new Error('canto não encontrado');
}
export const homeOf = (colors: number[]) => findCorner(solvedS, colors);

export interface Macro {
  kind: 'adjust' | 'alg';
  moves: string[];
  perm: Int32Array;
  group?: string;
  meta?: Record<string, number | string>;
}
export const macro = (kind: Macro['kind'], moves: string[], group?: string, meta?: Macro['meta']): Macro => ({
  kind,
  moves,
  perm: composePerm(moves),
  group,
  meta,
});
export const ADJUSTS = ['U', "U'", 'U2'].map((m) => macro('adjust', [m]));

/** Algoritmo escrito com uma face de frente → movimentos absolutos. */
const VIEW = ['F', 'R', 'B', 'L'];
export const remap = (alg: string, view: number) =>
  alg
    .split(' ')
    .filter(Boolean)
    .map((m) => {
      const i = VIEW.indexOf(m[0]);
      return i < 0 ? m : VIEW[(i + view) % 4] + m.slice(1);
    });

export function searchMacros(start: S, macros: Macro[], goal: (s: S) => boolean, maxDepth: number): Macro[] | null {
  if (goal(start)) return [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let best: Macro[] | null = null;
    let bestLen = Infinity;
    const path: Macro[] = [];
    const dfs = (s: S, d: number, len: number) => {
      if (len >= bestLen) return;
      if (d === 0) {
        if (goal(s)) {
          best = [...path];
          bestLen = len;
        }
        return;
      }
      const prev = path[path.length - 1];
      for (const m of macros) {
        if (prev && ((prev.kind === 'adjust' && m.kind === 'adjust') || (prev.group && prev.group === m.group))) continue;
        path.push(m);
        dfs(applyPerm(s, m.perm), d - 1, len + m.moves.length);
        path.pop();
      }
    };
    dfs(start, depth, 0);
    if (best) return best;
  }
  return null;
}

export interface Ctx {
  s: S;
  steps: SolutionStep[];
}

export function pushStep(ctx: Ctx, stageId: string, title: string, description: string, segments: StepSegment[], focus: number[]) {
  const moves = segments.flatMap((sg) => sg.moves);
  if (!moves.length) return;
  ctx.steps.push({ stageId, title, description, segments: segments.filter((s) => s.moves.length), focus });
  ctx.s = applyPerm(ctx.s, composePerm(moves));
}

export const setupText = (setup: string[]) => (setup.length ? `Primeiro gire a camada de cima: <b>${setup.join(' ')}</b>. ` : '');

/** Junta ajustes do topo ao algoritmo seguinte e cria um passo por algoritmo. */
export function stepsFromMacros(
  ctx: Ctx,
  seq: Macro[],
  stageId: string,
  describe: (m: Macro, setup: string[], before: S, after: S) => { title: string; text: string; algLabel: string },
  focusFn: (s: S) => number[],
) {
  let setup: string[] = [];
  for (const m of seq) {
    if (m.kind === 'adjust') {
      setup.push(...m.moves);
      continue;
    }
    const before = ctx.s;
    const afterSetup = applyPerm(before, composePerm(setup));
    const d = describe(m, setup, afterSetup, applyPerm(afterSetup, m.perm));
    pushStep(ctx, stageId, d.title, d.text, [
      { label: 'Ajuste do topo', moves: setup },
      { label: d.algLabel, moves: m.moves },
    ], focusFn(before));
    setup = [];
  }
  if (setup.length)
    pushStep(ctx, stageId, 'Ajuste da camada de cima', 'Gire a camada de cima para alinhar com a de baixo.', [{ label: 'Ajuste do topo', moves: setup }], focusFn(ctx.s));
}
