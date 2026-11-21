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

const p = (id: string, pt: string, en: string, aboutPt: string, aboutEn: string, alg: string): Pattern => ({
  id,
  name: () => tr(pt, en),
  about: () => tr(aboutPt, aboutEn),
  alg,
});

export const PATTERNS: Record<string, Pattern[]> = {
  cube3: [
    p('xadrez', 'Xadrez', 'Checkerboard', 'O clássico: todas as faces viram um tabuleiro de xadrez.', 'The classic: every face becomes a checkerboard.', 'M2 E2 S2'),
    p('pontos', 'Seis pontos', 'Six spots', 'Cada face fica de uma cor só, com o centro de outra cor.', 'Each face is one color, with a center of another color.', "U D' R L' F B' U D'"),
    p('cruz', 'Cruz', 'Cross', 'Uma cruz de outra cor em cada face.', 'A cross of another color on every face.', "U F B' L2 U2 L2 F' B U2 L2 U"),
    p('cubo-no-cubo', 'Cubo dentro do cubo', 'Cube in a cube', 'Parece que tem um cubo menor encaixado no canto.', 'Looks like a smaller cube tucked into the corner.', "F L F U' R U F2 L2 U' L' B D' B' L2 U"),
    p('cubo-cubo-cubo', 'Cubo dentro do cubo dentro do cubo', 'Cube in a cube in a cube', 'Três cubos, um dentro do outro.', 'Three cubes, one inside the other.', "U' L' U' F' R2 B' R F U B2 U B' L U' F U R F'"),
    p('superflip', 'Superflip', 'Superflip', 'Todas as arestas viradas ao contrário. É uma das posições mais longe do cubo resolvido.', 'Every edge flipped. It’s one of the positions farthest from solved.', "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"),
    p('tetris', 'Tetris', 'Tetris', 'Peças que lembram as do Tetris em volta do cubo.', 'Shapes like Tetris pieces around the cube.', "L R F B U' D' L' R'"),
    p('anaconda', 'Anaconda', 'Anaconda', 'Uma cobra que dá a volta no cubo.', 'A snake that wraps around the cube.', "L U B' U' R L' B R' F B' D R D' F'"),
    p('piton', 'Píton', 'Python', 'Outra cobra, com um caminho diferente.', 'Another snake, along a different path.', "F2 R' B' U R' L F' L F' B D' R B L2"),
    p('mamba-preta', 'Mamba negra', 'Black mamba', 'A cobra mais famosa entre os padrões.', 'The most famous snake pattern.', "R D L F' R L' D R' U D' B U' R' D'"),
    p('cruz-plummer', 'Cruz de Plummer', 'Plummer’s cross', 'Uma cruz diferente em cada face.', 'A different cross on each face.', "R2 L' D F2 R' D' R' L U' D R D B2 R' U D2"),
    p('arame', 'Arame', 'Wire', 'Uma faixa fina que passa pelas faces.', 'A thin band running across the faces.', 'R L F B R L F B R L F B R2 B2 L2 R2'),
  ],
  cube4: [
    p('losangos', 'Losangos', 'Diamonds', 'Meia volta nas duas camadas do meio de cada lado: um losango em cada face.', 'Half turns on the two middle layers of each side: a diamond on every face.', '2R2 3R2 2U2 3U2 2F2 3F2'),
    p('cubo-no-cubo', 'Cubo dentro do cubo', 'Cube in a cube', 'O mesmo padrão do 3x3, girando duas camadas de cada vez (Rw, Uw…).', 'The 3x3 pattern again, turning two layers at a time (Rw, Uw…).', "Fw Lw Fw Uw' Rw Uw Fw2 Lw2 Uw' Lw' Bw Dw' Bw' Lw2 Uw"),
    p('cubinho', 'Cubinho no canto', 'Little corner cube', 'O padrão do 3x3 só com as faces de fora: um cubo pequeno no canto.', 'The 3x3 pattern with outer faces only: a small cube in the corner.', "F L F U' R U F2 L2 U' L' B D' B' L2 U"),
  ],
  cube5: [
    p('xadrez', 'Xadrez', 'Checkerboard', 'Meia volta nas camadas 1, 3 e 5 de cada lado.', 'Half turns on layers 1, 3 and 5 of each side.', 'R2 3R2 5R2 U2 3U2 5U2 F2 3F2 5F2'),
    p('pontos', 'Seis pontos', 'Six spots', 'O meio de cada face (3x3) troca de lugar com o de outra face.', 'The middle of each face (3x3) swaps with another face’s.', "U D' R L' F B' U D'"),
    p('cruz', 'Cruz', 'Cross', 'A cruz do 3x3, girando duas camadas de cada vez.', 'The 3x3 cross, turning two layers at a time.', "Uw Fw Bw' Lw2 Uw2 Lw2 Fw' Bw Uw2 Lw2 Uw"),
    p('cubo-no-cubo', 'Cubo dentro do cubo', 'Cube in a cube', 'Um cubo 2x2 encaixado no canto (giros de duas camadas).', 'A 2x2 cube tucked into the corner (two-layer turns).', "Fw Lw Fw Uw' Rw Uw Fw2 Lw2 Uw' Lw' Bw Dw' Bw' Lw2 Uw"),
    p('cubinho', 'Cubinho no canto', 'Little corner cube', 'Só as faces de fora: um cubo pequeno no canto.', 'Outer faces only: a small cube in the corner.', "F L F U' R U F2 L2 U' L' B D' B' L2 U"),
  ],
};

/** puzzles com padrões (a ordem das abas) */
export const PATTERN_PUZZLES = Object.keys(PATTERNS);
