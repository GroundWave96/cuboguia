import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { PYRA_COLORS, PYRA_COLOR_NAME } from '../pyraminx/colors';
import { isPieces, readPyramid } from './model';

/** Confere se as cores pintadas (ou lidas pela câmera) formam um Mastermorphix de verdade. */
export function validateMorph(state: PuzzleState): ValidationResult {
  if (isPieces(state)) return { ok: true, errors: [] };
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };
  const errors: string[] = [];
  for (const c of PYRA_COLORS) {
    const n = state.filter((x) => x === c.key).length;
    if (n !== 10) errors.push(msg.colorCount(PYRA_COLOR_NAME[c.key], n, 10));
  }
  if (errors.length) return { ok: false, errors };
  const r = readPyramid(state);
  if (!r.error) return { ok: true, errors: [] };
  if (r.error === 'mids')
    return {
      ok: false,
      errors: [
        tr(
          'Os triângulos do meio das arestas não combinam: em volta de cada face, os 3 meios precisam ter uma cor em comum (a cor daquela face). Confira as cores desses triângulos.',
          'The triangles in the middle of the edges don’t match: around each face, the 3 middles must share one color (that face’s color). Check the colors of those triangles.',
          'Los triángulos del medio de las aristas no coinciden: alrededor de cada cara, los 3 medios tienen que compartir un color (el de esa cara). Revisa los colores de esos triángulos.',
        ),
      ],
    };
  if (r.error === 'piece')
    return {
      ok: false,
      errors: [
        tr(
          'Uma peça ficou com cores que não existem nela (ou na ordem errada) — confira as pontas (3 cores cada) e as pipas.',
          'A piece has colors it doesn’t have (or in the wrong order) — check the tips (3 colors each) and the kites.',
          'Una pieza tiene colores que no existen en ella (o en el orden equivocado): revisa las puntas (3 colores cada una) y las cometas.',
        ),
      ],
    };
  return {
    ok: false,
    errors: [
      tr(
        'Essa combinação não existe num Mastermorphix: provavelmente duas cores foram trocadas na pintura. Confira as pontas (3 cores cada) e os triângulos do centro.',
        'That combination doesn’t exist on a Mastermorphix: two colors were probably swapped while painting. Check the tips (3 colors each) and the center triangles.',
        'Esa combinación no existe en un Mastermorphix: probablemente se cambiaron dos colores al pintar. Revisa las puntas (3 colores cada una) y los triángulos del centro.',
      ),
    ],
  };
}
