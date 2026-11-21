/** Frases dos avisos de validação, comuns a vários puzzles (nos dois idiomas). */
import { tr } from './i18n';

export const msg = {
  missing: (n: number) =>
    tr(n === 1 ? 'Ainda falta 1 adesivo para pintar.' : `Ainda faltam ${n} adesivos para pintar.`, n === 1 ? '1 sticker is still unpainted.' : `${n} stickers are still unpainted.`, n === 1 ? 'Todavía falta pintar 1 pegatina.' : `Todavía faltan ${n} pegatinas por pintar.`),
  colorCount: (color: string, n: number, expected: number, extra = ['', '', ''] as [string, string, string]) =>
    tr(
      `A cor ${color} aparece ${n} ${n === 1 ? 'vez' : 'vezes'} — deveria aparecer ${expected}${extra[0]}.`,
      `The color ${color} appears ${n} ${n === 1 ? 'time' : 'times'} — it should appear ${expected}${extra[1]}.`, `El color ${color} aparece ${n} ${n === 1 ? 'vez' : 'veces'}; debería aparecer ${expected}${extra[2]}.`,
    ),
  noCorner: (cols: string) => tr(`Existe um canto com as cores ${cols}, que não existe num cubo real.`, `There’s a corner with the colors ${cols}, which doesn’t exist on a real puzzle.`, `Hay una esquina con los colores ${cols}, que no existe en un puzzle real.`),
  noEdge: (cols: string) => tr(`Existe uma aresta com as cores ${cols}, que não existe num cubo real.`, `There’s an edge with the colors ${cols}, which doesn’t exist on a real puzzle.`, `Hay una arista con los colores ${cols}, que no existe en un puzzle real.`),
  dupCorner: (cols: string) => tr(`O canto ${cols} aparece duas vezes.`, `The ${cols} corner appears twice.`, `La esquina ${cols} aparece dos veces.`),
  dupEdge: (cols: string) => tr(`A aresta ${cols} aparece duas vezes.`, `The ${cols} edge appears twice.`, `La arista ${cols} aparece dos veces.`),
  mirrorCorner: (cols: string) =>
    tr(`O canto ${cols} está com as cores na ordem trocada (como num espelho) — confira esse canto.`, `The ${cols} corner has its colors in the wrong order (like a mirror image) — check that corner.`, `La esquina ${cols} tiene los colores en el orden equivocado (como en un espejo): revisa esa esquina.`),
  twistedCorner: () =>
    tr(
      'Um canto está girado (torcido) — provavelmente uma cor de canto foi pintada errada ou o cubo foi montado torto.',
      'A corner is twisted — probably a corner color was painted wrong, or the puzzle was reassembled incorrectly.', 'Una esquina está girada: probablemente se pintó mal un color de esquina o el puzzle se armó torcido.',
    ),
  flippedEdge: () => tr('Uma aresta está invertida — confira as cores das arestas (peças de 2 cores).', 'An edge is flipped — check the edge colors (the 2-color pieces).', 'Una arista está volteada: revisa los colores de las aristas (las piezas de 2 colores).'),
  swapped: () => tr('Duas peças estão trocadas de lugar — confira se alguma cor foi pintada na posição errada.', 'Two pieces are swapped — check whether a color was painted in the wrong spot.', 'Hay dos piezas intercambiadas: revisa si algún color se pintó en el lugar equivocado.'),
};
