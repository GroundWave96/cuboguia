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
  if (unknown > 0) return { ok: false, errors: [`Ainda faltam ${unknown} adesivo(s) para pintar.`] };

  for (const f of FACES5) {
    const n = state.filter((c) => c === f).length;
    if (n !== 25) errors.push(`A cor ${name(f)} aparece ${n} vez(es) — deveria aparecer 25.`);
  }
  if (errors.length) return { ok: false, errors };

  const countIn = (ids: number[], label: string) => {
    for (const f of FACES5) {
      const n = ids.filter((i) => state[i] === f).length;
      if (n !== 4)
        errors.push(`Nos centros ${label}, a cor ${name(f)} aparece ${n} vez(es) — cada cor tem 4 peças desse tipo.`);
    }
  };
  countIn(X_CENTERS, 'em X (as 4 quinas do miolo de cada face)');
  countIn(T_CENTERS, 'em cruz (os 4 vizinhos do centro fixo)');

  const valid = new Set(WINGS.map(([a, b]) => FACES5[faceOf5(a)] + FACES5[faceOf5(b)]));
  const seen = new Map<string, number>();
  for (const [a, b] of WINGS) {
    const k = state[a] + state[b];
    if (!valid.has(k)) {
      const opposite = valid.has(state[b] + state[a]);
      errors.push(
        opposite
          ? `Existe uma ponta de aresta ${name(state[a])}-${name(state[b])} virada ao contrário — no 5x5 essas peças não viram no lugar; confira as cores dela.`
          : `Existe uma ponta de aresta com as cores ${name(state[a])}-${name(state[b])}, que não existe num cubo real.`,
      );
      continue;
    }
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of seen)
    if (n > 1) errors.push(`A ponta de aresta ${name(k[0])}-${name(k[1])} aparece ${n} vezes — provavelmente duas cores estão trocadas.`);
  if (errors.length) return { ok: false, errors };

  // o que sobra (cantos, meio das arestas e centros fixos) é um 3x3 de verdade
  const r3 = validateCube3(project3(state));
  return { ok: r3.ok, errors: r3.errors.map((e) => e.replace('Uma aresta está invertida', 'Uma aresta (adesivo do meio) está invertida')) };
}
