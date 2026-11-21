/**
 * Cubos grandes (6x6, 7x7) pelo método de redução — o mesmo caminho do 4x4 e do 5x5, escrito
 * para qualquer tamanho:
 *
 *  1. Centros    os adesivos do miolo de cada face (branco embaixo, amarelo em cima, depois
 *                os lados). Cada adesivo de centro só anda entre posições do mesmo "tipo"
 *                (mesma distância das bordas); um ciclo de 3 centros troca só 3 deles.
 *  2. Arestas    juntar todas as pontas de cada aresta. Nos cubos ímpares o meio da aresta
 *                é a referência; nos pares, primeiro se juntam as pontas de dentro (como no
 *                4x4) e elas viram a referência das de fora. Ciclos de 3 pontas, e o
 *                algoritmo de paridade quando sobram duas pontas trocadas.
 *  3. Paridades  só nos pares: uma aresta virada sozinha (OLL) ou duas trocadas (PLL).
 *  4. Como 3x3   o resto é a solução do 3x3 (iniciante ou CFOP).
 *
 * Técnica (a mesma do 4x4 e do 5x5): para colocar UMA peça, uma busca pelo caminho mais curto
 * sobre a posição dela, usando giros e ciclos de 3 peças que não estragam o que já está pronto.
 * Todos os ciclos de 3 de cada tipo de peça saem de alguns comutadores-base conjugados por
 * giros (o que dá os 4048 ciclos possíveis de cada tipo).
 */
import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import { UNKNOWN, type PuzzleState, type Solution, type SolutionStage, type SolutionStep, type StepSegment, type ValidationResult } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { CORNER_FACELETS, EDGE_FACELETS } from '../cube3/pieces';
import { solveBeginner } from '../cube3/solver/beginner';
import { solveCFOP } from '../cube3/solver/cfop';
import { validateCube3 } from '../cube3/validate';
import { NxNGeometry } from './geometry';
import { cornerFacelets } from './pieces';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const AXIS: Record<string, number> = { U: 0, D: 0, E: 0, R: 1, L: 1, M: 1, F: 2, B: 2, S: 2 };
const SUFFIX = ['', "'", '2'];
const cname = (f: number) => COLOR_NAME[FACES[f]];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Notação: "2R", "3Uw2", "M'"... → camada e quantidade de quartos de volta
const MOVE_RE = /^(\d*[URFDLBMES]w?)(['2]?)$/;
const keyOf = (m: string) => MOVE_RE.exec(m)![1];
const amount = (m: string) => ({ '': 1, "'": 3, '2': 2 })[MOVE_RE.exec(m)![2] as '' | "'" | '2'];
const axisOf = (m: string) => AXIS[m.replace(/[^URFDLBMES]/g, '')];
export const invBig = (m: string) => keyOf(m) + ['', '', '2', ''][amount(m)] + (amount(m) === 1 ? "'" : '');
const withAmount = (k: string, t: number) => k + ['', '', '2', "'"][t];

/** junta giros seguidos da mesma camada ("U U" → "U2", "U U'" → nada) */
export function simplifyBig(moves: string[]): string[] {
  const out: string[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && keyOf(last) === keyOf(m)) {
      const t = (amount(last) + amount(m)) % 4;
      out.pop();
      if (t) out.push(withAmount(keyOf(m), t));
    } else out.push(m);
  }
  return out.length === moves.length ? out : simplifyBig(out);
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
const rotateMove = (m: string, map: Record<string, string>) => m.replace(/[URFDLB]/, (f) => map[f]);

/** troca as duas pontas da camada k numa aresta (a de cima da frente); centros voltam no fim */
export const wingParityAlg = (k: number) => `${k}R2 B2 U2 ${k}L U2 ${k}R' U2 ${k}R U2 F2 ${k}R F2 ${k}L' B2 ${k}R2`;
/** cubos pares: troca as arestas de cima da frente e de trás (as fatias de dentro giram juntas) */
export const pllParityAlg = (n: number) => {
  const inner = (f: string, t: string) => innerLayers(n).map((k) => `${k}${f}${t}`).join(' ');
  return `${inner('R', '2')} U2 ${inner('R', '2')} ${n / 2}Uw2 ${inner('R', '2')} ${inner('U', '2')}`;
};
const innerLayers = (n: number) => Array.from({ length: Math.floor(n / 2) - 1 }, (_, i) => i + 2);

// ---------------------------------------------------------------------------
type S = Uint8Array;

interface Cycle3 {
  /** posições (adesivo de referência de cada peça), na ordem do ciclo: a peça em p[0] vai para p[1]... */
  p: [number, number, number];
  moves: string[];
}

interface Macro {
  moves: string[];
  perm: Int32Array;
  loc: Int32Array;
  label: string;
  kind: 'turn' | 'alg';
}

export type BigCube = ReturnType<typeof bigCube>;

const cache = new Map<number, BigCube>();
export function getBigCube(n: number): BigCube {
  if (!cache.has(n)) cache.set(n, bigCube(n));
  return cache.get(n)!;
}

function bigCube(n: number) {
  const geo = new NxNGeometry(n);
  const N = geo.count;
  const A = n * n;
  const h = n - 1;
  const odd = n % 2 === 1;
  const midCell = h / 2;
  const faceOf = (i: number) => (i / A) | 0;
  const rowOf = (i: number) => ((i % A) / n) | 0;
  const colOf = (i: number) => i % n;
  const isCenter = (i: number) => rowOf(i) > 0 && rowOf(i) < h && colOf(i) > 0 && colOf(i) < h;
  const isFixed = (i: number) => odd && rowOf(i) === midCell && colOf(i) === midCell;
  const isEdgeCell = (i: number) => (rowOf(i) === 0 || rowOf(i) === h) !== (colOf(i) === 0 || colOf(i) === h);
  /** posição ao longo da borda (1..n-2) */
  const along = (i: number) => (rowOf(i) === 0 || rowOf(i) === h ? colOf(i) : rowOf(i));
  const isMidge = (i: number) => odd && isEdgeCell(i) && along(i) === midCell;

  // ------------------------------------------------------------- movimentos
  const OUTER = FACES.flatMap((f) => SUFFIX.map((t) => f + t));
  const LAYERS = innerLayers(n);
  const SLICES = FACES.flatMap((f) => LAYERS.flatMap((k) => SUFFIX.map((t) => `${k}${f}${t}`)));
  const MIDS = odd ? ['M', 'E', 'S'].flatMap((f) => SUFFIX.map((t) => f + t)) : [];
  /** giros de preparação: sem a fatia do meio (os centros fixos ficam parados) */
  const ALL_MOVES = [...OUTER, ...SLICES];

  const composePerm = (moves: string[]): Int32Array => {
    let c = new Int32Array(N);
    for (let i = 0; i < N; i++) c[i] = i;
    for (const m of moves) {
      const p = geo.permutation(m);
      const nx = new Int32Array(N);
      for (let i = 0; i < N; i++) nx[i] = c[p[i]];
      c = nx;
    }
    return c;
  };
  const applyPerm = (s: S, p: Int32Array): S => {
    const o = new Uint8Array(N);
    for (let i = 0; i < N; i++) o[i] = s[p[i]];
    return o;
  };
  const makeMacro = (raw: string[], kind: Macro['kind'], label: string): Macro | null => {
    const moves = simplifyBig(raw);
    if (!moves.length) return null;
    const perm = composePerm(moves);
    const loc = new Int32Array(N);
    for (let i = 0; i < N; i++) loc[perm[i]] = i;
    return { moves, perm, loc, label, kind };
  };

  // ------------------------------------------------------------- peças
  /** o outro adesivo da mesma peça (peças de 2 adesivos) */
  const partnerOf = new Int32Array(N).fill(-1);
  {
    const byCubie = new Map<string, number[]>();
    for (const s of geo.stickers) {
      const k = s.cubie2.join(',');
      byCubie.set(k, [...(byCubie.get(k) ?? []), s.index]);
    }
    for (const list of byCubie.values()) if (list.length === 2) [partnerOf[list[0]], partnerOf[list[1]]] = [list[1], list[0]];
  }
  const partner = (i: number) => partnerOf[i];

  /** tipo de cada adesivo: as posições que ele alcança com os giros (union-find) */
  const root = Int32Array.from({ length: N }, (_, i) => i);
  const find = (x: number): number => (root[x] === x ? x : (root[x] = find(root[x])));
  for (const f of FACES)
    for (const k of [1, ...LAYERS]) {
      const loc = geo.locationMap(k === 1 ? f : `${k}${f}`);
      for (let i = 0; i < N; i++) {
        const a = find(i), b = find(loc[i]);
        if (a !== b) root[a] = b;
      }
    }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < N; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);

  /** tipos de centro (24 posições cada) */
  const CENTER_ORBITS = [...groups.values()].filter((g) => isCenter(g[0]) && !isFixed(g[0]));
  const centerOrbit = new Int8Array(N).fill(-1);
  CENTER_ORBITS.forEach((g, k) => g.forEach((i) => (centerOrbit[i] = k)));
  const FACE_CENTERS = FACES.map((_, f) => Array.from({ length: A }, (_, c) => f * A + c).filter((i) => isCenter(i) && !isFixed(i)));
  const FIXED_CENTERS = odd ? FACES.map((_, f) => f * A + midCell * n + midCell) : [];

  /**
   * Pontas: cada tipo de ponta tem 24 peças; uma ponta nunca vira no lugar, então os dois
   * adesivos dela ficam em grupos diferentes. A "posição" da ponta é o adesivo do grupo 0.
   */
  const wingGroups = [...groups.values()].filter((g) => isEdgeCell(g[0]) && !isMidge(g[0]));
  // os grupos saem em ordem crescente: fica como grupo 0 o que tem o menor adesivo do par
  const WING_ORBITS = wingGroups.filter((g) => g[0] < wingGroups.find((o) => o.includes(partner(g[0])))![0]);
  const wingOrbit = new Int8Array(N).fill(-1);
  WING_ORBITS.forEach((g, k) => g.forEach((i) => (wingOrbit[i] = k)));
  /** camada de cada tipo de ponta (2 = a fatia logo atrás da face) */
  const WING_LAYER = WING_ORBITS.map((g) => Math.min(along(g[0]), h - along(g[0])) + 1);
  const isWingPos = (i: number) => wingOrbit[i] >= 0;

  /** 12 lugares de aresta (ordem de EDGE_FACELETS): faces e posições de ponta de cada tipo */
  const MAP3 = [0, odd ? midCell : n / 2 - 1, h];
  const to3 = (i3: number) => {
    const f = (i3 / 9) | 0, r = ((i3 % 9) / 3) | 0, c = i3 % 3;
    return f * A + MAP3[r] * n + MAP3[c];
  };
  /** as n-2 células de uma borda, na face do adesivo do 3x3 */
  const edgeCells = (i3: number) => {
    const f = (i3 / 9) | 0, r = ((i3 % 9) / 3) | 0, c = i3 % 3;
    return Array.from({ length: n - 2 }, (_, k) => (r === 1 ? f * A + (k + 1) * n + MAP3[c] : f * A + MAP3[r] * n + k + 1));
  };
  const SLOTS = EDGE_FACELETS.map(([a, b]) => {
    const cells = [...edgeCells(a), ...edgeCells(b)];
    return {
      faces: [(a / 9) | 0, (b / 9) | 0] as [number, number],
      /** adesivo de referência em cada face (o meio da aresta, ou uma ponta de dentro nos pares) */
      ref: [to3(a), to3(b)] as [number, number],
      /** posições de ponta deste lugar, por tipo */
      wings: WING_ORBITS.map((_, k) => cells.filter((i) => wingOrbit[i] === k)),
      cells,
    };
  });
  const slotOf = new Int8Array(N).fill(-1);
  SLOTS.forEach((s, k) => s.cells.forEach((i) => (slotOf[i] = k)));
  const CORNERS = cornerFacelets(geo);

  /** estado → 3x3 equivalente (cantos, uma ponta/meio de cada aresta, um centro de cada face) */
  const project3 = (state: string[]) => Array.from({ length: 54 }, (_, i) => state[to3(i)]);
  /** adesivos que formam a peça do 3x3 (para destacar no tutorial) */
  const expand3 = (i3: number): number[] => {
    const c = i3 % 9, f = (i3 / 9) | 0;
    if (c === 4) return [...FACE_CENTERS[f], ...(odd ? [FIXED_CENTERS[f]] : [])];
    if (c % 2 === 1) return edgeCells(i3);
    return [to3(i3)];
  };

  return {
    n,
    geo,
    N,
    A,
    odd,
    faceOf,
    isCenter,
    partner,
    OUTER,
    SLICES,
    MIDS,
    ALL_MOVES,
    LAYERS,
    CENTER_ORBITS,
    centerOrbit,
    FACE_CENTERS,
    FIXED_CENTERS,
    WING_ORBITS,
    WING_LAYER,
    wingOrbit,
    isWingPos,
    SLOTS,
    slotOf,
    CORNERS,
    project3,
    expand3,
    composePerm,
    applyPerm,
    makeMacro,
    lazy: {} as { centerCycles?: Cycle3[][]; byPos?: [Cycle3, number][][]; wingCycles?: Cycle3[][]; parity?: Map<string, Macro>; turns?: Macro[] },
  };
}

// ---------------------------------------------------------------------------
// Ciclos de 3 peças

/** fecha uma lista de ciclos-base por conjugação com giros: [Z', ciclo, Z] leva o ciclo para Z(p) */
function closeCycles(cube: BigCube, base: Cycle3[]): Cycle3[] {
  const key = (p: number[]) => {
    const k = p.indexOf(Math.min(...p));
    return `${p[k]},${p[(k + 1) % 3]},${p[(k + 2) % 3]}`;
  };
  const seen = new Map<string, Cycle3>();
  let frontier: Cycle3[] = [];
  for (const c of base.sort((a, b) => a.moves.length - b.moves.length)) {
    const k = key(c.p);
    if (!seen.has(k)) {
      seen.set(k, c);
      frontier.push(c);
    }
  }
  const locs = cube.ALL_MOVES.map((m) => [m, cube.geo.locationMap(m)] as const);
  while (frontier.length) {
    const next: Cycle3[] = [];
    for (const c of frontier)
      for (const [z, lz] of locs) {
        const p: [number, number, number] = [lz[c.p[0]], lz[c.p[1]], lz[c.p[2]]];
        const k = key(p);
        if (seen.has(k)) continue;
        const nc = { p, moves: simplifyBig([invBig(z), ...c.moves, z]) };
        seen.set(k, nc);
        next.push(nc);
      }
    frontier = next;
  }
  return [...seen.values()];
}

/** para onde vai cada adesivo de `watch` com uma sequência: dest[i] (sem montar a permutação inteira) */
function traceSources(cube: BigCube, moves: string[], i: number): number {
  let src = i;
  for (let k = moves.length - 1; k >= 0; k--) src = cube.geo.permutation(moves[k])[src];
  return src;
}

/** todos os ciclos de 3 centros, por tipo de centro */
function centerCycles(cube: BigCube): Cycle3[][] {
  if (cube.lazy.centerCycles) return cube.lazy.centerCycles;
  const centers = cube.FACE_CENTERS.flat();
  const fixed = new Set(cube.FIXED_CENTERS);
  const base: Cycle3[][] = cube.CENTER_ORBITS.map(() => []);
  const quarter = (list: string[]) => list.filter((m) => !m.endsWith('2'));
  const inv = invBig;
  const tryComm = (x: string, y: string, z: string) => {
    if (axisOf(x) === axisOf(y)) return;
    const raw = [x, y, inv(x), z, x, inv(y), inv(x), inv(z)];
    const moved: number[] = [];
    for (const i of centers) {
      if (traceSources(cube, raw, i) !== i) {
        moved.push(i);
        if (moved.length > 3) return;
      }
    }
    if (moved.length !== 3) return;
    for (const f of fixed) if (traceSources(cube, raw, f) !== f) return;
    const o = cube.centerOrbit[moved[0]];
    if (moved.some((i) => cube.centerOrbit[i] !== o)) return;
    // ordem do ciclo: a peça em p0 vai para onde?
    const dest = (i: number) => moved.find((j) => traceSources(cube, raw, j) === i)!;
    const p0 = moved[0];
    base[o].push({ p: [p0, dest(p0), dest(dest(p0))], moves: simplifyBig(raw) });
  };
  const slices = quarter(cube.SLICES);
  const mids = quarter(cube.MIDS);
  const outer = quarter(cube.OUTER);
  // X fatia (de dentro ou do meio), Y face, Z fatia — ou X fatia, Y fatia, Z face
  for (const x of [...slices, ...mids]) {
    for (const y of outer) for (const z of [...slices, ...mids]) tryComm(x, y, z);
    for (const y of [...slices, ...mids]) for (const z of outer) tryComm(x, y, z);
  }
  cube.lazy.centerCycles = base.map((b) => closeCycles(cube, b));
  return cube.lazy.centerCycles;
}

/** todos os ciclos de 3 pontas (comutador [fatia, Y Z Y'] que só mexe nessas 3 pontas), por tipo */
function wingCycles(cube: BigCube): Cycle3[][] {
  if (cube.lazy.wingCycles) return cube.lazy.wingCycles;
  const base: Cycle3[][] = cube.WING_ORBITS.map(() => []);
  const all = Array.from({ length: cube.N }, (_, i) => i);
  for (const x of cube.SLICES)
    for (const y of cube.OUTER)
      for (const z of cube.OUTER) {
        if (axisOf(y) === axisOf(z) || axisOf(x) === axisOf(y)) continue;
        const raw = simplifyBig([x, y, z, invBig(y), invBig(x), y, invBig(z), invBig(y)]);
        const moved: number[] = [];
        for (const i of all)
          if (traceSources(cube, raw, i) !== i) {
            moved.push(i);
            if (moved.length > 6) break;
          }
        if (moved.length !== 6) continue;
        const w0 = moved.filter(cube.isWingPos);
        if (w0.length !== 3) continue;
        const o = cube.wingOrbit[w0[0]];
        const dest = (i: number) => w0.find((j) => traceSources(cube, raw, j) === i)!;
        base[o].push({ p: [w0[0], dest(w0[0]), dest(dest(w0[0]))], moves: raw });
      }
  cube.lazy.wingCycles = base.map((b) => closeCycles(cube, b));
  return cube.lazy.wingCycles;
}

/** algoritmo de paridade das pontas para cada (tipo de ponta, lugar de aresta) */
function parityFor(cube: BigCube, orbit: number, slot: number): Macro {
  cube.lazy.parity ??= new Map();
  const id = `${orbit}:${slot}`;
  if (!cube.lazy.parity.has(id)) {
    const base = wingParityAlg(cube.WING_LAYER[orbit]).split(' ');
    const [a, b] = cube.SLOTS[slot].wings[orbit];
    for (const map of rotations()) {
      const m = cube.makeMacro(
        base.map((x) => rotateMove(x, map)),
        'alg',
        'Paridade das arestas',
      )!;
      if (m.loc[a] === b && m.loc[b] === a) {
        cube.lazy.parity.set(id, m);
        break;
      }
    }
  }
  return cube.lazy.parity.get(id)!;
}

// ---------------------------------------------------------------------------
// Busca: Dijkstra sobre a posição de UMA peça

interface Edge {
  to: number;
  cost: number;
  macro: () => Macro;
}

function search(sources: number[], isGoal: (pos: number) => boolean, edges: (pos: number) => Edge[], maxCost = 80): Macro[] | null {
  const dist = new Map<number, number>();
  const prev = new Map<number, [number, Edge]>();
  const done = new Set<number>();
  const buckets: number[][] = Array.from({ length: maxCost + 1 }, () => []);
  for (const s of sources) {
    dist.set(s, 0);
    buckets[0].push(s);
  }
  for (let c = 0; c <= maxCost; c++)
    for (const x of buckets[c]) {
      if (done.has(x) || dist.get(x) !== c) continue;
      done.add(x);
      if (isGoal(x)) {
        const path: Macro[] = [];
        for (let z = x; prev.has(z); z = prev.get(z)![0]) path.push(prev.get(z)![1].macro());
        return path.reverse();
      }
      for (const e of edges(x)) {
        const nc = c + e.cost;
        if (nc > maxCost || done.has(e.to)) continue;
        const old = dist.get(e.to);
        if (old !== undefined && old <= nc) continue;
        dist.set(e.to, nc);
        prev.set(e.to, [x, e]);
        buckets[nc].push(e.to);
      }
    }
  return null;
}

/** giros simples (uma camada), como macros */
function turnMacros(cube: BigCube): Macro[] {
  cube.lazy.turns ??= cube.ALL_MOVES.map((m) => cube.makeMacro([m], 'turn', '')!);
  return cube.lazy.turns;
}

// ---------------------------------------------------------------------------
// Passos do tutorial

interface Ctx {
  cube: BigCube;
  s: S;
  steps: SolutionStep[];
}

const SEG_LABELS: Record<string, [string, string]> = {
  Posicionar: ['Posicionar', 'Setup'],
  'Ciclo de 3 centros': ['Ciclo de 3 centros', '3-center cycle'],
  'Ciclo de 3 pontas': ['Ciclo de 3 pontas', '3-wing cycle'],
  'Paridade das arestas': ['Paridade das arestas', 'Edge parity'],
  'Paridade OLL': ['Paridade OLL', 'OLL parity'],
  'Paridade PLL': ['Paridade PLL', 'PLL parity'],
};
const segLabel = (l: string) => (SEG_LABELS[l] ? tr(...SEG_LABELS[l]) : l);

function segmentsOf(path: Macro[]): StepSegment[] {
  const segs: StepSegment[] = [];
  for (const m of path) {
    const last = segs[segs.length - 1];
    const label = m.kind === 'turn' ? 'Posicionar' : m.label;
    if (last && last.label === label && m.kind === 'turn') last.moves.push(...m.moves);
    else segs.push({ label, moves: [...m.moves] });
  }
  for (const s of segs) {
    s.moves = simplifyBig(s.moves);
    s.label = segLabel(s.label);
  }
  return segs.filter((s) => s.moves.length);
}

function push(ctx: Ctx, stageId: string, title: string, description: string, path: Macro[], focus: number[]) {
  const moves = path.flatMap((m) => m.moves);
  if (!moves.length) return;
  ctx.steps.push({ stageId, title, description, segments: segmentsOf(path), focus });
  ctx.s = ctx.cube.applyPerm(ctx.s, ctx.cube.composePerm(moves));
}

// ---------------------------------------------------------------------------
// 1. Centros
const CENTER_ORDER = [3, 0, 2, 1, 5, 4]; // D (branco), U (amarelo), F, R, B, L

function solveCenters(ctx: Ctx) {
  const { cube } = ctx;
  const turns = turnMacros(cube);
  // ciclos que passam por cada posição: [ciclo, lugar da posição no ciclo]
  cube.lazy.byPos ??= (() => {
    const out: [Cycle3, number][][] = [];
    for (const orbit of centerCycles(cube)) for (const c of orbit) c.p.forEach((pos, k) => (out[pos] ??= []).push([c, k]));
    return out;
  })();
  const byPos = cube.lazy.byPos;
  const total = cube.FACE_CENTERS[0].length + (cube.odd ? 1 : 0);
  const done: number[] = [];
  CENTER_ORDER.forEach((f, order) => {
    const stage = order === 0 ? 'c-white' : order === 1 ? 'c-yellow' : 'c-sides';
    for (;;) {
      const s = ctx.s;
      const todo = cube.FACE_CENTERS[f].filter((k) => s[k] !== f);
      if (!todo.length) break;
      const kept = new Uint8Array(cube.N);
      for (const g of done) for (const k of cube.FACE_CENTERS[g]) kept[k] = 1;
      for (const k of cube.FACE_CENTERS[f]) if (s[k] === f) kept[k] = 1;
      const keptList = [...kept.keys()].filter((k) => kept[k]);
      // giros que não tiram nenhum centro pronto da face dele (podem girar a face)
      const okTurns = turns.filter((m) => keptList.every((k) => kept[m.perm[k]] && cube.faceOf(m.perm[k]) === cube.faceOf(k)));
      // ciclos de 3 que só trazem para um centro pronto outro centro pronto da mesma face
      const okFrom = (to: number, from: number) => !kept[to] || (kept[from] && cube.faceOf(from) === cube.faceOf(to));
      const macros = new Map<Cycle3, Macro>();
      const macroOf = (c: Cycle3) => macros.get(c) ?? macros.set(c, cube.makeMacro(c.moves, 'alg', 'Ciclo de 3 centros')!).get(c)!;
      const edges = (pos: number): Edge[] => {
        const out: Edge[] = okTurns.map((m) => ({ to: m.loc[pos], cost: m.moves.length, macro: () => m }));
        for (const [c, k] of byPos[pos] ?? []) {
          const [a, b, d] = c.p;
          if (!okFrom(b, a) || !okFrom(d, b) || !okFrom(a, d)) continue;
          out.push({ to: c.p[(k + 1) % 3], cost: c.moves.length, macro: () => macroOf(c) });
        }
        return out;
      };
      const sources = cube.FACE_CENTERS.flat().filter((k) => s[k] === f && !kept[k]);
      const todoSet = new Set(todo);
      const path = search(sources, (pos) => todoSet.has(pos), edges);
      if (!path) throw new Error('não achei como montar o centro');
      const after = cube.applyPerm(s, cube.composePerm(path.flatMap((m) => m.moves)));
      const ready = cube.FACE_CENTERS[f].filter((k) => after[k] === f).length + (cube.odd ? 1 : 0);
      push(
        ctx,
        stage,
        tr(`Centro ${cname(f)}: ${ready} de ${total}`, `${cap(cname(f))} center: ${ready} of ${total}`),
        order === 0
          ? cube.odd
            ? tr(`Leve adesivos ${cname(f)} para o centro ${cname(f)}, em volta do adesivo fixo do meio.`, `Bring ${cname(f)} stickers to the ${cname(f)} center, around the fixed middle sticker.`)
            : tr(
                `Junte os adesivos ${cname(f)} no centro da face de baixo. Neste cubo nenhum centro é fixo: a cor de cada face é decidida aqui.`,
                `Gather the ${cname(f)} stickers in the center of the bottom face. On this cube no center is fixed: this is where each face’s color is decided.`,
              )
          : order === 1
            ? tr(`Monte o centro ${cname(f)} sem desmanchar o centro branco.`, `Build the ${cname(f)} center without breaking the white center.`)
            : order < 5
              ? tr(`Monte o centro ${cname(f)} sem desmanchar os centros que já estão prontos.`, `Build the ${cname(f)} center without breaking the centers that are already done.`)
              : tr(
                  `Os dois últimos centros (${cname(5)} e ${cname(4)}) se montam juntos, trocando peças entre eles.`,
                  `The last two centers (${cname(5)} and ${cname(4)}) are built together, swapping pieces between them.`,
                ),
        path,
        [...cube.FACE_CENTERS[f], ...(cube.odd ? [cube.FIXED_CENTERS[f]] : [])],
      );
    }
    done.push(f);
  });
}

// ---------------------------------------------------------------------------
// 2. Arestas

/** cores da ponta numa posição, sem ordem */
const pairAt = (ctx: Ctx, pos: number) => {
  const a = ctx.s[pos], b = ctx.s[ctx.cube.partner(pos)];
  return a < b ? a * 6 + b : b * 6 + a;
};
const pairName = (cols: number[]) => [...cols].sort((x, y) => 'UDFBRL'.indexOf(FACES[x]) - 'UDFBRL'.indexOf(FACES[y])).map(cname).join('-');

function cycleStep(ctx: Ctx, c: Cycle3, title: string, gainText: [string, string], beforeText: [string, string]) {
  const { cube } = ctx;
  const m = cube.makeMacro(c.moves, 'alg', 'Ciclo de 3 pontas')!;
  push(
    ctx,
    'edges',
    title,
    tr(
      `${gainText[0]} Só essas 3 pontas se mexem — os centros e o resto saem do lugar no meio do algoritmo e voltam no fim. ${beforeText[0]}`,
      `${gainText[1]} Only these 3 wings move — the centers and everything else leave their spots during the algorithm and come back at the end. ${beforeText[1]}`,
    ),
    [m],
    c.p.flatMap((x) => [x, cube.partner(x)]),
  );
}

/** cubos pares: junta as pontas de dentro como no 4x4 (sem lugar fixo, só formando pares) */
function pairInner(ctx: Ctx, orbit: number) {
  const { cube } = ctx;
  const cycles = wingCycles(cube)[orbit];
  const paired = (k: number) => {
    const [a, b] = cube.SLOTS[k].wings[orbit];
    return pairAt(ctx, a) === pairAt(ctx, b);
  };
  for (;;) {
    const open = new Set<number>();
    cube.SLOTS.forEach((sl, k) => {
      if (!paired(k)) sl.wings[orbit].forEach((p) => open.add(p));
    });
    if (!open.size) break;
    const pairedBefore = 12 - open.size / 2;
    let best: Cycle3 | null = null, bestScore = 0, bestGain = 0;
    for (const c of cycles) {
      if (!open.has(c.p[0]) || !open.has(c.p[1]) || !open.has(c.p[2])) continue;
      const after = new Map<number, number>([
        [c.p[1], pairAt(ctx, c.p[0])],
        [c.p[2], pairAt(ctx, c.p[1])],
        [c.p[0], pairAt(ctx, c.p[2])],
      ]);
      const at = (p: number) => after.get(p) ?? pairAt(ctx, p);
      let gain = 0;
      for (const k of new Set(c.p.map((p) => cube.slotOf[p]))) {
        const [a, b] = cube.SLOTS[k].wings[orbit];
        if (at(a) === at(b)) gain++;
      }
      if (!gain) continue;
      const score = gain / (c.moves.length + 4);
      if (score > bestScore) {
        best = c;
        bestScore = score;
        bestGain = gain;
      }
    }
    if (!best) throw new Error('não achei como juntar as pontas de dentro');
    const before = ctx.s;
    const m = cube.makeMacro(best.moves, 'alg', '')!;
    const afterS = cube.applyPerm(before, m.perm);
    const formed = [...new Set(best.p.map((p) => cube.slotOf[p]))].filter((k) => {
      const [a, b] = cube.SLOTS[k].wings[orbit];
      const pa = (s: S, p: number) => [s[p], s[cube.partner(p)]].sort().join();
      return pa(afterS, a) === pa(afterS, b);
    });
    const names = formed.map((k) => pairName([afterS[cube.SLOTS[k].wings[orbit][0]], afterS[cube.partner(cube.SLOTS[k].wings[orbit][0])]]));
    cycleStep(
      ctx,
      best,
      bestGain > 1 ? tr(`Pontas de dentro ${names.join(' e ')}`, `${names.join(' and ')} inner wings`) : tr(`Pontas de dentro ${names[0]}`, `${names[0]} inner wings`),
      [
        `Um ciclo de 3 pontas junta ${bestGain > 1 ? 'as duas pontas de dentro de cada uma dessas arestas' : 'as duas pontas de dentro dessa aresta'} no mesmo lugar (como no 4x4).`,
        `A 3-wing cycle brings ${bestGain > 1 ? 'the two inner wings of each of these edges' : 'the two inner wings of this edge'} together (like on a 4x4).`,
      ],
      [`(${pairedBefore} de 12 pares de dentro prontos antes deste passo.)`, `(${pairedBefore} of 12 inner pairs done before this step.)`],
    );
  }
}

/**
 * Pontas com lugar certo: ao lado da referência da aresta (o meio, nos ímpares; o par de dentro,
 * nos pares). Cada ponta (cor do adesivo do grupo 0 = a, do outro = b) vai para o lugar onde a
 * referência mostra a e b, na posição em que o adesivo do grupo 0 fica na face que mostra a.
 */
function wingTargets(ctx: Ctx, orbit: number) {
  const { cube, s } = ctx;
  const out: { at: number; to: number; ca: number; cb: number }[] = [];
  for (const sl of cube.SLOTS)
    for (const at of sl.wings[orbit]) {
      const ca = s[at], cb = s[cube.partner(at)];
      const home = cube.SLOTS.find((t) => {
        const ra = s[t.ref[0]], rb = s[t.ref[1]];
        return (ra === ca && rb === cb) || (ra === cb && rb === ca);
      });
      if (!home) throw new Error('referência da aresta não encontrada');
      const faceShowingA = s[home.ref[0]] === ca ? home.faces[0] : home.faces[1];
      const to = home.wings[orbit].find((p) => cube.faceOf(p) === faceShowingA)!;
      out.push({ at, to, ca, cb });
    }
  return out;
}

function placeWings(ctx: Ctx, orbits: number[]) {
  const { cube } = ctx;
  const all = wingCycles(cube);
  const edgeDone = () =>
    cube.SLOTS.filter((sl) => {
      const cols = (face: number) => new Set(sl.cells.filter((i) => cube.faceOf(i) === face).map((i) => ctx.s[i]));
      return cols(sl.faces[0]).size === 1 && cols(sl.faces[1]).size === 1;
    }).length;
  for (;;) {
    const targets = orbits.map((o) => wingTargets(ctx, o));
    const open = targets.map((t) => t.filter((w) => w.at !== w.to));
    if (open.every((o) => !o.length)) break;
    // sobraram duas pontas trocadas num tipo: a paridade troca as duas pontas de uma aresta
    const two = open.findIndex((o) => o.length === 2);
    if (two >= 0) {
      const orbit = orbits[two];
      const w = open[two][0];
      const slot = cube.slotOf[w.to];
      const m = parityFor(cube, orbit, slot);
      const [a, b] = cube.SLOTS[slot].wings[orbit];
      push(
        ctx,
        'edges',
        tr('Paridade das arestas', 'Edge parity'),
        tr(
          `Sobraram duas pontas trocadas — isso acontece nos cubos grandes e não tem como resolver só com ciclos de 3 peças. Este algoritmo troca as duas pontas da ${cube.WING_LAYER[orbit]}ª camada de uma aresta; os centros se mexem no meio e voltam no fim.`,
          `Two wings are left swapped — this happens on big cubes and can’t be fixed with 3-piece cycles alone. This algorithm swaps the two layer-${cube.WING_LAYER[orbit]} wings of one edge; the centers move along the way and come back at the end.`,
        ),
        [m],
        [a, cube.partner(a), b, cube.partner(b), ...open[two].flatMap((x) => [x.at, cube.partner(x.at)])],
      );
      continue;
    }
    let best: Cycle3 | null = null, bestScore = 0, bestGain = 0, bestOrbit = -1;
    orbits.forEach((orbit, oi) => {
      const targetAt = new Map(targets[oi].map((w) => [w.at, w.to]));
      const openPos = new Set(open[oi].map((w) => w.at));
      for (const c of all[orbit]) {
        if (!openPos.has(c.p[0]) || !openPos.has(c.p[1]) || !openPos.has(c.p[2])) continue;
        const gain = +(targetAt.get(c.p[0]) === c.p[1]) + +(targetAt.get(c.p[1]) === c.p[2]) + +(targetAt.get(c.p[2]) === c.p[0]);
        if (!gain) continue;
        const score = gain / (c.moves.length + 4);
        if (score > bestScore) {
          best = c;
          bestScore = score;
          bestGain = gain;
          bestOrbit = oi;
        }
      }
    });
    if (!best) throw new Error('não achei como montar as arestas');
    const c: Cycle3 = best;
    const t = targets[bestOrbit];
    const placed = c.p.map((pos, k) => ({ w: t.find((x) => x.at === pos)!, next: c.p[(k + 1) % 3] })).filter(({ w, next }) => w.to === next);
    const names = placed.map(({ w }) => `${cname(w.ca)}-${cname(w.cb)}`);
    const before = edgeDone();
    cycleStep(
      ctx,
      c,
      bestGain > 1 ? tr(`Pontas ${names.join(' e ')}`, `${names.join(' and ')} wings`) : tr(`Ponta ${names[0]}`, `${names[0]} wing`),
      cube.odd
        ? [
            `Um ciclo de 3 pontas: ${bestGain > 1 ? 'duas pontas vão' : 'uma ponta vai'} para o lado do meio da ${bestGain > 1 ? 'aresta delas' : 'aresta dela'}.`,
            `A 3-wing cycle: ${bestGain > 1 ? 'two wings go' : 'one wing goes'} next to the middle of ${bestGain > 1 ? 'their edge' : 'its edge'}.`,
          ]
        : [
            `Um ciclo de 3 pontas: ${bestGain > 1 ? 'duas pontas de fora vão' : 'uma ponta de fora vai'} para o lado do par de dentro da ${bestGain > 1 ? 'aresta delas' : 'aresta dela'}.`,
            `A 3-wing cycle: ${bestGain > 1 ? 'two outer wings go' : 'one outer wing goes'} next to the inner pair of ${bestGain > 1 ? 'their edge' : 'its edge'}.`,
          ],
      [`(${before} de 12 arestas completas antes deste passo.)`, `(${before} of 12 edges complete before this step.)`],
    );
  }
}

function solveEdges(ctx: Ctx) {
  const { cube } = ctx;
  const orbits = cube.WING_ORBITS.map((_, k) => k);
  if (cube.odd) return placeWings(ctx, orbits);
  // pares: as pontas de dentro (as do adesivo de referência) primeiro, depois as outras
  const ref = cube.wingOrbit[cube.SLOTS[0].ref[0]] >= 0 ? cube.wingOrbit[cube.SLOTS[0].ref[0]] : cube.wingOrbit[cube.partner(cube.SLOTS[0].ref[0])];
  pairInner(ctx, ref);
  placeWings(
    ctx,
    orbits.filter((o) => o !== ref),
  );
}

// ---------------------------------------------------------------------------
// 3. Paridades (cubos pares)

function permParity(p: number[]): number {
  const seen = new Array(p.length).fill(false);
  let par = 0;
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = p[j]) {
      seen[j] = true;
      len++;
    }
    par ^= (len - 1) & 1;
  }
  return par;
}
const face3 = (i: number) => FACES[(i / 9) | 0];
function parities3(s3: string[]) {
  const edgeOf = (cols: string[]) =>
    EDGE_FACELETS.findIndex((e) => (face3(e[0]) === cols[0] && face3(e[1]) === cols[1]) || (face3(e[0]) === cols[1] && face3(e[1]) === cols[0]));
  let flips = 0;
  const ep = EDGE_FACELETS.map((e) => {
    const cols = e.map((i) => s3[i]);
    const piece = edgeOf(cols);
    if (cols[0] !== face3(EDGE_FACELETS[piece][0])) flips++;
    return piece;
  });
  const cp = CORNER_FACELETS.map((c) => {
    const cols = new Set(c.map((i) => s3[i]));
    return CORNER_FACELETS.findIndex((hh) => hh.every((i) => cols.has(face3(i))));
  });
  return { oll: flips % 2 === 1, pll: permParity(ep) !== permParity(cp) };
}

/** OLL de cubo par: as fatias de dentro giram juntas (a mesma ideia do 4x4) */
export const ollParityAlg = (n: number) =>
  wingParityAlg(0)
    .split(' ')
    .flatMap((m) => (m.startsWith('0') ? innerLayers(n).map((k) => `${k}${m.slice(1)}`) : [m]))
    .join(' ');

function fixParities(ctx: Ctx) {
  const { cube } = ctx;
  const toS3 = () => cube.project3(Array.from(ctx.s, (f) => FACES[f]));
  let p = parities3(toS3());
  const uf = cube.SLOTS[1].cells;
  if (p.oll) {
    push(
      ctx,
      'parity',
      tr('Paridade OLL: uma aresta virada', 'OLL parity: one flipped edge'),
      tr(
        'Sobrou uma aresta "virada sozinha" — isso nunca acontece num 3x3, só nos cubos pares. Este algoritmo vira a <b>aresta da frente de cima</b>; as fatias de dentro giram juntas (como se fossem uma só) e os centros voltam no fim. Depois o resto se resolve como um 3x3.',
        'One edge is "flipped on its own" — that never happens on a 3x3, only on even cubes. This algorithm flips the <b>top front edge</b>; the inner slices turn together (as if they were one) and the centers come back at the end. After that, the rest is solved like a 3x3.',
      ),
      [cube.makeMacro(ollParityAlg(cube.n).split(' '), 'alg', 'Paridade OLL')!],
      [...uf],
    );
    p = parities3(toS3());
  }
  if (p.pll) {
    push(
      ctx,
      'parity',
      tr('Paridade PLL: duas arestas trocadas', 'PLL parity: two swapped edges'),
      tr(
        'Duas arestas estão trocadas de um jeito que um 3x3 não consegue resolver — outra coisa que só acontece nos cubos pares. Este algoritmo troca a <b>aresta da frente de cima</b> com a <b>de trás de cima</b>; as fatias de dentro giram juntas e o resto volta ao lugar.',
        'Two edges are swapped in a way a 3x3 can’t solve — another thing that only happens on even cubes. This algorithm swaps the <b>top front edge</b> with the <b>top back edge</b>; the inner slices turn together and everything else goes back in place.',
      ),
      [cube.makeMacro(pllParityAlg(cube.n).split(' '), 'alg', 'Paridade PLL')!],
      [...uf, ...cube.SLOTS[3].cells],
    );
  }
}

// ---------------------------------------------------------------------------
export const bigStages = (n: number): SolutionStage[] => {
  const cube = getBigCube(n);
  const per = cube.FACE_CENTERS[0].length + (cube.odd ? 1 : 0);
  return [
    { id: 'c-white', name: tr('Centro branco', 'White center'), goal: tr(`Montar os ${per} adesivos do centro da face branca.`, `Build the ${per} stickers of the white face’s center.`) },
    { id: 'c-yellow', name: tr('Centro amarelo', 'Yellow center'), goal: tr('Montar o centro amarelo, do lado oposto ao branco.', 'Build the yellow center, opposite the white one.') },
    { id: 'c-sides', name: tr('Centros laterais', 'Side centers'), goal: tr('Montar os 4 centros dos lados sem desmanchar os que já estão prontos.', 'Build the 4 side centers without breaking the ones already done.') },
    {
      id: 'edges',
      name: tr('Arestas', 'Edges'),
      goal: tr(`Juntar as ${n - 2} peças de cada aresta, formando 12 arestas inteiras.`, `Bring the ${n - 2} pieces of each edge together, forming 12 complete edges.`),
    },
    ...(cube.odd
      ? []
      : [
          {
            id: 'parity',
            name: tr('Paridades', 'Parities'),
            goal: tr('Corrigir as situações que só existem nos cubos pares: uma aresta virada sozinha ou duas arestas trocadas.', 'Fix the cases that only exist on even cubes: one edge flipped on its own or two swapped edges.'),
          },
        ]),
  ];
};

export function solveBig(n: number, state: PuzzleState, method: 'beginner' | 'cfop' = 'beginner'): Solution {
  const cube = getBigCube(n);
  const ctx: Ctx = { cube, s: Uint8Array.from(state, (c) => FACES.indexOf(c)), steps: [] };
  solveCenters(ctx);
  solveEdges(ctx);
  if (!cube.odd) fixParities(ctx);
  // agora é um 3x3: a "camada do meio" do 3x3 são as camadas de dentro, então "r" (face + meio)
  // vira "(n-1)Rw" (tudo menos a face oposta)
  const s3 = cube.project3(Array.from(ctx.s, (f) => FACES[f]));
  const sol3 = method === 'cfop' ? solveCFOP(s3) : solveBeginner(s3);
  const toBig = (m: string) => (/^[rludfb]/.test(m) ? `${n - 1}${m[0].toUpperCase()}w${m.slice(1)}` : m);
  return {
    method: method === 'cfop' ? tr('Redução + CFOP', 'Reduction + CFOP') : tr('Redução (iniciante)', 'Reduction (beginner)'),
    stages: [...bigStages(n), ...sol3.stages.map((sg) => ({ ...sg, id: '3x3-' + sg.id, name: tr(`Como 3x3: ${sg.name}`, `As a 3x3: ${sg.name}`) }))],
    steps: [
      ...ctx.steps,
      ...sol3.steps.map((st) => ({
        ...st,
        stageId: '3x3-' + st.stageId,
        segments: st.segments.map((sg) => ({ ...sg, moves: sg.moves.map(toBig) })),
        focus: [...new Set(st.focus.flatMap(cube.expand3))],
      })),
    ],
  };
}

// ---------------------------------------------------------------------------
// Validação

const name = (k: string) => COLOR_NAME[k] ?? k;
const sameCycle = (a: string[], b: string[]) => [0, 1, 2].some((r) => a.every((c, i) => c === b[(i + r) % 3]));

/**
 * Confere se o cubo pintado pode existir:
 *  - n² adesivos de cada cor
 *  - cada tipo de centro: 4 de cada cor
 *  - cada tipo de ponta: cada uma das 24 aparece uma vez (pontas não viram no lugar)
 *  - cantos (e, nos ímpares, o meio das arestas e os centros fixos): as regras de um 3x3
 */
export function validateBig(n: number, state: PuzzleState): ValidationResult {
  const cube = getBigCube(n);
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };
  const errors: string[] = [];
  for (const f of FACES) {
    const k = state.filter((c) => c === f).length;
    if (k !== n * n) errors.push(msg.colorCount(name(f), k, n * n));
  }
  if (errors.length) return { ok: false, errors };

  const solved = cube.geo.solved();
  cube.CENTER_ORBITS.forEach((orbit) => {
    for (const f of FACES) {
      const k = orbit.filter((i) => state[i] === f).length;
      if (k !== 4)
        errors.push(
          tr(
            `Nos centros, a cor ${name(f)} aparece ${k} ${k === 1 ? 'vez' : 'vezes'} entre as peças de um mesmo tipo (mesma distância das bordas) — cada cor tem 4 peças de cada tipo. Confira os adesivos do miolo das faces.`,
            `In the centers, the color ${name(f)} appears ${k} ${k === 1 ? 'time' : 'times'} among pieces of the same kind (same distance from the edges) — each color has 4 pieces of each kind. Check the stickers in the middle of the faces.`,
          ),
        );
    }
  });
  if (errors.length) return { ok: false, errors: [...new Set(errors)].slice(0, 4) };

  cube.WING_ORBITS.forEach((orbit) => {
    const home = new Set(orbit.map((p) => solved[p] + solved[cube.partner(p)]));
    const seen = new Map<string, number>();
    for (const p of orbit) {
      const w = state[p] + state[cube.partner(p)];
      const text = `${name(state[p])}-${name(state[cube.partner(p)])}`;
      if (!home.has(w)) {
        errors.push(
          home.has(state[cube.partner(p)] + state[p])
            ? tr(
                `Existe uma ponta de aresta ${text} virada ao contrário — essas peças não viram no lugar; confira as cores dela.`,
                `There’s a ${text} edge wing flipped the wrong way — these pieces can’t flip in place; check its colors.`,
              )
            : msg.noEdge(text),
        );
        continue;
      }
      seen.set(w, (seen.get(w) ?? 0) + 1);
    }
    for (const [w, k] of seen)
      if (k > 1)
        errors.push(
          tr(
            `A ponta de aresta ${name(w[0])}-${name(w[1])} aparece ${k} vezes — provavelmente duas cores estão trocadas.`,
            `The ${name(w[0])}-${name(w[1])} edge wing appears ${k} times — two colors are probably swapped.`,
          ),
        );
  });
  if (errors.length) return { ok: false, errors: [...new Set(errors)].slice(0, 4) };

  if (cube.odd) {
    // cantos, meio das arestas e centros fixos formam um 3x3 de verdade
    const r3 = validateCube3(cube.project3(state));
    const flipped = msg.flippedEdge();
    const flippedBig = tr(
      'Uma aresta (adesivo do meio) está invertida — confira as cores das arestas (peças de 2 cores).',
      'An edge (middle sticker) is flipped — check the edge colors (the 2-color pieces).',
    );
    return { ok: r3.ok, errors: r3.errors.map((e) => (e === flipped ? flippedBig : e)) };
  }

  const homeCorners = cube.CORNERS.map((c) => c.map((i) => solved[i]));
  const seenCorner = new Set<number>();
  let twist = 0;
  for (const pos of cube.CORNERS) {
    const cols = pos.map((i) => state[i]);
    const home = homeCorners.findIndex((hc) => sameCycle(hc, cols));
    if (home < 0) {
      const mirrored = homeCorners.some((hc) => [...hc].sort().join() === [...cols].sort().join());
      errors.push(mirrored ? msg.mirrorCorner(cols.map(name).join('-')) : msg.noCorner(cols.map(name).join('-')));
      continue;
    }
    if (seenCorner.has(home)) errors.push(msg.dupCorner(cols.map(name).join('-')));
    seenCorner.add(home);
    twist += cols.findIndex((c) => c === 'U' || c === 'D');
  }
  if (errors.length) return { ok: false, errors };
  if (twist % 3 !== 0) errors.push(msg.twistedCorner());
  return { ok: !errors.length, errors };
}

/** embaralho com faces e fatias de dentro (nos ímpares a fatia do meio fica parada: centros fixos) */
export function scrambleBig(n: number, len: number): string[] {
  const out: string[] = [];
  const axis: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
  const layers = [1, ...innerLayers(n)];
  let lastAxis = -1;
  const used = new Set<string>();
  while (out.length < len) {
    const f = 'URFDLB'[Math.floor(Math.random() * 6)];
    const k = layers[Math.floor(Math.random() * layers.length)];
    const layer = k === 1 ? f : `${k}${f}`;
    if (axis[f] !== lastAxis) used.clear();
    if (used.has(layer)) continue; // não repete a mesma camada no mesmo eixo
    used.add(layer);
    lastAxis = axis[f];
    out.push(layer + SUFFIX[Math.floor(Math.random() * 3)]);
  }
  return out;
}
