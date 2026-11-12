import { expect, it } from 'vitest';
import { faceNeighbors } from '../src/puzzles/nxn/layout';

it('vizinhos das faces como vistas pela câmera', () => {
  expect(faceNeighbors('F')).toEqual({ up: 'U', down: 'D', left: 'L', right: 'R' });
  expect(faceNeighbors('R')).toEqual({ up: 'U', down: 'D', left: 'F', right: 'B' });
  expect(faceNeighbors('B')).toEqual({ up: 'U', down: 'D', left: 'R', right: 'L' });
  expect(faceNeighbors('L')).toEqual({ up: 'U', down: 'D', left: 'B', right: 'F' });
  // U visto de cima com o verde (F) embaixo; D visto de baixo com o verde em cima
  expect(faceNeighbors('U')).toEqual({ up: 'B', down: 'F', left: 'L', right: 'R' });
  expect(faceNeighbors('D')).toEqual({ up: 'F', down: 'B', left: 'L', right: 'R' });
});
