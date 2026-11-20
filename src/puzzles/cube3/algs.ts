/**
 * Algoritmos da última camada do 3x3: OLL em 2 etapas (10 casos), OLL completa (57) e PLL (21).
 *
 * OLL completa: números, grupos e algoritmos da folha de OLL de Feliks Zemdegs e Andy Klise
 * (CubeSkills), na ordem sugerida para aprender. O caso de cada algoritmo é calculado
 * (o algoritmo ao contrário num cubo resolvido) e conferido em tests/algs.test.ts.
 */
import { tr } from '../../core/i18n';
import { nxnKit, splitAlg, type AlgCase, type AlgGroup, type AlgSetDef } from '../algkit';

export type { AlgCase, AlgGroup } from '../algkit';
export { invertAlg, splitAlg } from '../algkit';

export const CUBE3_SETS: AlgSetDef[] = [
  { id: 'oll2', name: () => tr('OLL em 2 etapas', '2-look OLL'), style: 'oll' },
  { id: 'oll', name: () => tr('OLL completa', 'Full OLL'), style: 'oll' },
  { id: 'pll', name: () => 'PLL', style: 'pll' },
];

const g = (id: string, set: string, name: [string, string], about: [string, string]): AlgGroup => ({ id, set, name: () => tr(...name), about: () => tr(...about) });

export const ALG_GROUPS: AlgGroup[] = [
  g('oll-edges', 'oll2', ['1ª etapa · cruz amarela', 'Step 1 · yellow cross'], [
    'Olhe só as <b>arestas</b> amarelas do topo (ignore os cantos): um ponto, um L ou uma linha. Segure o L no canto de trás à esquerda e a linha deitada.',
    'Look only at the yellow <b>edges</b> on top (ignore the corners): a dot, an L or a line. Hold the L at the back-left and the line horizontal.',
  ]),
  g('oll-corners', 'oll2', ['2ª etapa · cantos', 'Step 2 · corners'], [
    'Com a cruz pronta, conte os cantos já amarelos no topo e olhe para onde apontam os outros adesivos amarelos (nas laterais).',
    'With the cross done, count the corners already yellow on top and see where the other yellow stickers point (on the sides).',
  ]),
  // ---- OLL completa (ordem sugerida para aprender)
  g('ollf-ocll', 'oll', ['Cruz já pronta (OCLL)', 'Cross already done (OCLL)'], ['Os mesmos 7 casos da 2ª etapa: as arestas já estão amarelas.', 'The same 7 cases as step 2: the edges are already yellow.']),
  g('ollf-t', 'oll', ['Formato T', 'T shapes'], ['O amarelo forma um T no topo.', 'The yellow forms a T on top.']),
  g('ollf-square', 'oll', ['Quadrados', 'Squares'], ['Um quadrado 2×2 amarelo num canto.', 'A yellow 2×2 square in one corner.']),
  g('ollf-c', 'oll', ['Formato C', 'C shapes'], ['O amarelo forma um C (ou U).', 'The yellow forms a C (or U).']),
  g('ollf-w', 'oll', ['Formato W', 'W shapes'], ['O amarelo forma uma escadinha (W).', 'The yellow forms a little staircase (W).']),
  g('ollf-edges', 'oll', ['Cantos prontos, arestas viradas', 'Corners done, edges flipped'], ['Os 4 cantos já estão amarelos; faltam arestas.', 'All 4 corners are already yellow; some edges are not.']),
  g('ollf-p', 'oll', ['Formato P', 'P shapes'], ['O amarelo forma um P (um quadrado com uma perninha).', 'The yellow forms a P (a square with a little leg).']),
  g('ollf-i', 'oll', ['Formato I (linha)', 'I shapes (line)'], ['Uma linha amarela atravessa o topo.', 'A yellow line crosses the top.']),
  g('ollf-fish', 'oll', ['Peixes', 'Fish'], ['O amarelo forma um peixinho na diagonal.', 'The yellow forms a little fish along the diagonal.']),
  g('ollf-knight', 'oll', ['Movimento do cavalo', 'Knight move'], ['O amarelo lembra o L do cavalo no xadrez.', 'The yellow looks like a chess knight’s L move.']),
  g('ollf-awkward', 'oll', ['Desajeitados', 'Awkward'], ['Formatos sem nome fácil: duas arestas em linha e cantos espalhados.', 'Shapes without an easy name: two edges in a line and scattered corners.']),
  g('ollf-l', 'oll', ['Formato L', 'L shapes'], ['Só um L de arestas no topo (canto do meio e duas arestas).', 'Just an L of edges on top (the center and two edges).']),
  g('ollf-lightning', 'oll', ['Raios', 'Lightning bolts'], ['O amarelo forma um raio (zigue-zague).', 'The yellow forms a lightning bolt (zigzag).']),
  g('ollf-dot', 'oll', ['Pontos (nenhuma aresta)', 'Dots (no edges)'], ['Nenhuma aresta amarela no topo: só o centro (e às vezes cantos).', 'No yellow edges on top: just the center (and sometimes corners).']),
  // ---- PLL
  g('pll-edges', 'pll', ['Só arestas', 'Edges only'], ['Os cantos já estão no lugar: só as arestas trocam.', 'The corners are already solved: only the edges move.']),
  g('pll-corners', 'pll', ['Só cantos', 'Corners only'], ['As arestas já estão no lugar: só os cantos trocam.', 'The edges are already solved: only the corners move.']),
  g('pll-adjacent', 'pll', ['Troca de cantos vizinhos', 'Adjacent corner swap'], [
    'Há um par de “faróis” (dois cantos iguais num lado): os cantos que trocam ficam lado a lado.',
    'There is one pair of “headlights” (two matching corners on one side): the swapped corners are next to each other.',
  ]),
  g('pll-diagonal', 'pll', ['Troca de cantos na diagonal', 'Diagonal corner swap'], ['Nenhum lado tem faróis: os cantos trocam na diagonal.', 'No side has headlights: the corners swap diagonally.']),
  g('pll-g', 'pll', ['G-perms', 'G-perms'], [
    'Três cantos e três arestas giram juntos. Procure o bloco 1×2 e os faróis para saber qual dos quatro é.',
    'Three corners and three edges cycle together. Look for the 1×2 block and the headlights to tell the four apart.',
  ]),
];

/** OLL completa: [número, grupo, algoritmo, alternativo?] */
const OLL_FULL: [number, string, string, string?][] = [
  [21, 'ocll', "(R U2 R') (U' R U R') (U' R U' R')", "y (R U R' U) (R U' R' U) (R U2' R')"],
  [22, 'ocll', "R U2' R2' U' R2 U' R2' U2' R"],
  [23, 'ocll', "R2 D (R' U2 R) D' (R' U2 R')", "y2 R2' D' (R U2 R') D (R U2 R)"],
  [24, 'ocll', "(r U R' U') (r' F R F')", "y (R U R D) (R' U' R D') R2'"],
  [25, 'ocll', "y F' (r U R' U') r' F R", "x (R' U R) D' (R' U' R) D x'"],
  [26, 'ocll', "R U2 R' U' R U' R'", "y' R' U' R U' R' U2 R"],
  [27, 'ocll', "R U R' U R U2' R'", "y' R' U2' R U R' U R"],
  [33, 't', "(R U R' U') (R' F R F')"],
  [45, 't', "F (R U R' U') F'"],
  [5, 'square', "(r' U2' R U R' U r)"],
  [6, 'square', "(r U2 R' U' R U' r')"],
  [34, 'c', "(R U R2' U') (R' F R U) R U' F'"],
  [46, 'c', "R' U' (R' F R F') U R"],
  [36, 'w', "(R' U' R U') (R' U R U) l U' R' U x", "y2 (R U R' F') (R U R' U') (R' F R U') (R' F R F')"],
  [38, 'w', "(R U R' U) (R U' R' U') (R' F R F')"],
  [28, 'edges', "(r U R' U') M (U R U' R')"],
  [57, 'edges', "(R U R' U') M' (U R U' r')"],
  [31, 'p', "(R' U' F) (U R U' R') F' R"],
  [32, 'p', "R U B' (U' R' U) (R B R')", "S (R U R' U') (R' F R f')"],
  [43, 'p', "y R' U' F' U F R", "f' (L' U' L U) f"],
  [44, 'p', "f (R U R' U') f'", "y2 F (U R U' R') F'"],
  [51, 'i', "f (R U R' U') (R U R' U') f'", "y2 F (U R U' R') (U R U' R') F'"],
  [56, 'i', "r' U' r (U' R' U R) (U' R' U R) r' U r"],
  [52, 'i', "(R' U' R U' R' U) y' (R' U R) B", "(R U R' U R U') y (R U' R') F'"],
  [55, 'i', "y (R' F R U) (R U' R2' F') R2 U' R' (U R U R')"],
  [9, 'fish', "(R U R' U') R' F (R2 U R' U') F'", "(R' U' R) y r U' r' U r U r'"],
  [10, 'fish', "(R U R' U) (R' F R F') (R U2' R')", "(R U R') y (R' F R U') (R' F' R)"],
  [35, 'fish', "(R U2') (R2' F R F') (R U2' R')"],
  [37, 'fish', "F (R U' R' U') (R U R' F')"],
  [13, 'knight', "(r U' r') (U' r U r') y' (R' U R)", "F U R U' R2' F' R U (R U' R')"],
  [14, 'knight', "(R' F R) (U R' F' R) (F U' F')"],
  [15, 'knight', "(r' U' r) (R' U' R U) (r' U r)"],
  [16, 'knight', "(r U r') (R U R' U') (r U' r')"],
  [29, 'awkward', "y (R U R' U') (R U' R') (F' U' F) (R U R')", "M U (R U R' U') (R' F R F') M'"],
  [30, 'awkward', "y' F U (R U2 R' U') (R U2 R' U') F'", "y' (F R' F) (R2 U' R' U') (R U R') F2"],
  [41, 'awkward', "(R U R' U R U2' R') F (R U R' U') F'"],
  [42, 'awkward', "(R' U' R U' R' U2 R) F (R U R' U') F'", "y (R' F R F') (R' F R F') (R U R' U') (R U R')"],
  [47, 'l', "F' (L' U' L U) (L' U' L U) F", "R' U' (R' F R F') (R' F R F') U R"],
  [48, 'l', "F (R U R' U') (R U R' U') F'"],
  [49, 'l', "r U' r2' U r2 U r2' U' r"],
  [50, 'l', "r' U r2 U' r2' U' r2 U r'", "y' (R U2 R' U' R U' R') F (R U R' U') F'"],
  [53, 'l', "(r' U' R U') (R' U R U') R' U2 r", "y r' U2' R (U R' U' R) (U R' U r)"],
  [54, 'l', "(r U R' U) (R U' R' U) R U2' r'", "y' (r U2 R' U') (R U R' U') R U' r'"],
  [7, 'lightning', "(r U R' U R U2' r')"],
  [8, 'lightning', "(r' U' R U' R' U2 r)", "y2 l' U' L U' L' U2 l"],
  [11, 'lightning', "r' (R2 U R' U R U2 R') U M'"],
  [12, 'lightning', "M' (R' U' R U' R' U2 R) U' M", "y F (R U R' U') F' U F (R U R' U') F'"],
  [39, 'lightning', "(L F') (L' U' L U) F U' L'", "F (R U R' U') F' (R' U' R U' R' U2 R)"],
  [40, 'lightning', "(R' F) (R U R' U') F' U R"],
  [1, 'dot', "(R U2') (R2' F R F') U2' (R' F R F')"],
  [2, 'dot', "F (R U R' U') F' f (R U R' U') f'", "y (r U r') U2 R U2' R' U2 (r U' r')"],
  [3, 'dot', "f (R U R' U') f' U' F (R U R' U') F'"],
  [4, 'dot', "f (R U R' U') f' U F (R U R' U') F'"],
  [17, 'dot', "(R U R' U) (R' F R F') U2' (R' F R F')"],
  [18, 'dot', "y R U2' (R2' F R F') U2' M' (U R U' r')", "(r U R' U R U2 r') (r' U' R U' R' U2 r)"],
  [19, 'dot', "M U (R U R' U') M' (R' F R F')"],
  [20, 'dot', "M U (R U R' U') M2' (U R U' r')", "(r U R' U') M2' (U R U' R') U' M'"],
];
/** apelidos famosos da OLL completa */
const OLL_NICK: Record<number, [string, string]> = {
  21: ['H', 'H'],
  22: ['Pi', 'Pi'],
  23: ['faróis', 'headlights'],
  24: ['T', 'T'],
  25: ['gravata', 'bowtie'],
  26: ['Antisune', 'Antisune'],
  27: ['Sune', 'Sune'],
};

/** algoritmo legível: sem parênteses e com "2'" virando "2" */
const clean = (alg: string) => splitAlg(alg).join(' ');

export const ALG_CASES: AlgCase[] = [
  // ---- OLL em 2 etapas: arestas
  { id: 'oll-dot', set: 'oll2', group: 'oll-edges', name: ['Ponto', 'Dot'], alg: "F R U R' U' F' f R U R' U' f'" },
  { id: 'oll-l', set: 'oll2', group: 'oll-edges', name: 'L', alg: "f R U R' U' f'" },
  { id: 'oll-line', set: 'oll2', group: 'oll-edges', name: ['Linha', 'Line'], alg: "F R U R' U' F'" },
  // ---- OLL em 2 etapas: cantos
  { id: 'oll-sune', set: 'oll2', group: 'oll-corners', name: 'Sune', alg: "R U R' U R U2 R'" },
  { id: 'oll-antisune', set: 'oll2', group: 'oll-corners', name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { id: 'oll-h', set: 'oll2', group: 'oll-corners', name: 'H', alg: "R U R' U R U' R' U R U2 R'" },
  { id: 'oll-pi', set: 'oll2', group: 'oll-corners', name: 'Pi', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: 'oll-u', set: 'oll2', group: 'oll-corners', name: ['U (faróis)', 'U (headlights)'], alg: "R2 D R' U2 R D' R' U2 R'" },
  { id: 'oll-t', set: 'oll2', group: 'oll-corners', name: 'T', alg: "r U R' U' r' F R F'" },
  { id: 'oll-bowtie', set: 'oll2', group: 'oll-corners', name: ['L (gravata)', 'L (bowtie)'], alg: "F' r U R' U' r' F R" },
  // ---- OLL completa
  ...OLL_FULL.map(([n, group, alg, alt]): AlgCase => {
    const nick = OLL_NICK[n];
    return { id: `ollf-${n}`, set: 'oll', group: `ollf-${group}`, name: nick ? [`OLL ${n} · ${nick[0]}`, `OLL ${n} · ${nick[1]}`] : `OLL ${n}`, alg: clean(alg), alt: alt && clean(alt) };
  }),
  // ---- PLL: só arestas
  { id: 'pll-ua', set: 'pll', group: 'pll-edges', name: 'Ua', alg: "M2 U M U2 M' U M2", alt: "R U' R U R U R U' R' U' R2" },
  { id: 'pll-ub', set: 'pll', group: 'pll-edges', name: 'Ub', alg: "M2 U' M U2 M' U' M2", alt: "R2 U R U R' U' R' U' R' U R'" },
  { id: 'pll-h', set: 'pll', group: 'pll-edges', name: 'H', alg: 'M2 U M2 U2 M2 U M2' },
  { id: 'pll-z', set: 'pll', group: 'pll-edges', name: 'Z', alg: "M' U M2 U M2 U M' U2 M2" },
  // ---- PLL: só cantos
  { id: 'pll-aa', set: 'pll', group: 'pll-corners', name: 'Aa', alg: "x R' U R' D2 R U' R' D2 R2 x'", alt: "R' F R' B2 R F' R' B2 R2" },
  { id: 'pll-ab', set: 'pll', group: 'pll-corners', name: 'Ab', alg: "x R2 D2 R U R' D2 R U' R x'", alt: "R2 B2 R F R' B2 R F' R" },
  { id: 'pll-e', set: 'pll', group: 'pll-corners', name: 'E', alg: "x' R U' R' D R U R' D' R U R' D R U' R' D' x" },
  // ---- PLL: cantos vizinhos
  { id: 'pll-t', set: 'pll', group: 'pll-adjacent', name: 'T', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: 'pll-f', set: 'pll', group: 'pll-adjacent', name: 'F', alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R" },
  { id: 'pll-ja', set: 'pll', group: 'pll-adjacent', name: 'Ja', alg: "x R2 F R F' R U2 r' U r U2 x'", alt: "R' U L' U2 R U' R' U2 R L" },
  { id: 'pll-jb', set: 'pll', group: 'pll-adjacent', name: 'Jb', alg: "R U R' F' R U R' U' R' F R2 U' R'", alt: "R U2 R' U' R U2 L' U R' U' L" },
  { id: 'pll-ra', set: 'pll', group: 'pll-adjacent', name: 'Ra', alg: "R U' R' U' R U R D R' U' R D' R' U2 R'", alt: "R U R' F' R U2 R' U2 R' F R U R U2 R'" },
  { id: 'pll-rb', set: 'pll', group: 'pll-adjacent', name: 'Rb', alg: "R2 F R U R U' R' F' R U2 R' U2 R", alt: "R' U2 R U2 R' F R U R' U' R' F' R2" },
  // ---- PLL: cantos na diagonal
  { id: 'pll-v', set: 'pll', group: 'pll-diagonal', name: 'V', alg: "R' U R' U' y R' F' R2 U' R' U R' F R F", alt: "R' U R' d' R' F' R2 U' R' U R' F R F" },
  { id: 'pll-y', set: 'pll', group: 'pll-diagonal', name: 'Y', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { id: 'pll-na', set: 'pll', group: 'pll-diagonal', name: 'Na', alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'" },
  { id: 'pll-nb', set: 'pll', group: 'pll-diagonal', name: 'Nb', alg: "R' U R U' R' F' U' F R U R' F R' F' R U' R" },
  // ---- PLL: G
  { id: 'pll-ga', set: 'pll', group: 'pll-g', name: 'Ga', alg: "R2 U R' U R' U' R U' R2 U' D R' U R D'" },
  { id: 'pll-gb', set: 'pll', group: 'pll-g', name: 'Gb', alg: "R' U' R U D' R2 U R' U R U' R U' R2 D" },
  { id: 'pll-gc', set: 'pll', group: 'pll-g', name: 'Gc', alg: "R2 U' R U' R U R' U R2 U D' R U' R' D" },
  { id: 'pll-gd', set: 'pll', group: 'pll-g', name: 'Gd', alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'" },
];

export const caseName = (c: AlgCase) => (typeof c.name === 'string' ? c.name : tr(...c.name));

export const cube3 = nxnKit(3);
export const caseState = cube3.caseState;
export const uprightState = cube3.upright;
