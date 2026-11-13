/**
 * Solução ÓTIMA do 2x2 (o menor número possível de movimentos, no máximo 11).
 *
 * O cubo é descrito por peças (cubies): permutação e torção dos 8 cantos, com o
 * canto DBL parado. Uma busca IDA* com duas tabelas de distância (só permutação e
 * só torção) encontra a menor sequência de giros U, R e F.
 */
import type { PuzzleState, Solution } from '../../../core/types';
import { ALL, CORNERS, D, U, allSolved, applyPerm, composePerm, solvedS, toS, type S } from './kit';

const MOVES = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2'];
const SOLVED_COLORS = CORNERS.map((fs) => fs.map((f) => solvedS[f]));

export interface Cubies {
  cp: number[];
  co: number[];
}

/** Lê permutação e torção dos cantos a partir dos adesivos. */
export function toCubies(s: S): Cubies {
  const cp: number[] = [];
  const co: number[] = [];
  for (const fs of CORNERS) {
    const cols = fs.map((f) => s[f]);
    const ori = cols.findIndex((c) => c === U || c === D);
    const rot = [cols[ori], cols[(ori + 1) % 3], cols[(ori + 2) % 3]];
    cp.push(SOLVED_COLORS.findIndex((cc) => cc.every((c, k) => c === rot[k])));
    co.push(ori);
  }
  return { cp, co };
}

const MOVE_CUBIES = MOVES.map((m) => toCubies(applyPerm(solvedS, composePerm([m]))));

/** estado ∘ movimento (convenção de Kociemba) */
export function applyCubieMove(c: Cubies, m: number): Cubies {
  const mv = MOVE_CUBIES[m];
  return {
    cp: mv.cp.map((p) => c.cp[p]),
    co: mv.cp.map((p, i) => (c.co[p] + mv.co[i]) % 3),
  };
}

// --- coordenadas
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040];
function permIndex(p: number[]): number {
  let idx = 0;
  for (let i = 0; i < 8; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 8; j++) if (p[j] < p[i]) smaller++;
    idx += smaller * FACT[7 - i];
  }
  return idx;
}
function permFromIndex(idx: number): number[] {
  const avail = [0, 1, 2, 3, 4, 5, 6, 7];
  const p: number[] = [];
  for (let i = 0; i < 8; i++) {
    const f = FACT[7 - i];
    const k = Math.floor(idx / f);
    idx %= f;
    p.push(avail.splice(k, 1)[0]);
  }
  return p;
}
const TWIST_POS = [0, 1, 2, 3, 4, 5, 7]; // DBL (6) nunca gira
const twistIndex = (co: number[]) => TWIST_POS.reduce((a, i) => a * 3 + co[i], 0);
function twistFromIndex(idx: number): number[] {
  const co = new Array(8).fill(0);
  for (let k = TWIST_POS.length - 1; k >= 0; k--) {
    co[TWIST_POS[k]] = idx % 3;
    idx = Math.floor(idx / 3);
  }
  return co;
}

interface Tables {
  permMove: Int32Array;
  twistMove: Int32Array;
  permDist: Int8Array;
  twistDist: Int8Array;
}
let tables: Tables | null = null;

function bfs(size: number, start: number, next: (x: number, m: number) => number) {
  const move = new Int32Array(size * 9).fill(-1);
  const dist = new Int8Array(size).fill(-1);
  const queue = [start];
  dist[start] = 0;
  for (let h = 0; h < queue.length; h++) {
    const x = queue[h];
    for (let m = 0; m < 9; m++) {
      const y = next(x, m);
      move[x * 9 + m] = y;
      if (dist[y] < 0) {
        dist[y] = dist[x] + 1;
        queue.push(y);
      }
    }
  }
  return { move, dist };
}

function getTables(): Tables {
  if (tables) return tables;
  const id = [0, 1, 2, 3, 4, 5, 6, 7];
  const p = bfs(40320, permIndex(id), (x, m) => permIndex(applyCubieMove({ cp: permFromIndex(x), co: new Array(8).fill(0) }, m).cp));
  const t = bfs(2187, 0, (x, m) => twistIndex(applyCubieMove({ cp: id, co: twistFromIndex(x) }, m).co));
  tables = { permMove: p.move, twistMove: t.move, permDist: p.dist, twistDist: t.dist };
  return tables;
}

/** Menor sequência de movimentos que resolve o 2x2 (DBL fixo). */
export function optimalMoves(state: PuzzleState): string[] {
  const T = getTables();
  const c = toCubies(toS(state));
  const p0 = permIndex(c.cp);
  const t0 = twistIndex(c.co);
  const path: number[] = [];
  const dfs = (p: number, t: number, g: number, bound: number, lastFace: number): boolean => {
    const h = Math.max(T.permDist[p], T.twistDist[t]);
    if (h === 0) return true;
    if (g + h > bound) return false;
    for (let m = 0; m < 9; m++) {
      const face = (m / 3) | 0;
      if (face === lastFace) continue;
      path.push(m);
      if (dfs(T.permMove[p * 9 + m], T.twistMove[t * 9 + m], g + 1, bound, face)) return true;
      path.pop();
    }
    return false;
  };
  for (let bound = 0; bound <= 14; bound++) if (dfs(p0, t0, 0, bound, -1)) return path.map((m) => MOVES[m]);
  throw new Error('estado sem solução');
}

export function solveOptimal2(state: PuzzleState): Solution {
  const moves = optimalMoves(state);
  const s = applyPerm(toS(state), composePerm(moves));
  if (!allSolved(s, ALL)) throw new Error('A solução ótima não terminou o cubo.');
  // divide em partes de até 4 movimentos para acompanhar com calma
  const parts: string[][] = [];
  for (let i = 0; i < moves.length; i += 4) parts.push(moves.slice(i, i + 4));
  const steps = parts.map((mv, i) => ({
    stageId: 'opt',
    title: `Parte ${i + 1} de ${parts.length}`,
    description:
      (i === 0
        ? `Esta é a <b>menor solução possível</b> para o seu cubo: <b>${moves.length} movimentos</b> (nenhum caminho é mais curto — um 2x2 nunca precisa de mais de 11). `
        : '') +
      (i === parts.length - 1
        ? 'Último trecho! Depois destes movimentos o cubo fica resolvido.'
        : 'Faça estes movimentos com calma, sempre segurando o cubo na mesma posição.') +
      ' Soluções ótimas não seguem etapas humanas — são ótimas para comparar e descobrir atalhos.',
    segments: [{ label: `Movimentos ${i * 4 + 1}–${i * 4 + mv.length}`, moves: mv }],
    focus: [],
  }));
  return {
    method: 'Solução ótima (computador)',
    stages: [{ id: 'opt', name: 'Solução ótima', goal: 'Resolver com o menor número possível de movimentos.' }],
    steps,
  };
}
