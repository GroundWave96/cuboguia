import type { PuzzleDefinition, PuzzleImpl } from './types';
import { cubeIcon, megaminxIcon, pyraminxIcon } from './icons';

export const PUZZLES: PuzzleDefinition[] = [
  {
    id: 'cube3',
    name: 'Cubo 3x3',
    subtitle: 'O clássico. Método de iniciante passo a passo.',
    available: true,
    icon: cubeIcon(3),
    load: () => import('../puzzles/cube3').then((m) => m.default as PuzzleImpl),
  },
  {
    id: 'cube2',
    name: 'Cubo 2x2',
    subtitle: 'Pocket cube. Iniciante ou solução ótima.',
    available: true,
    icon: cubeIcon(2),
    load: () => import('../puzzles/cube2').then((m) => m.default as PuzzleImpl),
  },
  { id: 'cube4', name: 'Cubo 4x4', subtitle: 'Revenge', available: false, icon: cubeIcon(4) },
  { id: 'cube5', name: 'Cubo 5x5', subtitle: 'Professor', available: false, icon: cubeIcon(5) },
  { id: 'pyraminx', name: 'Pyraminx', subtitle: 'O triângulo', available: false, icon: pyraminxIcon() },
  {
    id: 'megaminx',
    name: 'Megaminx',
    subtitle: 'Dodecaedro de 12 faces. Camada por camada.',
    available: true,
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
