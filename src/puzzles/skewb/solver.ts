/**
 * Solucionadores do Skewb.
 *
 * Técnica: cada peça do Skewb é única, então dá para seguir onde cada adesivo foi
 * parar ("where": casa → posição atual). Uma etapa é "estes adesivos em casa"; para
 * cada conjunto de adesivos calculamos uma tabela de distâncias (busca em largura a
 * partir do resolvido) e uma busca em profundidade iterativa (IDA*) usa essas tabelas
 * para achar o caminho mais curto até a etapa — sem estragar o que já está pronto.
 *
 * O Skewb inteiro tem 3.149.280 posições = 8.748 dos cantos × 360 dos centros (são
 * independentes). Por isso as tabelas de cantos e de centros também validam o puzzle.
 *
 * Iniciante: face branca (centro e depois um canto por vez) → cantos de cima → centros.
 * Ótimo: a menor solução possível (no máximo 11 movimentos).
 */
import type { PuzzleState, Solution, SolutionStage, SolutionStep } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { FACE_ORDER } from '../nxn/geometry';
import { MOVES, REFERENCE_CORNER, STICKERS, skewbGeo as geo } from './geometry';

const SOLVED = geo.solved();
/** destino de cada posição em cada movimento: LOC[m][posição] = nova posição */
const LOC: Int32Array[] = MOVES.map((m) => geo.locationMap(m));
const AXIS = MOVES.map((m) => m[0]);

/** cores de um canto começando em qualquer adesivo (mesmo sentido): a peça é a mesma */
const sameCycle = (a: string[], b: string[]) => [0, 1, 2].some((r) => a.every((c, i) => c === b[(i + r) % 3]));

/** onde está cada adesivo: where[casa] = posição atual. null se as peças não existem num Skewb */
export function locate(state: PuzzleState): Int8Array | null {
  const where = new Int8Array(STICKERS).fill(-1);
  for (const c of geo.centers) {
    const home = geo.centers.find((h) => SOLVED[h] === state[c]);
    if (home === undefined || where[home] >= 0) return null;
    where[home] = c;
  }
  for (const pos of geo.corners) {
    const cols = pos.stickers.map((i) => state[i]);
    const home = geo.corners.find((h) => sameCycle(h.stickers.map((i) => SOLVED[i]), cols));
    if (!home) return null;
    for (let j = 0; j < 3; j++) {
      const hs = home.stickers.find((h) => SOLVED[h] === cols[j])!;
      if (where[hs] >= 0) return null;
      where[hs] = pos.stickers[j];
    }
  }
  return where;
}

// ---------------------------------------------------------------------------
// Tabelas de distância

/** um adesivo de cada canto (a posição dele diz onde o canto está e como está girado) */
const MOVABLE_CORNERS = geo.corners.filter((c) => c !== REFERENCE_CORNER);
const cornerRef = (c: { stickers: number[] }) => c.stickers[0];
const cornerAt = (vertex: [number, number, number]) => geo.corners.find((c) => c.vertex.every((v, i) => v === vertex[i]))!;
const D_CENTER = geo.centers[FACE_ORDER.indexOf('D')];
/** cantos de baixo na ordem do tutorial */
const D_CORNERS = [cornerAt([1, -1, 1]), cornerAt([-1, -1, 1]), cornerAt([-1, -1, -1]), cornerAt([1, -1, -1])];
const TOP_CORNERS = MOVABLE_CORNERS.filter((c) => c.vertex[1] === 1);

const keyOf = (where: ArrayLike<number>, sel: number[]) => {
  let k = 0;
  for (const h of sel) k = k * 32 + where[h];
  return k;
};

type Table = { sel: number[]; dist: Map<number, number> };
const tables = new Map<string, Table>();

/** distância (em movimentos) até os adesivos `sel` estarem em casa, para cada posição deles */
function table(sel: number[]): Table {
  const id = sel.join(',');
  const hit = tables.get(id);
  if (hit) return hit;
  const dist = new Map<number, number>();
  let frontier = [Int8Array.from(sel)];
  dist.set(keyOf(Int8Array.from({ length: STICKERS }, (_, i) => i), sel), 0);
  // trabalha só com as posições dos adesivos escolhidos
  const local = (pos: Int8Array) => {
    let k = 0;
    for (let i = 0; i < pos.length; i++) k = k * 32 + pos[i];
    return k;
  };
  for (let d = 1; frontier.length; d++) {
    const next: Int8Array[] = [];
    for (const pos of frontier)
      for (const loc of LOC) {
        const np = Int8Array.from(pos, (p) => loc[p]);
        const k = local(np);
        if (!dist.has(k)) {
          dist.set(k, d);
          next.push(np);
        }
      }
    frontier = next;
  }
  const t = { sel, dist };
  tables.set(id, t);
  return t;
}

export const cornerTable = () => table(MOVABLE_CORNERS.map(cornerRef));
export const centerTable = () => table(geo.centers);

/** os cantos e os centros formam um Skewb possível? (where já calculado) */
export function reachable(where: Int8Array) {
  return {
    corners: cornerTable().dist.has(keyOf(where, cornerTable().sel)),
    centers: centerTable().dist.has(keyOf(where, centerTable().sel)),
  };
}

// ---------------------------------------------------------------------------
// Busca (IDA*): o menor caminho até todas as tabelas darem 0

const MAX_DEPTH = 14;

function search(start: Int8Array, parts: Table[]): string[] {
  const h = (w: Int8Array) => {
    let m = 0;
    for (const t of parts) {
      const d = t.dist.get(keyOf(w, t.sel));
      if (d === undefined) return Infinity;
      if (d > m) m = d;
    }
    return m;
  };
  const path: number[] = [];
  const dfs = (w: Int8Array, g: number, bound: number, last: string): number => {
    const f = g + h(w);
    if (f > bound) return f;
    if (f === g) return -1; // h = 0: chegou
    let min = Infinity;
    for (let mi = 0; mi < MOVES.length; mi++) {
      if (AXIS[mi] === last) continue; // girar o mesmo canto de novo é desperdício
      const loc = LOC[mi];
      const nw = Int8Array.from(w, (p) => loc[p]);
      path.push(mi);
      const r = dfs(nw, g + 1, bound, AXIS[mi]);
      if (r < 0) return -1;
      if (r < min) min = r;
      path.pop();
    }
    return min;
  };
  let bound = h(start);
  if (bound === Infinity) throw new Error('Esse Skewb não pode ser resolvido (combinação impossível).');
  while (bound <= MAX_DEPTH) {
    const r = dfs(start, 0, bound, '');
    if (r < 0) return path.map((i) => MOVES[i]);
    bound = r;
  }
  throw new Error('Não foi possível resolver esse Skewb.');
}

const follow = (where: Int8Array, moves: string[]) => {
  let w = where;
  for (const m of moves) {
    const loc = LOC[MOVES.indexOf(m)];
    w = Int8Array.from(w, (p) => loc[p]);
  }
  return w;
};

// ---------------------------------------------------------------------------
// Textos

const cname = (sticker: number) => COLOR_NAME[SOLVED[sticker]];
const cornerName = (c: { stickers: number[] }) =>
  [...c.stickers]
    .sort((a, b) => 'UDFBRL'.indexOf(SOLVED[a]) - 'UDFBRL'.indexOf(SOLVED[b]))
    .map(cname)
    .join('-');
const PLACE: Record<string, string> = { '1,1': 'na frente, à direita', '-1,1': 'na frente, à esquerda', '-1,-1': 'atrás, à esquerda', '1,-1': 'atrás, à direita' };
const placeOf = (c: { vertex: number[] }) => PLACE[`${c.vertex[0]},${c.vertex[2]}`];

export const SKEWB_STAGES: SolutionStage[] = [
  { id: 'face', name: 'Face branca', goal: 'Montar a face branca embaixo: o centro branco e os 4 cantos brancos, cada um com as cores laterais certas.' },
  { id: 'top', name: 'Cantos de cima', goal: 'Colocar os cantos de cima no lugar, com o amarelo para cima. O canto amarelo-verde-laranja nunca sai do lugar.' },
  { id: 'centers', name: 'Centros', goal: 'Com todos os cantos certos, trocar os centros de lugar até cada face ter uma cor só.' },
];
export const OPTIMAL_STAGES: SolutionStage[] = [{ id: 'optimal', name: 'Solução ótima', goal: 'Resolver com o menor número de movimentos possível.' }];

const stepOf = (stageId: string, title: string, description: string, moves: string[], focus: number[]): SolutionStep => ({
  stageId,
  title,
  description,
  segments: [{ label: 'Movimentos', moves }],
  focus,
});

/** adesivos (na posição atual) das peças com estas casas */
const focusOf = (where: Int8Array, homes: number[]) => homes.map((h) => where[h]);

export function solveSkewbBeginner(state: PuzzleState): Solution {
  let where = locate(state);
  if (!where) throw new Error('Esse Skewb não pode ser resolvido (peças inválidas).');
  const steps: SolutionStep[] = [];
  const run = (stageId: string, title: string, desc: string, parts: Table[], focusHomes: number[]) => {
    const moves = search(where!, parts);
    if (moves.length) steps.push(stepOf(stageId, title, desc, moves, focusOf(where!, focusHomes)));
    where = follow(where!, moves);
  };

  // 1. face branca: o centro e depois um canto por vez (cada passo sem desmontar o anterior)
  const sel = [D_CENTER];
  run('face', 'Centro branco embaixo', 'Leve o <b>centro branco</b> para a face de baixo. Os cantos ainda não importam.', [table([...sel])], [D_CENTER]);
  for (const c of D_CORNERS) {
    sel.push(cornerRef(c));
    run(
      'face',
      `Canto ${cornerName(c)}`,
      `Encaixe o canto <b>${cornerName(c)}</b> embaixo, ${placeOf(c)}, com o <b>branco para baixo</b>. ` +
        'As cores do lado precisam combinar com o canto de referência (amarelo-verde-laranja, em cima, na frente, à direita). ' +
        'Os movimentos mantêm o que já está pronto na face branca.',
      [table([...sel])],
      c.stickers,
    );
  }
  // 2. cantos de cima (sem perder a face branca no fim)
  run(
    'top',
    'Cantos de cima',
    `Agora os cantos de cima: ${TOP_CORNERS.map((c) => `<b>${cornerName(c)}</b>`).join(', ')}. ` +
      'Cada um vai para o seu lugar com o <b>amarelo para cima</b>. A face branca se desmonta no meio da sequência, mas volta inteira no fim.',
    [cornerTable(), table([D_CENTER])],
    TOP_CORNERS.flatMap((c) => c.stickers),
  );
  // 3. centros
  run(
    'centers',
    'Trocar os centros',
    'Todos os cantos estão certos; faltam os <b>centros</b> (o quadrado do meio de cada face). ' +
      'A sequência mexe nos cantos no meio do caminho e devolve tudo no lugar no final.',
    [cornerTable(), centerTable()],
    geo.centers,
  );
  return { method: 'Método de iniciante (face branca, cantos, centros)', stages: SKEWB_STAGES, steps };
}

export function solveSkewbOptimal(state: PuzzleState): Solution {
  const where = locate(state);
  if (!where) throw new Error('Esse Skewb não pode ser resolvido (peças inválidas).');
  const moves = search(where, [cornerTable(), centerTable()]);
  const steps = moves.length
    ? [
        stepOf(
          'optimal',
          `Resolver em ${moves.length} movimento${moves.length > 1 ? 's' : ''}`,
          'Este é o <b>caminho mais curto possível</b> para o seu Skewb (nenhum tem mais de 11). Siga os movimentos com calma: no Skewb, cada giro mexe em metade do puzzle.',
          moves,
          [],
        ),
      ]
    : [];
  return { method: 'Solução ótima', stages: OPTIMAL_STAGES, steps };
}

export { SOLVED as SKEWB_SOLVED };
