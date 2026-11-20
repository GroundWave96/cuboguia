import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { FACES, megaGeo as geo } from './geometry';
import { MEGA_COLOR_NAME } from './colors';

const faceKey = (i: number) => FACES[Math.floor(i / 11)];
const pieceName = (cols: string[]) => cols.map((c) => MEGA_COLOR_NAME[c] ?? c).join('-');

function parity(p: number[]): number {
  let s = 0;
  const seen = new Array(p.length).fill(false);
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = p[j]) {
      seen[j] = true;
      len++;
    }
    s += len - 1;
  }
  return s % 2;
}

/**
 * Validação do megaminx: contagem de cores, peças que existem e paridade
 * (todo giro é um ciclo de 5, então cantos e arestas sempre têm permutação par).
 * Cantos torcidos ou arestas invertidas sozinhos são detectados pelo solucionador.
 */
export function validateMegaminx(state: PuzzleState): ValidationResult {
  const errors: string[] = [];
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };
  for (const f of FACES) {
    const n = state.filter((c) => c === f).length;
    if (n !== 11) errors.push(msg.colorCount(MEGA_COLOR_NAME[f], n, 11));
  }
  if (errors.length) return { ok: false, errors };

  const solvedCorners = geo.corners.map((c) => c.map(faceKey));
  const cp: number[] = [];
  const usedC = new Set<number>();
  for (const pos of geo.corners) {
    const cols = pos.map((i) => state[i]);
    const j = solvedCorners.findIndex((sc) => [0, 1, 2].some((r) => sc.every((c, k) => c === cols[(k + r) % 3])));
    if (j < 0) {
      errors.push(msg.noCorner(pieceName(cols)));
      continue;
    }
    if (usedC.has(j)) errors.push(msg.dupCorner(pieceName(solvedCorners[j])));
    usedC.add(j);
    cp.push(j);
  }
  const solvedEdges = geo.edges.map((e) => e.map(faceKey));
  const ep: number[] = [];
  const usedE = new Set<number>();
  for (const pos of geo.edges) {
    const [a, b] = pos.map((i) => state[i]);
    const j = solvedEdges.findIndex((se) => (se[0] === a && se[1] === b) || (se[0] === b && se[1] === a));
    if (j < 0) {
      errors.push(msg.noEdge(pieceName([a, b])));
      continue;
    }
    if (usedE.has(j)) errors.push(msg.dupEdge(pieceName(solvedEdges[j])));
    usedE.add(j);
    ep.push(j);
  }
  if (errors.length) return { ok: false, errors };
  if (parity(cp) !== 0) errors.push(tr('Dois cantos estão trocados de lugar — confira as cores dos cantos.', 'Two corners are swapped — check the corner colors.'));
  if (parity(ep) !== 0) errors.push(tr('Duas arestas estão trocadas de lugar — confira as cores das arestas.', 'Two edges are swapped — check the edge colors.'));
  return { ok: errors.length === 0, errors };
}
