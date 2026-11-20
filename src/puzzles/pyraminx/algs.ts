/**
 * Algoritmos do Pyraminx: a última camada (as 3 arestas em volta da ponta de cima), com a base
 * amarela e os centros prontos. São 5 casos. Os algoritmos foram achados por busca (os mais curtos
 * com R, L e U) e conferidos em tests/algs-others.test.ts, que também confere o sentido de cada ciclo.
 */
import { tr } from '../../core/i18n';
import { invertAlg, splitAlg, type AlgCase, type AlgGroup, type AlgSetDef } from '../algkit';
import { invertPyraMove, pyraGeo as geo } from './geometry';

export const PYRA_SETS: AlgSetDef[] = [{ id: 'pyra-top', name: () => tr('Última camada', 'Last layer'), style: 'net' }];

export const PYRA_GROUPS: AlgGroup[] = [
  {
    id: 'pyra-top',
    set: 'pyra-top',
    name: () => tr('As 3 arestas de cima', 'The 3 top edges'),
    about: () =>
      tr(
        'Com a base amarela e os centros prontos, só faltam as 3 arestas em volta da ponta de cima: ou elas giram entre si (ciclo), ou duas estão viradas, ou as duas coisas. O desenho é o Pyraminx aberto, com a base amarela embaixo. O sentido do ciclo é olhando a ponta de cima, com a face verde de frente.',
        'With the yellow bottom and the centers done, only the 3 edges around the top tip are left: they cycle, two are flipped, or both. The picture is the unfolded puzzle, with the yellow bottom at the bottom. The cycle direction is seen from the top tip, with the green face in front.',
      ),
  },
];

export const PYRA_CASES: AlgCase[] = [
  { id: 'pyra-cycle-cw', set: 'pyra-top', group: 'pyra-top', name: ['Ciclo sem virar (horário)', 'Cycle, no flips (clockwise)'], alg: "R' L' U' L U R" },
  { id: 'pyra-cycle-ccw', set: 'pyra-top', group: 'pyra-top', name: ['Ciclo sem virar (anti-horário)', 'Cycle, no flips (counterclockwise)'], alg: "R' U' L' U L R" },
  { id: 'pyra-flip', set: 'pyra-top', group: 'pyra-top', name: ['Duas arestas viradas', 'Two flipped edges'], alg: "R U' R' U R' L R L'" },
  { id: 'pyra-sune-r', set: 'pyra-top', group: 'pyra-top', name: ['Ciclo com duas viradas (anti-horário)', 'Cycle with two flips (counterclockwise)'], alg: "R U R' U R U R'", alt: "L' U L U L' U L" },
  { id: 'pyra-sune-l', set: 'pyra-top', group: 'pyra-top', name: ['Ciclo com duas viradas (horário)', 'Cycle with two flips (clockwise)'], alg: "R U' R' U' R U' R'", alt: "L' U' L U' L' U' L" },
];

const solved = geo.solved();
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);
const topEdgeStickers = new Set(
  geo.edges.filter((e) => geo.stickers[e[0]].verts.includes(0)).flat(),
);

/** o caso do algoritmo, com a camada de cima girada até os centros e a ponta de cima ficarem no lugar */
export function pyraCaseState(alg: string): string[] {
  const s = applyAll(solved, invertAlg(splitAlg(alg), invertPyraMove));
  for (const a of [[], ['U'], ["U'"]]) {
    const t = applyAll(s, a);
    if (t.every((c, i) => c === solved[i] || topEdgeStickers.has(i))) return t;
  }
  return s;
}

export const pyra = { geo, solved, applyAll, topEdgeStickers };
