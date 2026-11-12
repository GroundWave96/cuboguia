/** Peças, movimentos e busca de macros compartilhados pelos métodos do 3x3. */
import type { PuzzleState, SolutionStep, StepSegment } from '../../../core/types';
import { NxNGeometry } from '../../nxn/geometry';
import { CORNER_FACELETS, EDGE_FACELETS, FACES } from '../pieces';
import { COLOR_NAME } from '../colors';

export const geo = new NxNGeometry(3);
export type S = Uint8Array;

export const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;
export const ALL_MOVES = FACES.flatMap((f) => [f, f + "'", f + '2']);

export const toS = (state: PuzzleState): S => Uint8Array.from(state, (c) => FACES.indexOf(c));
export const solvedAt = (s: S, f: number) => s[f] === ((f / 9) | 0);
export const allSolved = (s: S, fs: number[]) => fs.every((f) => solvedAt(s, f));

export function composePerm(moves: string[]): Int32Array {
  let c = new Int32Array(54);
  for (let i = 0; i < 54; i++) c[i] = i;
  for (const m of moves) {
    const p = geo.permutation(m);
    const n = new Int32Array(54);
    for (let i = 0; i < 54; i++) n[i] = c[p[i]];
    c = n;
  }
  return c;
}

export function applyPerm(s: S, p: Int32Array): S {
  const o = new Uint8Array(54);
  for (let i = 0; i < 54; i++) o[i] = s[p[i]];
  return o;
}

/** Mapeia um algoritmo escrito "com a face X de frente" para movimentos absolutos. */
export const VIEW = ['F', 'R', 'B', 'L'];
export function remap(alg: string, view: number): string[] {
  return alg
    .split(' ')
    .filter(Boolean)
    .map((m) => {
      const i = VIEW.indexOf(m[0]);
      return i < 0 ? m : VIEW[(i + view) % 4] + m.slice(1);
    });
}

// ---------------------------------------------------------------------------
// Grupos de adesivos usados nos objetivos
export const D_FACE = [27, 28, 29, 30, 31, 32, 33, 34, 35];
export const SIDE_FACES = [R, F, L, B];
export const sideRows = (rows: number[]) => SIDE_FACES.flatMap((f) => rows.flatMap((r) => [0, 1, 2].map((c) => f * 9 + r * 3 + c)));
export const FIRST_LAYER = [...D_FACE, ...sideRows([2])];
export const F2L = [...D_FACE, ...sideRows([1, 2])];
export const U_FACE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const LAST_LAYER = [...U_FACE, ...sideRows([0])];
export const U_CORNER_FACELETS = CORNER_FACELETS.slice(0, 4).flat();
export const ALL_FACELETS = Array.from({ length: 54 }, (_, i) => i);

// ---------------------------------------------------------------------------
// Localização de peças pelas cores
export function findCorner(s: S, colors: number[]): number[] {
  for (const fs of CORNER_FACELETS) {
    const cs = fs.map((f) => s[f]);
    if (colors.every((c) => cs.includes(c))) return fs;
  }
  throw new Error('canto não encontrado');
}
export function findEdge(s: S, colors: number[]): number[] {
  for (const fs of EDGE_FACELETS) {
    const cs = fs.map((f) => s[f]);
    if (colors.every((c) => cs.includes(c))) return fs;
  }
  throw new Error('aresta não encontrada');
}

export const cname = (c: number) => COLOR_NAME[FACES[c]];
export const pieceName = (cs: number[]) => cs.map(cname).join('-');

// ---------------------------------------------------------------------------
// Busca de macros
export interface Macro {
  kind: 'adjust' | 'alg';
  moves: string[];
  perm: Int32Array;
  group?: string;
  meta?: Record<string, number | string>;
}

export function macro(kind: Macro['kind'], moves: string[], group?: string, meta?: Macro['meta']): Macro {
  return { kind, moves, perm: composePerm(moves), group, meta };
}

export const ADJUSTS = ['U', "U'", 'U2'].map((m) => macro('adjust', [m]));

export interface SearchOptions {
  /** limite de nós visitados (devolve null ao estourar) */
  maxNodes?: number;
  /** poda algoritmos seguidos cuja junção cancelaria movimentos (ex.: ...R' + R...) */
  pruneCancel?: boolean;
}

export function searchMacros(start: S, macros: Macro[], goal: (s: S) => boolean, maxDepth: number, opts: SearchOptions = {}): Macro[] | null {
  if (goal(start)) return [];
  let nodes = 0;
  const maxNodes = opts.maxNodes ?? Infinity;
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
        if (prev) {
          if (prev.kind === 'adjust' && m.kind === 'adjust') continue;
          if (prev.group && prev.group === m.group) continue;
          if (opts.pruneCancel && prev.kind === 'alg' && m.kind === 'alg' && prev.moves[prev.moves.length - 1][0] === m.moves[0][0]) continue;
        }
        if (++nodes > maxNodes) return;
        path.push(m);
        dfs(applyPerm(s, m.perm), d - 1, len + m.moves.length);
        path.pop();
      }
    };
    dfs(start, depth, 0);
    if (best) return best;
    if (nodes > maxNodes) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Cruz branca — BFS sobre as posições dos adesivos brancos das arestas
export const EDGE_STICKERS = EDGE_FACELETS.flat();
export const EDGE_IDX = new Map(EDGE_STICKERS.map((f, i) => [f, i]));
export const EDGE_LOC_MAPS = ALL_MOVES.map((m) => {
  const map = geo.locationMap(m);
  return Int8Array.from(EDGE_STICKERS, (f) => EDGE_IDX.get(map[f])!);
});

export function bfsEdges(startLocs: number[], targetLocs: number[]): string[] {
  const k = startLocs.length;
  const enc = (locs: number[]) => locs.reduce((acc, l, i) => acc + l * 24 ** i, 0);
  const start = enc(startLocs);
  const goal = enc(targetLocs);
  if (start === goal) return [];
  const size = 24 ** k;
  const prev = new Int32Array(size).fill(-1);
  const prevMove = new Int8Array(size);
  const queue = new Int32Array(size);
  let head = 0, tail = 0;
  queue[tail++] = start;
  prev[start] = start;
  const locs = new Array<number>(k);
  while (head < tail) {
    const cur = queue[head++];
    let x = cur;
    for (let i = 0; i < k; i++) {
      locs[i] = x % 24;
      x = Math.floor(x / 24);
    }
    for (let m = 0; m < ALL_MOVES.length; m++) {
      const map = EDGE_LOC_MAPS[m];
      let next = 0;
      for (let i = k - 1; i >= 0; i--) next = next * 24 + map[locs[i]];
      if (prev[next] !== -1) continue;
      prev[next] = cur;
      prevMove[next] = m;
      if (next === goal) {
        const moves: string[] = [];
        for (let c = goal; c !== start; c = prev[c]) moves.push(ALL_MOVES[prevMove[c]]);
        return moves.reverse();
      }
      queue[tail++] = next;
    }
  }
  throw new Error('cruz sem solução');
}

export const CROSS_TARGETS: { color: number; target: number }[] = [
  { color: F, target: 28 },
  { color: R, target: 32 },
  { color: B, target: 34 },
  { color: L, target: 30 },
];

export function whiteLoc(s: S, color: number): number {
  for (const [a, b] of EDGE_FACELETS) {
    if (s[a] === D && s[b] === color) return EDGE_IDX.get(a)!;
    if (s[b] === D && s[a] === color) return EDGE_IDX.get(b)!;
  }
  throw new Error('aresta branca não encontrada');
}

// ---------------------------------------------------------------------------
export interface Ctx {
  s: S;
  steps: SolutionStep[];
}

export function pushStep(ctx: Ctx, stageId: string, title: string, description: string, segments: StepSegment[], focus: number[]) {
  const moves = segments.flatMap((sg) => sg.moves);
  if (moves.length === 0) return;
  ctx.steps.push({ stageId, title, description, segments: segments.filter((s) => s.moves.length), focus });
  ctx.s = applyPerm(ctx.s, composePerm(moves));
}

export const crossFacelets = [28, 25, 32, 16, 34, 52, 30, 43];
export const cornerFaceletsOf = (colors: number[]) => findCorner(solvedS, colors);
export const edgeFaceletsOf = (colors: number[]) => findEdge(solvedS, colors);
export const solvedS = Uint8Array.from({ length: 54 }, (_, i) => (i / 9) | 0);

export function setupText(setup: string[]) {
  return setup.length ? `Primeiro gire a camada de cima: <b>${setup.join(' ')}</b>. ` : '';
}

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
    const after = applyPerm(afterSetup, m.perm);
    const d = describe(m, setup, afterSetup, after);
    pushStep(
      ctx,
      stageId,
      d.title,
      d.text,
      [
        { label: 'Ajuste do topo', moves: setup },
        { label: d.algLabel, moves: m.moves },
      ],
      focusFn(before),
    );
    setup = [];
  }
  if (setup.length) {
    pushStep(ctx, stageId, 'Ajuste da camada de cima', 'Gire a camada de cima para alinhar as peças com os centros.', [{ label: 'Ajuste do topo', moves: setup }], focusFn(ctx.s));
  }
}

