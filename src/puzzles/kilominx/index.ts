/**
 * Kilominx: o "megaminx 2x2" — 20 cantos de plástico colorido, sem centros. Pinta-se (ou
 * lê-se pela câmera) em qualquer posição; o solucionador escolhe onde cada cor termina.
 */
import { i18nMap, tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { megaGeo as geo, type V3 } from '../megaminx/geometry';
import { PolyView } from '../poly/PolyView';
import { KILO_COLORS, KILO_COLOR_HEX } from './colors';
import { buildKiloNet, buildKiloScan } from './layout';
import { FACES, STICKERS, applyMove, invertMove, layerOf, locationMap, moveAngle, parseMove, randomScramble, solvedState } from './model';
import { KILO_ROUND, kiloCut, kiloPieces } from './pieces3d';
import { solveKilominx } from './solver';
import { validateKilominx } from './validate';

const FACE_TEXT = i18nMap({
  U: ['Cima', 'Top', 'Arriba'],
  F: ['Frente', 'Front', 'Frente'],
  R: ['Direita', 'Right', 'Derecha'],
  L: ['Esquerda', 'Left', 'Izquierda'],
  BR: ['Trás-direita', 'Back-right', 'Atrás a la derecha'],
  BL: ['Trás-esquerda', 'Back-left', 'Atrás a la izquierda'],
  DR: ['Baixo-direita', 'Bottom-right', 'Abajo a la derecha'],
  DL: ['Baixo-esquerda', 'Bottom-left', 'Abajo a la izquierda'],
  DBR: ['Baixo-trás-direita', 'Bottom-back-right', 'Abajo, atrás a la derecha'],
  DBL: ['Baixo-trás-esquerda', 'Bottom-back-left', 'Abajo, atrás a la izquierda'],
  B: ['Trás (embaixo)', 'Back (lower)', 'Atrás (abajo)'],
  D: ['Baixo', 'Bottom', 'Abajo'],
});

/**
 * A câmera leu uma face girada (sem centros, é fácil segurar torto)? Tenta girar cada face,
 * uma de cada vez, até as peças fecharem. Devolve de onde vem cada adesivo.
 */
function repairOrder(state: string[]): number[] {
  const ids = state.map((_, i) => i);
  if (validateKilominx(state).ok) return ids;
  for (let f = 0; f < 12; f++)
    for (let r = 1; r < 5; r++) {
      const order = ids.map((i) => (Math.floor(i / 5) === f ? f * 5 + ((i % 5) + r) % 5 : i));
      if (validateKilominx(order.map((i) => state[i])).ok) return order;
    }
  return ids;
}

const kilominx: PuzzleImpl = {
  colors: KILO_COLORS,
  get holdHint() {
    return tr(
      'Segure o Kilominx igual ao desenho 3D, com a mesma face em cima e a mesma de frente (compare as cores dos cantos). Sem centros, ele fica pronto com o <b>branco embaixo</b>, na posição que der menos movimentos.',
      'Hold the Kilominx like the 3D drawing, with the same face on top and the same one in front (compare the corner colors). With no centers, it ends up solved with <b>white at the bottom</b>, in whichever position takes the fewest moves.',
      'Sujeta el Kilominx como en el dibujo 3D, con la misma cara arriba y la misma al frente (compara los colores de las esquinas). Sin centros, queda resuelto con el <b>blanco abajo</b>, en la posición que lleve menos movimientos.',
    );
  },
  get scanHint() {
    return tr(
      'Sem centros, pode começar com <b>qualquer face</b> de frente: o que importa é seguir as setas, girando um passo de cada vez. As cores que você já leu aparecem nas bordas para ajudar a achar a próxima face.',
      'With no centers, you can start with <b>any face</b> in front: what matters is following the arrows, turning one step at a time. The colors you’ve already read show up along the borders to help you find the next face.',
      'Sin centros, puedes empezar con <b>cualquier cara</b> al frente: lo importante es seguir las flechas, girando un paso cada vez. Los colores que ya leíste aparecen en los bordes para ayudarte a encontrar la siguiente cara.',
    );
  },
  repairScan: (s) => repairOrder(s).map((i) => s[i]),
  scanOrder: repairOrder,
  stickerCount: STICKERS,
  solvedState,
  fixedStickers: [],
  applyMove: (s, m) => applyMove(s, m),
  invertMove,
  locationMap,
  scramble: (len = 30) => randomScramble(len),
  validate: validateKilominx,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Iniciante (camadas)', 'Beginner (layers)', 'Principiante (capas)'),
        tagline: tr('Um canto de cada vez · ~80 movimentos', 'One corner at a time · ~80 moves', 'Una esquina a la vez · ~80 movimientos'),
        description: tr(
          'Face branca, as duas camadas do meio e a face cinza: posicionar os cantos e girá-los com R′ D′ R D, como no 3x3.',
          'White face, the two middle layers and the gray face: place the corners and twist them with R′ D′ R D, like on a 3x3.',
          'Cara blanca, las dos capas del medio y la cara gris: colocar las esquinas y girarlas con R′ D′ R D, como en el 3x3.',
        ),
      },
      {
        id: 'advanced',
        name: tr('Avançado (2 cantos de cada vez)', 'Advanced (2 corners at a time)', 'Avanzado (2 esquinas a la vez)'),
        tagline: tr('Mais curto · ~60 movimentos', 'Shorter · ~60 moves', 'Más corto · ~60 movimientos'),
        description: tr(
          'As camadas planejando dois cantos juntos e a última face em 2 olhares: orientar com Sunes e depois permutar.',
          'The layers planning two corners together and a 2-look last face: orient with Sunes, then permute.',
          'Las capas planeando dos esquinas juntas y la última cara en 2 pasos: orientar con Sunes y después permutar.',
        ),
      },
    ];
  },
  solve: (state, methodId) => solveKilominx(state, methodId === 'advanced' ? 'advanced' : 'beginner'),
  createView: (container) => {
    const kp = kiloPieces();
    return new PolyView(container, {
      pieces: kp.pieces,
      stickers: kp.stickers,
      core: kp.core,
      pieceRound: KILO_ROUND,
      bodyFaces: geo.faceVerts.map((vs) => vs.map((v) => geo.vertices[v])),
      palette: KILO_COLOR_HEX,
      solved: solvedState(),
      apply: (s, m) => applyMove(s, m),
      locationMap,
      moveInfo: (m) => {
        const { face } = parseMove(m);
        return { axis: geo.normals[face], angle: moveAngle(m), layer: layerOf(face), cut: kiloCut(face), pieces: kp.blackOf[face] };
      },
      // vértice entre U, F e R: vista diagonal padrão (mostra as três)
      defaultDir: (() => {
        const v = geo.vertices.findIndex((_, i) => [0, 1, 2].every((f) => geo.faceVerts[f].includes(i)));
        const p = geo.vertices[v];
        return [p[0] * 0.8, p[1] + 0.35, p[2] + 0.25] as V3;
      })(),
      viewDirs: geo.vertices,
      radius: 1,
    });
  },
  net: [],
  netSvg: buildKiloNet(),
  scan: buildKiloScan(),
  scanColorModel: 'nearest',
  describeMove: (m) => {
    const { face } = parseMove(m);
    const two = m.includes('2');
    const dir = m.endsWith("'") ? tr('anti-horário ↺', 'counterclockwise ↺', 'antihorario ↺') : tr('horário ↻', 'clockwise ↻', 'horario ↻');
    return `${FACE_TEXT[FACES[face]]} · ${dir}${two ? tr(' · 2 cliques (144°)', ' · 2 clicks (144°)', ' · 2 clics (144°)') : ''}`;
  },
  get notationIntro() {
    return tr(
      'É a notação do Megaminx: cada letra é uma <b>face</b> (com os 5 cantos em volta dela), segurando o Kilominx igual ao desenho 3D. Gire olhando de frente para aquela face:',
      'It’s Megaminx notation: each letter is a <b>face</b> (with the 5 corners around it), holding the Kilominx like the 3D drawing. Turn it while looking straight at that face:',
      'Es la notación del Megaminx: cada letra es una <b>cara</b> (con las 5 esquinas a su alrededor), sujetando el Kilominx como en el dibujo 3D. Gírala mirando esa cara de frente:',
    );
  },
  get notationNote() {
    return tr(
      "<p><code>R</code> = 1 clique (72°) no sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = 2 cliques (144°) · <code>R2'</code> = 2 cliques anti-horário.</p>",
      "<p><code>R</code> = 1 click (72°) clockwise · <code>R'</code> = counterclockwise · <code>R2</code> = 2 clicks (144°) · <code>R2'</code> = 2 clicks counterclockwise.</p>",
      "<p><code>R</code> = 1 clic (72°) en sentido horario · <code>R'</code> = antihorario · <code>R2</code> = 2 clics (144°) · <code>R2'</code> = 2 clics en sentido antihorario.</p>",
    );
  },
  get notationHelp() {
    return FACES.map((f) => ({ move: f, text: FACE_TEXT[f] }));
  },
};

export default kilominx;
