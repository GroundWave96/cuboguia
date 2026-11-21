/**
 * Algoritmos do 2x2 (método Ortega): face amarela (7 casos, como a OLL do 3x3) e PBL
 * (permutar as duas camadas de uma vez: 6 casos). Conferidos em tests/algs-others.test.ts.
 */
import { tr } from '../../core/i18n';
import { nxnKit, type AlgCase, type AlgGroup, type AlgSetDef } from '../algkit';

export const CUBE2_SETS: AlgSetDef[] = [
  { id: 'c2oll', name: () => tr('Face amarela', 'Yellow face', 'Cara amarilla'), style: 'oll' },
  { id: 'pbl', name: () => 'PBL', style: 'pbl' },
];

export const CUBE2_GROUPS: AlgGroup[] = [
  {
    id: 'c2oll',
    set: 'c2oll',
    name: () => tr('Deixar o topo todo amarelo', 'Make the whole top yellow', 'Haz toda la cara de arriba amarilla'),
    about: () =>
      tr(
        'Com a face branca pronta embaixo (as laterais ainda podem estar trocadas), conte os cantos já amarelos no topo e olhe para onde apontam os outros adesivos amarelos.',
        'With the white face done on the bottom (the sides may still be mixed up), count the corners already yellow on top and see where the other yellow stickers point.', 'Con la cara blanca hecha abajo (los lados pueden seguir mezclados), cuenta las esquinas que ya están amarillas arriba y mira hacia dónde apuntan las otras pegatinas amarillas.',
      ),
  },
  {
    id: 'pbl',
    set: 'pbl',
    name: () => tr('Colocar as duas camadas no lugar', 'Put both layers in place', 'Coloca las dos capas'),
    about: () =>
      tr(
        'Topo amarelo e base branca prontos: olhe em cada camada se há um par de “faróis” (dois cantos iguais num lado, troca vizinha) ou nenhum (troca na diagonal). O desenho da esquerda é o topo; o da direita, a base vista de baixo. Se só a base estiver trocada, vire o cubo (x2) e use o caso de cima.',
        'Yellow top and white bottom done: in each layer, look for a pair of “headlights” (two matching corners on one side: adjacent swap) or none (diagonal swap). The left picture is the top; the right one, the bottom seen from below. If only the bottom is swapped, flip the cube (x2) and use the top case.', 'Con el amarillo arriba y el blanco abajo hechos: en cada capa, busca un par de “faros” (dos esquinas iguales en un mismo lado: intercambio de vecinas) o ninguno (intercambio en diagonal). El dibujo de la izquierda es la capa de arriba; el de la derecha, la de abajo vista desde abajo. Si solo la de abajo está intercambiada, da la vuelta al cubo (x2) y usa el caso de arriba.',
      ),
  },
];

export const CUBE2_CASES: AlgCase[] = [
  { id: 'c2-sune', set: 'c2oll', group: 'c2oll', name: 'Sune', alg: "R U R' U R U2 R'" },
  { id: 'c2-antisune', set: 'c2oll', group: 'c2oll', name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { id: 'c2-h', set: 'c2oll', group: 'c2oll', name: 'H', alg: 'R2 U2 R U2 R2', alt: "R U R' U R U' R' U R U2 R'" },
  { id: 'c2-pi', set: 'c2oll', group: 'c2oll', name: 'Pi', alg: "F R U R' U' R U R' U' F'", alt: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: 'c2-u', set: 'c2oll', group: 'c2oll', name: ['U (faróis)', 'U (headlights)', 'U (faros)'], alg: "R2 D R' U2 R D' R' U2 R'" },
  { id: 'c2-t', set: 'c2oll', group: 'c2oll', name: 'T', alg: "R U R' U' R' F R F'" },
  { id: 'c2-l', set: 'c2oll', group: 'c2oll', name: ['L (gravata)', 'L (bowtie)', 'L (pajarita)'], alg: "F R' F' R U R U' R'" },
  { id: 'pbl-adj', set: 'pbl', group: 'pbl', name: ['Vizinhos em cima', 'Adjacent on top', 'Vecinas arriba'], alg: "R U2 R' U' R U2 L' U R' U' L", alt: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: 'pbl-diag', set: 'pbl', group: 'pbl', name: ['Diagonal em cima', 'Diagonal on top', 'Diagonal arriba'], alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { id: 'pbl-adj-adj', set: 'pbl', group: 'pbl', name: ['Vizinhos nas duas', 'Adjacent on both', 'Vecinas en las dos'], alg: "R2 U' B2 U2 R2 U' R2" },
  { id: 'pbl-diag-diag', set: 'pbl', group: 'pbl', name: ['Diagonal nas duas', 'Diagonal on both', 'Diagonal en las dos'], alg: 'R2 F2 R2' },
  { id: 'pbl-adj-diag', set: 'pbl', group: 'pbl', name: ['Vizinhos em cima, diagonal embaixo', 'Adjacent on top, diagonal on bottom', 'Vecinas arriba, diagonal abajo'], alg: "R U' R F2 R' U R'" },
  { id: 'pbl-diag-adj', set: 'pbl', group: 'pbl', name: ['Diagonal em cima, vizinhos embaixo', 'Diagonal on top, adjacent on bottom', 'Diagonal arriba, vecinas abajo'], alg: "x2 R U' R F2 R' U R' x2" },
];

export const cube2 = nxnKit(2);
