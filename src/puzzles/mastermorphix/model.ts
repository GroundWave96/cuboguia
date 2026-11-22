/**
 * Mastermorphix: por dentro é um cubo 3x3; por fora, um tetraedro de 4 cores.
 *
 * O cubo fica no referencial de sempre (x → direita, y → cima, z → frente) e o tetraedro
 * tem as faces com normais N = (−1,−1,−1), (−1,1,1), (1,−1,1) e (1,1,−1). Assim:
 *   - os 4 cantos nos vértices do tetraedro são as PONTAS (3 cores);
 *   - os outros 4 cantos ficam no meio de cada face: o TRIÂNGULO do centro (1 cor);
 *   - as 12 arestas são as PIPAS (1 cor, 3 em volta de cada triângulo);
 *   - os 6 centros ficam no meio das arestas do tetraedro (2 cores: meio em cada face).
 * Cada face tem 10 adesivos: 3 pontas, 3 pipas, 3 meios de aresta e o triângulo.
 *
 * Girar ¼ de volta muda a FORMA (uma ponta vai para o lugar de um triângulo...). Por isso
 * o estado tem dois formatos:
 *   - "pirâmide": as 40 cores dos adesivos (o que se pinta e a câmera lê);
 *   - "peças": ['@', cor de cada face (4), rotação de cada uma das 26 peças] — vale para
 *     qualquer forma; volta a ser "pirâmide" sempre que a forma volta.
 */
import { FACE_FRAME, layerHit, parseMove } from '../nxn/geometry';

export type V3 = [number, number, number];
type M3 = number[];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mulMV = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mulMM = (a: M3, b: M3): M3 => {
  const out: M3 = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
  return out;
};
const keyOf = (m: M3) => m.join(',');
const eqV = (a: V3, b: V3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** ¼ de volta no sentido horário olhando de fora para o lado n */
function quarter(n: V3): M3 {
  const f = (v: V3): V3 => {
    const k = dot(n, v);
    const c: V3 = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]];
    return [-c[0] + n[0] * k, -c[1] + n[1] * k, -c[2] + n[2] * k];
  };
  const cols = [f([1, 0, 0]), f([0, 1, 0]), f([0, 0, 1])];
  return [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]];
}

// ---------------------------------------------------------------------------
// As 24 rotações do cubo (matrizes inteiras), com a tabela de composição
export const ROTS: M3[] = [];
{
  const seen = new Map<string, number>();
  const add = (m: M3) => {
    if (!seen.has(keyOf(m))) {
      seen.set(keyOf(m), ROTS.length);
      ROTS.push(m);
    }
  };
  add([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const gens = [quarter([1, 0, 0]), quarter([0, 1, 0]), quarter([0, 0, 1])];
  for (let i = 0; i < ROTS.length; i++) for (const g of gens) add(mulMM(g, ROTS[i]));
}
const ROT_INDEX = new Map(ROTS.map((m, i) => [keyOf(m), i]));
const rotIndex = (m: M3) => ROT_INDEX.get(keyOf(m))!;
/** MUL[a][b] = a·b (primeiro b, depois a) */
export const MUL = ROTS.map((a) => ROTS.map((b) => rotIndex(mulMM(a, b))));
export const INV = ROTS.map((_, a) => MUL[a].indexOf(0));
export const rotate = (r: number, v: V3) => mulMV(ROTS[r], v);

// ---------------------------------------------------------------------------
// Peças (26 posições do 3x3) e o tetraedro
export const CUBIES: V3[] = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) CUBIES.push([x, y, z]);
const CUBIE_INDEX = new Map(CUBIES.map((p, i) => [p.join(','), i]));
export const cubieAt = (p: V3) => CUBIE_INDEX.get(p.join(','))!;

export const NORMALS: V3[] = [
  [-1, -1, -1],
  [-1, 1, 1],
  [1, -1, 1],
  [1, 1, -1],
];
const faceOfNormal = (n: V3) => NORMALS.findIndex((m) => eqV(m, n));
/** vértice oposto à face j (a ponta fica na peça −N_j) */
export const VERTEX: V3[] = NORMALS.map((n) => [-n[0], -n[1], -n[2]]);

export type Kind = 'tip' | 'kite' | 'mid' | 'center';
/** faces do tetraedro em que a peça aparece (as de maior produto escalar com a posição) */
export const PIECE_FACES: number[][] = CUBIES.map((p) => {
  const d = NORMALS.map((n) => dot(n, p));
  const max = Math.max(...d);
  return d.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
});
export const PIECE_KIND: Kind[] = CUBIES.map((p, i) => {
  const nz = p.filter(Boolean).length;
  if (nz === 1) return 'mid';
  if (nz === 2) return 'kite';
  return PIECE_FACES[i].length === 3 ? 'tip' : 'center';
});

/**
 * Vértices de cada face na ordem dos adesivos: A, B, C no sentido anti-horário visto de
 * fora, começando pelo de menor número.
 */
export const FACE_VERTS: number[][] = NORMALS.map((n, i) => {
  const vs = [0, 1, 2, 3].filter((j) => j !== i);
  const [a, b, c] = vs.map((j) => VERTEX[j]);
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr: V3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  return dot(cr, n) > 0 ? vs : [vs[0], vs[2], vs[1]];
});

/**
 * Os 10 adesivos de cada face (índice = face·10 + k), na ordem da câmera com o vértice A
 * em cima: ponta A, pipa A, meio AB, meio CA, triângulo, pipa B, pipa C, ponta B, meio BC, ponta C.
 */
export interface MorphSticker {
  index: number;
  face: number;
  k: number;
  kind: Kind;
  /** peça (posição do 3x3) onde fica o adesivo */
  cubie: number;
}
const half = (v: V3): V3 => [v[0] / 2, v[1] / 2, v[2] / 2];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
export const STICKERS: MorphSticker[] = [];
NORMALS.forEach((N, f) => {
  const [A, B, C] = FACE_VERTS[f];
  const tip = (j: number) => VERTEX[j];
  const kite = (j: number) => half(add3(N, NORMALS[j].map((x) => -x) as V3));
  const mid = (j: number, l: number) => half(neg(add3(NORMALS[j], NORMALS[l])));
  const slots: [Kind, V3][] = [
    ['tip', tip(A)],
    ['kite', kite(A)],
    ['mid', mid(A, B)],
    ['mid', mid(C, A)],
    ['center', N],
    ['kite', kite(B)],
    ['kite', kite(C)],
    ['tip', tip(B)],
    ['mid', mid(B, C)],
    ['tip', tip(C)],
  ];
  slots.forEach(([kind, p], k) => STICKERS.push({ index: f * 10 + k, face: f, k, kind, cubie: cubieAt(p) }));
});
export const STICKER_COUNT = 40;
/** adesivo de uma peça numa face (para achar o índice) */
const STICKER_AT = new Map(STICKERS.map((s) => [`${s.cubie}|${s.face}`, s.index]));
export const stickerAt = (cubie: number, face: number) => STICKER_AT.get(`${cubie}|${face}`);

// ---------------------------------------------------------------------------
// Formatos do estado
export type MorphState = string[];
export const isPieces = (s: MorphState) => s[0] === '@';
export const FACE_KEYS_DEFAULT = ['D', 'F', 'L', 'R'];

export function solvedPyramid(keys = FACE_KEYS_DEFAULT): MorphState {
  return STICKERS.map((s) => keys[s.face]);
}
export function solvedPieces(keys = FACE_KEYS_DEFAULT): MorphState {
  return ['@', ...keys, ...CUBIES.map(() => '0')];
}

/** rotação de cada peça e posição atual */
export const rotsOf = (s: MorphState) => s.slice(5).map(Number);
export const keysOf = (s: MorphState) => s.slice(1, 5);

/** eixo, quartos de volta e quais peças giram (no formato "peças") */
export function moveSpec(move: string) {
  const mv = parseMove(move);
  const axis = FACE_FRAME[mv.face].n as V3;
  const q = rotIndex(quarter(axis));
  let r = 0;
  for (let t = 0; t < mv.turns; t++) r = MUL[q][r];
  return { mv, axis, rot: r, hit: (pos: V3) => layerHit(2 * dot(pos, axis), 3, mv) };
}

export function applyPieces(s: MorphState, move: string): MorphState {
  const { rot, hit } = moveSpec(move);
  const rs = rotsOf(s);
  const out = rs.map((r, h) => (hit(rotate(r, CUBIES[h])) ? MUL[rot][r] : r));
  return ['@', ...keysOf(s), ...out.map(String)];
}

/** peças que estão na camada do movimento (para a animação) */
export function movingPieces(s: MorphState, move: string): number[] {
  const { hit } = moveSpec(move);
  const rs = rotsOf(s);
  return CUBIES.map((h, i) => (hit(rotate(rs[i], h)) ? i : -1)).filter((i) => i >= 0);
}

/**
 * Formato "peças" → "pirâmide" (as 40 cores), ou null se a forma não for a de pirâmide
 * (alguma peça fora do lugar do seu tipo ou virada de um jeito que muda a forma).
 */
export function toPyramid(s: MorphState): MorphState | null {
  const keys = keysOf(s);
  const rs = rotsOf(s);
  const at = new Map<number, number>(); // posição → peça
  rs.forEach((r, h) => at.set(cubieAt(rotate(r, CUBIES[h])), h));
  const out: string[] = [];
  for (const st of STICKERS) {
    const h = at.get(st.cubie)!;
    const inv = INV[rs[h]];
    const f = faceOfNormal(rotate(inv, NORMALS[st.face]));
    if (f < 0 || !PIECE_FACES[h].includes(f)) return null;
    // a peça precisa ocupar exatamente as faces do lugar (senão a forma muda)
    if (PIECE_FACES[h].length !== PIECE_FACES[st.cubie].length) return null;
    out.push(keys[f]);
  }
  return out;
}

/** cor de cada adesivo pelo dono (a peça leva as cores com ela), no formato "peças" */
export function pieceColors(s: MorphState): string[] {
  const keys = keysOf(s);
  return STICKERS.map((st) => keys[st.face]);
}

// ---------------------------------------------------------------------------
// Pirâmide → peças. Pontas, triângulos e meios são únicos pelas cores; as pipas da mesma
// cor são iguais e o giro dos triângulos não aparece: escolhe a combinação que forma um
// 3x3 de verdade (cantos girados somando 0, arestas viradas em número par, paridades iguais).

export interface Reading {
  /** cor de cada face do tetraedro (pelos meios de aresta, que nunca saem do lugar) */
  keys: string[];
  pieces: MorphState | null;
  error: 'colors' | 'mids' | 'piece' | 'parity' | null;
  /** adesivo com problema (para a mensagem), quando der para dizer */
  bad?: number;
}

/** rotações que levam a peça h para a posição p com cada adesivo (face de origem → face do lugar) */
function rotationsFor(h: number, p: number, pairs: [number, number][]): number[] {
  const out: number[] = [];
  for (let r = 0; r < 24; r++) {
    if (!eqV(rotate(r, CUBIES[h]), CUBIES[p])) continue;
    if (pairs.every(([from, to]) => eqV(rotate(r, NORMALS[from]), NORMALS[to]))) out.push(r);
  }
  return out;
}

export function readPyramid(state: MorphState): Reading {
  const colors = [...new Set(state)];
  if (state.length !== STICKER_COUNT || colors.length !== 4 || colors.some((c) => state.filter((x) => x === c).length !== 10))
    return { keys: [], pieces: null, error: 'colors' };
  // cor de cada face: a comum aos 3 meios de aresta em volta dela
  const midPairs = new Map<number, string[]>();
  for (const st of STICKERS) if (st.kind === 'mid') (midPairs.get(st.cubie) ?? midPairs.set(st.cubie, []).get(st.cubie)!).push(state[st.index]);
  const keys: string[] = [];
  for (let f = 0; f < 4; f++) {
    const mids = STICKERS.filter((s) => s.face === f && s.kind === 'mid').map((s) => midPairs.get(s.cubie)!);
    const common = colors.filter((c) => mids.every((m) => m.includes(c)));
    if (common.length !== 1) return { keys: [], pieces: null, error: 'mids', bad: STICKERS.find((s) => s.face === f && s.kind === 'mid')!.index };
    keys.push(common[0]);
  }
  if (new Set(keys).size !== 4) return { keys, pieces: null, error: 'mids' };
  const faceOf = (c: string) => keys.indexOf(c);

  // para cada lugar: candidatos (peça, rotações)
  const rot = new Array<number>(26).fill(-1); // rotação de cada PEÇA
  const kiteSlots: { slot: number; face: number; pairs: [number, number][] }[] = [];
  const centerChoices: { h: number; rs: number[] }[] = [];
  for (let p = 0; p < 26; p++) {
    const sts = STICKERS.filter((s) => s.cubie === p);
    const pairs = sts.map((s) => [faceOf(state[s.index]), s.face] as [number, number]);
    const homeFaces = [...pairs.map((x) => x[0])].sort();
    const kind = PIECE_KIND[p];
    if (kind === 'kite') {
      kiteSlots.push({ slot: p, face: pairs[0][0], pairs });
      continue;
    }
    // a peça certa é a do mesmo tipo com as mesmas faces de origem
    const h = CUBIES.findIndex((_, i) => PIECE_KIND[i] === kind && [...PIECE_FACES[i]].sort().join() === homeFaces.join());
    if (h < 0 || rot[h] >= 0 && kind !== 'center') return { keys, pieces: null, error: 'piece', bad: sts[0].index };
    const rs = rotationsFor(h, p, pairs);
    if (!rs.length) return { keys, pieces: null, error: 'piece', bad: sts[0].index };
    if (kind === 'center') centerChoices.push({ h, rs });
    rot[h] = rs[0];
  }
  // pipas: 3 de cada cor, iguais entre si
  const byFace = [0, 1, 2, 3].map((f) => kiteSlots.filter((k) => k.face === f));
  if (byFace.some((g) => g.length !== 3)) return { keys, pieces: null, error: 'colors' };
  const kitePieces = [0, 1, 2, 3].map((f) => CUBIES.map((_, i) => i).filter((i) => PIECE_KIND[i] === 'kite' && PIECE_FACES[i][0] === f));
  const perms3 = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const choose = (pick: number[]): boolean => {
    for (let f = 0; f < 4; f++)
      for (let j = 0; j < 3; j++) {
        const slot = byFace[f][j];
        const h = kitePieces[f][perms3[pick[f]][j]];
        const rs = rotationsFor(h, slot.slot, slot.pairs);
        if (rs.length !== 1) return false;
        rot[h] = rs[0];
      }
    return true;
  };
  // com a forma de pirâmide os meios estão em 0 ou ½ volta (soma par): a troca dos cantos
  // tem que ser par (cada ¼ de volta troca a paridade dos cantos e gira um centro)
  if (cornerParity(['@', ...keys, ...rot.map((r) => String(Math.max(r, 0)))]) !== 0) return { keys, pieces: null, error: 'parity' };
  // triângulos: o giro não aparece (3 opções cada); fixados pela soma dos cantos girados
  const centers = centerChoices;
  for (let e = 0; e < 6 ** 4; e++) {
    const pick = [e % 6, Math.floor(e / 6) % 6, Math.floor(e / 36) % 6, Math.floor(e / 216) % 6];
    if (!choose(pick)) continue;
    const base = ['@', ...keys, ...rot.map(String)];
    if (!edgesOk(base)) continue;
    for (let t = 0; t < 81; t++) {
      centers.forEach((c, i) => (rot[c.h] = c.rs[Math.floor(t / 3 ** i) % 3]));
      const cand = ['@', ...keys, ...rot.map(String)];
      if (cornersOk(cand) && paritiesMatch(cand)) return { keys, pieces: cand, error: null };
    }
  }
  return { keys, pieces: null, error: 'parity' };
}

// ---------------------------------------------------------------------------
// Invariantes do 3x3 (no referencial do cubo: U = +y, R = +x, F = +z)
const AXIS_FACE = (n: V3) => (n[1] === 1 ? 'U' : n[1] === -1 ? 'D' : n[0] === 1 ? 'R' : n[0] === -1 ? 'L' : n[2] === 1 ? 'F' : 'B');

/** para cada posição de canto/aresta: a peça que está lá e para onde foi cada face de origem */
function placement(s: MorphState) {
  const rs = rotsOf(s);
  const at = new Map<number, number>();
  rs.forEach((r, h) => at.set(cubieAt(rotate(r, CUBIES[h])), h));
  return { rs, at };
}
const axes = (p: V3): V3[] => [0, 1, 2].filter((a) => p[a]).map((a) => [a === 0 ? p[0] : 0, a === 1 ? p[1] : 0, a === 2 ? p[2] : 0] as V3);

/** giro de cada canto: onde ficou a face U/D da peça (0 = em U/D) */
function cornersOk(s: MorphState): boolean {
  const { rs, at } = placement(s);
  let sum = 0;
  for (let p = 0; p < 26; p++) {
    const P = CUBIES[p];
    if (P.some((x) => x === 0)) continue;
    const h = at.get(p)!;
    const ud: V3 = [0, CUBIES[h][1], 0];
    const now = rotate(rs[h], ud);
    // ordem dos 3 lados do lugar: U/D primeiro e os outros no sentido horário visto de fora
    const order = cornerOrder(P);
    sum += order.findIndex((n) => eqV(n, now));
  }
  return sum % 3 === 0;
}
function cornerOrder(P: V3): V3[] {
  const [x, y, z] = axes(P).sort((a, b) => (a[1] ? -1 : b[1] ? 1 : 0));
  // y primeiro; depois os dois horizontais no sentido horário visto de fora do canto
  const a = y, b = x, c = z;
  const cr: V3 = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
  return dot(cr, a) > 0 ? [a, c, b] : [a, b, c];
}
/** arestas viradas: conta quantas estão com a face "boa" fora do lugar bom (precisa ser par) */
function edgesOk(s: MorphState): boolean {
  const { rs, at } = placement(s);
  let flips = 0;
  for (let p = 0; p < 26; p++) {
    const P = CUBIES[p];
    if (P.filter(Boolean).length !== 2) continue;
    const h = at.get(p)!;
    flips += edgeFlip(CUBIES[h], rs[h], P);
  }
  return flips % 2 === 0;
}
/** a face "boa" de uma aresta: U/D se tiver; senão F/B */
const goodAxis = (p: V3): V3 => {
  const as = axes(p);
  return as.find((n) => n[1]) ?? as.find((n) => n[2])!;
};
function edgeFlip(home: V3, r: number, slot: V3): number {
  return eqV(rotate(r, goodAxis(home)), goodAxis(slot)) ? 0 : 1;
}
function parity(perm: number[]): number {
  const seen = new Array(perm.length).fill(false);
  let par = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let j = i, len = 0;
    while (!seen[j]) {
      seen[j] = true;
      j = perm[j];
      len++;
    }
    par += len - 1;
  }
  return par % 2;
}
function cornerParity(s: MorphState): number {
  const { at } = placement(s);
  const corners = CUBIES.map((_, i) => i).filter((i) => CUBIES[i].every((x) => x));
  return parity(corners.map((p) => corners.indexOf(at.get(p)!)));
}
function paritiesMatch(s: MorphState): boolean {
  const { at } = placement(s);
  const corners = CUBIES.map((_, i) => i).filter((i) => CUBIES[i].every((x) => x));
  const edges = CUBIES.map((_, i) => i).filter((i) => CUBIES[i].filter(Boolean).length === 2);
  const cp = corners.map((p) => corners.indexOf(at.get(p)!));
  const ep = edges.map((p) => edges.indexOf(at.get(p)!));
  return parity(cp) === parity(ep);
}

/** as 54 cores de um 3x3 comum (U R F D L B, convenção do site) para o resolvedor do 3x3 */
export function cubeFacelets(s: MorphState, stickerOf: (cubie2: V3, normal: V3) => number): string[] {
  const rs = rotsOf(s);
  const out = new Array<string>(54).fill('?');
  CUBIES.forEach((h, i) => {
    for (const n of axes(h)) {
      const pos = rotate(rs[i], h);
      const nn = rotate(rs[i], n);
      out[stickerOf([pos[0] * 2, pos[1] * 2, pos[2] * 2], nn)] = AXIS_FACE(n);
    }
  });
  return out;
}

/** giro de cada centro (quartos de volta no sentido horário visto de fora), na ordem U R F D L B */
export function centerTurns(s: MorphState): Record<string, number> {
  const rs = rotsOf(s);
  const out: Record<string, number> = {};
  CUBIES.forEach((h, i) => {
    if (h.filter(Boolean).length !== 1) return;
    const r = rs[i];
    const pos = rotate(r, h);
    const face = AXIS_FACE(pos);
    // vetor de referência perpendicular ao eixo, levado pela rotação
    const u: V3 = h[1] ? [1, 0, 0] : [0, 1, 0];
    const now = rotate(r, u);
    // compara com o de referência da posição atual (as peças do centro podem mudar de lugar com M/E/S)
    const ref: V3 = pos[1] ? [1, 0, 0] : [0, 1, 0];
    let k = 0, v = ref;
    const q = quarter(pos);
    while (!eqV(v, now) && k < 4) {
      v = mulMV(q, v);
      k++;
    }
    out[face] = k % 4;
  });
  return out;
}
