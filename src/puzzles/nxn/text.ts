/** Textos dos cubos NxN nos dois idiomas: nomes das faces, sentido do giro, notação. */
import { tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { COLOR_NAME, FACE_NAME } from '../cube3/colors';
import { parseMove } from './geometry';

/** "Direita (laranja)" — a face e, nos cubos com centro, a cor dela */
export const faceText = (f: string, withColor: boolean) => (withColor ? `${FACE_NAME[f]} (${COLOR_NAME[f]})` : FACE_NAME[f]);

const half = (m: string) => m.endsWith('2') && !/^\d[URFDLB]w?$/.test(m);
export const dirText = (m: string) =>
  m.endsWith("'") ? tr('anti-horário ↺', 'counterclockwise ↺') : half(m) ? tr('meia volta (180°)', 'half turn (180°)') : tr('horário ↻', 'clockwise ↻');

const MIDDLE: Record<string, [string, string]> = {
  M: ['Fatia do meio vertical (sentido da esquerda)', 'Vertical middle slice (same way as L)'],
  E: ['Fatia do meio horizontal (sentido de baixo)', 'Horizontal middle slice (same way as D)'],
  S: ['Fatia do meio da frente (sentido da frente)', 'Front middle slice (same way as F)'],
};

/** "da direita", "de cima": a preposição muda com a face (só em português) */
const FROM_FACE: Record<string, string> = { U: 'de cima', D: 'de baixo', F: 'da frente', B: 'de trás', R: 'da direita', L: 'da esquerda' };
const FROM_FACE_EN: Record<string, string> = { U: 'top', D: 'bottom', F: 'front', B: 'back', R: 'right', L: 'left' };
const ordinal = (k: number) => (k === 2 ? '2nd' : k === 3 ? '3rd' : `${k}th`);

/** "2ª camada da direita (fatia de dentro) · horário ↻" */
export function describeNxNMove(m: string, withColor: boolean): string {
  const rot = /^([xyz])/.exec(m);
  if (rot) {
    const like = { x: 'R', y: 'U', z: 'F' }[rot[1] as 'x' | 'y' | 'z'];
    return tr(`Girar o cubo inteiro na mão (como o ${like}) · ${dirText(m)}`, `Turn the whole cube in your hands (like ${like}) · ${dirText(m)}`);
  }
  const letter = m.replace(/[^URFDLBMES]/g, '');
  if (MIDDLE[letter]) return `${tr(...MIDDLE[letter])} · ${dirText(m)}`;
  const mv = parseMove(m);
  const face = faceText(mv.face, withColor);
  const what =
    mv.from === mv.depth && mv.from > 1
      ? tr(`${mv.from}ª camada ${FROM_FACE[mv.face]} (fatia de dentro)`, `${ordinal(mv.from)} layer from the ${FROM_FACE_EN[mv.face]} (inner slice)`)
      : mv.depth > 1
        ? tr(
            `${face} + ${mv.depth - 1} ${mv.depth > 2 ? 'camadas' : 'camada'} de dentro (${mv.depth} camadas juntas)`,
            `${face} + ${mv.depth - 1} inner ${mv.depth > 2 ? 'layers' : 'layer'} (${mv.depth} layers together)`,
          )
        : face;
  return `${what} · ${dirText(m)}`;
}

/** as 6 faces na explicação da notação */
export const faceNotation = (withColor: boolean, order = ['U', 'D', 'F', 'B', 'R', 'L']): PuzzleImpl['notationHelp'] =>
  order.map((f) => ({ move: f, text: faceText(f, withColor) }));
