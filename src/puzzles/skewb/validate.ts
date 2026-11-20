import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import { UNKNOWN, type PuzzleState, type ValidationResult } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { REFERENCE_CORNER, skewbGeo as geo } from './geometry';
import { SKEWB_SOLVED as SOLVED, locate, reachable } from './solver';

const name = (k: string) => COLOR_NAME[k] ?? k;
const sameCycle = (a: string[], b: string[]) => [0, 1, 2].some((r) => a.every((c, i) => c === b[(i + r) % 3]));
const HOME_CORNERS = geo.corners.map((c) => c.stickers.map((i) => SOLVED[i]));

export function validateSkewb(state: PuzzleState): ValidationResult {
  const errors: string[] = [];
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };

  const count = new Map<string, number>();
  for (const c of state) count.set(c, (count.get(c) ?? 0) + 1);
  for (const [c, n] of count) if (n !== 5) errors.push(msg.colorCount(name(c), n, 5, [': um centro e 4 cantos', ': one center and 4 corners']));
  if (errors.length) return { ok: false, errors };

  // centros: uma cor em cada
  const centerColors = geo.centers.map((i) => state[i]);
  const dupCenter = centerColors.find((c, i) => centerColors.indexOf(c) !== i);
  if (dupCenter)
    errors.push(
      tr(
        `Dois centros (o quadrado do meio das faces) estão com a cor ${name(dupCenter)} — cada centro tem uma cor diferente.`,
        `Two centers (the square in the middle of the faces) are ${name(dupCenter)} — each center has a different color.`,
      ),
    );

  // cantos: cada um precisa existir num Skewb de verdade (e só uma vez)
  const seen = new Set<number>();
  for (const pos of geo.corners) {
    const cols = pos.stickers.map((i) => state[i]);
    const home = HOME_CORNERS.findIndex((h) => sameCycle(h, cols));
    if (home < 0) {
      const sameColors = HOME_CORNERS.some((h) => [...h].sort().join() === [...cols].sort().join());
      errors.push(
        sameColors
          ? msg.mirrorCorner(cols.map(name).join('-'))
          : msg.noCorner(cols.map(name).join('-')),
      );
    } else if (seen.has(home)) errors.push(msg.dupCorner(cols.map(name).join('-')));
    else seen.add(home);
  }
  if (errors.length) return { ok: false, errors };

  const where = locate(state)!;
  if (!REFERENCE_CORNER.stickers.every((i) => where[i] === i))
    return {
      ok: false,
      errors: [
        tr(
          'O canto amarelo-verde-laranja precisa ficar em cima, na frente, à direita (amarelo em cima, verde na frente).',
          'The yellow-green-orange corner must be at the top front right (yellow on top, green in front).',
        ),
      ],
    };

  const r = reachable(where);
  if (!r.corners)
    errors.push(
      tr(
        'Algum canto está girado (ou dois cantos trocados) de um jeito que não acontece num Skewb de verdade — confira as cores dos cantos.',
        'A corner is twisted (or two corners are swapped) in a way that can’t happen on a real Skewb — check the corner colors.',
      ),
    );
  if (!r.centers)
    errors.push(
      tr(
        'Dois centros estão trocados de um jeito que não acontece num Skewb de verdade — confira os quadrados do meio das faces.',
        'Two centers are swapped in a way that can’t happen on a real Skewb — check the squares in the middle of the faces.',
      ),
    );
  return { ok: errors.length === 0, errors };
}
