import { tr } from '../../core/i18n';
/**
 * Kilominx (só cantos), com o BRANCO embaixo (D) e o CINZA em cima (U).
 *
 * Iniciante:  face branca → 2ª camada → 3ª camada → posicionar os cantos cinzas → girá-los
 *             com "R' D' R D" (como no 3x3).
 * Avançado:   as mesmas camadas planejando 2 cantos de cada vez (o menor número de movimentos
 *             para os dois juntos) e a última face em 2 olhares (orientar e permutar).
 *
 * Sem centros, o puzzle pode terminar em qualquer rotação: fica o branco embaixo e, das 5
 * rotações possíveis em volta dele, a que der a solução mais curta. Para isso, cada adesivo
 * ganha o "rótulo" da face onde a cor dele termina, e a busca trabalha com os rótulos.
 *
 * Técnica (a mesma do Megaminx): cada algoritmo que não mexe no que já está pronto é um passo
 * válido; a busca é sobre a posição de uma peça (60 posições) ou de algumas peças juntas.
 */
import type { PuzzleState, Solution, SolutionStage, SolutionStep, StepSegment } from '../../core/types';
import { megaGeo as geo } from '../megaminx/geometry';
import { KILO_COLOR_NAME } from './colors';
import { CORNERS, FACES, ROTATIONS, STICKERS, faceOf, permutation, readCorners } from './model';

type S = Uint8Array;
const U = 0, D = 11;
const UPPER = [1, 2, 3, 4, 5];
const LOWER = [6, 7, 8, 9, 10];
const ALL = Array.from({ length: STICKERS }, (_, i) => i);

/** cor (chave) que termina em cada face — muda conforme a rotação escolhida */
let FACE_COLOR: string[] = [...FACES];
const cname = (f: number) => KILO_COLOR_NAME[FACE_COLOR[f]];
const pieceName = (stickers: number[]) => stickers.map((i) => cname(faceOf(i))).join(' / ');

const solvedAt = (s: S, i: number) => s[i] === faceOf(i);
const allSolved = (s: S, ids: number[]) => ids.every((i) => solvedAt(s, i));

function composePerm(moves: string[]): Int32Array {
  let c = Int32Array.from(ALL);
  for (const m of moves) {
    const p = permutation(m);
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
  /** nome do algoritmo (em português; traduzido ao mostrar) */
  alg?: string;
  kind: 'turn' | 'alg';
}

function makeMacro(moves: string[], kind: Macro['kind'], alg?: string): Macro {
  const perm = composePerm(moves);
  const loc = new Int32Array(STICKERS);
  for (let i = 0; i < STICKERS; i++) loc[perm[i]] = i;
  return { moves, perm, loc, alg, kind };
}
const fixes = (m: Macro, keep: number[]) => keep.every((k) => m.perm[k] === k);

// ---------------------------------------------------------------------------
// Vistas: para cada canto, (U, R, F) em sentido horário visto de fora, como no canto URF
// do 3x3; D é a face embaixo do canto (vizinha de F e de R).
interface View {
  U: number;
  R: number;
  F: number;
  L: number;
  D: number;
}
const common = (a: number, b: number, not: number) => geo.neighbors[a].find((x) => x !== not && geo.neighbors[b].includes(x))!;
const VIEWS: View[] = CORNERS.flatMap((c) => {
  const [a, b, d] = c.map(faceOf);
  return [
    [a, b, d],
    [b, d, a],
    [d, a, b],
  ].map(([u, r, f]) => ({ U: u, R: r, F: f, L: common(u, f, r), D: common(f, r, u) }));
});
const LL_VIEWS = VIEWS.filter((v) => v.U === U);

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
const AS = [1, -1, 2, -2];
const invTok = (t: string) => (t.endsWith("'") ? t.slice(0, -1) : t + "'");
const sune = (a: number, b: number, c: number) => `R ${pw(a)} R' ${pw(b)} R ${pw(c)} R'`;

const SINGLE_TURNS: Macro[] = FACES.flatMap((f) => ['', "'", '2', "2'"].map((s) => makeMacro([f + s], 'turn')));
const TURNS_U = SINGLE_TURNS.filter((m) => m.moves[0].replace(/[2']/g, '') === 'U');

/** gatilhos de 3 e 4 movimentos entre faces vizinhas: X Y X' e X Y X' Y' em todas as variações */
let triggersCache: Macro[] | null = null;
const TRIGGERS = () =>
  (triggersCache ??= FACES.flatMap((fx, xi) =>
    geo.neighbors[xi].flatMap((yi) =>
      ['', "'", '2', "2'"].flatMap((x) =>
        ['', "'", '2', "2'"].flatMap((a) => {
          const X = fx + x, A = FACES[yi] + a;
          return [makeMacro([X, A, invTok(X)], 'alg', 'Gatilho'), makeMacro([X, A, invTok(X), invTok(A)], 'alg', 'Gatilho')];
        }),
      ),
    ),
  ));

/** algoritmos da última face, em todas as vistas com o cinza em cima, sem repetir efeito */
function llMacros(templates: { name: string; alg: string }[]): Macro[] {
  const seen = new Map<string, Macro>();
  for (const v of LL_VIEWS)
    for (const t of templates) {
      const m = makeMacro(mapAlg(t.alg, v), 'alg', t.name);
      const key = m.perm.join(',');
      const old = seen.get(key);
      if (!old || old.moves.length > m.moves.length) seen.set(key, m);
    }
  return [...seen.values()];
}
let suneCache: Macro[] | null = null;
/** Sune e variações: R U^a R' U^b R U^c R' (giram cantos e trocam alguns) */
const SUNES = () => (suneCache ??= llMacros(AS.flatMap((a) => AS.flatMap((b) => AS.map((c) => ({ name: 'Sune', alg: sune(a, b, c) }))))));
let cycleCache: Macro[] | null = null;
/** ciclos de 3 cantos (comutadores tipo Niklas): [X, U^a Y U^-a] */
const CYCLES = () =>
  (cycleCache ??= llMacros(
    ['R', "R'", 'L', "L'"].flatMap((x) =>
      ['R', "R'", 'L', "L'"].flatMap((y) => (x[0] === y[0] ? [] : AS.map((a) => ({ name: 'Ciclo de cantos', alg: `${x} ${pw(a)} ${y} ${pw(-a)} ${invTok(x)} ${pw(a)} ${invTok(y)} ${pw(-a)}` })))),
    ),
  ));
// ---------------------------------------------------------------------------
/** onde está agora o adesivo `home` (pela cor da peça) */
function whereIs(s: S, home: number): number {
  const piece = CORNERS.find((c) => c.includes(home))!;
  const labels = piece.map(faceOf);
  for (const slot of CORNERS) {
    const cs = slot.map((i) => s[i]);
    if (labels.every((c) => cs.includes(c))) return slot[cs.indexOf(faceOf(home))];
  }
  throw new Error('peça não encontrada');
}
const currentStickers = (s: S, piece: number[]) => CORNERS.find((slot) => slot.includes(whereIs(s, piece[0])))!;

/** busca sobre a posição de UMA peça (Dijkstra pelo número de movimentos) */
function placePiece(s: S, piece: number[], macros: Macro[]): Macro[] | null {
  const ref = piece[0];
  const start = whereIs(s, ref);
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

/**
 * Busca sobre várias peças ao mesmo tempo, minimizando os MOVIMENTOS: Dijkstra com fila em
 * baldes, até um custo máximo. `positions` são os adesivos onde as peças podem estar.
 */
function multiDijkstra(s: S, tracked: number[], positions: number[], macros: Macro[], goal: (p: number[]) => boolean, maxCost: number): Macro[] | null {
  const B = positions.length;
  const k = tracked.length;
  const idxOf = new Int32Array(STICKERS).fill(-1);
  positions.forEach((p, i) => (idxOf[p] = i));
  const cur = tracked.map((h) => whereIs(s, h));
  if (goal(cur)) return [];
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
  const ps = new Array<number>(k);
  for (let c = 0; c <= maxCost; c++) {
    const bucket = buckets[c];
    for (let bi = 0; bi < bucket.length; bi++) {
      const x = bucket[bi];
      if (done[x] || dist[x] !== c) continue;
      done[x] = 1;
      let r = x;
      for (let i = k - 1; i >= 0; i--) {
        digits[i] = r % B;
        r = (r - digits[i]) / B;
        ps[i] = positions[digits[i]];
      }
      if (goal(ps)) {
        const path: Macro[] = [];
        for (let z = x; z !== start; z = prev[z]) path.push(usable[via[z]]);
        return path.reverse();
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

/** busca em largura sobre várias peças: o menor número de ALGORITMOS */
function multiBfs(s: S, tracked: number[], positions: number[], macros: Macro[], goal: (p: number[]) => boolean, maxDepth = 6): Macro[] | null {
  const idx = new Map(positions.map((p, i) => [p, i]));
  const B = positions.length;
  const cur = tracked.map((h) => whereIs(s, h));
  if (goal(cur)) return [];
  const usable = macros.filter((m) => positions.every((p) => idx.has(m.loc[p])));
  const enc = (ps: number[]) => ps.reduce((a, p) => a * B + idx.get(p)!, 0);
  const seen = new Map<number, { prev: number; via: number; depth: number }>();
  const start = enc(cur);
  seen.set(start, { prev: -1, via: -1, depth: 0 });
  let frontier: number[][] = [cur];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: number[][] = [];
    for (const ps of frontier) {
      const x = enc(ps);
      for (let mi = 0; mi < usable.length; mi++) {
        const np = ps.map((p) => usable[mi].loc[p]);
        const y = enc(np);
        if (seen.has(y)) continue;
        seen.set(y, { prev: x, via: mi, depth: depth + 1 });
        if (goal(np)) {
          const path: Macro[] = [];
          for (let z = y; z !== start; z = seen.get(z)!.prev) path.push(usable[seen.get(z)!.via]);
          return path.reverse();
        }
        next.push(np);
      }
    }
    frontier = next;
  }
  return null;
}

// ---------------------------------------------------------------------------
interface Ctx {
  s: S;
  steps: SolutionStep[];
  keep: number[];
}

/** nomes dos algoritmos (guardados em português nos macros; traduzidos ao mostrar) */
const ALG_WORDS: [string, string, string][] = [
  ['Ciclo de cantos', 'Corner cycle', 'Ciclo de esquinas'],
  ['Gatilho', 'Trigger', 'Truco'],
];
const wordsIn = (a: string, k: 1 | 2) => ALG_WORDS.reduce((s, w) => s.split(w[0]).join(w[k]), a);
const algLabel = (a: string) => tr(a, wordsIn(a, 1), wordsIn(a, 2));

/** junta giros livres e repetições do mesmo algoritmo em partes legíveis */
function segmentsOf(path: Macro[]): StepSegment[] {
  const segs: StepSegment[] = [];
  let i = 0;
  while (i < path.length) {
    const m = path[i];
    if (m.kind === 'turn') {
      const moves: string[] = [];
      while (i < path.length && path[i].kind === 'turn') moves.push(...path[i++].moves);
      segs.push({ label: tr('Posicionar', 'Setup', 'Preparación'), moves });
      continue;
    }
    let n = 1;
    while (i + n < path.length && path[i + n] === m) n++;
    segs.push({ label: `${algLabel(m.alg ?? '')}${n > 1 ? ` × ${n}` : ''}`, moves: Array.from({ length: n }, () => m.moves).flat() });
    i += n;
  }
  return segs;
}

function pushStep(ctx: Ctx, stageId: string, title: string, description: string, segments: StepSegment[], focus: number[]) {
  const moves = segments.flatMap((g) => g.moves);
  if (!moves.length) return;
  ctx.steps.push({ stageId, title, description, segments, focus });
  ctx.s = applyPerm(ctx.s, composePerm(moves));
}
const push = (ctx: Ctx, stageId: string, title: string, description: string, path: Macro[], focus: number[]) =>
  pushStep(ctx, stageId, title, description, segmentsOf(path), focus);

const moveCount = (path: Macro[]) => path.reduce((a, m) => a + m.moves.length, 0);
const touches = (piece: number[], f: number) => piece.map(faceOf).includes(f);
const lowerCount = (p: number[]) => p.map(faceOf).filter((f) => LOWER.includes(f)).length;
const upperCount = (p: number[]) => p.map(faceOf).filter((f) => UPPER.includes(f)).length;

/**
 * Pares de gatilhos perto da peça: o primeiro desfaz algo já pronto e o segundo conserta.
 * Só entram os pares que, juntos, preservam tudo o que já está resolvido.
 */
function pairMacros(keep: number[], piece: number[], wide: boolean): Macro[] {
  const near = new Set<number>([U]);
  for (const f of piece.map(faceOf)) {
    near.add(f);
    for (const g of geo.neighbors[f]) if (g !== D) near.add(g);
  }
  if (wide) FACES.forEach((_, f) => f !== D && near.add(f));
  const faceIdx = (mv: string) => FACES.indexOf(mv.replace(/[2']/g, '') as never);
  const T = TRIGGERS().filter((m) => m.moves.every((mv) => near.has(faceIdx(mv))) && !fixes(m, keep));
  const groups = new Map<string, Macro[]>();
  for (const t of T) {
    const sig = keep.filter((k) => t.perm[k] !== k).join(',');
    const g = groups.get(sig);
    if (g) g.push(t);
    else groups.set(sig, [t]);
  }
  const out: Macro[] = [];
  const seen = new Set<string>();
  for (const G of groups.values())
    for (const t1 of G)
      for (const t2 of G) {
        if (!keep.every((k) => t1.perm[t2.perm[k]] === k)) continue;
        const perm = new Int32Array(STICKERS);
        for (let i = 0; i < STICKERS; i++) perm[i] = t1.perm[t2.perm[i]];
        const key = perm.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const loc = new Int32Array(STICKERS);
        for (let i = 0; i < STICKERS; i++) loc[perm[i]] = i;
        out.push({ moves: [...t1.moves, ...t2.moves], perm, loc, alg: 'Gatilho', kind: 'alg' });
      }
  return out;
}

const cornerTitle = (p: number[]) => tr(`Canto ${pieceName(p)}`, `${pieceName(p)} corner`, `Esquina ${pieceName(p)}`);

/** coloca as peças de uma etapa, uma de cada vez, sempre a mais fácil primeiro */
function solvePieces(ctx: Ctx, stageId: string, pieces: number[][], text: (piece: number[]) => string) {
  let remaining = pieces.filter((p) => !allSolved(ctx.s, p));
  ctx.keep.push(...pieces.filter((p) => allSolved(ctx.s, p)).flat());
  while (remaining.length) {
    const allowed = [...SINGLE_TURNS, ...TRIGGERS()].filter((m) => fixes(m, ctx.keep));
    let best = null as { piece: number[]; path: Macro[]; len: number } | null;
    for (const piece of remaining) {
      const path = placePiece(ctx.s, piece, allowed);
      if (!path) continue;
      const len = moveCount(path);
      if (!best || len < best.len) best = { piece, path, len };
    }
    for (const wide of [false, true]) {
      if (best) break;
      for (const piece of remaining) {
        const path = placePiece(ctx.s, piece, [...allowed, ...pairMacros(ctx.keep, piece, wide)]);
        if (!path) continue;
        best = { piece, path, len: moveCount(path) };
        break;
      }
    }
    if (!best) throw new Error(`Não encontrei solução (etapa ${stageId}, faltando ${remaining.length}) — confira se as cores foram pintadas corretamente.`);
    push(ctx, stageId, cornerTitle(best.piece), text(best.piece), best.path, currentStickers(ctx.s, best.piece));
    ctx.keep.push(...best.piece);
    remaining = remaining.filter((p) => p !== best!.piece);
  }
}

/** coloca as peças de 2 em 2: a dupla que sai mais barata, planejada junto */
function solvePairs(ctx: Ctx, stageId: string, pieces: number[][], text: (group: number[][]) => string) {
  let remaining = pieces.filter((p) => !allSolved(ctx.s, p));
  ctx.keep.push(...pieces.filter((p) => allSolved(ctx.s, p)).flat());
  while (remaining.length) {
    const allowed = [...SINGLE_TURNS, ...TRIGGERS()].filter((m) => fixes(m, ctx.keep));
    const single = new Map<number[], Macro[] | null>();
    for (const p of remaining) single.set(p, placePiece(ctx.s, p, allowed));
    let best: { group: number[][]; path: Macro[]; per: number } | null = null;
    for (const [p, path] of single) if (path && (!best || moveCount(path) < best.per)) best = { group: [p], path, per: moveCount(path) };
    const est = (p: number[]) => (single.get(p) ? moveCount(single.get(p)!) : 99);
    if (remaining.length >= 2) {
      const pairs: number[][][] = [];
      for (let i = 0; i < remaining.length; i++) for (let j = i + 1; j < remaining.length; j++) pairs.push([remaining[i], remaining[j]]);
      pairs.sort((a, b) => est(a[0]) + est(a[1]) - est(b[0]) - est(b[1]));
      for (const g of pairs.slice(0, 3)) {
        const near = new Set<number>([U]);
        for (const f of g.flat().map(faceOf)) {
          near.add(f);
          for (const x of geo.neighbors[f]) near.add(x);
        }
        const short = allowed.filter((m) => m.moves.length <= 3 && m.moves.every((mv) => near.has(FACES.indexOf(mv.replace(/[2']/g, '') as never))));
        // só vale a pena se a dupla sair mais barata que as duas peças separadas
        const budget = Math.min(22, est(g[0]) + est(g[1]) - 1);
        if (budget < 1) continue;
        const homes = g.map((p) => p[0]);
        const path = multiDijkstra(ctx.s, homes, ALL, short, (ps) => ps.every((p, i) => p === homes[i]), budget);
        if (!path) continue;
        const per = moveCount(path) / 2;
        if (!best || per < best.per) best = { group: g, path, per };
      }
    }
    for (const wide of [false, true]) {
      if (best) break;
      for (const p of remaining) {
        const path = placePiece(ctx.s, p, [...allowed, ...pairMacros(ctx.keep, p, wide)]);
        if (path) {
          best = { group: [p], path, per: moveCount(path) };
          break;
        }
      }
    }
    if (!best) throw new Error(`Não encontrei solução (etapa ${stageId}, faltando ${remaining.length}) — confira se as cores foram pintadas corretamente.`);
    const g = best.group;
    const title =
      g.length === 2 ? tr(`Cantos ${pieceName(g[0])} e ${pieceName(g[1])}`, `${pieceName(g[0])} and ${pieceName(g[1])} corners`, `Esquinas ${pieceName(g[0])} y ${pieceName(g[1])}`) : cornerTitle(g[0]);
    push(ctx, stageId, title, text(g), best.path, g.flatMap((p) => currentStickers(ctx.s, p)));
    ctx.keep.push(...g.flat());
    remaining = remaining.filter((p) => !g.includes(p));
  }
}

const D_CORNERS = CORNERS.filter((c) => touches(c, D));
const RING2 = CORNERS.filter((c) => lowerCount(c) === 2 && upperCount(c) === 1);
const RING3 = CORNERS.filter((c) => lowerCount(c) === 1 && upperCount(c) === 2);
const U_CORNERS = CORNERS.filter((c) => touches(c, U));
const U_STICKERS = U_CORNERS.flat();
const UFACE = ALL.filter((i) => faceOf(i) === U);
const F2L = ALL.filter((i) => !U_STICKERS.includes(i));
/** adesivo cinza de cada canto da última face */
const HOMES_U = U_CORNERS.map((c) => c.find((i) => faceOf(i) === U)!);
const slotOfU = (p: number) => U_CORNERS.findIndex((c) => c.includes(p));

const texts = {
  dface: (p: number[]) =>
    tr(
      `Encaixe o canto <b>${pieceName(p)}</b> na face de baixo, com o branco para baixo e as outras duas cores do lado dos cantos vizinhos certos.`,
      `Insert the <b>${pieceName(p)}</b> corner into the bottom face, with white facing down and its other two colors next to the right neighboring corners.`,
      `Coloca la esquina <b>${pieceName(p)}</b> en la cara de abajo, con el blanco hacia abajo y sus otros dos colores junto a las esquinas vecinas correctas.`,
    ),
  ring2: (p: number[]) =>
    tr(
      `Encaixe o canto <b>${pieceName(p)}</b> na 2ª camada (entre duas faces de baixo e uma de cima), sem desmanchar a face branca.`,
      `Insert the <b>${pieceName(p)}</b> corner into the 2nd layer (between two lower faces and one upper face) without breaking the white face.`,
      `Coloca la esquina <b>${pieceName(p)}</b> en la 2.ª capa (entre dos caras de abajo y una de arriba) sin deshacer la cara blanca.`,
    ),
  ring3: (p: number[]) =>
    tr(
      `Encaixe o canto <b>${pieceName(p)}</b> na 3ª camada (entre uma face de baixo e duas de cima). Ele desce da face cinza com um gatilho, como no 3x3.`,
      `Insert the <b>${pieceName(p)}</b> corner into the 3rd layer (between one lower face and two upper faces). It comes down from the gray face with a trigger, like on a 3x3.`,
      `Coloca la esquina <b>${pieceName(p)}</b> en la 3.ª capa (entre una cara de abajo y dos de arriba). Baja desde la cara gris con un truco, como en el 3x3.`,
    ),
};
const pairText = (stage: 'dface' | 'ring2' | 'ring3') => (g: number[][]) =>
  g.length === 1
    ? texts[stage](g[0])
    : tr(
        `Planeje os dois cantos juntos: <b>${pieceName(g[0])}</b> e <b>${pieceName(g[1])}</b> vão para o lugar na mesma sequência — gasta menos movimentos que um de cada vez.`,
        `Plan both corners together: <b>${pieceName(g[0])}</b> and <b>${pieceName(g[1])}</b> reach their spots in the same sequence — fewer moves than one at a time.`,
        `Planea las dos esquinas juntas: <b>${pieceName(g[0])}</b> y <b>${pieceName(g[1])}</b> llegan a su sitio en la misma secuencia; son menos movimientos que una a una.`,
      );

/** as peças acompanhadas ficam como `ok` pede depois de algum giro de U (ou nenhum)? */
const auf = (ps: number[], ok: (p: number, i: number) => boolean) =>
  ps.every((p, i) => ok(p, i)) || TURNS_U.some((t) => ps.every((p, i) => ok(t.loc[p], i)));
/** acrescenta ao caminho o giro final de U (se precisar) */
function withAuf(ctx: Ctx, path: Macro[], ok: (p: number, i: number) => boolean) {
  let s = ctx.s;
  for (const m of path) s = applyPerm(s, m.perm);
  const ps = HOMES_U.map((h) => whereIs(s, h));
  if (ps.every((p, i) => ok(p, i))) return;
  const m = TURNS_U.find((t) => ps.every((p, i) => ok(t.loc[p], i)));
  if (m) path.push(m);
}

// ---------------------------------------------------------------------------
// Última face, método de iniciante: posicionar e depois girar com R' D' R D
function lastLayerBeginner(ctx: Ctx) {
  const focus = [...UFACE, ...U_STICKERS];
  const cp = multiBfs(ctx.s, HOMES_U, U_STICKERS, CYCLES().filter((m) => fixes(m, F2L)), (ps) => auf(ps, (q, i) => slotOfU(q) === i), 4);
  if (!cp) throw new Error('Não encontrei solução para os cantos cinzas — confira as cores.');
  withAuf(ctx, cp, (q, i) => slotOfU(q) === i);
  push(
    ctx,
    'upos',
    tr('Posicionar os cantos cinzas', 'Place the gray corners', 'Coloca las esquinas grises'),
    tr(
      'Leve cada canto cinza para o lugar dele (entre as cores certas), mesmo que ainda girado. O ciclo de cantos troca 3 cantos de lugar sem mexer no resto.',
      'Bring each gray corner to its spot (between the right colors), even if it’s still twisted. The corner cycle moves 3 corners around without touching anything else.',
      'Lleva cada esquina gris a su sitio (entre los colores correctos), aunque todavía esté girada. El ciclo de esquinas mueve 3 esquinas sin tocar nada más.',
    ),
    cp,
    focus,
  );

  // girar: canto na frente-direita-cima, "R' D' R D" até o cinza ficar para cima
  const ufr = U_CORNERS.find((c) => [U, 1, 2].every((f) => touches(c, f)))!;
  const view = VIEWS.find((v) => v.U === U && v.F === 1 && v.R === 2)!;
  const X = mapAlg("R' D' R D", view);
  const grayUp = (slot: number[]) => ctx.s[slot.find((i) => faceOf(i) === U)!] === U;
  let turned = 0; // cliques de U já dados (para desfazer no fim)
  const uSlots = U_CORNERS.map((c) => c);
  const total = uSlots.filter((c) => !grayUp(c)).length;
  let done = 0;
  for (let guard = 0; guard < 6; guard++) {
    // o canto torto mais perto da frente-direita (só girando a face de cima)
    let pick: { clicks: number; slot: number[] } | null = null;
    for (const slot of uSlots) {
      if (grayUp(slot)) continue;
      for (const c of [0, 1, -1, 2, -2]) {
        let p = slot.find((i) => faceOf(i) === U)!;
        const mv = c === 0 ? '' : pw(c);
        if (mv) p = makeMacro([mv], 'turn').loc[p];
        if (ufr.includes(p)) {
          if (!pick || Math.abs(c) < Math.abs(pick.clicks)) pick = { clicks: c, slot };
          break;
        }
      }
    }
    if (!pick) break;
    const segs: StepSegment[] = [];
    if (pick.clicks) {
      segs.push({ label: tr('Girar a face de cima', 'Turn the top face', 'Girar la cara de arriba'), moves: [pw(pick.clicks)] });
      turned += pick.clicks;
    }
    // quantas vezes: 2 ou 4
    let s = ctx.s;
    for (const m of segs.flatMap((g) => g.moves)) s = applyPerm(s, permutation(m));
    let reps = 0;
    const xPerm = composePerm(X);
    const ufrGray = ufr.find((i) => faceOf(i) === U)!;
    while (reps < 6) {
      s = applyPerm(s, xPerm);
      reps++;
      if (reps % 2 === 0 && s[ufrGray] === U) break;
    }
    segs.push({ label: `R' D' R D × ${reps}`, moves: Array.from({ length: reps }, () => X).flat() });
    done++;
    const piece = pick.slot.map((i) => ctx.s[i] * 5);
    pushStep(
      ctx,
      'utwist',
      tr(`Girar o canto ${pieceName(piece)}`, `Twist the ${pieceName(piece)} corner`, `Girar la esquina ${pieceName(piece)}`),
      (pick.clicks
        ? tr('Gire só a face de cima até o canto torto ficar na frente-direita. ', 'Turn only the top face until the twisted corner is at the front-right. ', 'Gira solo la cara de arriba hasta que la esquina girada quede adelante a la derecha. ')
        : '') +
        tr(
          `Com ele na frente-direita, repita <b>R' D' R D</b> até o cinza ficar para cima (${reps} vezes).`,
          `With it at the front-right, repeat <b>R' D' R D</b> until gray faces up (${reps} times).`,
          `Con ella adelante a la derecha, repite <b>R' D' R D</b> hasta que el gris quede hacia arriba (${reps} veces).`,
        ) +
        (done === 1
          ? tr(
              ' As camadas de baixo bagunçam no meio do caminho — é normal: elas voltam sozinhas quando o último canto for girado. Entre um canto e outro, gire só a face de cima.',
              ' The lower layers get scrambled along the way — that’s normal: they come back on their own when the last corner is twisted. Between corners, turn only the top face.',
              ' Las capas de abajo se desordenan por el camino; es normal: vuelven solas cuando se gira la última esquina. Entre una esquina y otra, gira solo la cara de arriba.',
            )
          : done === total
            ? tr(' É o último: as camadas de baixo voltam ao lugar.', ' It’s the last one: the lower layers fall back into place.', ' Es la última: las capas de abajo vuelven a su sitio.')
            : ''),
      segs,
      focus,
    );
  }
  const back = (((-turned % 5) + 5) % 5) as 0 | 1 | 2 | 3 | 4;
  if (back) {
    const c = back === 1 ? 1 : back === 2 ? 2 : back === 3 ? -2 : -1;
    pushStep(
      ctx,
      'utwist',
      tr('Alinhar a face de cima', 'Align the top face', 'Alinear la cara de arriba'),
      tr('Por fim, gire a face cinza até tudo combinar.', 'Finally, turn the gray face until everything matches.', 'Por último, gira la cara gris hasta que todo coincida.'),
      [{ label: tr('Girar a face de cima', 'Turn the top face', 'Girar la cara de arriba'), moves: [pw(c)] }],
      focus,
    );
  }
}

// Última face em 2 olhares: orientar (cinza para cima) e depois permutar
/**
 * Tabela da última face: busca em largura sobre TODOS os estados dos 5 cantos cinzas
 * (no máximo 5!·3⁴), a partir dos estados-alvo. Para cada estado guarda o próximo algoritmo
 * rumo ao alvo — achar a solução depois é só seguir a tabela. Os algoritmos entram junto com
 * os inversos (para o caminho de volta existir).
 */
interface LLTable {
  next: Int16Array;
  macros: Macro[];
}
const LL_B = U_STICKERS.length;
const LL_IDX = new Int32Array(STICKERS).fill(-1);
U_STICKERS.forEach((p, i) => (LL_IDX[p] = i));
const llCode = (ps: number[]) => ps.reduce((a, p) => a * LL_B + LL_IDX[p], 0);
const inverseMacro = (m: Macro): Macro => makeMacro([...m.moves].reverse().map(invTok), m.kind, m.alg);

function buildTable(base: Macro[], sources: number[][]): LLTable {
  const seen = new Set<string>();
  const macros: Macro[] = [];
  const inv: number[] = [];
  for (const m of base) {
    const key = m.perm.join(',');
    if (seen.has(key)) continue;
    const im = inverseMacro(m);
    const ikey = im.perm.join(',');
    seen.add(key);
    macros.push(m);
    if (ikey === key) inv.push(macros.length - 1);
    else {
      seen.add(ikey);
      macros.push(im);
      inv.push(macros.length - 1, macros.length - 2);
    }
  }
  const next = new Int16Array(LL_B ** 5).fill(-1);
  const queue: number[][] = [];
  for (const ps of sources) {
    const c = llCode(ps);
    if (next[c] !== -1) continue;
    next[c] = -2; // alvo
    queue.push(ps);
  }
  for (let h = 0; h < queue.length; h++) {
    const ps = queue[h];
    for (let mi = 0; mi < macros.length; mi++) {
      const loc = macros[mi].loc;
      const np = [loc[ps[0]], loc[ps[1]], loc[ps[2]], loc[ps[3]], loc[ps[4]]];
      const y = llCode(np);
      if (next[y] !== -1) continue;
      next[y] = inv[mi]; // de y, o inverso volta para ps (um passo mais perto do alvo)
      queue.push(np);
    }
  }
  return { next, macros };
}

function followTable(ctx: Ctx, t: LLTable): Macro[] {
  let ps = HOMES_U.map((h) => whereIs(ctx.s, h));
  const path: Macro[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const mi = t.next[llCode(ps)];
    if (mi === -2) return path;
    if (mi === -1) throw new Error('Um canto está girado sozinho — confira as cores dos cantos.');
    const m = t.macros[mi];
    path.push(m);
    ps = ps.map((p) => m.loc[p]);
  }
  throw new Error('Não encontrei solução para a última face — confira as cores.');
}

const ALL_PERMS = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => ALL_PERMS([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
let ollTable: LLTable | null = null;
/** orientar: alvo = qualquer estado com o cinza dos 5 cantos para cima */
const OLL_TABLE = () => (ollTable ??= buildTable(SUNES().filter((m) => fixes(m, F2L)), ALL_PERMS(UFACE)));
let pllTable: LLTable | null = null;
/** permutar: alvo = resolvido (a menos de um giro de U, acertado no fim) */
const PLL_TABLE = () =>
  (pllTable ??= buildTable(
    [...SUNES(), ...CYCLES()].filter((m) => fixes(m, F2L)),
    [null, ...TURNS_U].map((t) => HOMES_U.map((h) => (t ? t.loc[h] : h))),
  ));

// Última face em 2 olhares: orientar (cinza para cima) e depois permutar
function lastLayerAdvanced(ctx: Ctx) {
  const focus = [...UFACE, ...U_STICKERS];
  const co = followTable(ctx, OLL_TABLE());
  push(
    ctx,
    'oll',
    tr('Orientar a última face', 'Orient the last face', 'Orientar la última cara'),
    tr(
      'Deixe os 5 cantos com o cinza para cima. O Sune (R U R′ U R U2′ R′ e variações) gira cantos sem mexer nas camadas de baixo.',
      'Get all 5 corners with gray facing up. The Sune (R U R′ U R U2′ R′ and variations) twists corners without touching the lower layers.',
      'Deja las 5 esquinas con el gris hacia arriba. El Sune (R U R′ U R U2′ R′ y variaciones) gira esquinas sin tocar las capas de abajo.',
    ),
    co,
    focus,
  );
  const cp = followTable(ctx, PLL_TABLE());
  withAuf(ctx, cp, (q, i) => q === HOMES_U[i]);
  push(
    ctx,
    'pll',
    tr('Permutar a última face', 'Permute the last face', 'Permutar la última cara'),
    tr(
      'Agora troque os cantos de lugar até todos combinarem com as faces de baixo. Os algoritmos devolvem o cinza para cima no fim.',
      'Now swap the corners around until they all match the lower faces. The algorithms bring gray back up at the end.',
      'Ahora intercambia las esquinas hasta que todas coincidan con las caras de abajo. Los algoritmos dejan el gris hacia arriba al final.',
    ),
    cp,
    focus,
  );
}

export const KILO_STAGES = (): SolutionStage[] => [
  { id: 'dface', name: tr('Face branca', 'White face', 'Cara blanca'), goal: tr('Montar a face branca embaixo com os 5 cantos brancos.', 'Build the white face on the bottom with the 5 white corners.', 'Arma la cara blanca abajo con las 5 esquinas blancas.') },
  { id: 'ring2', name: tr('2ª camada', '2nd layer', '2.ª capa'), goal: tr('Encaixar os 5 cantos entre duas faces de baixo e uma de cima.', 'Insert the 5 corners between two lower faces and one upper face.', 'Coloca las 5 esquinas entre dos caras de abajo y una de arriba.') },
  { id: 'ring3', name: tr('3ª camada', '3rd layer', '3.ª capa'), goal: tr('Encaixar os 5 cantos entre uma face de baixo e duas de cima.', 'Insert the 5 corners between one lower face and two upper faces.', 'Coloca las 5 esquinas entre una cara de abajo y dos de arriba.') },
  { id: 'upos', name: tr('Cantos cinzas no lugar', 'Gray corners in place', 'Esquinas grises en su sitio'), goal: tr('Levar os 5 cantos cinzas para o lugar deles, mesmo girados.', 'Bring the 5 gray corners to their spots, even if twisted.', 'Lleva las 5 esquinas grises a su sitio, aunque estén giradas.') },
  { id: 'utwist', name: tr('Girar os cantos', 'Twist the corners', 'Girar las esquinas'), goal: tr('Girar cada canto cinza com R′ D′ R D até o cinza ficar para cima.', 'Twist each gray corner with R′ D′ R D until gray faces up.', 'Gira cada esquina gris con R′ D′ R D hasta que el gris quede hacia arriba.') },
];
export const KILO_ADV_STAGES = (): SolutionStage[] => [
  { id: 'dface', name: tr('Face branca', 'White face', 'Cara blanca'), goal: tr('Montar a face branca planejando dois cantos de cada vez.', 'Build the white face planning two corners at a time.', 'Arma la cara blanca planeando dos esquinas a la vez.') },
  { id: 'ring2', name: tr('2ª camada', '2nd layer', '2.ª capa'), goal: tr('Encaixar os cantos da 2ª camada, de dois em dois.', 'Insert the 2nd-layer corners, two at a time.', 'Coloca las esquinas de la 2.ª capa, de dos en dos.') },
  { id: 'ring3', name: tr('3ª camada', '3rd layer', '3.ª capa'), goal: tr('Encaixar os cantos da 3ª camada, de dois em dois.', 'Insert the 3rd-layer corners, two at a time.', 'Coloca las esquinas de la 3.ª capa, de dos en dos.') },
  { id: 'oll', name: tr('Orientar', 'Orient', 'Orientar'), goal: tr('Deixar o cinza para cima nos 5 cantos de uma vez.', 'Get gray facing up on all 5 corners at once.', 'Deja el gris hacia arriba en las 5 esquinas de una vez.') },
  { id: 'pll', name: tr('Permutar', 'Permute', 'Permutar'), goal: tr('Trocar os cantos de lugar até tudo combinar.', 'Swap the corners until everything matches.', 'Intercambia las esquinas hasta que todo coincida.') },
];

/** rótulos (face onde a cor termina) para uma rotação */
function labels(state: PuzzleState, rot: (typeof ROTATIONS)[number]): S {
  return Uint8Array.from(state, (c) => rot.face[FACES.indexOf(c as never)]);
}

function solveWith(state: PuzzleState, rot: (typeof ROTATIONS)[number], method: 'beginner' | 'advanced'): SolutionStep[] {
  FACE_COLOR = FACES.map((_, f) => FACES[rot.face.indexOf(f)]);
  const ctx: Ctx = { s: labels(state, rot), steps: [], keep: [] };
  if (method === 'advanced') {
    solvePairs(ctx, 'dface', D_CORNERS, pairText('dface'));
    solvePairs(ctx, 'ring2', RING2, pairText('ring2'));
    solvePairs(ctx, 'ring3', RING3, pairText('ring3'));
    lastLayerAdvanced(ctx);
  } else {
    solvePieces(ctx, 'dface', D_CORNERS, texts.dface);
    solvePieces(ctx, 'ring2', RING2, texts.ring2);
    solvePieces(ctx, 'ring3', RING3, texts.ring3);
    lastLayerBeginner(ctx);
  }
  if (!allSolved(ctx.s, ALL)) throw new Error('O solucionador não terminou o kilominx.');
  return ctx.steps;
}

/** o puzzle já está montado (em qualquer rotação)? */
export function isSolvedKilo(state: PuzzleState): boolean {
  return Array.from({ length: 12 }, (_, f) => state.slice(f * 5, f * 5 + 5)).every((cs) => cs.every((c) => c === cs[0]));
}

export function solveKilominx(state: PuzzleState, method: 'beginner' | 'advanced' = 'beginner'): Solution {
  const r = readCorners(state as string[]);
  if ('error' in r) throw new Error('Há um canto com cores que não existem — confira as cores.');
  const stages = method === 'advanced' ? KILO_ADV_STAGES() : KILO_STAGES();
  const methodName =
    method === 'advanced'
      ? tr('Avançado (2 cantos de cada vez, última face em 2 olhares)', 'Advanced (2 corners at a time, 2-look last face)', 'Avanzado (2 esquinas a la vez, última cara en 2 pasos)')
      : tr('Iniciante (camadas)', 'Beginner (layers)', 'Principiante (capas)');
  if (isSolvedKilo(state)) return { method: methodName, stages, steps: [] };
  // o branco embaixo; das 5 rotações em volta dele, a de solução mais curta. No avançado
  // (mais lento), só as 2 rotações em que a face branca sai mais barata.
  let spins = ROTATIONS.filter((x) => x.face[D] === D);
  if (method === 'advanced') {
    const est = (rot: (typeof ROTATIONS)[number]) => {
      FACE_COLOR = FACES.map((_, f) => FACES[rot.face.indexOf(f)]);
      const ctx: Ctx = { s: labels(state, rot), steps: [], keep: [] };
      try {
        solvePieces(ctx, 'dface', D_CORNERS, texts.dface);
        return ctx.steps.reduce((a, s) => a + s.segments.reduce((b, g) => b + g.moves.length, 0), 0);
      } catch {
        return Infinity;
      }
    };
    spins = spins
      .map((rot) => ({ rot, e: est(rot) }))
      .sort((a, b) => a.e - b.e)
      .slice(0, 2)
      .map((x) => x.rot);
  }
  let best: { steps: SolutionStep[]; colors: string[] } | null = null;
  let err: unknown = null;
  const count = (steps: SolutionStep[]) => steps.reduce((a, s) => a + s.segments.reduce((b, g) => b + g.moves.length, 0), 0);
  for (const rot of spins) {
    try {
      const steps = solveWith(state, rot, method);
      if (!best || count(steps) < count(best.steps)) best = { steps, colors: FACE_COLOR };
    } catch (e) {
      err = e;
    }
  }
  if (!best) throw err instanceof Error ? err : new Error('Não encontrei solução — confira as cores.');
  return { method: methodName, stages, steps: best.steps };
}
