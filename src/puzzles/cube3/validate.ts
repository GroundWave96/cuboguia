import { msg } from '../../core/messages';
import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { CORNER_COLORS, CORNER_FACELETS, EDGE_COLORS, EDGE_FACELETS, FACES } from './pieces';
import { COLOR_NAME } from './colors';

const pieceName = (cols: string[]) => cols.map((c) => COLOR_NAME[c] ?? c).join('-');

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
 * Verifica se um estado pintado corresponde a um cubo 3x3 possível de resolver.
 * Mensagens em português para mostrar ao usuário.
 */
export function validateCube3(state: PuzzleState): ValidationResult {
  const errors: string[] = [];

  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown > 0) {
    errors.push(msg.missing(unknown));
    return { ok: false, errors };
  }

  for (const f of FACES) {
    const n = state.filter((c) => c === f).length;
    if (n !== 9) errors.push(msg.colorCount(COLOR_NAME[f], n, 9));
  }
  if (errors.length) return { ok: false, errors };

  const cp: number[] = [];
  let twist = 0;
  const usedC = new Set<number>();
  for (let i = 0; i < 8; i++) {
    const cols = CORNER_FACELETS[i].map((f) => state[f]);
    const ori = cols.findIndex((c) => c === 'U' || c === 'D');
    const rot = ori < 0 ? null : [cols[ori], cols[(ori + 1) % 3], cols[(ori + 2) % 3]];
    const j = rot ? CORNER_COLORS.findIndex((cc) => cc.every((c, k) => c === rot[k])) : -1;
    if (j < 0) {
      errors.push(msg.noCorner(pieceName(cols)));
      continue;
    }
    if (usedC.has(j)) errors.push(msg.dupCorner(pieceName(CORNER_COLORS[j])));
    usedC.add(j);
    cp.push(j);
    twist += ori;
  }

  const ep: number[] = [];
  let flip = 0;
  const usedE = new Set<number>();
  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELETS[i].map((f) => state[f]);
    let j = EDGE_COLORS.findIndex((ec) => ec[0] === a && ec[1] === b);
    let ori = 0;
    if (j < 0) {
      j = EDGE_COLORS.findIndex((ec) => ec[0] === b && ec[1] === a);
      ori = 1;
    }
    if (j < 0) {
      errors.push(msg.noEdge(pieceName([a, b])));
      continue;
    }
    if (usedE.has(j)) errors.push(msg.dupEdge(pieceName(EDGE_COLORS[j])));
    usedE.add(j);
    ep.push(j);
    flip += ori;
  }

  if (errors.length) return { ok: false, errors };

  if (twist % 3 !== 0)
    errors.push(msg.twistedCorner());
  if (flip % 2 !== 0)
    errors.push(msg.flippedEdge());
  if (parity(cp) !== parity(ep))
    errors.push(msg.swapped());

  return { ok: errors.length === 0, errors };
}
