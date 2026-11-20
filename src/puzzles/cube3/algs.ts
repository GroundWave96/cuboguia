/**
 * Algoritmos da última camada do 3x3 para a página de algoritmos: OLL em 2 etapas (10 casos)
 * e PLL completa (21 casos).
 *
 * O caso de cada algoritmo não é desenhado à mão: é calculado aplicando o algoritmo ao contrário
 * num cubo resolvido (`caseState`). Os testes (tests/algs.test.ts) conferem que cada algoritmo
 * mexe só no que deve, que os casos são todos diferentes, que o formato combina com o nome e que
 * o algoritmo alternativo leva ao mesmo caso.
 */
import { tr } from '../../core/i18n';
import { NxNGeometry, invertMove } from '../nxn/geometry';

export type AlgSet = 'oll' | 'pll';

export interface AlgCase {
  id: string;
  set: AlgSet;
  group: string;
  /** nome internacional (ou [pt, en] quando tem tradução) */
  name: string | [string, string];
  alg: string;
  /** outro algoritmo comum para o mesmo caso (conferido nos testes) */
  alt?: string;
}

export interface AlgGroup {
  id: string;
  set: AlgSet;
  name: () => string;
  about: () => string;
}

export const ALG_GROUPS: AlgGroup[] = [
  {
    id: 'oll-edges',
    set: 'oll',
    name: () => tr('OLL 1ª etapa · cruz amarela', 'OLL step 1 · yellow cross'),
    about: () =>
      tr(
        'Olhe só as <b>arestas</b> amarelas do topo (ignore os cantos): um ponto, um L ou uma linha. Segure o L no canto de trás à esquerda e a linha deitada.',
        'Look only at the yellow <b>edges</b> on top (ignore the corners): a dot, an L or a line. Hold the L at the back-left and the line horizontal.',
      ),
  },
  {
    id: 'oll-corners',
    set: 'oll',
    name: () => tr('OLL 2ª etapa · cantos', 'OLL step 2 · corners'),
    about: () =>
      tr(
        'Com a cruz pronta, conte os cantos já amarelos no topo e olhe para onde apontam os outros adesivos amarelos (nas laterais).',
        'With the cross done, count the corners already yellow on top and see where the other yellow stickers point (on the sides).',
      ),
  },
  {
    id: 'pll-edges',
    set: 'pll',
    name: () => tr('Só arestas', 'Edges only'),
    about: () => tr('Os cantos já estão no lugar: só as arestas trocam.', 'The corners are already solved: only the edges move.'),
  },
  {
    id: 'pll-corners',
    set: 'pll',
    name: () => tr('Só cantos', 'Corners only'),
    about: () => tr('As arestas já estão no lugar: só os cantos trocam.', 'The edges are already solved: only the corners move.'),
  },
  {
    id: 'pll-adjacent',
    set: 'pll',
    name: () => tr('Troca de cantos vizinhos', 'Adjacent corner swap'),
    about: () =>
      tr(
        'Há um par de “faróis” (dois cantos iguais num lado): os cantos que trocam ficam lado a lado.',
        'There is one pair of “headlights” (two matching corners on one side): the swapped corners are next to each other.',
      ),
  },
  {
    id: 'pll-diagonal',
    set: 'pll',
    name: () => tr('Troca de cantos na diagonal', 'Diagonal corner swap'),
    about: () => tr('Nenhum lado tem faróis: os cantos trocam na diagonal.', 'No side has headlights: the corners swap diagonally.'),
  },
  {
    id: 'pll-g',
    set: 'pll',
    name: () => tr('G-perms', 'G-perms'),
    about: () =>
      tr(
        'Três cantos e três arestas giram juntos. Procure o bloco 1×2 e os faróis para saber qual dos quatro é.',
        'Three corners and three edges cycle together. Look for the 1×2 block and the headlights to tell the four apart.',
      ),
  },
];

export const ALG_CASES: AlgCase[] = [
  // ---- OLL em 2 etapas: arestas
  { id: 'oll-dot', set: 'oll', group: 'oll-edges', name: ['Ponto', 'Dot'], alg: "F R U R' U' F' f R U R' U' f'" },
  { id: 'oll-l', set: 'oll', group: 'oll-edges', name: 'L', alg: "f R U R' U' f'" },
  { id: 'oll-line', set: 'oll', group: 'oll-edges', name: ['Linha', 'Line'], alg: "F R U R' U' F'" },
  // ---- OLL em 2 etapas: cantos
  { id: 'oll-sune', set: 'oll', group: 'oll-corners', name: 'Sune', alg: "R U R' U R U2 R'" },
  { id: 'oll-antisune', set: 'oll', group: 'oll-corners', name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { id: 'oll-h', set: 'oll', group: 'oll-corners', name: 'H', alg: "R U R' U R U' R' U R U2 R'" },
  { id: 'oll-pi', set: 'oll', group: 'oll-corners', name: 'Pi', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: 'oll-u', set: 'oll', group: 'oll-corners', name: ['U (faróis)', 'U (headlights)'], alg: "R2 D R' U2 R D' R' U2 R'" },
  { id: 'oll-t', set: 'oll', group: 'oll-corners', name: 'T', alg: "r U R' U' r' F R F'" },
  { id: 'oll-bowtie', set: 'oll', group: 'oll-corners', name: ['L (gravata)', 'L (bowtie)'], alg: "F' r U R' U' r' F R" },
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
export const splitAlg = (alg: string) => alg.split(/\s+/).filter(Boolean);
export const invertAlg = (moves: string[]) => [...moves].reverse().map(invertMove);

const geo = new NxNGeometry(3);
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);
/** índices dos centros (U R F D L B) */
const CENTERS = [4, 13, 22, 31, 40, 49];
const ROTATIONS: string[][] = (() => {
  // as 24 posições do cubo inteiro
  const out: string[][] = [];
  for (const a of [[], ['x'], ['x2'], ["x'"], ['z'], ["z'"]])
    for (const b of [[], ['y'], ['y2'], ["y'"]]) out.push([...a, ...b]);
  return out;
})();

/** estado com os centros no lugar (desfaz uma rotação do cubo inteiro que sobrou do algoritmo) */
export function uprightState(s: string[]): string[] {
  for (const r of ROTATIONS) {
    const t = applyAll(s, r);
    if (CENTERS.every((i) => t[i] === geo.solved()[i])) return t;
  }
  return s;
}

/** o caso que o algoritmo resolve: o cubo resolvido com o algoritmo feito ao contrário */
export function caseState(alg: string): string[] {
  return uprightState(applyAll(geo.solved(), invertAlg(splitAlg(alg))));
}

export const cube3 = { geo, applyAll };
