/**
 * Megaminx pelo método de iniciante (camadas), com o BRANCO embaixo (D) e o
 * CINZA em cima (U).
 *
 *  1. Estrela branca          5 arestas de D
 *  2. Cantos brancos          5 cantos de D
 *  3. Segunda camada          5 arestas entre as faces de baixo
 *  4. Terceira camada         5 cantos + 10 arestas entre o anel de baixo e o de cima
 *  5. Quarta camada           5 arestas entre as faces de cima
 *  6. Estrela cinza           orientar as arestas de U
 *  7. Arestas cinzas          posicionar as arestas de U
 *  8. Cantos cinzas           posicionar e girar os cantos de U
 *
 * Técnica: cada algoritmo ("macro") que não mexe no que já está pronto é um passo
 * válido. Para colocar UMA peça, basta buscar sobre a posição dela (60 posições),
 * o que é instantâneo e sempre acha o caminho mais curto com aqueles algoritmos.
 * Na última face, a busca acompanha várias peças ao mesmo tempo.
 */
import type { PuzzleState, Solution, SolutionStage, SolutionStep, StepSegment } from '../../core/types';
import { FACES, STICKERS, megaGeo as geo } from './geometry';
import { MEGA_COLOR_NAME } from './colors';

type S = Uint8Array;
const U = 0, D = 11;
const UPPER = [1, 2, 3, 4, 5];
const LOWER = [6, 7, 8, 9, 10];

const faceOf = (i: number) => Math.floor(i / 11);
const toS = (state: PuzzleState): S => Uint8Array.from(state, (c) => FACES.indexOf(c as never));
const solvedAt = (s: S, i: number) => s[i] === faceOf(i);
const allSolved = (s: S, ids: number[]) => ids.every((i) => solvedAt(s, i));
const ALL = Array.from({ length: STICKERS }, (_, i) => i);
const cname = (f: number) => MEGA_COLOR_NAME[FACES[f]];
const pieceName = (stickers: number[]) => stickers.map((i) => cname(faceOf(i))).join('-');

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

interface Macro {
  moves: string[];
  perm: Int32Array;
  loc: Int32Array; // loc[origem] = destino
  /** rótulo do algoritmo (notação relativa) e faces usadas */
  alg?: string;
  view?: { U: number; R: number; F: number };
  kind: 'turn' | 'alg';
}

function makeMacro(moves: string[], kind: Macro['kind'], alg?: string, view?: Macro['view']): Macro {
  const perm = composePerm(moves);
  const loc = new Int32Array(STICKERS);
  for (let i = 0; i < STICKERS; i++) loc[perm[i]] = i;
  return { moves, perm, loc, alg, view, kind };
}

const fixes = (m: Macro, keep: number[]) => keep.every((k) => m.perm[k] === k);

// ---------------------------------------------------------------------------
// Vistas: para cada vértice, (U, R, F) em sentido horário visto de fora, como no
// canto URF do 3x3. L e D completam a vista para os algoritmos que precisam.
interface View {
  U: number;
  R: number;
  F: number;
  L: number;
  D: number;
}
const common = (a: number, b: number, not: number) => geo.neighbors[a].find((x) => x !== not && geo.neighbors[b].includes(x))!;
const VIEWS: View[] = geo.corners.flatMap((c) => {
  const [a, b, d] = c.map(faceOf);
  return [
    [a, b, d],
    [b, d, a],
    [d, a, b],
  ].map(([u, r, f]) => ({ U: u, R: r, F: f, L: common(u, f, r), D: common(f, r, u) }));
});

/** "R U2' R'" com a vista → movimentos absolutos */
function mapAlg(alg: string, v: View): string[] {
  return alg
    .split(' ')
    .filter(Boolean)
    .map((t) => {
      const m = /^([URFLD])(2?)('?)$/.exec(t)!;
      return FACES[v[m[1] as keyof View]] + m[2] + m[3];
    });
}
const pw = (a: number) => (a === 1 ? 'U' : a === -1 ? "U'" : a === 2 ? 'U2' : "U2'");

const F2L_TEMPLATES = ["R U R' U'", "R' U' R U", "U R U' R' U' F' U F", "U' L' U L U F U' F'", "R U R'", "R U' R'", "F' U' F", "F' U F"];

function llTemplates(): { name: string; alg: string }[] {
  const out: { name: string; alg: string }[] = [
    { name: 'Estrela', alg: "F R U R' U' F'" },
    { name: 'Estrela', alg: "F U R U' R' F'" },
  ];
  const as = [1, -1, 2, -2];
  for (const a of as) for (const b of as) for (const c of as) out.push({ name: 'Sune', alg: `R ${pw(a)} R' ${pw(b)} R ${pw(c)} R'` });
  // comutadores de cantos (tipo Niklas): [X, U^a Y U^-a]
  const inv = (t: string) => (t.endsWith("'") ? t[0] : t + "'");
  for (const x of ['R', "R'", 'L', "L'"])
    for (const y of ['R', "R'", 'L', "L'"]) {
      if (x[0] === y[0]) continue;
      for (const a of as) out.push({ name: 'Ciclo de cantos', alg: `${x} ${pw(a)} ${y} ${pw(-a)} ${inv(x)} ${pw(a)} ${inv(y)} ${pw(-a)}` });
    }
  // Sune seguido de um Sune inverso (com ajuste no meio): permutações curtas de cantos
  const sune = (a: number, b: number, c: number) => `R ${pw(a)} R' ${pw(b)} R ${pw(c)} R'`;
  const suneInv = (a: number, b: number, c: number) => `R ${pw(-c)} R' ${pw(-b)} R ${pw(-a)} R'`;
  for (const a of as)
    for (const b of as)
      for (const c of as)
        for (const d of [0, ...as])
          for (const [x, y, z] of [[a, b, c], [-a, b, c], [a, -b, c], [a, b, -c]])
            out.push({ name: 'Sune + Sune inverso', alg: `${sune(a, b, c)}${d ? ' ' + pw(d) : ''} ${suneInv(x, y, z)}` });
  // pares de giro de canto: X^k U^a X^-k U^-a, com X = R' D' R D
  const X = "R' D' R D", Xi = "D' R' D R";
  for (let k = 1; k <= 5; k++)
    for (const a of as)
      out.push({ name: 'Girar cantos', alg: [...Array(k).fill(X), pw(a), ...Array(k).fill(Xi), pw(-a)].join(' ') });
  return out;
}

const SINGLE_TURNS: Macro[] = FACES.flatMap((f) => ['', "'", '2', "2'"].map((s) => makeMacro([f + s], 'turn')));
const CLICKS = ['', "'", '2', "2'"];
const invTok = (t: string) => (t.endsWith("'") ? t.slice(0, -1) : t + "'");
/** gatilhos de 3 e 4 movimentos entre faces vizinhas: X Y X' e X Y X' Y' em todas as variações */
let triggersCache: Macro[] | null = null;
const TRIGGERS = () =>
  (triggersCache ??= FACES.flatMap((fx, xi) =>
    geo.neighbors[xi].flatMap((yi) =>
      CLICKS.flatMap((x) =>
        CLICKS.flatMap((a) => {
          const X = fx + x, A = FACES[yi] + a;
          return [
            makeMacro([X, A, invTok(X)], 'alg', `Gatilho ${X} ${A} ${invTok(X)}`),
            makeMacro([X, A, invTok(X), invTok(A)], 'alg', `Gatilho ${X} ${A} ${invTok(X)} ${invTok(A)}`),
          ];
        }),
      ),
    ),
  ));
const F2L_POOL = () => [...F2L_MACROS, ...TRIGGERS()];
const F2L_MACROS: Macro[] = VIEWS.flatMap((v) => F2L_TEMPLATES.map((t) => makeMacro(mapAlg(t, v), 'alg', t, v)));
const LL_VIEWS = VIEWS.filter((v) => v.U === U);
let llMacrosCache: Macro[] | null = null;
const LL_MACROS = () =>
  (llMacrosCache ??= LL_VIEWS.flatMap((v) => llTemplates().map((t) => makeMacro(mapAlg(t.alg, v), 'alg', `${t.name}: ${t.alg}`, v))));

// ---------------------------------------------------------------------------
// Busca sobre a posição de UMA peça (Dijkstra pelo número de movimentos)
function placePiece(s: S, piece: number[], macros: Macro[]): Macro[] | null {
  const ref = piece[0];
  const colors = piece.map(faceOf);
  const pool = piece.length === 3 ? geo.corners : geo.edges;
  let start = -1;
  for (const slot of pool) {
    const cs = slot.map((i) => s[i]);
    if (colors.every((c) => cs.includes(c))) start = slot[cs.indexOf(faceOf(ref))];
  }
  if (start < 0) throw new Error('peça não encontrada');
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
      const v = m.loc[u];
      const nd = dist[u] + m.moves.length;
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

// Busca sobre várias peças ao mesmo tempo (última face)
function multiBfs(s: S, tracked: number[], positions: number[], macros: Macro[], goal: (p: number[]) => boolean, maxDepth = Infinity): Macro[] | null {
  const idx = new Map(positions.map((p, i) => [p, i]));
  const B = positions.length;
  const k = tracked.length;
  // posição atual de cada adesivo acompanhado (pela cor da peça)
  const cur = tracked.map((home) => {
    const piece = (geo.corners.find((c) => c.includes(home)) ?? geo.edges.find((e) => e.includes(home)))!;
    const colors = piece.map(faceOf);
    const pool = piece.length === 3 ? geo.corners : geo.edges;
    for (const slot of pool) {
      const cs = slot.map((i) => s[i]);
      if (colors.every((c) => cs.includes(c))) return slot[cs.indexOf(faceOf(home))];
    }
    throw new Error('peça não encontrada');
  });
  const enc = (ps: number[]) => ps.reduce((a, p) => a * B + idx.get(p)!, 0);
  const dec = (x: number) => {
    const out = new Array<number>(k);
    for (let i = k - 1; i >= 0; i--) {
      out[i] = positions[x % B];
      x = Math.floor(x / B);
    }
    return out;
  };
  if (goal(cur)) return [];
  const usable = macros.filter((m) => positions.every((p) => idx.has(m.loc[p])));
  const size = B ** k;
  const prev = new Int32Array(size).fill(-1);
  const via = new Int16Array(size);
  const queue = new Int32Array(size);
  const depth = new Uint8Array(size);
  const start = enc(cur);
  prev[start] = start;
  let head = 0, tail = 0;
  queue[tail++] = start;
  while (head < tail) {
    const x = queue[head++];
    if (depth[x] >= maxDepth) continue;
    const ps = dec(x);
    for (let mi = 0; mi < usable.length; mi++) {
      const m = usable[mi];
      const np = ps.map((p) => m.loc[p]);
      const y = enc(np);
      if (prev[y] !== -1) continue;
      prev[y] = x;
      via[y] = mi;
      depth[y] = depth[x] + 1;
      if (goal(np)) {
        const path: Macro[] = [];
        for (let z = y; z !== start; z = prev[z]) path.push(usable[via[z]]);
        return path.reverse();
      }
      queue[tail++] = y;
    }
  }
  return null;
}

/**
 * Igual ao multiBfs, mas minimiza o número de MOVIMENTOS (não de algoritmos):
 * Dijkstra com fila em baldes, até um custo máximo.
 */
function multiDijkstra(s: S, tracked: number[], positions: number[], macros: Macro[], goal: (p: number[]) => boolean, maxCost: number): Macro[] | null {
  const B = positions.length;
  const k = tracked.length;
  const idxOf = new Int32Array(STICKERS).fill(-1);
  positions.forEach((p, i) => (idxOf[p] = i));
  const cur = tracked.map((home) => {
    const piece = (geo.corners.find((c) => c.includes(home)) ?? geo.edges.find((e) => e.includes(home)))!;
    const colors = piece.map(faceOf);
    const pool = piece.length === 3 ? geo.corners : geo.edges;
    for (const slot of pool) {
      const cs = slot.map((i) => s[i]);
      if (colors.every((c) => cs.includes(c))) return slot[cs.indexOf(faceOf(home))];
    }
    throw new Error('peça não encontrada');
  });
  if (goal(cur)) return [];
  // tabela: para cada macro, índice de destino de cada posição
  const usable: Macro[] = [];
  const maps: Int32Array[] = [];
  for (const m of macros) {
    const t = new Int32Array(B);
    let ok = true;
    for (let i = 0; i < B; i++) {
      const d = idxOf[m.loc[positions[i]]];
      if (d < 0) {
        ok = false;
        break;
      }
      t[i] = d;
    }
    if (ok) {
      usable.push(m);
      maps.push(t);
    }
  }
  const goalIdx = tracked.map((h) => idxOf[h]);
  let goalCode = 0;
  for (let i = 0; i < k; i++) goalCode = goalCode * B + goalIdx[i];
  const size = B ** k;
  const dist = new Int16Array(size).fill(-1);
  const prev = new Int32Array(size).fill(-1);
  const via = new Int16Array(size);
  const done = new Uint8Array(size);
  const buckets: number[][] = Array.from({ length: maxCost + 1 }, () => []);
  let start = 0;
  for (let i = 0; i < k; i++) start = start * B + idxOf[cur[i]];
  dist[start] = 0;
  buckets[0].push(start);
  const digits = new Int32Array(k);
  for (let c = 0; c <= maxCost; c++) {
    const bucket = buckets[c];
    for (let bi = 0; bi < bucket.length; bi++) {
      const x = bucket[bi];
      if (done[x] || dist[x] !== c) continue;
      done[x] = 1;
      if (x === goalCode) {
        const path: Macro[] = [];
        for (let z = x; z !== start; z = prev[z]) path.push(usable[via[z]]);
        return path.reverse();
      }
      let r = x;
      for (let i = k - 1; i >= 0; i--) {
        digits[i] = r % B;
        r = (r - digits[i]) / B;
      }
      for (let mi = 0; mi < usable.length; mi++) {
        const nc = c + usable[mi].moves.length;
        if (nc > maxCost) continue;
        const t = maps[mi];
        let y = 0;
        for (let i = 0; i < k; i++) y = y * B + t[digits[i]];
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

// ---------------------------------------------------------------------------
interface Ctx {
  s: S;
  steps: SolutionStep[];
  keep: number[];
}

function viewText(v?: Macro['view']) {
  if (!v) return '';
  return `frente ${cname(v.F)} · direita ${cname(v.R)} · cima ${cname(v.U)}`;
}

/** Junta giros livres e repetições do mesmo algoritmo em partes legíveis. */
function segmentsOf(path: Macro[]): StepSegment[] {
  const segs: StepSegment[] = [];
  let i = 0;
  while (i < path.length) {
    const m = path[i];
    if (m.kind === 'turn') {
      const moves: string[] = [];
      while (i < path.length && path[i].kind === 'turn') moves.push(...path[i++].moves);
      segs.push({ label: 'Posicionar', moves });
      continue;
    }
    let n = 1;
    while (i + n < path.length && path[i + n] === m) n++;
    segs.push({
      label: `${m.alg}${n > 1 ? ` × ${n}` : ''}${m.view ? ` (${viewText(m.view)})` : ''}`,
      moves: Array.from({ length: n }, () => m.moves).flat(),
    });
    i += n;
  }
  return segs;
}

function push(ctx: Ctx, stageId: string, title: string, description: string, path: Macro[], focus: number[]) {
  const moves = path.flatMap((m) => m.moves);
  if (!moves.length) return;
  ctx.steps.push({ stageId, title, description, segments: segmentsOf(path), focus });
  ctx.s = applyPerm(ctx.s, composePerm(moves));
}

function currentStickers(s: S, piece: number[]) {
  const colors = piece.map(faceOf);
  const pool = piece.length === 3 ? geo.corners : geo.edges;
  return pool.find((slot) => colors.every((c) => slot.map((i) => s[i]).includes(c)))!;
}

/**
 * Pares de gatilhos perto da peça: o primeiro desfaz algo já pronto e o segundo
 * conserta (como o "U R U' R' U' F' U F" do 3x3, que são dois gatilhos seguidos).
 * Só entram os pares que, juntos, preservam tudo o que já está resolvido.
 */
function pairMacros(keep: number[], piece: number[], wide = false): Macro[] {
  const near = new Set<number>([U]);
  for (const f of piece.map(faceOf)) {
    near.add(f);
    for (const g of geo.neighbors[f]) if (g !== D) near.add(g);
  }
  // modo amplo: qualquer face menos a branca (que já está pronta)
  if (wide) FACES.forEach((_, f) => f !== D && near.add(f));
  const keepSet = keep;
  const faceIdx = (mv: string) => FACES.indexOf(mv.replace(/[2']/g, '') as never);
  const T = TRIGGERS().filter((m) => m.moves.every((mv) => near.has(faceIdx(mv))) && !fixes(m, keepSet));
  const out: Macro[] = [];
  const seen = new Set<string>();
  // Para o par preservar o que está pronto, os dois gatilhos precisam mexer
  // exatamente no MESMO conjunto de adesivos prontos: agrupa por esse conjunto.
  const groups = new Map<string, Macro[]>();
  for (const t of T) {
    const sig = keepSet.filter((k) => t.perm[k] !== k).join(',');
    const g = groups.get(sig);
    if (g) g.push(t);
    else groups.set(sig, [t]);
  }
  for (const G of groups.values())
  for (const t1 of G)
    for (const t2 of G) {
      let ok = true;
      for (const k of keepSet)
        if (t1.perm[t2.perm[k]] !== k) {
          ok = false;
          break;
        }
      if (!ok) continue;
      // composição direta das permutações (sem refazer movimento por movimento)
      const perm = new Int32Array(STICKERS);
      for (let i = 0; i < STICKERS; i++) perm[i] = t1.perm[t2.perm[i]];
      const key = perm.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const loc = new Int32Array(STICKERS);
      for (let i = 0; i < STICKERS; i++) loc[perm[i]] = i;
      out.push({ moves: [...t1.moves, ...t2.moves], perm, loc, alg: `${t1.alg!.replace('Gatilho ', '')} + ${t2.alg!.replace('Gatilho ', '')}`, kind: 'alg' });
    }
  return out;
}

/** Coloca as peças de uma etapa, sempre a mais fácil primeiro. */
function solvePieces(ctx: Ctx, stageId: string, pieces: number[][], pool: Macro[], text: (piece: number[], path: Macro[]) => string) {
  let remaining = pieces.filter((p) => !allSolved(ctx.s, p));
  ctx.keep.push(...pieces.filter((p) => allSolved(ctx.s, p)).flat());
  while (remaining.length) {
    const allowed = [...SINGLE_TURNS, ...pool].filter((m) => fixes(m, ctx.keep));
    let best = null as { piece: number[]; path: Macro[]; len: number } | null;
    for (const piece of remaining) {
      const path = placePiece(ctx.s, piece, allowed);
      if (!path) continue;
      const len = path.reduce((a, m) => a + m.moves.length, 0);
      if (!best || len < best.len) best = { piece, path, len };
    }
    // nenhuma peça entra só com gatilhos simples: tenta pares de gatilhos
    for (const wide of [false, true]) {
      if (best) break;
      for (const piece of remaining) {
        const path = placePiece(ctx.s, piece, [...allowed, ...pairMacros(ctx.keep, piece, wide)]);
        if (!path) continue;
        best = { piece, path, len: path.reduce((a, m) => a + m.moves.length, 0) };
        break; // basta uma
      }
    }
    if (!best) throw new Error(`Não encontrei solução (etapa ${stageId}, faltando ${remaining.length}) — confira se as cores foram pintadas corretamente.`);
    const kind = best.piece.length === 3 ? 'Canto' : 'Aresta';
    push(ctx, stageId, `${kind} ${pieceName(best.piece)}`, text(best.piece, best.path), best.path, currentStickers(ctx.s, best.piece));
    ctx.keep.push(...best.piece);
    remaining = remaining.filter((p) => p !== best!.piece);
  }
}

const has = (piece: number[], faces: number[]) => piece.map(faceOf).every((f) => faces.includes(f));
const touches = (piece: number[], f: number) => piece.map(faceOf).includes(f);

const algHint = (path: Macro[]) =>
  path.some((m) => m.kind === 'alg' && m.view)
    ? ' Nos algoritmos, as letras são relativas: segure com as faces indicadas em “frente”, “direita” e “cima” — os movimentos absolutos estão logo abaixo.'
    : '';

function solveF2L(ctx: Ctx) {
  const edgesD = geo.edges.filter((e) => touches(e, D));
  solvePieces(ctx, 'star', edgesD, F2L_POOL(), (p, path) =>
    `Leve a aresta <b>${pieceName(p)}</b> para a face branca, com o branco para baixo e a outra cor combinando com o centro vizinho.` + algHint(path),
  );
  const cornersD = geo.corners.filter((c) => touches(c, D));
  solvePieces(ctx, 'dcorners', cornersD, F2L_POOL(), (p, path) =>
    `Encaixe o canto <b>${pieceName(p)}</b> na face branca. Deixe-o acima do lugar dele e repita o gatilho até ele entrar com o branco para baixo.` + algHint(path),
  );
  const edges2 = geo.edges.filter((e) => has(e, LOWER));
  solvePieces(ctx, 'layer2', edges2, F2L_POOL(), (p, path) =>
    `Encaixe a aresta <b>${pieceName(p)}</b> entre as duas faces de baixo dessas cores, como na segunda camada do 3x3.` + algHint(path),
  );
  const lowerCount = (p: number[]) => p.map(faceOf).filter((f) => LOWER.includes(f)).length;
  const upperCount = (p: number[]) => p.map(faceOf).filter((f) => UPPER.includes(f)).length;
  const c3 = geo.corners.filter((c) => lowerCount(c) === 2 && upperCount(c) === 1);
  const e3 = geo.edges.filter((e) => lowerCount(e) === 1 && upperCount(e) === 1);
  // arestas antes dos cantos: com os cantos prontos, as arestas entre eles ficam sem caminho
  for (const layer3 of [e3, c3])
  solvePieces(ctx, 'layer3', layer3, F2L_POOL(), (p, path) =>
    (p.length === 3
      ? `Encaixe o canto <b>${pieceName(p)}</b> na terceira camada (entre duas faces de baixo e uma de cima).`
      : `Encaixe a aresta <b>${pieceName(p)}</b> na terceira camada (entre uma face de baixo e uma de cima).`) + algHint(path),
  );
  const layer4 = [
    ...geo.corners.filter((c) => lowerCount(c) === 1 && upperCount(c) === 2),
    ...geo.edges.filter((e) => upperCount(e) === 2),
  ];
  solvePieces(ctx, 'layer4', layer4, F2L_POOL(), (p, path) =>
    (p.length === 3
      ? `Encaixe o canto <b>${pieceName(p)}</b> na quarta camada (entre uma face de baixo e duas de cima).`
      : `Encaixe a aresta <b>${pieceName(p)}</b> entre as duas faces de cima dessas cores.`) + algHint(path),
  );
}

function solveLastLayer(ctx: Ctx) {
  const uEdges = geo.edges.filter((e) => touches(e, U));
  const uCorners = geo.corners.filter((c) => touches(c, U));
  const uEdgeStickers = uEdges.flat();
  const uCornerStickers = uCorners.flat();
  const UFACE = ALL.filter((i) => faceOf(i) === U);
  const turnsU = SINGLE_TURNS.filter((m) => m.moves[0].replace(/[2']/g, '') === 'U');
  const F2L = ALL.filter((i) => !uEdgeStickers.includes(i) && !uCornerStickers.includes(i) && faceOf(i) !== U);
  const ll = LL_MACROS();
  const llFocus = () => [...UFACE, ...uEdgeStickers, ...uCornerStickers];

  const describeSeq = (_path: Macro[], intro: string) =>
    intro +
    ' Gire a face cinza (U) quando indicado e aplique os algoritmos com as faces de “frente/direita/cima” mostradas em cada parte.';

  // 6. estrela cinza: arestas com o cinza para cima
  const homesU = uEdges.map((e) => e.find((i) => faceOf(i) === U)!);
  const eo = multiBfs(
    ctx.s,
    homesU,
    uEdgeStickers,
    [...turnsU, ...ll.filter((m) => m.alg!.startsWith('Estrela') && fixes(m, F2L))],
    (ps) => ps.every((p) => faceOf(p) === U),
  );
  if (!eo) throw new Error('Não encontrei solução para a estrela cinza — confira as cores (uma aresta pode estar invertida).');
  push(ctx, 'ustar', 'Estrela cinza', describeSeq(eo, 'Deixe as 5 arestas da última face com o cinza virado para cima, formando uma estrela.'), eo, llFocus());

  // 7. arestas cinzas no lugar
  const ep = multiBfs(ctx.s, homesU, uEdgeStickers, [...turnsU, ...ll.filter((m) => fixes(m, F2L))], (ps) => ps.every((p, i) => p === homesU[i]));
  if (!ep) throw new Error('Não encontrei solução para as arestas cinzas — confira as cores.');
  push(ctx, 'uedges', 'Posicionar as arestas cinzas', describeSeq(ep, 'Agora coloque cada aresta cinza ao lado do centro da sua outra cor.'), ep, llFocus());

  // 8. cantos cinzas: primeiro o lugar, depois o giro
  const keepE = [...F2L, ...uEdgeStickers, ...UFACE.filter((i) => i % 11 === 0)];
  const homesC = uCorners.map((c) => c.find((i) => faceOf(i) === U)!);
  const slotOf = (p: number) => uCorners.findIndex((c) => c.includes(p));
  const cMacros = ll.filter((m) => fixes(m, keepE));
  const cp = multiBfs(ctx.s, homesC, uCornerStickers, cMacros, (ps) => ps.every((p, i) => slotOf(p) === i));
  if (!cp) throw new Error('Não encontrei solução para os cantos cinzas — confira as cores.');
  push(ctx, 'ucorners', 'Posicionar os cantos cinzas', describeSeq(cp, 'Leve cada canto cinza para o lugar dele (entre as cores certas), mesmo que ainda girado.'), cp, llFocus());
  const co = multiBfs(ctx.s, homesC, uCornerStickers, cMacros, (ps) => ps.every((p, i) => p === homesC[i]));
  if (!co) throw new Error('Um canto está girado sozinho — confira as cores dos cantos.');
  push(ctx, 'ucorners', 'Girar os cantos cinzas', describeSeq(co, 'Por fim, gire os cantos para o cinza ficar para cima. Os giros sempre aparecem em pares.'), co, llFocus());
}

export const MEGA_STAGES: SolutionStage[] = [
  { id: 'star', name: 'Estrela branca', goal: 'Montar uma estrela com as 5 arestas brancas na face de baixo.' },
  { id: 'dcorners', name: 'Face branca', goal: 'Completar a face branca com os 5 cantos.' },
  { id: 'layer2', name: '2ª camada', goal: 'Encaixar as 5 arestas entre as faces de baixo.' },
  { id: 'layer3', name: '3ª camada', goal: 'Encaixar os 5 cantos e as 10 arestas entre o anel de baixo e o de cima.' },
  { id: 'layer4', name: '4ª camada', goal: 'Encaixar os 5 cantos e as 5 arestas entre as faces de cima.' },
  { id: 'ustar', name: 'Estrela cinza', goal: 'Orientar as arestas da última face.' },
  { id: 'uedges', name: 'Arestas cinzas', goal: 'Colocar as arestas da última face no lugar.' },
  { id: 'ucorners', name: 'Cantos cinzas', goal: 'Colocar e girar os cantos da última face.' },
];

export function solveMegaminx(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [], keep: ALL.filter((i) => i % 11 === 0) };
  solveF2L(ctx);
  solveLastLayer(ctx);
  if (!allSolved(ctx.s, ALL)) throw new Error('O solucionador não terminou o megaminx.');
  return { method: 'Método de iniciante (camadas)', stages: MEGA_STAGES, steps: ctx.steps };
}


// ===========================================================================
// MÉTODO AVANÇADO (estilo Balint/Westlund): peças em PARES, como no F2L do CFOP
// ===========================================================================

/** faces perto de um grupo de peças (para restringir a busca e ficar rápida) */
function nearFaces(pieces: number[][]): Set<number> {
  const near = new Set<number>([U]);
  for (const f of pieces.flat().map(faceOf)) {
    near.add(f);
    for (const g of geo.neighbors[f]) if (g !== D) near.add(g);
  }
  return near;
}
const faceIdxOf = (mv: string) => FACES.indexOf(mv.replace(/[2']/g, '') as never);
const usesOnly = (m: Macro, near: Set<number>) => m.moves.every((mv) => near.has(faceIdxOf(mv)));

const positionsFor = (pieces: number[][]) => [...new Set(pieces.flatMap((p) => (p.length === 3 ? geo.corners.flat() : geo.edges.flat())))];

/** coloca 2 peças juntas (busca sobre as posições das duas ao mesmo tempo) */
function placeGroup(s: S, group: number[][], macros: Macro[], maxCost: number): Macro[] | null {
  const homes = group.map((p) => p[0]);
  return multiDijkstra(s, homes, positionsFor(group), macros, (ps) => ps.every((p, i) => p === homes[i]), maxCost);
}

const moveCount = (path: Macro[]) => path.reduce((a, m) => a + m.moves.length, 0);

interface GroupOpts {
  /** pares candidatos entre as peças que faltam */
  pairs: (remaining: number[][]) => number[][][];
  /** gatilhos permitidos (além dos giros simples) */
  pool: () => Macro[];
  /** quantos pares avaliar por rodada (os mais promissores) */
  tryPairs: number;
  /** custo máximo (movimentos) da busca de um par */
  maxCost: number;
  title: (group: number[][]) => string;
  text: (group: number[][], path: Macro[]) => string;
}

/** Resolve uma etapa juntando peças em pares sempre que isso economiza movimentos. */
function solveGroups(ctx: Ctx, stageId: string, pieces: number[][], o: GroupOpts) {
  let remaining = pieces.filter((p) => !allSolved(ctx.s, p));
  ctx.keep.push(...pieces.filter((p) => allSolved(ctx.s, p)).flat());
  while (remaining.length) {
    const allowed = [...SINGLE_TURNS, ...o.pool()].filter((m) => fixes(m, ctx.keep));
    // custo de cada peça sozinha (rápido) — também serve para estimar os pares
    const single = new Map<number[], Macro[] | null>();
    for (const p of remaining) single.set(p, placePiece(ctx.s, p, allowed));
    let best: { group: number[][]; path: Macro[]; perPiece: number } | null = null;
    for (const [p, path] of single)
      if (path && (!best || moveCount(path) < best.perPiece)) best = { group: [p], path, perPiece: moveCount(path) };
    const est = (g: number[][]) => g.reduce((a, p) => a + (single.get(p) ? moveCount(single.get(p)!) : 99), 0);
    const pairs = o
      .pairs(remaining)
      .sort((a, b) => est(a) - est(b))
      .slice(0, o.tryPairs);
    for (const g of pairs) {
      const near = nearFaces(g);
      // só vale a pena se o par sair mais barato que as duas peças separadas
      const budget = Math.min(o.maxCost, Math.max(1, est(g) - 1));
      // nos pares, só giros simples e gatilhos de 3 movimentos (X Y X'): o miolo do F2L.
      // (com o conjunto completo saem mais pares, mas o total de movimentos piora)
      const path = placeGroup(ctx.s, g, allowed.filter((m) => m.moves.length <= 3 && usesOnly(m, near)), budget);
      if (!path) continue;
      const per = moveCount(path) / 2;
      if (!best || per < best.perPiece) best = { group: g, path, perPiece: per };
    }
    // ninguém entra: pares de gatilhos para uma peça (como no método de iniciante)
    for (const wide of [false, true]) {
      if (best) break;
      for (const p of remaining) {
        const path = placePiece(ctx.s, p, [...allowed, ...pairMacros(ctx.keep, p, wide)]);
        if (path) {
          best = { group: [p], path, perPiece: moveCount(path) };
          break;
        }
      }
    }
    if (!best) throw new Error(`Não encontrei solução (etapa ${stageId}, faltando ${remaining.length}) — confira se as cores foram pintadas corretamente.`);
    const g = best.group;
    push(ctx, stageId, o.title(g), o.text(g, best.path), best.path, g.flatMap((p) => currentStickers(ctx.s, p)));
    ctx.keep.push(...g.flat());
    remaining = remaining.filter((p) => !g.includes(p));
  }
}

const adjacent = (c: number[], e: number[]) => e.map(faceOf).every((f) => c.map(faceOf).includes(f));
const pairsOf = (rem: number[][], ok: (a: number[], b: number[]) => boolean) => {
  const out: number[][][] = [];
  for (let i = 0; i < rem.length; i++) for (let j = i + 1; j < rem.length; j++) if (ok(rem[i], rem[j])) out.push([rem[i], rem[j]]);
  return out;
};
const groupName = (g: number[][]) =>
  g.length === 1 ? `${g[0].length === 3 ? 'Canto' : 'Aresta'} ${pieceName(g[0])}` : `Par ${pieceName(g.find((p) => p.length === 3) ?? g[0])} + ${pieceName(g.find((p) => p.length === 2 && p !== g[0]) ?? g[1])}`;

function solveAdvancedF2L(ctx: Ctx) {
  const lowerCount = (p: number[]) => p.map(faceOf).filter((f) => LOWER.includes(f)).length;
  const upperCount = (p: number[]) => p.map(faceOf).filter((f) => UPPER.includes(f)).length;

  // 1. estrela: duas arestas de cada vez
  solveGroups(ctx, 'star', geo.edges.filter((e) => touches(e, D)), {
    pairs: (rem) => pairsOf(rem, () => true),
    pool: () => [],
    tryPairs: 10,
    maxCost: 16,
    title: (g) => (g.length === 2 ? `Arestas ${pieceName(g[0])} e ${pieceName(g[1])}` : groupName(g)),
    text: (g, path) =>
      (g.length === 2
        ? `Planeje as duas arestas juntas: <b>${pieceName(g[0])}</b> e <b>${pieceName(g[1])}</b> descem para a face branca na mesma sequência.`
        : `Leve a aresta <b>${pieceName(g[0])}</b> para a face branca.`) + algHint(path),
  });

  // 2. F2L: canto branco + aresta da 2ª camada que fica em cima dele
  const dCorners = geo.corners.filter((c) => touches(c, D));
  const e2 = geo.edges.filter((e) => has(e, LOWER));
  solveGroups(ctx, 'f2l', [...dCorners, ...e2], {
    pairs: (rem) => pairsOf(rem, (a, b) => (a.length === 3 && b.length === 2 && adjacent(a, b)) || (b.length === 3 && a.length === 2 && adjacent(b, a))),
    pool: () => TRIGGERS(),
    tryPairs: 5,
    maxCost: 24,
    title: groupName,
    text: (g, path) =>
      (g.length === 2
        ? `Junte o canto <b>${pieceName(g.find((p) => p.length === 3)!)}</b> com a aresta <b>${pieceName(g.find((p) => p.length === 2)!)}</b> e encaixe os dois de uma vez, como um par do F2L no 3x3.`
        : `Encaixe a peça <b>${pieceName(g[0])}</b> sozinha.`) + algHint(path),
  });

  const snapshot = { s: ctx.s, steps: ctx.steps.length, keep: ctx.keep.length };
  try {
    s2lBlocks(ctx, lowerCount, upperCount);
  } catch {
    ctx.s = snapshot.s;
    ctx.steps.length = snapshot.steps;
    ctx.keep.length = snapshot.keep;
    s2lSafe(ctx, lowerCount, upperCount);
  }
}

type Counter = (p: number[]) => number;

/** S2L na ordem que nunca trava: arestas da 3ª faixa, cantos da 3ª faixa, depois a 4ª faixa */
function s2lSafe(ctx: Ctx, lowerCount: Counter, upperCount: Counter) {
  const e3 = geo.edges.filter((e) => lowerCount(e) === 1 && upperCount(e) === 1);
  const c3 = geo.corners.filter((c) => lowerCount(c) === 2 && upperCount(c) === 1);
  const edgePairs = (rem: number[][]) => pairsOf(rem, (a, b) => a.map(faceOf).some((f) => b.map(faceOf).includes(f)));
  const opts = (pairs: GroupOpts['pairs']): GroupOpts => ({
    pairs,
    pool: () => TRIGGERS(),
    tryPairs: 2,
    maxCost: 24,
    title: (g) => (g.length === 2 && g.every((p) => p.length === 2) ? `Arestas ${pieceName(g[0])} e ${pieceName(g[1])}` : groupName(g)),
    text: (g, path) => (g.length === 2 ? `Encaixe <b>${pieceName(g[0])}</b> e <b>${pieceName(g[1])}</b> na mesma sequência.` : `Encaixe a peça <b>${pieceName(g[0])}</b> nas camadas do meio.`) + algHint(path),
  });
  solveGroups(ctx, 's2l', e3, opts(edgePairs));
  solveGroups(ctx, 's2l', c3, opts(() => []));
  s2lUpper(ctx, lowerCount, upperCount);
}

function s2lBlocks(ctx: Ctx, lowerCount: Counter, upperCount: Counter) {
  void upperCount;
  // 3. S2L em blocos: cada face de cima tem, na base, 1 canto + 2 arestas.
  //    Completar um bloco por vez mantém a face vizinha livre para as inserções.
  const pairRule = (a: number[], b: number[]) => (a.length === 3 && b.length === 2 && adjacent(a, b)) || (b.length === 3 && a.length === 2 && adjacent(b, a)) || (a.length === 2 && b.length === 2);
  const blocks = UPPER.map((um) => [
    ...geo.corners.filter((c) => lowerCount(c) === 2 && touches(c, um)),
    ...geo.edges.filter((e) => lowerCount(e) === 1 && touches(e, um)),
  ]);
  // começa pelo bloco mais barato e segue em volta do anel
  const blockCost = (b: number[][]) => b.reduce((a, p) => a + (placePiece(ctx.s, p, [...SINGLE_TURNS, ...TRIGGERS()].filter((m) => fixes(m, ctx.keep)))?.length ?? 9), 0);
  const first = blocks.map((b, i) => [blockCost(b), i]).sort((a, b) => a[0] - b[0])[0][1];
  for (let k = 0; k < 5; k++) {
    const block = blocks[(first + k) % 5];
    solveGroups(ctx, 's2l', block, {
      pairs: (rem) => pairsOf(rem, pairRule),
      pool: () => TRIGGERS(),
      tryPairs: 2,
      maxCost: 24,
      title: (g) => (g.length === 2 && g.every((p) => p.length === 2) ? `Arestas ${pieceName(g[0])} e ${pieceName(g[1])}` : groupName(g)),
      text: (g, path) =>
        (g.length === 2
          ? `Encaixe <b>${pieceName(g[0])}</b> e <b>${pieceName(g[1])}</b> juntos no bloco abaixo da face <b>${cname(faceOf(g[0].find((i) => UPPER.includes(faceOf(i))) ?? g[0][0]))}</b>.`
          : `Complete o bloco com a peça <b>${pieceName(g[0])}</b>.`) + algHint(path),
    });
  }
  s2lUpper(ctx, lowerCount, upperCount);
}

function s2lUpper(ctx: Ctx, lowerCount: Counter, upperCount: Counter) {
  const mid4 = [...geo.corners.filter((c) => lowerCount(c) === 1 && upperCount(c) === 2), ...geo.edges.filter((e) => upperCount(e) === 2)];
  solveGroups(ctx, 's2l', mid4, {
    pairs: (rem) => pairsOf(rem, (a, b) => (a.length === 3 && b.length === 2 && adjacent(a, b)) || (b.length === 3 && a.length === 2 && adjacent(b, a))),
    pool: () => TRIGGERS(),
    tryPairs: 2,
    maxCost: 24,
    title: groupName,
    text: (g, path) =>
      (g.length === 2
        ? `Junte o canto <b>${pieceName(g.find((p) => p.length === 3)!)}</b> com a aresta <b>${pieceName(g.find((p) => p.length === 2)!)}</b> e encaixe o par logo abaixo da face cinza.`
        : `Encaixe a peça <b>${pieceName(g[0])}</b> logo abaixo da face cinza.`) + algHint(path),
  });
}

function solveAdvancedLastLayer(ctx: Ctx) {
  const uEdges = geo.edges.filter((e) => touches(e, U));
  const uCorners = geo.corners.filter((c) => touches(c, U));
  const uEdgeStickers = uEdges.flat();
  const uCornerStickers = uCorners.flat();
  const UFACE = ALL.filter((i) => faceOf(i) === U);
  const turnsU = SINGLE_TURNS.filter((m) => m.moves[0].replace(/[2']/g, '') === 'U');
  const F2L = ALL.filter((i) => !uEdgeStickers.includes(i) && !uCornerStickers.includes(i) && faceOf(i) !== U);
  const ll = LL_MACROS();
  const focus = [...UFACE, ...uEdgeStickers, ...uCornerStickers];
  const homesU = uEdges.map((e) => e.find((i) => faceOf(i) === U)!);
  const ed = multiBfs(ctx.s, homesU, uEdgeStickers, [...turnsU, ...ll.filter((m) => fixes(m, F2L))], (ps) => ps.every((p, i) => p === homesU[i]));
  if (!ed) throw new Error('Não encontrei solução para as arestas da última face — confira as cores.');
  push(
    ctx,
    'lledges',
    'Última face: arestas',
    'Num olhar só, as 5 arestas cinzas ficam com o cinza para cima e no lugar certo (orientação e posição juntas). Aplique os algoritmos com as faces de “frente/direita/cima” indicadas.',
    ed,
    focus,
  );
  const keepE = [...F2L, ...uEdgeStickers, 0];
  const homesC = uCorners.map((c) => c.find((i) => faceOf(i) === U)!);
  const co = multiBfs(ctx.s, homesC, uCornerStickers, ll.filter((m) => fixes(m, keepE)), (ps) => ps.every((p, i) => p === homesC[i]));
  if (!co) throw new Error('Um canto está girado sozinho — confira as cores dos cantos.');
  push(
    ctx,
    'llcorners',
    'Última face: cantos',
    'No segundo olhar, os 5 cantos cinzas vão para o lugar e já ficam com o cinza para cima. Os algoritmos trocam e giram cantos sem mexer nas arestas.',
    co,
    focus,
  );
}

export const MEGA_ADV_STAGES: SolutionStage[] = [
  { id: 'star', name: 'Estrela', goal: 'Montar a estrela branca planejando duas arestas de cada vez.' },
  { id: 'f2l', name: 'F2L', goal: 'Completar a face branca e a 2ª camada encaixando canto + aresta juntos (5 pares).' },
  { id: 's2l', name: 'S2L', goal: 'Completar as camadas do meio (3ª e 4ª) também em pares canto + aresta.' },
  { id: 'lledges', name: 'Arestas da última face', goal: 'Orientar e posicionar as 5 arestas cinzas de uma vez.' },
  { id: 'llcorners', name: 'Cantos da última face', goal: 'Posicionar e girar os 5 cantos cinzas de uma vez.' },
];

export function solveMegaminxAdvanced(state: PuzzleState): Solution {
  const ctx: Ctx = { s: toS(state), steps: [], keep: ALL.filter((i) => i % 11 === 0) };
  solveAdvancedF2L(ctx);
  solveAdvancedLastLayer(ctx);
  if (!allSolved(ctx.s, ALL)) throw new Error('O solucionador não terminou o megaminx.');
  return { method: 'Avançado (F2L e S2L em pares, última face em 2 olhares)', stages: MEGA_ADV_STAGES, steps: ctx.steps };
}

export { toS as megaToS, faceOf as megaFaceOf };
