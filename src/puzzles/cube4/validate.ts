import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import { UNKNOWN, type PuzzleState, type ValidationResult } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { CORNERS4, WING_POSITIONS, geo4 as geo, partner } from './pieces';

const name = (k: string) => COLOR_NAME[k] ?? k;
const SOLVED = geo.solved();
const sameCycle = (a: string[], b: string[]) => [0, 1, 2].some((r) => a.every((c, i) => c === b[(i + r) % 3]));
const HOME_CORNERS = CORNERS4.map((c) => c.map((i) => SOLVED[i]));
/** cada ponta, lida a partir do adesivo da classe 0: cor dele + cor do parceiro */
const HOME_WINGS = WING_POSITIONS.map((p) => SOLVED[p] + SOLVED[partner(p)]);

/**
 * No 4x4, centros e pontas podem ficar em qualquer ordem (nada é fixo); o que precisa
 * bater é: 16 de cada cor, cantos e pontas que existem (cada um uma vez) e o giro dos cantos.
 */
export function validateCube4(state: PuzzleState): ValidationResult {
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };
  const errors: string[] = [];
  const count = new Map<string, number>();
  for (const c of state) count.set(c, (count.get(c) ?? 0) + 1);
  for (const [c, n] of count) if (n !== 16) errors.push(msg.colorCount(name(c), n, 16));
  if (errors.length) return { ok: false, errors };

  const seenCorner = new Set<number>();
  let twist = 0;
  for (const pos of CORNERS4) {
    const cols = pos.map((i) => state[i]);
    const home = HOME_CORNERS.findIndex((h) => sameCycle(h, cols));
    if (home < 0) {
      const mirrored = HOME_CORNERS.some((h) => [...h].sort().join() === [...cols].sort().join());
      errors.push(
        mirrored
          ? msg.mirrorCorner(cols.map(name).join('-'))
          : msg.noCorner(cols.map(name).join('-')),
      );
      continue;
    }
    if (seenCorner.has(home)) errors.push(msg.dupCorner(cols.map(name).join('-')));
    seenCorner.add(home);
    // giro: em que posição está o adesivo amarelo/branco (o primeiro adesivo do canto é o de cima/baixo)
    twist += cols.findIndex((c) => c === 'U' || c === 'D');
  }

  const seenWing = new Set<string>();
  for (const p of WING_POSITIONS) {
    const w = state[p] + state[partner(p)];
    const pairText = `${name(state[p])}-${name(state[partner(p)])}`;
    if (!HOME_WINGS.includes(w)) {
      errors.push(msg.noEdge(pairText));
      continue;
    }
    // cada aresta tem duas pontas, uma em cada sentido: uma ponta pintada ao contrário vira repetida
    if (seenWing.has(w))
      errors.push(
        tr(
          `A ponta de aresta ${pairText} aparece mais de uma vez — cada aresta tem duas pontas, uma de cada lado; confira se alguma ficou com as cores ao contrário.`,
          `The ${pairText} edge wing appears more than once — every edge has two wings, one on each side; check whether one has its colors reversed.`, `La mitad de arista ${pairText} aparece más de una vez; cada arista tiene dos mitades, una de cada lado: revisa si alguna tiene los colores invertidos.`,
        ),
      );
    seenWing.add(w);
  }
  if (errors.length) return { ok: false, errors };
  if (twist % 3 !== 0) errors.push(msg.twistedCorner());
  return { ok: errors.length === 0, errors };
}
