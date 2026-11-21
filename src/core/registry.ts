import { tr } from './i18n';
import type { PuzzleDefinition, PuzzleImpl } from './types';
import { cubeIcon, megaminxIcon, pyraminxIcon, skewbIcon } from './icons';

export const PUZZLES: PuzzleDefinition[] = [
  {
    id: 'cube2',
    slug: '2x2',
    get name() {
      return tr('Cubo 2x2', '2x2 Cube');
    },
    short: '2x2',
    get subtitle() {
      return tr('Pocket cube. Iniciante ou solução ótima.', 'Pocket cube. Beginner or optimal solution.');
    },
    available: true,
    methods: 2,
    icon: cubeIcon(2),
    load: () => import('../puzzles/cube2').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'cube3',
    slug: '3x3',
    get name() {
      return tr('Cubo 3x3', '3x3 Cube');
    },
    short: '3x3',
    get subtitle() {
      return tr('O clássico. Método de iniciante passo a passo.', 'The classic. Beginner method, step by step.');
    },
    available: true,
    methods: 2,
    icon: cubeIcon(3),
    load: () => import('../puzzles/cube3').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'cube4',
    slug: '4x4',
    get name() {
      return tr('Cubo 4x4', '4x4 Cube');
    },
    short: '4x4',
    get subtitle() {
      return tr('Revenge. Centros, arestas, paridades e fim como 3x3.', 'Revenge. Centers, edges, parities, then like a 3x3.');
    },
    available: true,
    methods: 2,
    icon: cubeIcon(4),
    load: () => import('../puzzles/cube4').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'cube5',
    slug: '5x5',
    get name() {
      return tr('Cubo 5x5', '5x5 Cube');
    },
    short: '5x5',
    get subtitle() {
      return tr('Professor. Centros, arestas e fim como 3x3.', 'Professor. Centers, edges, then like a 3x3.');
    },
    available: true,
    methods: 2,
    icon: cubeIcon(5),
    load: () => import('../puzzles/cube5').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'cube6',
    slug: '6x6',
    get name() {
      return tr('Cubo 6x6', '6x6 Cube');
    },
    short: '6x6',
    get subtitle() {
      return tr('Centros grandes, arestas de 4 peças, paridades e fim como 3x3.', 'Big centers, 4-piece edges, parities, then like a 3x3.');
    },
    available: true,
    methods: 2,
    icon: cubeIcon(6),
    load: () => import('../puzzles/cube6').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'cube7',
    slug: '7x7',
    get name() {
      return tr('Cubo 7x7', '7x7 Cube');
    },
    short: '7x7',
    get subtitle() {
      return tr('O maior de todos aqui. Centros, arestas e fim como 3x3.', 'The biggest one here. Centers, edges, then like a 3x3.');
    },
    available: true,
    methods: 2,
    icon: cubeIcon(7),
    load: () => import('../puzzles/cube7').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'pyraminx',
    slug: 'pyraminx',
    get name() {
      return tr('Pyraminx', 'Pyraminx');
    },
    short: 'Pyraminx',
    get subtitle() {
      return tr('O triângulo. Iniciante ou solução ótima.', 'The triangle. Beginner or optimal solution.');
    },
    available: true,
    methods: 2,
    icon: pyraminxIcon(),
    load: () => import('../puzzles/pyraminx').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'skewb',
    slug: 'skewb',
    get name() {
      return tr('Skewb', 'Skewb');
    },
    short: 'Skewb',
    get subtitle() {
      return tr('O cubo que gira pelos cantos. Iniciante ou solução ótima.', 'The cube that turns around its corners. Beginner or optimal solution.');
    },
    available: true,
    methods: 2,
    icon: skewbIcon(),
    load: () => import('../puzzles/skewb').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'megaminx',
    slug: 'megaminx',
    get name() {
      return tr('Megaminx', 'Megaminx');
    },
    short: 'Megaminx',
    get subtitle() {
      return tr('Dodecaedro de 12 faces. Camada por camada.', '12-sided dodecahedron. Layer by layer.');
    },
    available: true,
    methods: 2,
    icon: megaminxIcon(),
    load: () => import('../puzzles/megaminx').then((m) => m.default as PuzzleImpl),
  },
];

export const getPuzzle = (id: string) => PUZZLES.find((p) => p.id === id);

const cache = new Map<string, Promise<PuzzleImpl>>();
export function loadPuzzle(id: string): Promise<PuzzleImpl> {
  const def = getPuzzle(id);
  if (!def?.load) return Promise.reject(new Error('Puzzle não disponível'));
  if (!cache.has(id))
    cache.set(
      id,
      def.load().catch((e) => {
        cache.delete(id); // uma falha (ex.: rede) não fica guardada para sempre
        throw e;
      }),
    );
  return cache.get(id)!;
}
