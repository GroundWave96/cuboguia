/**
 * Solucionadores do Pyraminx. A referência é a POSIÇÃO dos centros (cada centro
 * fica sempre no seu vértice; eles só giram). Usa os 4 eixos: U, L, R, B (+ pontas).
 *
 * Iniciante: pontas → centros → arestas da base amarela → topo (algoritmos)
 * Ótimo:     pontas → menor sequência possível (IDA* com tabelas)
 */
import type { PuzzleState, Solution, SolutionStage, SolutionStep, StepSegment } from '../../core/types';
import { FACE_KEYS, STICKERS, VERTS, pyraGeo as geo } from './geometry';
import { PYRA_COLOR_NAME } from './colors';

type S = Uint8Array;
const ALL = Array.from({ length: STICKERS }, (_, i) => i);
const faceOf = (i: number) => Math.floor(i / 9);
const toS = (state: PuzzleState): S => Uint8Array.from(state, (c) => FACE_KEYS.indexOf(c as never));
const solvedAt = (s: S, i: number) => s[i] === faceOf(i);
const allSolved = (s: S, ids: number[]) => ids.every((i) => solvedAt(s, i));
const cname = (f: number) => PYRA_COLOR_NAME[FACE_KEYS[f]];
const pieceName = (st: number[]) => st.map((i) => cname(faceOf(i))).join('-');
const [VU, VL, VR, VB] = [0, 1, 2, 3];
const D = FACE_KEYS.indexOf('D');

function composePerm(moves: string[]): Int32Array {
  let c = Int32Array.from(ALL);
  for (const m of moves) {
    const p = geo.permutation(m);
    const n = new Int32Array(STICKERS);
    for (let i = 0; i < STICKERS; i++) n[i] = c[p[i]];
    c = n;
  }
  return c;
}
const applyPerm = (s: S, p: Int32Array): S => {
  const o = new Uint8Array(STICKERS);
  for (let i = 0; i < STICKERS; i++) o[i] = s[p[i]];
  return o;
};

interface Ctx {
  s: S;
  steps: SolutionStep[];
}
function push(ctx: Ctx, stageId: string, title: string, description: string, segments: StepSegment[], focus: number[]) {
  const moves = segments.flatMap((g) => g.moves);
  if (!moves.length) return;
  ctx.steps.push({ stageId, title, description, segments: segments.filter((g) => g.moves.length), focus });
  ctx.s = applyPerm(ctx.s, composePerm(moves));
}

// ---------------------------------------------------------------------------
// 1. Pontas: cada ponta gira até combinar com o centro logo abaixo dela
function solveTips(ctx: Ctx, stageId: string) {
  const segs: StepSegment[] = [];
  for (let v = 0; v < 4; v++) {
    const tip = geo.tips[v], ctr = geo.centers[v];
    const want = (s: S) => tip.every((t) => ctr.some((c) => faceOf(c) === faceOf(t) && s[c] === s[t]));
    for (const mv of ['', VERTS[v].toLowerCase(), VERTS[v].toLowerCase() + "'"]) {
      const s2 = mv ? applyPerm(ctx.s, geo.permutation(mv)) : ctx.s;
      if (want(s2)) {
        if (mv) segs.push({ label: `Ponta ${VERTS[v]}`, moves: [mv] });
        break;
      }
    }
  }
  push(
    ctx,
    stageId,
    'Alinhar as pontas',
    'As pontas são as pecinhas da quina e giram sozinhas. Gire cada ponta (letra minúscula) até as cores dela combinarem com o centro logo abaixo. Depois disso elas acompanham os centros e nunca mais desalinham.',
    segs,
    geo.tips.flat(),
  );
}

// ---------------------------------------------------------------------------
// Busca sobre a posição de uma peça (Dijkstra pelo nº de movimentos)
interface Macro {
  moves: string[];
  perm: Int32Array;
  loc: Int32Array;
  label: string;
}
function makeMacro(moves: string[], label: string): Macro {
  const perm = composePerm(moves);
  const loc = new Int32Array(STICKERS);
  for (let i = 0; i < STICKERS; i++) loc[perm[i]] = i;
  return { moves, perm, loc, label };
}
const fixes = (m: Macro, keep: number[]) => keep.every((k) => m.perm[k] === k);
const BIG = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
const SINGLES = BIG.map((m) => makeMacro([m], 'Posicionar'));
const inv = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : m + "'");
/** gatilhos X Y X' e X Y X' Y' entre as camadas U, L, R e B */
const TRIGGERS = BIG.flatMap((x) =>
  BIG.filter((y) => y[0] !== x[0]).flatMap((y) => [makeMacro([x, y, inv(x)], `Gatilho ${x} ${y} ${inv(x)}`), makeMacro([x, y, inv(x), inv(y)], `Gatilho ${x} ${y} ${inv(x)} ${inv(y)}`)]),
);

/**
 * Pares de gatilhos que, juntos, preservam o que está pronto (o primeiro desfaz
 * algo e o segundo conserta) — como os algoritmos de aresta virada do Pyraminx.
 */
function triggerPairs(keep: number[]): Macro[] {
  const out: Macro[] = [];
  const seen = new Set<string>();
  const bad = TRIGGERS.filter((t) => !fixes(t, keep));
  for (const a of bad)
    for (const b of bad) {
      let ok = true;
      for (const k of keep)
        if (a.perm[b.perm[k]] !== k) {
          ok = false;
          break;
        }
      if (!ok) continue;
      const perm = new Int32Array(STICKERS);
      for (let i = 0; i < STICKERS; i++) perm[i] = a.perm[b.perm[i]];
      const key = perm.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const loc = new Int32Array(STICKERS);
      for (let i = 0; i < STICKERS; i++) loc[perm[i]] = i;
      out.push({ moves: [...a.moves, ...b.moves], perm, loc, label: `${a.label} + ${b.label.replace('Gatilho ', '')}` });
    }
  return out;
}

function locate(s: S, piece: number[]): number {
  const colors = piece.map(faceOf);
  for (const slot of geo.edges) {
    const cs = slot.map((i) => s[i]);
    if (colors.every((c) => cs.includes(c))) return slot[cs.indexOf(faceOf(piece[0]))];
  }
  throw new Error('peça não encontrada');
}

function placeEdge(s: S, piece: number[], macros: Macro[]): Macro[] | null {
  const ref = piece[0];
  const start = locate(s, piece);
  if (start === ref) return [];
  const dist = new Float64Array(STICKERS).fill(Infinity);
  const prev = new Int32Array(STICKERS).fill(-1);
  const via: (Macro | null)[] = new Array(STICKERS).fill(null);
  const done = new Uint8Array(STICKERS);
  dist[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < STICKERS; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) return null;
    if (u === ref) break;
    done[u] = 1;
    for (const m of macros) {
      const v = m.loc[u], nd = dist[u] + m.moves.length;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        via[v] = m;
      }
    }
  }
  const path: Macro[] = [];
  for (let v = ref; v !== start; v = prev[v]) path.push(via[v]!);
  return path.reverse();
}

function segmentsOf(path: Macro[]): StepSegment[] {
  const segs: StepSegment[] = [];
  for (const m of path) {
    const last = segs[segs.length - 1];
    if (m.label === 'Posicionar' && last?.label === 'Posicionar') last.moves.push(...m.moves);
    else segs.push({ label: m.label, moves: [...m.moves] });
  }
  return segs;
}

/** busca sobre várias peças ao mesmo tempo (topo) */
function multiBfs(s: S, homes: number[], positions: number[], macros: Macro[]): Macro[] | null {
  const idx = new Map(positions.map((p, i) => [p, i]));
  const B = positions.length, k = homes.length;
  const cur = homes.map((h) => {
    const piece = [...geo.edges, ...geo.centers].find((p) => p.includes(h))!;
    if (piece.length === 2) return locate(s, piece);
    // centro: o adesivo de referência está na mesma peça, em alguma das 3 posições
    const cs = piece.map((i) => s[i]);
    return piece[cs.indexOf(faceOf(h))];
  });
  const enc = (ps: number[]) => ps.reduce((a, p) => a * B + idx.get(p)!, 0);
  const goal = enc(homes);
  const start = enc(cur);
  if (start === goal) return [];
  const usable = macros.filter((m) => positions.every((p) => idx.has(m.loc[p])));
  const size = B ** k;
  const prev = new Int32Array(size).fill(-1);
  const via = new Int16Array(size);
  const queue = [start];
  prev[start] = start;
  for (let h = 0; h < queue.length; h++) {
    const x = queue[h];
    const ps: number[] = [];
    for (let r = x, i = 0; i < k; i++) {
      ps.unshift(positions[r % B]);
      r = Math.floor(r / B);
    }
    for (let mi = 0; mi < usable.length; mi++) {
      const y = enc(ps.map((p) => usable[mi].loc[p]));
      if (prev[y] !== -1) continue;
      prev[y] = x;
      via[y] = mi;
      if (y === goal) {
        const path: Macro[] = [];
        for (let z = y; z !== start; z = prev[z]) path.push(usable[via[z]]);
        return path.reverse();
      }
      queue.push(y);
    }
  }
  return null;
}

// algoritmos do topo (escritos com L e R na frente), nas 3 vistas em volta de U
const LL_ALGS = [
  { name: 'Ciclo de arestas (direita)', alg: "R U R' U R U R'" },
  { name: 'Ciclo de arestas (esquerda)', alg: "L' U' L U' L' U' L" },
  { name: 'Ciclo de arestas', alg: "R U' R' U' R U' R'" },
  { name: 'Ciclo de arestas', alg: "L' U L U L' U L" },
  { name: 'Virar duas arestas', alg: "R' L R L'" },
  { name: 'Virar duas arestas', alg: "L R' L' R" },
  { name: 'Virar duas arestas', alg: "R U R' U' R U R' U' R U R'" },
];
const ROT: Record<string, string> = { L: 'R', R: 'B', B: 'L', U: 'U' };
const rotAlg = (alg: string, k: number) =>
  alg.split(' ').map((t) => {
    let c = t[0];
    for (let i = 0; i < k; i++) c = ROT[c];
    return c + t.slice(1);
  });

// ---------------------------------------------------------------------------
function solveBeginnerCore(ctx: Ctx) {
  // 2. centros L, R e B com o amarelo para baixo
  const centerSegs: StepSegment[] = [];
  for (const v of [VL, VR, VB]) {
    const ctr = geo.centers[v];
    const dSticker = ctr.find((i) => faceOf(i) === D)!;
    for (const mv of ['', VERTS[v], VERTS[v] + "'"]) {
      const s2 = mv ? applyPerm(ctx.s, geo.permutation(mv)) : ctx.s;
      if (s2[dSticker] === D) {
        if (mv) {
          centerSegs.push({ label: `Centro ${VERTS[v]}`, moves: [mv] });
          ctx.s = s2;
        }
        break;
      }
    }
  }
  if (centerSegs.length) {
    ctx.s = applyPerm(ctx.s, composePerm(centerSegs.flatMap((g) => g.moves).map(inv).reverse()));
    push(
      ctx,
      'centers',
      'Alinhar os centros da base',
      `Os centros são as peças logo abaixo das pontas: eles só giram no lugar. Gire as camadas L, R e B até os três centros de baixo mostrarem <b>${cname(D)}</b> na base.`,
      centerSegs,
      geo.centers.flat(),
    );
  }

  // 3. arestas da base amarela
  const keep = [...geo.centers[VL], ...geo.centers[VR], ...geo.centers[VB], ...geo.tips[VL], ...geo.tips[VR], ...geo.tips[VB]];
  let remaining = geo.edges.filter((e) => e.some((i) => faceOf(i) === D));
  while (remaining.length) {
    const allowed = [...SINGLES, ...TRIGGERS].filter((m) => fixes(m, keep)).concat(triggerPairs(keep));
    let best: { e: number[]; path: Macro[]; len: number } | null = null;
    for (const e of remaining) {
      const path = placeEdge(ctx.s, e, allowed);
      if (!path) continue;
      const len = path.reduce((a, m) => a + m.moves.length, 0);
      if (!best || len < best.len) best = { e, path, len };
    }
    if (!best) throw new Error('Não encontrei solução para a base — confira as cores.');
    const cur = geo.edges.find((slot) => best!.e.map(faceOf).every((c) => slot.map((i) => ctx.s[i]).includes(c)))!;
    push(
      ctx,
      'base',
      `Aresta ${pieceName(best.e)}`,
      `Leve a aresta <b>${pieceName(best.e)}</b> para a base ${cname(D)}, com as cores combinando com os centros. Os gatilhos (como <code>R U R'</code>) colocam a peça sem desmontar o que já está pronto.`,
      segmentsOf(best.path),
      cur,
    );
    keep.push(...best.e);
    remaining = remaining.filter((x) => x !== best!.e);
  }

  // 4. topo: centro U e as 3 arestas de cima
  const topEdges = geo.edges.filter((e) => !e.some((i) => faceOf(i) === D));
  const homes = [geo.centers[VU][0], ...topEdges.map((e) => e[0])];
  const positions = [...geo.centers[VU], ...topEdges.flat()];
  const llMacros = [
    ...['U', "U'"].map((m) => makeMacro([m], 'Ajuste U')),
    ...[0, 1, 2].flatMap((k) => LL_ALGS.map((a) => makeMacro(rotAlg(a.alg, k), `${a.name}: ${rotAlg(a.alg, k).join(' ')}`))),
  ].filter((m) => fixes(m, keep)).concat(triggerPairs(keep));
  const ll = multiBfs(ctx.s, homes, positions, llMacros);
  if (!ll) throw new Error('Não encontrei solução para o topo — confira as cores (uma aresta pode estar invertida).');
  push(
    ctx,
    'top',
    'Terminar o topo',
    'Agora só falta o topo: gire U para alinhar e aplique os algoritmos indicados. Eles trocam ou viram as arestas de cima sem mexer na base.',
    segmentsOf(ll),
    [...geo.centers[VU], ...topEdges.flat()],
  );
}

// ---------------------------------------------------------------------------
// Ótimo: IDA* com U, L, R e B
const EDGE_ST = geo.edges.flat();
const EDGE_IDX = new Int32Array(STICKERS).fill(-1);
EDGE_ST.forEach((p, i) => (EDGE_IDX[p] = i));
const MOVE_LOC = BIG.map((m) => geo.locationMap(m));
const EDGE_REF = geo.edges.map((e) => e[0]);
let edgeTable: Int8Array | null = null;

function edgeCode(locs: number[]) {
  let c = 0;
  for (const l of locs) c = c * 12 + EDGE_IDX[l];
  return c;
}
function getEdgeTable(): Int8Array {
  if (edgeTable) return edgeTable;
  const size = 12 ** 6;
  const dist = new Int8Array(size).fill(-1);
  const start = edgeCode(EDGE_REF);
  dist[start] = 0;
  let frontier = [EDGE_REF];
  for (let d = 0; frontier.length; d++) {
    const next: number[][] = [];
    for (const locs of frontier)
      for (const ml of MOVE_LOC) {
        const nl = locs.map((l) => ml[l]);
        const c = edgeCode(nl);
        if (dist[c] === -1) {
          dist[c] = d + 1;
          next.push(nl);
        }
      }
    frontier = next;
  }
  edgeTable = dist;
  return dist;
}

export function optimalCore(state: S): string[] {
  const T = getEdgeTable();
  const centerRefs = [VU, VL, VR, VB].map((v) => geo.centers[v]);
  const edgeLocs = geo.edges.map((e) => locate(state, e));
  const unsolvedCenters = (s: S) => centerRefs.filter((c) => !allSolved(s, c)).length;
  const path: number[] = [];
  const dfs = (s: S, locs: number[], g: number, bound: number, lastAxis: number): boolean => {
    const e = T[edgeCode(locs)];
    if (e < 0) return false; // configuração impossível de arestas (ex.: uma aresta virada)
    const h = Math.max(unsolvedCenters(s), e);
    if (h === 0) return true;
    if (g + h > bound) return false;
    for (let mi = 0; mi < BIG.length; mi++) {
      const axis = mi >> 1;
      if (axis === lastAxis) continue;
      path.push(mi);
      if (dfs(applyPerm(s, geo.permutation(BIG[mi])), locs.map((l) => MOVE_LOC[mi][l]), g + 1, bound, axis)) return true;
      path.pop();
    }
    return false;
  };
  for (let bound = 0; bound <= 14; bound++) if (dfs(state, edgeLocs, 0, bound, -1)) return path.map((i) => BIG[i]);
  throw new Error('Este pyraminx não tem solução — confira as cores (uma aresta pode estar invertida).');
}

// ---------------------------------------------------------------------------
export const PYRA_BEGINNER_STAGES: SolutionStage[] = [
  { id: 'tips', name: 'Pontas', goal: 'Alinhar as 4 pontas com os centros.' },
  { id: 'centers', name: 'Centros', goal: 'Girar os 3 centros de baixo até o amarelo ficar na base.' },
  { id: 'base', name: 'Base amarela', goal: 'Encaixar as 3 arestas da base.' },
  { id: 'top', name: 'Topo', goal: 'Terminar as 3 arestas de cima.' },
];

/** cada centro precisa estar no seu vértice (o puzzle foi segurado na posição certa) */
export function centersInPlace(s: S) {
  return geo.centers.every((c) => {
    const want = c.map(faceOf).sort().join();
    return [...c].map((i) => s[i]).sort().join() === want;
  });
}
function checkReference(s: S) {
  if (!centersInPlace(s))
    throw new Error('Segure o pyraminx com o centro sem amarelo em cima e o centro sem verde atrás (embaixo).');
}

export function solvePyraBeginner(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  checkReference(ctx.s);
  solveTips(ctx, 'tips');
  solveBeginnerCore(ctx);
  if (!allSolved(ctx.s, ALL)) throw new Error('O solucionador não terminou o pyraminx.');
  return { method: 'Método de iniciante (camadas)', stages: PYRA_BEGINNER_STAGES, steps: ctx.steps };
}

export function solvePyraOptimal(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [] };
  checkReference(ctx.s);
  solveTips(ctx, 'tips');
  const moves = optimalCore(ctx.s);
  const parts: string[][] = [];
  for (let i = 0; i < moves.length; i += 4) parts.push(moves.slice(i, i + 4));
  parts.forEach((mv, i) =>
    push(
      ctx,
      'opt',
      `Parte ${i + 1} de ${parts.length}`,
      (i === 0 ? `Esta é a <b>menor solução possível</b> depois das pontas: <b>${moves.length} movimentos</b> (nunca passa de 11). ` : '') +
        (i === parts.length - 1 ? 'Último trecho!' : 'Faça com calma, sempre segurando o pyraminx na mesma posição.'),
      [{ label: `Movimentos ${i * 4 + 1}–${i * 4 + mv.length}`, moves: mv }],
      [],
    ),
  );
  if (!allSolved(ctx.s, ALL)) throw new Error('A solução ótima não terminou o pyraminx.');
  return {
    method: 'Solução ótima (computador)',
    stages: [
      { id: 'tips', name: 'Pontas', goal: 'Alinhar as 4 pontas com os centros.' },
      { id: 'opt', name: 'Solução ótima', goal: 'Resolver o resto com o menor número possível de movimentos.' },
    ],
    steps: ctx.steps,
  };
}

export { toS as pyraToS };
