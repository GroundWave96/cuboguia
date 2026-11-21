import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { COLOR_NAME } from '../cube3/colors';
import { validateCube3 } from '../cube3/validate';
import { FACES5, T_CENTERS, WINGS, X_CENTERS, faceOf5, project3 } from './pieces';

const name = (c: string) => COLOR_NAME[c] ?? c;

/**
 * Verifica se o 5x5 pintado pode existir:
 *  - 25 adesivos de cada cor
 *  - centros em X e em cruz: 4 de cada cor em cada tipo
 *  - pontas das arestas: cada uma das 24 aparece uma vez (elas não viram no lugar)
 *  - cantos, meio das arestas e centros fixos: as mesmas regras de um 3x3
 */
export function validateCube5(state: PuzzleState): ValidationResult {
  const errors: string[] = [];
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown > 0) return { ok: false, errors: [msg.missing(unknown)] };

  for (const f of FACES5) {
    const n = state.filter((c) => c === f).length;
    if (n !== 25) errors.push(msg.colorCount(name(f), n, 25));
  }
  if (errors.length) return { ok: false, errors };

  const countIn = (ids: number[], label: [string, string, string]) => {
    for (const f of FACES5) {
      const n = ids.filter((i) => state[i] === f).length;
      if (n !== 4)
        errors.push(
          tr(
            `Nos centros ${label[0]}, a cor ${name(f)} aparece ${n} ${n === 1 ? 'vez' : 'vezes'} — cada cor tem 4 peças desse tipo.`,
            `Among the ${label[1]} centers, the color ${name(f)} appears ${n} ${n === 1 ? 'time' : 'times'} — each color has 4 pieces of this kind.`, `Entre los centros ${label[2]}, el color ${name(f)} aparece ${n} ${n === 1 ? 'vez' : 'veces'}; cada color tiene 4 piezas de este tipo.`,
          ),
        );
    }
  };
  countIn(X_CENTERS, ['em X (as 4 quinas do miolo de cada face)', 'X (the 4 corners of each face’s middle)', 'en X (las 4 esquinas del centro de cada cara)']);
  countIn(T_CENTERS, ['em cruz (os 4 vizinhos do centro fixo)', 'cross-shaped (the 4 neighbors of the fixed center)', 'en cruz (los 4 vecinos del centro fijo)']);

  const valid = new Set(WINGS.map(([a, b]) => FACES5[faceOf5(a)] + FACES5[faceOf5(b)]));
  const seen = new Map<string, number>();
  for (const [a, b] of WINGS) {
    const k = state[a] + state[b];
    if (!valid.has(k)) {
      const opposite = valid.has(state[b] + state[a]);
      errors.push(
        opposite
          ? tr(
              `Existe uma ponta de aresta ${name(state[a])}-${name(state[b])} virada ao contrário — no 5x5 essas peças não viram no lugar; confira as cores dela.`,
              `There’s a ${name(state[a])}-${name(state[b])} edge wing flipped the wrong way — on a 5x5 these pieces can’t flip in place; check its colors.`, `Hay una mitad de arista ${name(state[a])}-${name(state[b])} volteada al revés; en el 5x5 estas piezas no se voltean en su sitio: revisa sus colores.`,
            )
          : tr(
              `Existe uma ponta de aresta com as cores ${name(state[a])}-${name(state[b])}, que não existe num cubo real.`,
              `There’s an edge wing with the colors ${name(state[a])}-${name(state[b])}, which doesn’t exist on a real cube.`, `Hay una mitad de arista con los colores ${name(state[a])}-${name(state[b])}, que no existe en un cubo real.`,
            ),
      );
      continue;
    }
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of seen)
    if (n > 1)
      errors.push(
        tr(
          `A ponta de aresta ${name(k[0])}-${name(k[1])} aparece ${n} vezes — provavelmente duas cores estão trocadas.`,
          `The ${name(k[0])}-${name(k[1])} edge wing appears ${n} times — two colors are probably swapped.`, `La mitad de arista ${name(k[0])}-${name(k[1])} aparece ${n} veces; probablemente hay dos colores intercambiados.`,
        ),
      );
  if (errors.length) return { ok: false, errors };

  // o que sobra (cantos, meio das arestas e centros fixos) é um 3x3 de verdade
  const r3 = validateCube3(project3(state));
  const flipped = msg.flippedEdge();
  const flipped5 = tr(
    'Uma aresta (adesivo do meio) está invertida — confira as cores das arestas (peças de 2 cores).',
    'An edge (middle sticker) is flipped — check the edge colors (the 2-color pieces).', 'Una arista (pegatina del medio) está volteada: revisa los colores de las aristas (las piezas de 2 colores).',
  );
  return { ok: r3.ok, errors: r3.errors.map((e) => (e === flipped ? flipped5 : e)) };
}
