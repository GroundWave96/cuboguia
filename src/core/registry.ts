import type { PuzzleDefinition, PuzzleImpl } from './types';

/** SVG isométrico simples de um cubo NxN para os cards. */
function cubeIcon(n: number, top = '#ffd500', left = '#00a651', right = '#ff6a13'): string {
  const proj = (x: number, y: number, z: number) => [60 + (x - y) * 47, 8 + (x + y) * 27 + (1 - z) * 54];
  const quad = (pts: number[][], fill: string) =>
    `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}"/>`;
  const cells: string[] = [];
  const d = 1 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = i * d, b = j * d;
      cells.push(quad([proj(a, b, 1), proj(a + d, b, 1), proj(a + d, b + d, 1), proj(a, b + d, 1)], top));
      cells.push(quad([proj(a, 1, 1 - b), proj(a + d, 1, 1 - b), proj(a + d, 1, 1 - b - d), proj(a, 1, 1 - b - d)], left));
      cells.push(quad([proj(1, 1 - a, 1 - b), proj(1, 1 - a - d, 1 - b), proj(1, 1 - a - d, 1 - b - d), proj(1, 1 - a, 1 - b - d)], right));
    }
  return `<svg viewBox="0 0 120 125" class="pz-icon" aria-hidden="true"><g stroke="#0d0f14" stroke-width="${n > 4 ? 1.8 : 2.6}" stroke-linejoin="round">${cells.join('')}</g></svg>`;
}

const pyraminxIcon = `<svg viewBox="0 0 120 130" class="pz-icon" aria-hidden="true"><g stroke="#0d0f14" stroke-width="2.4" stroke-linejoin="round">
<polygon points="60,10 110,110 10,110" fill="#00a651"/>
<polygon points="60,10 76.7,43.3 43.3,43.3" fill="#00a651"/><polygon points="43.3,43.3 60,76.7 26.7,76.7" fill="#00a651"/>
<polygon points="76.7,43.3 93.3,76.7 60,76.7" fill="#00a651"/><polygon points="43.3,43.3 76.7,43.3 60,76.7" fill="#ffd500"/>
<polygon points="26.7,76.7 43.3,110 10,110" fill="#00a651"/><polygon points="60,76.7 76.7,110 43.3,110" fill="#00a651"/>
<polygon points="93.3,76.7 110,110 76.7,110" fill="#00a651"/><polygon points="26.7,76.7 60,76.7 43.3,110" fill="#0a5bd6"/>
<polygon points="60,76.7 93.3,76.7 76.7,110" fill="#d0192d"/></g></svg>`;

const megaminxIcon = (() => {
  const pts = (r: number, rot = -90) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = ((rot + i * 72) * Math.PI) / 180;
      return [60 + r * Math.cos(a), 65 + r * Math.sin(a)];
    });
  const outer = pts(54);
  const inner = pts(22, 90);
  const colors = ['#00a651', '#d0192d', '#0a5bd6', '#ffd500', '#ff6a13'];
  const polys = outer.map((p, i) => {
    const q = outer[(i + 1) % 5];
    const a = inner[(i + 3) % 5];
    return `<polygon points="${[p, q, a].map((x) => x.join(',')).join(' ')}" fill="${colors[i]}"/>`;
  });
  return `<svg viewBox="0 0 120 130" class="pz-icon" aria-hidden="true"><g stroke="#0d0f14" stroke-width="2.4" stroke-linejoin="round">${polys.join('')}<polygon points="${inner.map((x) => x.join(',')).join(' ')}" fill="#f4f6f8"/></g></svg>`;
})();

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
  { id: 'pyraminx', name: 'Pyraminx', subtitle: 'O triângulo', available: false, icon: pyraminxIcon },
  { id: 'megaminx', name: 'Megaminx', subtitle: 'Dodecaedro de 12 faces', available: false, icon: megaminxIcon },
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
