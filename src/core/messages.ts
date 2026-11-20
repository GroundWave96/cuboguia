/** Frases dos avisos de validação, comuns a vários puzzles (nos dois idiomas). */
import { tr } from './i18n';

export const msg = {
  missing: (n: number) =>
    tr(n === 1 ? 'Ainda falta 1 adesivo para pintar.' : `Ainda faltam ${n} adesivos para pintar.`, n === 1 ? '1 sticker is still unpainted.' : `${n} stickers are still unpainted.`),
  colorCount: (color: string, n: number, expected: number, extra = ['', ''] as [string, string]) =>
    tr(
      `A cor ${color} aparece ${n} ${n === 1 ? 'vez' : 'vezes'} — deveria aparecer ${expected}${extra[0]}.`,
      `The color ${color} appears ${n} ${n === 1 ? 'time' : 'times'} — it should appear ${expected}${extra[1]}.`,
    ),
  noCorner: (cols: string) => tr(`Existe um canto com as cores ${cols}, que não existe num cubo real.`, `There’s a corner with the colors ${cols}, which doesn’t exist on a real puzzle.`),
  noEdge: (cols: string) => tr(`Existe uma aresta com as cores ${cols}, que não existe num cubo real.`, `There’s an edge with the colors ${cols}, which doesn’t exist on a real puzzle.`),
  dupCorner: (cols: string) => tr(`O canto ${cols} aparece duas vezes.`, `The ${cols} corner appears twice.`),
  dupEdge: (cols: string) => tr(`A aresta ${cols} aparece duas vezes.`, `The ${cols} edge appears twice.`),
  mirrorCorner: (cols: string) =>
    tr(`O canto ${cols} está com as cores na ordem trocada (como num espelho) — confira esse canto.`, `The ${cols} corner has its colors in the wrong order (like a mirror image) — check that corner.`),
  twistedCorner: () =>
    tr(
      'Um canto está girado (torcido) — provavelmente uma cor de canto foi pintada errada ou o cubo foi montado torto.',
      'A corner is twisted — probably a corner color was painted wrong, or the puzzle was reassembled incorrectly.',
    ),
  flippedEdge: () => tr('Uma aresta está invertida — confira as cores das arestas (peças de 2 cores).', 'An edge is flipped — check the edge colors (the 2-color pieces).'),
  swapped: () => tr('Duas peças estão trocadas de lugar — confira se alguma cor foi pintada na posição errada.', 'Two pieces are swapped — check whether a color was painted in the wrong spot.'),
};
