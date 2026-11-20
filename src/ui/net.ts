/** Planificação do puzzle em SVG (só para ver: cronômetro, prévia do embaralho). */
import type { PuzzleImpl, PuzzleState } from '../core/types';

export function netSvg(impl: PuzzleImpl, state: PuzzleState, cls = 'net-mini'): string {
  const hex = (k: string) => impl.colors.find((c) => c.key === k)?.hex ?? '#2a2f3d';
  if (impl.netSvg)
    return `<svg class="${cls}" viewBox="${impl.netSvg.viewBox}" aria-hidden="true">${impl.netSvg.stickers
      .map((s) => `<polygon points="${s.points}" fill="${hex(state[s.index])}"/>`)
      .join('')}</svg>`;
  // cubos: rede em cruz, cada face uma grade n×n
  const n = impl.net[0].grid.length;
  const cell = 10, gap = 1.2, faceGap = 4;
  const side = n * cell + (n - 1) * gap;
  const cols = Math.max(...impl.net.map((f) => f.col)) + 1;
  const rows = Math.max(...impl.net.map((f) => f.row)) + 1;
  const rects = impl.net.flatMap((f) =>
    f.grid.flatMap((row, r) =>
      row.map((i, c) => {
        const x = f.col * (side + faceGap) + c * (cell + gap);
        const y = f.row * (side + faceGap) + r * (cell + gap);
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell}" height="${cell}" rx="1.6" fill="${hex(state[i])}"/>`;
      }),
    ),
  );
  return `<svg class="${cls}" viewBox="-2 -2 ${cols * (side + faceGap) + 4 - faceGap} ${rows * (side + faceGap) + 4 - faceGap}" aria-hidden="true">${rects.join('')}</svg>`;
}
