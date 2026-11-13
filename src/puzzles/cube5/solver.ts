/**
 * 5x5 pelo método de redução — o jeito como quase todo mundo aprende:
 *
 *  1. Centros       monta os 8 adesivos móveis de cada face em volta do centro fixo
 *                   (branco, amarelo e depois as 4 laterais)
 *  2. Arestas       junta as duas pontas de cada aresta ao meio dela
 *                   (com o algoritmo de paridade quando sobram duas pontas trocadas)
 *  3. Como um 3x3   com centros e arestas prontos, o 5x5 vira um 3x3 grande:
 *                   usa a mesma solução do 3x3 (iniciante ou CFOP)
 *
 * Técnica (a mesma do Megaminx): uma biblioteca de "macros" — giros, gatilhos e
 * comutadores — e, para colocar UMA peça, uma busca pelo caminho mais curto sobre a
 * posição dela usando só macros que não estragam o que já está pronto.
 * Nos centros, peças da mesma cor são iguais: um macro vale se só troca centros
 * prontos entre si (da mesma face).
 */
import type { PuzzleState, Solution, SolutionStage, SolutionStep, StepSegment } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { solveBeginner } from '../cube3/solver/beginner';
import { solveCFOP } from '../cube3/solver/cfop';
import {
  FACES5,
  FACE_CENTERS,
  MIDGES,
  MID_CENTERS,
  N5,
  WINGS,
  expand3,
  faceOf5 as faceOf,
  geo5 as geo,
  isCenter,
  partner,
  project3,
  wingNeighbors,
  wingSlotNextTo,
} from './pieces';

type S = Uint8Array;
const toS = (state: PuzzleState): S => Uint8Array.from(state, (c) => FACES5.indexOf(c));
const fromS = (s: S): PuzzleState => Array.from(s, (f) => FACES5[f]);
const cname = (f: number) => COLOR_NAME[FACES5[f]];

// ---------------------------------------------------------------------------
// Movimentos e macros
const AXIS: Record<string, number> = { U: 0, D: 0, E: 0, R: 1, L: 1, M: 1, F: 2, B: 2, S: 2 };
const OUTER = FACES5.flatMap((f) => [f, f + "'", f + '2']);
const SLICES = FACES5.flatMap((f) => ['2' + f, '2' + f + "'", '2' + f + '2']);
const MIDS = ['M', 'E', 'S'].flatMap((f) => [f, f + "'", f + '2']);
const ALL_MOVES = [...OUTER, ...SLICES];
const faceLetter = (m: string) => m.replace(/[^URFDLBMES]/g, '');
const layerKey = (m: string) => m.replace(/['2]$/, '').replace(/'$/, '');
const amount = (m: string) => (m.endsWith("'") ? 3 : m.endsWith('2') && m.length > 1 && !/^\d[URFDLB]$/.test(m) ? 2 : 1);
const axisOf = (m: string) => AXIS[faceLetter(m)];
const inv = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') && !/^\d[URFDLB]$/.test(m) ? m : m + "'");

/** junta giros seguidos da mesma camada ("U U" → "U2", "U U'" → nada) */
function simplify(moves: string[]): string[] {
  const out: string[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && layerKey(last) === layerKey(m)) {
      const t = (amount(last) + amount(m)) % 4;
      out.pop();
      if (t) out.push(layerKey(m) + (t === 1 ? '' : t === 2 ? '2' : "'"));
    } else out.push(m);
  }
  return out.length === moves.length ? out : simplify(out);
}

interface Macro {
  moves: string[];
  perm: Int32Array;
  loc: Int32Array;
  label: string;
  kind: 'turn' | 'alg';
}

function composePerm(moves: string[]): Int32Array {
  let c = new Int32Array(N5);
  for (let i = 0; i < N5; i++) c[i] = i;
  for (const m of moves) {
    const p = geo.permutation(m);
    const n = new Int32Array(N5);
    for (let i = 0; i < N5; i++) n[i] = c[p[i]];
    c = n;
  }
  return c;
}
const applyPerm = (s: S, p: Int32Array): S => {
  const o = new Uint8Array(N5);
  for (let i = 0; i < N5; i++) o[i] = s[p[i]];
  return o;
};

function makeMacro(raw: string[], kind: Macro['kind'], label: string): Macro | null {
  const moves = simplify(raw);
  if (!moves.length) return null;
  const perm = composePerm(moves);
  const loc = new Int32Array(N5);
  for (let i = 0; i < N5; i++) loc[perm[i]] = i;
  return { moves, perm, loc, label, kind };
}

let libCache: Macro[] | null = null;
/** biblioteca dos centros: giros, gatilhos X Y X' e comutadores de 3 centros (sem repetidos) */
function library(): Macro[] {
  if (libCache) return libCache;
  const byPerm = new Map<string, Macro>();
  const add = (raw: string[], kind: Macro['kind'], label: string) => {
    const m = makeMacro(raw, kind, label);
    if (!m) return;
    let identity = true;
    for (let i = 0; i < N5; i++)
      if (m.perm[i] !== i) {
        identity = false;
        break;
      }
    if (identity) return;
    const key = m.perm.join(',');
    const old = byPerm.get(key);
    if (!old || old.moves.length > m.moves.length) byPerm.set(key, m);
  };
  for (const x of ALL_MOVES) add([x], 'turn', '');
  for (const x of ALL_MOVES) for (const y of ALL_MOVES) if (axisOf(x) !== axisOf(y)) add([x, y, inv(x)], 'alg', 'Gatilho');
  // comutadores de centro [X Y X', Z] que trocam exatamente 3 centros (pode mexer em
  // arestas, que só são arrumadas depois). Famílias que geram esses ciclos:
  //   X fatia interna, Y face,            Z fatia interna ou do meio
  //   X fatia interna, Y fatia (int./meio), Z face
  //   X fatia do meio, Y face,            Z fatia interna
  //   X fatia do meio, Y fatia interna,   Z face
  const comm3 = (x: string, ys: string[], zs: string[]) => {
    for (const y of ys) {
      if (axisOf(x) === axisOf(y)) continue;
      for (const z of zs) {
        const raw = [x, y, inv(x), z, x, inv(y), inv(x), inv(z)];
        const p = composePerm(raw);
        let moved = 0, bad = false;
        for (let i = 0; i < N5 && !bad; i++)
          if (p[i] !== i && isCenter(i)) {
            moved++;
            if (i % 25 === 12) bad = true;
          }
        if (!bad && moved === 3) add(raw, 'alg', 'Comutador de centros');
      }
    }
  };
  for (const x of SLICES) {
    comm3(x, OUTER, [...SLICES, ...MIDS]);
    comm3(x, [...SLICES, ...MIDS], OUTER);
  }
  for (const x of MIDS) {
    comm3(x, OUTER, SLICES);
    comm3(x, SLICES, OUTER);
  }
  libCache = [...byPerm.values()];
  return libCache;
}

/** As 24 rotações do cubo como troca de letras das faces. */
function rotations(): Record<string, string>[] {
  const N: Record<string, number[]> = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
  const rx = (v: number[]) => [v[0], -v[2], v[1]];
  const ry = (v: number[]) => [v[2], v[1], -v[0]];
  const seen = new Map<string, Record<string, string>>();
  let frontier: ((v: number[]) => number[])[] = [(v) => v];
  for (let d = 0; d < 6; d++) {
    const next: ((v: number[]) => number[])[] = [];
    for (const f of frontier)
      for (const g of [rx, ry]) {
        const h = (v: number[]) => g(f(v));
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(N)) {
          const w = h(v);
          map[k] = Object.keys(N).find((q) => N[q].every((x, i) => x === w[i]))!;
        }
        const key = Object.values(map).join('');
        if (!seen.has(key)) {
          seen.set(key, map);
          next.push(h);
        }
      }
    frontier = next;
  }
  return [...seen.values()];
}

export const PARITY_ALG = "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2";
const rotateMove = (m: string, map: Record<string, string>) => m.replace(/[URFDLB]/, (f) => map[f]);
function parityAlgs(): string[][] {
  const base = PARITY_ALG.split(' ');
  return rotations().map((map) => base.map((m) => rotateMove(m, map)));
}

// ---------------------------------------------------------------------------
// Busca: Dijkstra sobre a posição de uma peça (ou de várias, com rótulo)
/**
 * fontes: posições de onde partir (com rótulo); alvo(rótulo, posição) diz se chegou.
 * Retorna o caminho mais curto (em movimentos) até o PRIMEIRO alvo alcançado.
 */
function search(
  sources: { tag: number; pos: number }[],
  isGoal: (tag: number, pos: number) => boolean,
  macros: Macro[],
  maxCost = 60,
): { path: Macro[]; tag: number } | null {
  const T = Math.max(...sources.map((x) => x.tag)) + 1;
  const size = T * N5;
  const dist = new Int16Array(size).fill(-1);
  const prev = new Int32Array(size).fill(-1);
  const via = new Int32Array(size).fill(-1);
  const done = new Uint8Array(size);
  const buckets: number[][] = Array.from({ length: maxCost + 1 }, () => []);
  for (const { tag, pos } of sources) {
    const id = tag * N5 + pos;
    dist[id] = 0;
    buckets[0].push(id);
  }
  for (let c = 0; c <= maxCost; c++) {
    const bucket = buckets[c];
    for (let bi = 0; bi < bucket.length; bi++) {
      const x = bucket[bi];
      if (done[x] || dist[x] !== c) continue;
      done[x] = 1;
      const tag = (x / N5) | 0, pos = x % N5;
      if (isGoal(tag, pos)) {
        const path: Macro[] = [];
        for (let z = x; via[z] >= 0; z = prev[z]) path.push(macros[via[z]]);
        return { path: path.reverse(), tag };
      }
      for (let mi = 0; mi < macros.length; mi++) {
        const m = macros[mi];
        const nc = c + m.moves.length;
        if (nc > maxCost) continue;
        const y = tag * N5 + m.loc[pos];
        if (done[y] || (dist[y] !== -1 && dist[y] <= nc)) continue;
        dist[y] = nc;
        prev[y] = x;
        via[y] = mi;
        buckets[nc].push(y);
      }
    }
  }
  return null;
}

/**
 * Macros que preservam o que está pronto:
 *  - centros prontos: o macro pode trocá-los entre si, desde que fiquem na mesma face
 *  - `strict`: adesivos que não podem sair do lugar
 */
function usable(centersKept: number[], strict: number[]): Macro[] {
  const keepSet = new Uint8Array(N5);
  for (const k of centersKept) keepSet[k] = 1;
  return library().filter((m) => {
    for (const k of strict) if (m.perm[k] !== k) return false;
    for (const k of centersKept) {
      const p = m.perm[k];
      if (!keepSet[p] || faceOf(p) !== faceOf(k)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
interface Ctx {
  s: S;
  steps: SolutionStep[];
}

function segmentsOf(path: Macro[]): StepSegment[] {
  const segs: StepSegment[] = [];
  for (const m of path) {
    const last = segs[segs.length - 1];
    const label = m.kind === 'turn' ? 'Posicionar' : m.label;
    if (last && last.label === label && m.kind === 'turn') last.moves.push(...m.moves);
    else segs.push({ label, moves: [...m.moves] });
  }
  for (const s of segs) s.moves = simplify(s.moves);
  return segs.filter((s) => s.moves.length);
}

function push(ctx: Ctx, stageId: string, title: string, description: string, path: Macro[], focus: number[]) {
  const moves = path.flatMap((m) => m.moves);
  if (!moves.length) return;
  ctx.steps.push({ stageId, title, description, segments: segmentsOf(path), focus });
  ctx.s = applyPerm(ctx.s, composePerm(moves));
}

// ---------------------------------------------------------------------------
// 1. Centros
const CENTER_ORDER = [3, 0, 2, 1, 5, 4]; // D (branco), U (amarelo), F, R, B, L
const ALL_CENTER_SLOTS = FACE_CENTERS.flat();

function solveCenters(ctx: Ctx) {
  const done: number[] = [];
  CENTER_ORDER.forEach((f, order) => {
    const stage = order === 0 ? 'c-white' : order === 1 ? 'c-yellow' : 'c-sides';
    for (;;) {
      const s = ctx.s;
      const todo = FACE_CENTERS[f].filter((k) => s[k] !== f);
      if (!todo.length) break;
      const kept = [...done.flatMap((g) => FACE_CENTERS[g]), ...FACE_CENTERS[f].filter((k) => s[k] === f)];
      const macros = usable(kept, MID_CENTERS);
      const keptSet = new Set(kept);
      const sources = ALL_CENTER_SLOTS.filter((k) => s[k] === f && !keptSet.has(k)).map((pos) => ({ tag: 0, pos }));
      const todoSet = new Set(todo);
      const r = search(sources, (_, pos) => todoSet.has(pos), macros);
      if (!r) throw new Error('não achei como montar o centro');
      const after = applyPerm(s, composePerm(r.path.flatMap((m) => m.moves)));
      const ready = FACE_CENTERS[f].filter((k) => after[k] === f).length;
      push(
        ctx,
        stage,
        `Centro ${cname(f)}: ${ready} de 8`,
        order === 0
          ? `Leve adesivos ${cname(f)} para o centro ${cname(f)}, em volta do adesivo fixo do meio.`
          : order === 1
            ? `Monte o centro ${cname(f)} sem desmanchar o centro branco.`
            : order < 5
              ? `Monte o centro ${cname(f)} sem desmanchar os centros que já estão prontos.`
              : `Os dois últimos centros (${cname(5)} e ${cname(4)}) se montam juntos, trocando peças entre eles.`,
        r.path,
        FACE_CENTERS[f],
      );
    }
    done.push(f);
  });
}

// ---------------------------------------------------------------------------
// 2. Arestas: juntar as pontas ao meio de cada aresta (o meio não sai do lugar)
function wingTargets(s: S) {
  // para cada ponta (classe 0, cor a / parceiro cor b): onde ela está e para onde vai
  return WINGS.map(([a, b]) => {
    const ca = faceOf(a), cb = faceOf(b);
    const at = WINGS.find(([x, y]) => s[x] === ca && s[y] === cb)![0];
    const midge = MIDGES.find(([x, y]) => (s[x] === ca && s[y] === cb) || (s[x] === cb && s[y] === ca))!;
    const m = s[midge[0]] === ca ? midge[0] : midge[1];
    const to = wingSlotNextTo(m);
    return { at, to, ca, cb, midge };
  });
}

/**
 * Todos os ciclos de 3 pontas (4048), cada um como um comutador [fatia, Y Z Y'] que só
 * mexe nessas 3 pontas, conjugado por giros de preparação. Guardados pela trinca de
 * posições (adesivo da classe 0), na ordem do ciclo: a ponta em p[0] vai para p[1]...
 */
interface Cycle3 {
  p: [number, number, number];
  moves: string[];
}
let cyclesCache: Cycle3[] | null = null;
function wingCycles(): Cycle3[] {
  if (cyclesCache) return cyclesCache;
  const isWing0 = (i: number) => WINGS.some(([a]) => a === i);
  const key = (p: number[]) => {
    const k = p.indexOf(Math.min(...p));
    return [p[k], p[(k + 1) % 3], p[(k + 2) % 3]].join(',');
  };
  const seen = new Map<string, Cycle3>();
  let frontier: Cycle3[] = [];
  for (const x of SLICES)
    for (const y of OUTER)
      for (const z of OUTER) {
        if (axisOf(y) === axisOf(z)) continue;
        const moves = simplify([x, y, z, inv(y), inv(x), y, inv(z), inv(y)]);
        const perm = composePerm(moves);
        const moved: number[] = [];
        for (let i = 0; i < N5; i++) if (perm[i] !== i) moved.push(i);
        if (moved.length !== 6) continue;
        const w0 = moved.filter(isWing0);
        if (w0.length !== 3) continue;
        const loc = new Int32Array(N5);
        for (let i = 0; i < N5; i++) loc[perm[i]] = i;
        const p: [number, number, number] = [w0[0], loc[w0[0]], loc[loc[w0[0]]]];
        const k = key(p);
        if (!seen.has(k)) {
          const c = { p, moves };
          seen.set(k, c);
          frontier.push(c);
        }
      }
  // conjugar com um giro Z: [Z', ciclo, Z] leva o ciclo para Z(p)
  const locs = new Map(ALL_MOVES.map((m) => [m, geo.locationMap(m)]));
  while (frontier.length) {
    const next: Cycle3[] = [];
    for (const c of frontier)
      for (const z of ALL_MOVES) {
        const lz = locs.get(z)!;
        const p: [number, number, number] = [lz[c.p[0]], lz[c.p[1]], lz[c.p[2]]];
        const k = key(p);
        if (seen.has(k)) continue;
        const n = { p, moves: simplify([inv(z), ...c.moves, z]) };
        seen.set(k, n);
        next.push(n);
      }
    frontier = next;
  }
  cyclesCache = [...seen.values()];
  return cyclesCache;
}

/** algoritmo de paridade que troca as duas pontas de cada aresta (pela posição do meio) */
let parityCache: Map<number, Macro> | null = null;
function parityBySlot(): Map<number, Macro> {
  if (parityCache) return parityCache;
  parityCache = new Map();
  for (const alg of parityAlgs()) {
    const m = makeMacro(alg, 'alg', 'Paridade das arestas')!;
    MIDGES.forEach(([a], i) => {
      const w = wingNeighbors(a);
      if (!parityCache!.has(i) && m.perm[w[0]] !== w[0] && m.perm[w[1]] !== w[1]) parityCache!.set(i, m);
    });
  }
  return parityCache;
}

function solveEdges(ctx: Ctx) {
  const cycles = wingCycles();
  let done = 0;
  for (;;) {
    const t = wingTargets(ctx.s);
    const targetAt = new Map(t.map((w) => [w.at, w.to]));
    const open = t.filter((w) => w.at !== w.to);
    if (!open.length) break;
    const openPos = new Set(open.map((w) => w.at));
    const paired = () => MIDGES.filter((md) => t.filter((x) => x.midge === md && x.at === x.to).length === 2).length;
    if (open.length === 2) {
      // sobraram duas pontas trocadas: a paridade troca as pontas de uma aresta,
      // e depois um ciclo de 3 conserta o resto
      const slot = MIDGES.indexOf(open[0].midge);
      const m = parityBySlot().get(slot)!;
      push(
        ctx,
        'edges',
        'Paridade das arestas',
        'Sobraram duas pontas trocadas — isso acontece no 5x5 e não tem como resolver só com ciclos de 3 peças. Este algoritmo troca as duas pontas de uma aresta; os centros se mexem no meio e voltam no fim.',
        [m],
        [open[0].at, partner(open[0].at), open[1].at, partner(open[1].at), ...open[0].midge],
      );
      continue;
    }
    // escolhe o ciclo que encaixa mais pontas por movimento
    let best: Cycle3 | null = null, bestScore = 0, bestGain = 0;
    for (const c of cycles) {
      if (!openPos.has(c.p[0]) || !openPos.has(c.p[1]) || !openPos.has(c.p[2])) continue;
      const gain = +(targetAt.get(c.p[0]) === c.p[1]) + +(targetAt.get(c.p[1]) === c.p[2]) + +(targetAt.get(c.p[2]) === c.p[0]);
      if (!gain) continue;
      const score = gain / (c.moves.length + 4);
      if (score > bestScore) {
        best = c;
        bestScore = score;
        bestGain = gain;
      }
    }
    if (!best) throw new Error('não achei como montar as arestas');
    const m = makeMacro(best.moves, 'alg', 'Ciclo de 3 pontas')!;
    const moving = best.p.map((pos) => t.find((w) => w.at === pos)!);
    const placedNow = moving.filter((w) => m.loc[w.at] === w.to);
    done += placedNow.length;
    const names = placedNow.map((w) => `${cname(w.ca)}-${cname(w.cb)}`);
    push(
      ctx,
      'edges',
      bestGain > 1 ? `Pontas ${names.join(' e ')}` : `Ponta ${names[0]}`,
      `Um ciclo de 3 pontas: ${bestGain > 1 ? 'duas pontas vão' : 'uma ponta vai'} para o lado do meio da ${bestGain > 1 ? 'aresta delas' : 'aresta dela'}. Só essas 3 pontas se mexem — os centros e o resto saem do lugar no meio do algoritmo e voltam no fim. (${paired()} de 12 arestas completas antes deste passo.)`,
      [m],
      [...best.p.flatMap((x) => [x, partner(x)]), ...placedNow.flatMap((w) => w.midge)],
    );
  }
  void done;
}

// ---------------------------------------------------------------------------
export const CUBE5_STAGES: SolutionStage[] = [
  { id: 'c-white', name: 'Centro branco', goal: 'Montar os 9 adesivos do centro da face branca.' },
  { id: 'c-yellow', name: 'Centro amarelo', goal: 'Montar o centro amarelo, do lado oposto ao branco.' },
  { id: 'c-sides', name: 'Centros laterais', goal: 'Montar os 4 centros dos lados sem desmanchar os que já estão prontos.' },
  { id: 'edges', name: 'Arestas', goal: 'Juntar as duas pontas de cada aresta ao meio dela, formando 12 arestas inteiras.' },
];

export function solveCube5(state: PuzzleState, method: 'beginner' | 'cfop' = 'beginner'): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  solveCenters(ctx);
  solveEdges(ctx);
  // 3. agora é um 3x3: usa a solução do 3x3 sobre cantos, meio das arestas e centros
  const s3 = project3(fromS(ctx.s));
  const sol3 = method === 'cfop' ? solveCFOP(s3) : solveBeginner(s3);
  // no 3x3, "r" é a face + a camada do meio; no 5x5 reduzido a camada do meio do 3x3
  // são as 3 camadas de dentro, então "r" vira "4Rw" (4 camadas)
  const to5move = (m: string) => (/^[rludfb]/.test(m) ? `4${m[0].toUpperCase()}w${m.slice(1)}` : m);
  const steps = [
    ...ctx.steps,
    ...sol3.steps.map((st) => ({
      ...st,
      stageId: '3x3-' + st.stageId,
      segments: st.segments.map((sg) => ({ ...sg, moves: sg.moves.map(to5move) })),
      focus: [...new Set(st.focus.flatMap(expand3))],
    })),
  ];
  return {
    method: method === 'cfop' ? 'Redução + CFOP' : 'Redução (iniciante)',
    stages: [...CUBE5_STAGES, ...sol3.stages.map((sg) => ({ ...sg, id: '3x3-' + sg.id, name: `Como 3x3: ${sg.name}` }))],
    steps,
  };
}

export { isCenter };
