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
function multiBfs(s: S, tracked: number[], positions: number[], macros: Macro[], goal: (p: number[]) => boolean): Macro[] | null {
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
  const start = enc(cur);
  prev[start] = start;
  let head = 0, tail = 0;
  queue[tail++] = start;
  while (head < tail) {
    const x = queue[head++];
    const ps = dec(x);
    for (let mi = 0; mi < usable.length; mi++) {
      const m = usable[mi];
      const np = ps.map((p) => m.loc[p]);
      const y = enc(np);
      if (prev[y] !== -1) continue;
      prev[y] = x;
      via[y] = mi;
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
      label: `${m.alg}${n > 1 ? ` × ${n}` : ''} (${viewText(m.view)})`,
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
function pairMacros(keep: number[], piece: number[]): Macro[] {
  const near = new Set<number>([U]);
  for (const f of piece.map(faceOf)) {
    near.add(f);
    for (const g of geo.neighbors[f]) if (g !== D) near.add(g);
  }
  const keepSet = keep;
  const faceIdx = (mv: string) => FACES.indexOf(mv.replace(/[2']/g, '') as never);
  const T = TRIGGERS().filter((m) => m.moves.every((mv) => near.has(faceIdx(mv))) && !fixes(m, keepSet));
  const out: Macro[] = [];
  for (const t1 of T)
    for (const t2 of T) {
      let ok = true;
      for (const k of keepSet)
        if (t1.perm[t2.perm[k]] !== k) {
          ok = false;
          break;
        }
      if (!ok) continue;
      const m = makeMacro([...t1.moves, ...t2.moves], 'alg', `${t1.alg!.replace('Gatilho ', '')} + ${t2.alg!.replace('Gatilho ', '')}`);
      out.push(m);
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
    if (!best)
      for (const piece of remaining) {
        const path = placePiece(ctx.s, piece, [...allowed, ...pairMacros(ctx.keep, piece)]);
        if (!path) continue;
        best = { piece, path, len: path.reduce((a, m) => a + m.moves.length, 0) };
        break; // basta uma
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
  path.some((m) => m.kind === 'alg')
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

export { toS as megaToS, faceOf as megaFaceOf };
