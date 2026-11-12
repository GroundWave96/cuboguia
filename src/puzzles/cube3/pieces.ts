/** Tabelas de peças do 3x3 (índices de adesivos 0..53, convenção Kociemba). */

export const CORNERS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const;
export const CORNER_FACELETS: number[][] = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
];

export const EDGES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const;
export const EDGE_FACELETS: number[][] = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
];

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const faceOf = (i: number) => FACES[Math.floor(i / 9)];

export const CORNER_COLORS = CORNER_FACELETS.map((fs) => fs.map(faceOf));
export const EDGE_COLORS = EDGE_FACELETS.map((fs) => fs.map(faceOf));

export const CENTERS = [4, 13, 22, 31, 40, 49];
