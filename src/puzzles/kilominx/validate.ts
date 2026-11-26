import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { KILO_COLORS, KILO_COLOR_NAME } from './colors';
import { CORNERS, parity, readCorners } from './model';

const names = (cols: string[]) => cols.map((c) => KILO_COLOR_NAME[c] ?? c).join(' / ');

/**
 * Confere se as cores formam um Kilominx de verdade: 5 de cada cor, cantos que existem (com as
 * cores no sentido certo), nenhum repetido, e as duas regras de todo giro: os cantos sempre
 * trocam de lugar em número par e a soma dos giros dos cantos não muda.
 */
export function validateKilominx(state: PuzzleState): ValidationResult {
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };
  const errors: string[] = [];
  for (const c of KILO_COLORS) {
    const n = state.filter((x) => x === c.key).length;
    if (n !== 5) errors.push(msg.colorCount(KILO_COLOR_NAME[c.key], n, 5));
  }
  if (errors.length) return { ok: false, errors };
  const r = readCorners(state as string[]);
  if ('error' in r) {
    const cols = CORNERS[r.slot].map((i) => state[i]);
    return { ok: false, errors: [r.error === 'dup' ? msg.dupCorner(names(cols)) : msg.noCorner(names(cols))] };
  }
  if (parity(r.piece) !== 0)
    errors.push(tr('Dois cantos estão trocados de lugar — confira as cores dos cantos.', 'Two corners are swapped — check the corner colors.', 'Hay dos esquinas intercambiadas: revisa los colores de las esquinas.'));
  if (r.twist.reduce((a, b) => a + b, 0) % 3 !== 0)
    errors.push(tr('Um canto está girado sozinho — confira as cores dos cantos.', 'One corner is twisted on its own — check the corner colors.', 'Una esquina está girada sola: revisa los colores de las esquinas.'));
  return { ok: errors.length === 0, errors };
}
