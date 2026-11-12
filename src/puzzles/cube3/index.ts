import type { PuzzleImpl } from '../../core/types';
import { NxNGeometry, invertMove } from '../nxn/geometry';
import { NxNView } from '../nxn/NxNView';
import { buildNet, buildScan } from '../nxn/layout';
import { COLOR_HEX, CUBE3_COLORS } from './colors';
import { CENTERS } from './pieces';
import { validateCube3 } from './validate';
import { solveBeginner } from './solver/beginner';
import { solveCFOP } from './solver/cfop';

const geo = new NxNGeometry(3);

const cube3: PuzzleImpl = {
  colors: CUBE3_COLORS,
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: CENTERS,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 25) => geo.randomScramble(len),
  validate: validateCube3,
  methods: [
    {
      id: 'beginner',
      name: 'Iniciante (camadas)',
      tagline: 'Para aprender · ~130 movimentos',
      description: 'Camada por camada, com poucos algoritmos para decorar. O melhor jeito de resolver pela primeira vez.',
    },
    {
      id: 'cfop',
      name: 'CFOP (avançado)',
      tagline: 'O dos speedcubers · ~70 movimentos',
      description: 'Cruz planejada de uma vez, pares no F2L e OLL/PLL em 2 etapas. Mais rápido e com bem menos movimentos.',
    },
  ],
  solve: (state, methodId) => (methodId === 'cfop' ? solveCFOP(state) : solveBeginner(state)),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(3),
  scan: buildScan(3, CUBE3_COLORS),
  notationHelp: [
    { move: 'U', text: 'Cima (amarelo)' },
    { move: 'D', text: 'Baixo (branco)' },
    { move: 'F', text: 'Frente (verde)' },
    { move: 'B', text: 'Trás (azul)' },
    { move: 'R', text: 'Direita (laranja)' },
    { move: 'L', text: 'Esquerda (vermelho)' },
  ],
};

export default cube3;
