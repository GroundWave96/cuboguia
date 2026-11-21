import { tr } from '../../core/i18n';
/**
 * 4x4 pelo método de redução:
 *
 *  1. Centros     os 4 adesivos do centro de cada face (branco embaixo, amarelo em cima,
 *                 depois os lados). Nada é fixo no 4x4: a posição em que você segura o
 *                 cubo decide onde cada cor fica.
 *  2. Arestas     juntar as duas pontas de cada aresta no mesmo lugar (formando 12
 *                 "arestas duplas"), com ciclos de 3 pontas.
 *  3. Paridades   o 4x4 reduzido pode ter uma aresta virada sozinha (paridade OLL) ou
 *                 duas arestas trocadas (paridade PLL) — coisas impossíveis num 3x3.
 *                 Um algoritmo para cada uma.
 *  4. Como 3x3    o resto é a solução do 3x3 (iniciante ou CFOP).
 *
 * Técnica (a mesma do 5x5): macros (giros, gatilhos e comutadores) e, para colocar UMA
 * peça, uma busca pelo caminho mais curto sobre a posição dela usando só macros que não
 * estragam o que já está pronto.
 */
import type { PuzzleState, Solution, SolutionStage, SolutionStep, StepSegment } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { CORNER_FACELETS, EDGE_FACELETS } from '../cube3/pieces';
import { solveBeginner } from '../cube3/solver/beginner';
import { solveCFOP } from '../cube3/solver/cfop';
import { FACES4, FACE_CENTERS, N4, SLOTS, expand3, faceOf4 as faceOf, geo4 as geo, partner, project3, slotOf } from './pieces';

type S = Uint8Array;
const toS = (state: PuzzleState): S => Uint8Array.from(state, (c) => FACES4.indexOf(c));
const fromS = (s: S): PuzzleState => Array.from(s, (f) => FACES4[f]);
const cname = (f: number) => COLOR_NAME[FACES4[f]];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Movimentos e macros
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const OUTER = FACES4.flatMap((f) => [f, f + "'", f + '2']);
/** fatias internas (2ª camada a partir de cada face) */
const SLICES = FACES4.flatMap((f) => ['2' + f, '2' + f + "'", '2' + f + '2']);
const ALL_MOVES = [...OUTER, ...SLICES];
const faceLetter = (m: string) => m.replace(/[^URFDLB]/g, '');
const layerKey = (m: string) => m.replace(/['2]$/, '').replace(/'$/, '');
const amount = (m: string) => (m.endsWith("'") ? 3 : m.endsWith('2') && !/^\d[URFDLB]w?$/.test(m) ? 2 : 1);
const axisOf = (m: string) => AXIS[faceLetter(m)];
const inv = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : amount(m) === 2 ? m : m + "'");

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
  let c = new Int32Array(N4);
  for (let i = 0; i < N4; i++) c[i] = i;
  for (const m of moves) {
    const p = geo.permutation(m);
    const n = new Int32Array(N4);
    for (let i = 0; i < N4; i++) n[i] = c[p[i]];
    c = n;
  }
  return c;
}
const applyPerm = (s: S, p: Int32Array): S => {
  const o = new Uint8Array(N4);
  for (let i = 0; i < N4; i++) o[i] = s[p[i]];
  return o;
};

function makeMacro(raw: string[], kind: Macro['kind'], label: string): Macro | null {
  const moves = simplify(raw);
  if (!moves.length) return null;
  const perm = composePerm(moves);
  const loc = new Int32Array(N4);
  for (let i = 0; i < N4; i++) loc[perm[i]] = i;
  return { moves, perm, loc, label, kind };
}

const isCenterIdx = (i: number) => [5, 6, 9, 10].includes(i % 16);

let libCache: Macro[] | null = null;
/** biblioteca dos centros: giros, gatilhos X Y X' e comutadores que trocam 3 centros */
function library(): Macro[] {
  if (libCache) return libCache;
  const byPerm = new Map<string, Macro>();
  const add = (raw: string[], kind: Macro['kind'], label: string) => {
    const m = makeMacro(raw, kind, label);
    if (!m) return;
    let identity = true;
    for (let i = 0; i < N4; i++)
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
  // comutadores [X Y X', Z] que trocam exatamente 3 centros (podem mexer em arestas,
  // que só são arrumadas depois): X fatia, Y face e Z fatia — ou X fatia, Y fatia e Z face
  const comm3 = (x: string, ys: string[], zs: string[]) => {
    for (const y of ys) {
      if (axisOf(x) === axisOf(y)) continue;
      for (const z of zs) {
        const raw = [x, y, inv(x), z, x, inv(y), inv(x), inv(z)];
        const p = composePerm(raw);
        let moved = 0;
        for (let i = 0; i < N4; i++) if (p[i] !== i && isCenterIdx(i)) moved++;
        if (moved === 3) add(raw, 'alg', 'Comutador de centros');
      }
    }
  };
  for (const x of SLICES) {
    comm3(x, OUTER, SLICES);
    comm3(x, SLICES, OUTER);
  }
  libCache = [...byPerm.values()];
  return libCache;
}

// ---------------------------------------------------------------------------
// Busca: Dijkstra sobre a posição de uma peça
function search(sources: number[], isGoal: (pos: number) => boolean, macros: Macro[], maxCost = 60): Macro[] | null {
  const dist = new Int16Array(N4).fill(-1);
  const prev = new Int32Array(N4).fill(-1);
  const via = new Int32Array(N4).fill(-1);
  const done = new Uint8Array(N4);
  const buckets: number[][] = Array.from({ length: maxCost + 1 }, () => []);
  for (const pos of sources) {
    dist[pos] = 0;
    buckets[0].push(pos);
  }
  for (let c = 0; c <= maxCost; c++) {
    for (const x of buckets[c]) {
      if (done[x] || dist[x] !== c) continue;
      done[x] = 1;
      if (isGoal(x)) {
        const path: Macro[] = [];
        for (let z = x; via[z] >= 0; z = prev[z]) path.push(macros[via[z]]);
        return path.reverse();
      }
      for (let mi = 0; mi < macros.length; mi++) {
        const m = macros[mi];
        const nc = c + m.moves.length;
        if (nc > maxCost) continue;
        const y = m.loc[x];
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

/** macros que não tiram de face nenhum dos centros já prontos (podem trocá-los entre si na mesma face) */
function usable(kept: number[]): Macro[] {
  const keepSet = new Uint8Array(N4);
  for (const k of kept) keepSet[k] = 1;
  return library().filter((m) => {
    for (const k of kept) {
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

/** rótulos dos trechos (guardados em português na biblioteca; traduzidos ao mostrar) */
const SEG_LABELS: Record<string, [string, string, string]> = {
  Posicionar: ['Posicionar', 'Setup', 'Preparar'],
  Gatilho: ['Gatilho', 'Trigger', 'Truco'],
  'Comutador de centros': ['Comutador de centros', 'Center commutator', 'Conmutador de centros'],
  'Ciclo de 3 pontas': ['Ciclo de 3 pontas', '3-wing cycle', 'Ciclo de 3 piezas'],
  'Paridade das arestas': ['Paridade das arestas', 'Edge parity', 'Paridad de aristas'],
  'Paridade OLL': ['Paridade OLL', 'OLL parity', 'Paridad de OLL'],
  'Paridade PLL': ['Paridade PLL', 'PLL parity', 'Paridad de PLL'],
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
    s.moves = simplify(s.moves);
    s.label = segLabel(s.label);
  }
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
      const keptSet = new Set(kept);
      const sources = ALL_CENTER_SLOTS.filter((k) => s[k] === f && !keptSet.has(k));
      const todoSet = new Set(todo);
      const path = search(sources, (pos) => todoSet.has(pos), usable(kept));
      if (!path) throw new Error('não achei como montar o centro');
      const after = applyPerm(s, composePerm(path.flatMap((m) => m.moves)));
      const ready = FACE_CENTERS[f].filter((k) => after[k] === f).length;
      push(
        ctx,
        stage,
        tr(`Centro ${cname(f)}: ${ready} de 4`, `${cap(cname(f))} center: ${ready} of 4`, `Centro ${cname(f)}: ${ready} de 4`),
        order === 0
          ? tr(
              `Junte os 4 adesivos ${cname(f)} no centro da face de baixo. No 4x4 nenhum centro é fixo: a cor de cada face é decidida aqui.`,
              `Gather the 4 ${cname(f)} stickers in the center of the bottom face. On a 4x4 no center is fixed: this is where each face’s color is decided.`, `Junta las 4 pegatinas de color ${cname(f)} en el centro de la cara de abajo. En el 4x4 ningún centro es fijo: aquí se decide el color de cada cara.`,
            )
          : order === 1
            ? tr(`Monte o centro ${cname(f)} em cima, sem desmanchar o centro branco.`, `Build the ${cname(f)} center on top, without breaking the white center.`, `Arma el centro ${cname(f)} arriba, sin romper el centro blanco.`)
            : order < 5
              ? tr(`Monte o centro ${cname(f)} sem desmanchar os centros que já estão prontos.`, `Build the ${cname(f)} center without breaking the centers that are already done.`, `Arma el centro ${cname(f)} sin romper los centros que ya están hechos.`)
              : tr(
                  `Os dois últimos centros (${cname(5)} e ${cname(4)}) se montam juntos, trocando peças entre eles.`,
                  `The last two centers (${cname(5)} and ${cname(4)}) are built together, swapping pieces between them.`, `Los dos últimos centros (${cname(5)} y ${cname(4)}) se arman juntos, intercambiando piezas entre ellos.`,
                ),
        path,
        FACE_CENTERS[f],
      );
    }
    done.push(f);
  });
}

// ---------------------------------------------------------------------------
// 2. Arestas: juntar as duas pontas de cada aresta no mesmo lugar

/**
 * Todos os ciclos de 3 pontas (4048), cada um como um comutador [fatia, Y Z Y'] que só
 * mexe nessas 3 pontas, conjugado por giros de preparação. Guardados pela trinca de
 * posições, na ordem do ciclo: a ponta em p[0] vai para p[1], a de p[1] para p[2]...
 */
interface Cycle3 {
  p: [number, number, number];
  moves: string[];
}
let cyclesCache: Cycle3[] | null = null;
export function wingCycles(): Cycle3[] {
  if (cyclesCache) return cyclesCache;
  const isPos = (i: number) => slotOf[i] >= 0;
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
        for (let i = 0; i < N4; i++) if (perm[i] !== i) moved.push(i);
        if (moved.length !== 6) continue;
        const w0 = moved.filter(isPos);
        if (w0.length !== 3) continue;
        const loc = new Int32Array(N4);
        for (let i = 0; i < N4; i++) loc[perm[i]] = i;
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

/** cores da ponta numa posição, sem ordem (as duas pontas de uma aresta têm o mesmo par) */
const pairAt = (s: S, pos: number) => {
  const a = s[pos], b = s[partner(pos)];
  return a < b ? a * 6 + b : b * 6 + a;
};
const pairName = (s: S, pos: number) => [s[pos], s[partner(pos)]].sort((x, y) => 'UDFBRL'.indexOf(FACES4[x]) - 'UDFBRL'.indexOf(FACES4[y])).map(cname).join('-');
const slotPaired = (s: S, k: number) => pairAt(s, SLOTS[k][0]) === pairAt(s, SLOTS[k][1]);

function pairEdges(ctx: Ctx) {
  const cycles = wingCycles();
  for (;;) {
    const s = ctx.s;
    const open = new Set<number>();
    SLOTS.forEach((sl, k) => {
      if (!slotPaired(s, k)) sl.forEach((p) => open.add(p));
    });
    if (!open.size) break;
    const pairedBefore = 12 - open.size / 2;
    // o ciclo que forma mais arestas por movimento (só mexe em pontas de arestas ainda soltas)
    let best: Cycle3 | null = null, bestScore = 0, bestGain = 0;
    for (const c of cycles) {
      if (!open.has(c.p[0]) || !open.has(c.p[1]) || !open.has(c.p[2])) continue;
      const after = new Map<number, number>([
        [c.p[1], pairAt(s, c.p[0])],
        [c.p[2], pairAt(s, c.p[1])],
        [c.p[0], pairAt(s, c.p[2])],
      ]);
      const at = (p: number) => after.get(p) ?? pairAt(s, p);
      const touched = new Set(c.p.map((p) => slotOf[p]));
      let gain = 0;
      for (const k of touched) if (at(SLOTS[k][0]) === at(SLOTS[k][1])) gain++;
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
    const after = applyPerm(s, m.perm);
    const formed = [...new Set(best.p.map((p) => slotOf[p]))].filter((k) => slotPaired(after, k));
    const names = formed.map((k) => pairName(after, SLOTS[k][0]));
    push(
      ctx,
      'edges',
      bestGain > 1 ? tr(`Arestas ${names.join(' e ')}`, `${names.join(' and ')} edges`, `Aristas ${names.join(' y ')}`) : tr(`Aresta ${names[0]}`, `${names[0]} edge`, `Arista ${names[0]}`),
      tr(
        `Um ciclo de 3 pontas junta ${bestGain > 1 ? 'as duas pontas de cada uma dessas arestas' : 'as duas pontas dessa aresta'} no mesmo lugar. ` +
          `Só essas 3 pontas se mexem — os centros e o resto saem do lugar no meio do algoritmo e voltam no fim. (${pairedBefore} de 12 arestas prontas antes deste passo.)`,
        `A 3-wing cycle brings ${bestGain > 1 ? 'both wings of each of these edges' : 'both wings of this edge'} together. ` +
          `Only these 3 wings move — the centers and everything else leave their spots during the algorithm and come back at the end. (${pairedBefore} of 12 edges done before this step.)`,
        `Un ciclo de 3 piezas junta ${bestGain > 1 ? 'las dos mitades de cada una de estas aristas' : 'las dos mitades de esta arista'} en el mismo lugar. ` +
          `Solo se mueven estas 3 piezas; los centros y todo lo demás salen de su sitio durante el algoritmo y vuelven al final. (${pairedBefore} de 12 aristas hechas antes de este paso.)`,
      ),
      [m],
      best.p.flatMap((x) => [x, partner(x)]),
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Paridades: o 3x3 equivalente precisa ser um 3x3 possível

export const OLL_PARITY = "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2";
export const PLL_PARITY = '2R2 U2 2R2 Uw2 2R2 2U2';

/** paridade de uma permutação (0 = par) */
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

const F3 = ['U', 'R', 'F', 'D', 'L', 'B'];
const face3 = (i: number) => F3[(i / 9) | 0];
/** do 3x3 equivalente: aresta virada sozinha? permutação de arestas e cantos com paridades diferentes? */
export function parities3(s3: string[]) {
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
    return CORNER_FACELETS.findIndex((h) => h.every((i) => cols.has(face3(i))));
  });
  return { oll: flips % 2 === 1, pll: permParity(ep) !== permParity(cp) };
}

function fixParities(ctx: Ctx) {
  let p = parities3(project3(fromS(ctx.s)));
  if (p.oll) {
    const m = makeMacro(OLL_PARITY.split(' '), 'alg', 'Paridade OLL')!;
    const uf = SLOTS[1]; // aresta da frente de cima
    push(
      ctx,
      'parity',
      tr('Paridade OLL: uma aresta virada', 'OLL parity: one flipped edge', 'Paridad de OLL: una arista volteada'),
      tr(
        'Sobrou uma aresta "virada sozinha" — isso nunca acontece num 3x3, só no 4x4. Este algoritmo troca as duas pontas da <b>aresta da frente de cima</b> (vira essa aresta); os centros se mexem no meio e voltam no fim. Depois o resto se resolve como um 3x3.',
        'One edge is "flipped on its own" — that never happens on a 3x3, only on a 4x4. This algorithm swaps the two wings of the <b>top front edge</b> (flipping that edge); the centers move along the way and come back at the end. After that, the rest is solved like a 3x3.', 'Una arista quedó "volteada sola": eso nunca pasa en un 3x3, solo en un 4x4. Este algoritmo intercambia las dos mitades de la <b>arista de arriba al frente</b> (volteando esa arista); los centros se mueven por el camino y vuelven al final. Después, el resto se resuelve como un 3x3.',
      ),
      [m],
      uf.flatMap((x) => [x, partner(x)]),
    );
    p = parities3(project3(fromS(ctx.s)));
  }
  if (p.pll) {
    const m = makeMacro(PLL_PARITY.split(' '), 'alg', 'Paridade PLL')!;
    const [uf, ub] = [SLOTS[1], SLOTS[3]];
    push(
      ctx,
      'parity',
      tr('Paridade PLL: duas arestas trocadas', 'PLL parity: two swapped edges', 'Paridad de PLL: dos aristas intercambiadas'),
      tr(
        'Duas arestas estão trocadas de um jeito que um 3x3 não consegue resolver — outra coisa que só acontece no 4x4. Este algoritmo troca a <b>aresta da frente de cima</b> com a <b>de trás de cima</b>; o resto volta ao lugar.',
        'Two edges are swapped in a way a 3x3 can’t solve — another thing that only happens on a 4x4. This algorithm swaps the <b>top front edge</b> with the <b>top back edge</b>; everything else goes back in place.', 'Dos aristas están intercambiadas de una forma que un 3x3 no resuelve; otra cosa que solo pasa en un 4x4. Este algoritmo intercambia la <b>arista de arriba al frente</b> con la <b>arista de arriba atrás</b>; todo lo demás vuelve a su lugar.',
      ),
      [m],
      [...uf, ...ub].flatMap((x) => [x, partner(x)]),
    );
  }
}

// ---------------------------------------------------------------------------
export const CUBE4_STAGES = (): SolutionStage[] => [
  { id: 'c-white', name: tr('Centro branco', 'White center', 'Centro blanco'), goal: tr('Juntar os 4 adesivos brancos no centro da face de baixo.', 'Gather the 4 white stickers in the center of the bottom face.', 'Junta las 4 pegatinas blancas en el centro de la cara de abajo.') },
  { id: 'c-yellow', name: tr('Centro amarelo', 'Yellow center', 'Centro amarillo'), goal: tr('Montar o centro amarelo em cima, do lado oposto ao branco.', 'Build the yellow center on top, opposite the white one.', 'Arma el centro amarillo arriba, opuesto al blanco.') },
  { id: 'c-sides', name: tr('Centros laterais', 'Side centers', 'Centros de los lados'), goal: tr('Montar os 4 centros dos lados sem desmanchar os que já estão prontos.', 'Build the 4 side centers without breaking the ones already done.', 'Arma los 4 centros de los lados sin romper los que ya están hechos.') },
  { id: 'edges', name: tr('Arestas', 'Edges', 'Aristas'), goal: tr('Juntar as duas pontas de cada aresta no mesmo lugar, formando 12 arestas inteiras.', 'Bring the two wings of each edge together, forming 12 complete edges.', 'Junta las dos mitades de cada arista, formando 12 aristas completas.') },
  { id: 'parity', name: tr('Paridades', 'Parities', 'Paridades'), goal: tr('Corrigir as situações que só existem no 4x4: uma aresta virada sozinha ou duas arestas trocadas.', 'Fix the cases that only exist on a 4x4: one edge flipped on its own or two swapped edges.', 'Corrige los casos que solo existen en el 4x4: una arista volteada sola o dos aristas intercambiadas.') },
];

export function solveCube4(state: PuzzleState, method: 'beginner' | 'cfop' = 'beginner'): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  solveCenters(ctx);
  pairEdges(ctx);
  fixParities(ctx);
  // 4. agora é um 3x3: a "camada do meio" do 3x3 são as 2 camadas de dentro do 4x4,
  // então "r" (face + meio) vira "3Rw" (3 camadas)
  const s3 = project3(fromS(ctx.s));
  const sol3 = method === 'cfop' ? solveCFOP(s3) : solveBeginner(s3);
  const to4move = (m: string) => (/^[rludfb]/.test(m) ? `3${m[0].toUpperCase()}w${m.slice(1)}` : m);
  const steps = [
    ...ctx.steps,
    ...sol3.steps.map((st) => ({
      ...st,
      stageId: '3x3-' + st.stageId,
      segments: st.segments.map((sg) => ({ ...sg, moves: sg.moves.map(to4move) })),
      focus: [...new Set(st.focus.flatMap(expand3))],
    })),
  ];
  return {
    method: method === 'cfop' ? tr('Redução + CFOP', 'Reduction + CFOP', 'Reducción + CFOP') : tr('Redução (iniciante)', 'Reduction (beginner)', 'Reducción (principiante)'),
    stages: [...CUBE4_STAGES(), ...sol3.stages.map((sg) => ({ ...sg, id: '3x3-' + sg.id, name: tr(`Como 3x3: ${sg.name}`, `As a 3x3: ${sg.name}`, `Como un 3x3: ${sg.name}`) }))],
    steps,
  };
}
