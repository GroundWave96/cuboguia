import { faceNotation } from '../nxn/text';
import { tr } from '../../core/i18n';
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
  get holdHint() {
    return tr('Segure o cubo com o <b>amarelo</b> em cima e o <b>verde</b> de frente.', 'Hold the cube with <b>yellow</b> on top and <b>green</b> in front.');
  },
  stickerCount: geo.count,
  solvedState: () => geo.solved(),
  fixedStickers: CENTERS,
  applyMove: (s, m) => geo.apply(s, m),
  invertMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 25) => geo.randomScramble(len),
  validate: validateCube3,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Iniciante (camadas)', 'Beginner (layers)'),
        tagline: tr('Para aprender · ~130 movimentos', 'To learn · ~130 moves'),
        description: tr(
          'Camada por camada, com poucos algoritmos para decorar. O melhor jeito de resolver pela primeira vez.',
          'Layer by layer, with few algorithms to memorize. The best way to solve it for the first time.',
        ),
      },
      {
        id: 'cfop',
        name: tr('CFOP (avançado)', 'CFOP (advanced)'),
        tagline: tr('O dos speedcubers · ~70 movimentos', 'What speedcubers use · ~70 moves'),
        description: tr(
          'Cruz planejada de uma vez, pares no F2L e OLL/PLL em 2 etapas. Mais rápido e com bem menos movimentos.',
          'Cross planned in one go, pairs in F2L and OLL/PLL in 2 looks. Faster and with far fewer moves.',
        ),
      },
    ];
  },
  solve: (state, methodId) => (methodId === 'cfop' ? solveCFOP(state) : solveBeginner(state)),
  createView: (container) => new NxNView(container, geo, COLOR_HEX),
  net: buildNet(3),
  scan: buildScan(geo, CUBE3_COLORS),
  get notationHelp() {
    return faceNotation(true);
  },
};

export default cube3;
