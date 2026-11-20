import { tr } from '../../core/i18n';
import { msg } from '../../core/messages';
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
  if (unknown) return { ok: false, errors: [msg.missing(unknown)] };
  for (const f of FACE_KEYS) {
    const n = state.filter((c) => c === f).length;
    if (n !== 9) errors.push(msg.colorCount(PYRA_COLOR_NAME[f], n, 9));
  }
  if (errors.length) return { ok: false, errors };

  // pontas e centros nunca saem do seu vértice: só podem estar girados
  let wrongPlace = false;
  for (const [kind, list] of [
    [['Um centro', 'A center'], geo.centers],
    [['Uma ponta', 'A tip'], geo.tips],
  ] as const)
    for (const pos of list) {
      const want = pos.map(faceKey);
      const got = pos.map((i) => state[i]);
      if ([...want].sort().join() !== [...got].sort().join()) wrongPlace = true;
      else if (!sameCycle(want, got))
        errors.push(
          tr(
            `${kind[0]} com as cores ${pieceName(got)} está com as cores em ordem impossível — confira a pintura.`,
            `${kind[1]} with the colors ${pieceName(got)} has its colors in an impossible order — check the painting.`,
          ),
        );
    }
  if (wrongPlace)
    return {
      ok: false,
      errors: [
        tr(
          'As cores dos centros/pontas não batem com a posição do pyraminx. Segure com o centro SEM amarelo em cima e o centro SEM verde atrás (embaixo), e confira a pintura das pontas e dos centros.',
          'The center/tip colors don’t match the Pyraminx position. Hold it with the center WITHOUT yellow on top and the center WITHOUT green at the back (bottom), and check how the tips and centers were painted.',
        ),
      ],
    };

  const solvedEdges = geo.edges.map((e) => e.map(faceKey));
  const ep: number[] = [];
  const used = new Set<number>();
  for (const pos of geo.edges) {
    const [a, b] = pos.map((i) => state[i]);
    const j = solvedEdges.findIndex((se) => (se[0] === a && se[1] === b) || (se[0] === b && se[1] === a));
    if (j < 0) {
      errors.push(msg.noEdge(pieceName([a, b])));
      continue;
    }
    if (used.has(j)) errors.push(msg.dupEdge(pieceName(solvedEdges[j])));
    used.add(j);
    ep.push(j);
  }
  if (errors.length) return { ok: false, errors };
  if (parity(ep)) errors.push(tr('Duas arestas estão trocadas de lugar — confira as cores das arestas.', 'Two edges are swapped — check the edge colors.'));
  if (errors.length) return { ok: false, errors };
  // aresta virada sozinha: o solucionador ótimo não encontra solução
  try {
    optimalCore(pyraToS(state));
  } catch {
    return { ok: false, errors: [msg.flippedEdge()] };
  }
  return { ok: true, errors: [] };
}
