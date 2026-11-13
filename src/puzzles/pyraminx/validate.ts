import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { FACE_KEYS, pyraGeo as geo } from './geometry';
import { PYRA_COLOR_NAME } from './colors';
import { optimalCore, pyraToS } from './solver';

const faceKey = (i: number) => FACE_KEYS[Math.floor(i / 9)];
const pieceName = (cols: string[]) => cols.map((c) => PYRA_COLOR_NAME[c] ?? c).join('-');

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

/** mesmas cores na mesma ordem circular (girada) */
const sameCycle = (a: string[], b: string[]) => [0, 1, 2].some((r) => a.every((c, k) => c === b[(k + r) % 3]));

export function validatePyraminx(state: PuzzleState): ValidationResult {
  const errors: string[] = [];
  const unknown = state.filter((c) => c === UNKNOWN).length;
  if (unknown) return { ok: false, errors: [`Ainda faltam ${unknown} adesivo(s) para pintar.`] };
  for (const f of FACE_KEYS) {
    const n = state.filter((c) => c === f).length;
    if (n !== 9) errors.push(`A cor ${PYRA_COLOR_NAME[f]} aparece ${n} vez(es) — deveria aparecer 9.`);
  }
  if (errors.length) return { ok: false, errors };

  // pontas e centros nunca saem do seu vértice: só podem estar girados
  let wrongPlace = false;
  for (const [kind, list] of [['centro', geo.centers], ['ponta', geo.tips]] as const)
    for (const pos of list) {
      const want = pos.map(faceKey);
      const got = pos.map((i) => state[i]);
      if ([...want].sort().join() !== [...got].sort().join()) wrongPlace = true;
      else if (!sameCycle(want, got)) errors.push(`Uma ${kind} com as cores ${pieceName(got)} está com as cores em ordem impossível — confira a pintura.`);
    }
  if (wrongPlace)
    return {
      ok: false,
      errors: [
        'As cores dos centros/pontas não batem com a posição do pyraminx. Segure com o centro SEM amarelo em cima e o centro SEM verde atrás (embaixo), e confira a pintura das pontas e dos centros.',
      ],
    };

  const solvedEdges = geo.edges.map((e) => e.map(faceKey));
  const ep: number[] = [];
  const used = new Set<number>();
  for (const pos of geo.edges) {
    const [a, b] = pos.map((i) => state[i]);
    const j = solvedEdges.findIndex((se) => (se[0] === a && se[1] === b) || (se[0] === b && se[1] === a));
    if (j < 0) {
      errors.push(`Existe uma aresta com as cores ${pieceName([a, b])}, que não existe num pyraminx real.`);
      continue;
    }
    if (used.has(j)) errors.push(`A aresta ${pieceName(solvedEdges[j])} aparece duas vezes.`);
    used.add(j);
    ep.push(j);
  }
  if (errors.length) return { ok: false, errors };
  if (parity(ep)) errors.push('Duas arestas estão trocadas de lugar — confira as cores das arestas.');
  if (errors.length) return { ok: false, errors };
  // aresta virada sozinha: o solucionador ótimo não encontra solução
  try {
    optimalCore(pyraToS(state));
  } catch {
    return { ok: false, errors: ['Uma aresta está invertida — confira as cores das arestas (peças de 2 cores).'] };
  }
  return { ok: true, errors: [] };
}
