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
  if (unknown) return { ok: false, errors: [`Ainda falta${unknown > 1 ? 'm' : ''} ${unknown} adesivo${unknown > 1 ? 's' : ''} para pintar.`] };

  const count = new Map<string, number>();
  for (const c of state) count.set(c, (count.get(c) ?? 0) + 1);
  for (const [c, n] of count) if (n !== 5) errors.push(`A cor ${name(c)} aparece ${n} vezes (deveria aparecer 5: um centro e 4 cantos).`);
  if (errors.length) return { ok: false, errors };

  // centros: uma cor em cada
  const centerColors = geo.centers.map((i) => state[i]);
  const dupCenter = centerColors.find((c, i) => centerColors.indexOf(c) !== i);
  if (dupCenter) errors.push(`Dois centros (o quadrado do meio das faces) estão com a cor ${name(dupCenter)} — cada centro tem uma cor diferente.`);

  // cantos: cada um precisa existir num Skewb de verdade (e só uma vez)
  const seen = new Set<number>();
  for (const pos of geo.corners) {
    const cols = pos.stickers.map((i) => state[i]);
    const home = HOME_CORNERS.findIndex((h) => sameCycle(h, cols));
    if (home < 0) {
      const sameColors = HOME_CORNERS.some((h) => [...h].sort().join() === [...cols].sort().join());
      errors.push(
        sameColors
          ? `O canto ${cols.map(name).join('-')} está com as cores na ordem trocada (como num espelho) — confira esse canto.`
          : `Existe um canto com as cores ${cols.map(name).join('-')}, que não existe num Skewb real.`,
      );
    } else if (seen.has(home)) errors.push(`O canto ${cols.map(name).join('-')} aparece duas vezes.`);
    else seen.add(home);
  }
  if (errors.length) return { ok: false, errors };

  const where = locate(state)!;
  if (!REFERENCE_CORNER.stickers.every((i) => where[i] === i))
    return { ok: false, errors: ['O canto amarelo-verde-laranja precisa ficar em cima, na frente, à direita (amarelo em cima, verde na frente).'] };

  const r = reachable(where);
  if (!r.corners) errors.push('Algum canto está girado (ou dois cantos trocados) de um jeito que não acontece num Skewb de verdade — confira as cores dos cantos.');
  if (!r.centers) errors.push('Dois centros estão trocados de um jeito que não acontece num Skewb de verdade — confira os quadrados do meio das faces.');
  return { ok: errors.length === 0, errors };
}
