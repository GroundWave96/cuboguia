/**
 * Padrões bonitos: sequências que, a partir do cubo resolvido, desenham figuras nas faces.
 * Os desenhos de cada cartão são calculados (o padrão aplicado ao cubo resolvido), e
 * tests/patterns.test.ts confere que cada sequência é válida e que o desenho é o prometido.
 */
import { tr } from '../core/i18n';

export interface Pattern {
  id: string;
  name: () => string;
  about: () => string;
  alg: string;
}

const p = (id: string, [pt, en, es]: [string, string, string], [aboutPt, aboutEn, aboutEs]: [string, string, string], alg: string): Pattern => ({
  id,
  name: () => tr(pt, en, es),
  about: () => tr(aboutPt, aboutEn, aboutEs),
  alg,
});

export const PATTERNS: Record<string, Pattern[]> = {
  cube3: [
    p('xadrez', ['Xadrez', 'Checkerboard', 'Ajedrez'], ['O clássico: todas as faces viram um tabuleiro de xadrez.', 'The classic: every face becomes a checkerboard.', 'El clásico: todas las caras se vuelven un tablero de ajedrez.'], 'M2 E2 S2'),
    p('pontos', ['Seis pontos', 'Six spots', 'Seis puntos'], ['Cada face fica de uma cor só, com o centro de outra cor.', 'Each face is one color, with a center of another color.', 'Cada cara queda de un solo color, con el centro de otro color.'], "U D' R L' F B' U D'"),
    p('cruz', ['Cruz', 'Cross', 'Cruz'], ['Uma cruz de outra cor em cada face.', 'A cross of another color on every face.', 'Una cruz de otro color en cada cara.'], "U F B' L2 U2 L2 F' B U2 L2 U"),
    p('cubo-no-cubo', ['Cubo dentro do cubo', 'Cube in a cube', 'Cubo dentro del cubo'], ['Parece que tem um cubo menor encaixado no canto.', 'Looks like a smaller cube tucked into the corner.', 'Parece que hay un cubo más pequeño encajado en la esquina.'], "F L F U' R U F2 L2 U' L' B D' B' L2 U"),
    p('cubo-cubo-cubo', ['Cubo dentro do cubo dentro do cubo', 'Cube in a cube in a cube', 'Cubo dentro del cubo dentro del cubo'], ['Três cubos, um dentro do outro.', 'Three cubes, one inside the other.', 'Tres cubos, uno dentro del otro.'], "U' L' U' F' R2 B' R F U B2 U B' L U' F U R F'"),
    p('superflip', ['Superflip', 'Superflip', 'Superflip'], ['Todas as arestas viradas ao contrário. É uma das posições mais longe do cubo resolvido.', 'Every edge flipped. It’s one of the positions farthest from solved.', 'Todas las aristas volteadas. Es una de las posiciones más lejanas del cubo resuelto.'], "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"),
    p('tetris', ['Tetris', 'Tetris', 'Tetris'], ['Peças que lembram as do Tetris em volta do cubo.', 'Shapes like Tetris pieces around the cube.', 'Formas como las piezas del Tetris alrededor del cubo.'], "L R F B U' D' L' R'"),
    p('anaconda', ['Anaconda', 'Anaconda', 'Anaconda'], ['Uma cobra que dá a volta no cubo.', 'A snake that wraps around the cube.', 'Una serpiente que da la vuelta al cubo.'], "L U B' U' R L' B R' F B' D R D' F'"),
    p('piton', ['Píton', 'Python', 'Pitón'], ['Outra cobra, com um caminho diferente.', 'Another snake, along a different path.', 'Otra serpiente, por un camino distinto.'], "F2 R' B' U R' L F' L F' B D' R B L2"),
    p('mamba-preta', ['Mamba negra', 'Black mamba', 'Mamba negra'], ['A cobra mais famosa entre os padrões.', 'The most famous snake pattern.', 'La serpiente más famosa de los patrones.'], "R D L F' R L' D R' U D' B U' R' D'"),
    p('cruz-plummer', ['Cruz de Plummer', 'Plummer’s cross', 'Cruz de Plummer'], ['Uma cruz diferente em cada face.', 'A different cross on each face.', 'Una cruz distinta en cada cara.'], "R2 L' D F2 R' D' R' L U' D R D B2 R' U D2"),
    p('arame', ['Arame', 'Wire', 'Alambre'], ['Uma faixa fina que passa pelas faces.', 'A thin band running across the faces.', 'Una franja fina que recorre las caras.'], 'R L F B R L F B R L F B R2 B2 L2 R2'),
  ],
  cube4: [
    p('losangos', ['Losangos', 'Diamonds', 'Rombos'], ['Meia volta nas duas camadas do meio de cada lado: um losango em cada face.', 'Half turns on the two middle layers of each side: a diamond on every face.', 'Media vuelta en las dos capas del medio de cada lado: un rombo en cada cara.'], '2R2 3R2 2U2 3U2 2F2 3F2'),
    p('cubo-no-cubo', ['Cubo dentro do cubo', 'Cube in a cube', 'Cubo dentro del cubo'], ['O mesmo padrão do 3x3, girando duas camadas de cada vez (Rw, Uw…).', 'The 3x3 pattern again, turning two layers at a time (Rw, Uw…).', 'El mismo patrón del 3x3, girando dos capas a la vez (Rw, Uw…).'], "Fw Lw Fw Uw' Rw Uw Fw2 Lw2 Uw' Lw' Bw Dw' Bw' Lw2 Uw"),
    p('cubinho', ['Cubinho no canto', 'Little corner cube', 'Cubito en la esquina'], ['O padrão do 3x3 só com as faces de fora: um cubo pequeno no canto.', 'The 3x3 pattern with outer faces only: a small cube in the corner.', 'El patrón del 3x3 solo con las caras de fuera: un cubo pequeño en la esquina.'], "F L F U' R U F2 L2 U' L' B D' B' L2 U"),
  ],
  cube5: [
    p('xadrez', ['Xadrez', 'Checkerboard', 'Ajedrez'], ['Meia volta nas camadas 1, 3 e 5 de cada lado.', 'Half turns on layers 1, 3 and 5 of each side.', 'Media vuelta en las capas 1, 3 y 5 de cada lado.'], 'R2 3R2 5R2 U2 3U2 5U2 F2 3F2 5F2'),
    p('pontos', ['Seis pontos', 'Six spots', 'Seis puntos'], ['O meio de cada face (3x3) troca de lugar com o de outra face.', 'The middle of each face (3x3) swaps with another face’s.', 'El centro de cada cara (3x3) cambia de lugar con el de otra cara.'], "U D' R L' F B' U D'"),
    p('cruz', ['Cruz', 'Cross', 'Cruz'], ['A cruz do 3x3, girando duas camadas de cada vez.', 'The 3x3 cross, turning two layers at a time.', 'La cruz del 3x3, girando dos capas a la vez.'], "Uw Fw Bw' Lw2 Uw2 Lw2 Fw' Bw Uw2 Lw2 Uw"),
    p('cubo-no-cubo', ['Cubo dentro do cubo', 'Cube in a cube', 'Cubo dentro del cubo'], ['Um cubo 2x2 encaixado no canto (giros de duas camadas).', 'A 2x2 cube tucked into the corner (two-layer turns).', 'Un cubo 2x2 encajado en la esquina (giros de dos capas).'], "Fw Lw Fw Uw' Rw Uw Fw2 Lw2 Uw' Lw' Bw Dw' Bw' Lw2 Uw"),
    p('cubinho', ['Cubinho no canto', 'Little corner cube', 'Cubito en la esquina'], ['Só as faces de fora: um cubo pequeno no canto.', 'Outer faces only: a small cube in the corner.', 'Solo las caras de fuera: un cubo pequeño en la esquina.'], "F L F U' R U F2 L2 U' L' B D' B' L2 U"),
  ],
};

/** puzzles com padrões (a ordem das abas) */
export const PATTERN_PUZZLES = Object.keys(PATTERNS);
