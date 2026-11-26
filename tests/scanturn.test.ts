/** Animação da câmera: o giro que leva de uma face do molde à próxima. */
import { describe, expect, it } from 'vitest';
import { apply, poseMatrix, turnDuration, turnMatrix, turnSteps, type Pose } from '../src/ui/scanturn';
import { buildScan } from '../src/puzzles/nxn/layout';
import { NxNGeometry } from '../src/puzzles/nxn/geometry';
import { CUBE3_COLORS } from '../src/puzzles/cube3/colors';

const scan = buildScan(new NxNGeometry(2), CUBE3_COLORS, { turns: true });
const pose = (face: string) => scan.find((f) => f.face === face)!.pose as Pose;
const deg = (r: number) => Math.round((r * 180) / Math.PI);
const steps = (a: string, b: string) => turnSteps(pose(a), pose(b))!.map((s) => `${s.axis}${deg(s.angle)}`);

describe('câmera — giro entre as faces do cubo', () => {
  it('frente → direita → trás → esquerda: ¼ de volta para a esquerda (a frente vai para a esquerda)', () => {
    for (const [a, b] of [['F', 'R'], ['R', 'B'], ['B', 'L']]) expect(steps(a, b), `${a}→${b}`).toEqual(['y-90']);
  });
  it('esquerda → topo: mais ¼ para a esquerda e depois inclina (topo para a câmera)', () => {
    expect(steps('L', 'U')).toEqual(['y-90', 'x90']);
  });
  it('topo → base: meia volta, inclinando', () => {
    expect(steps('U', 'D')).toEqual(['x180']);
  });
  it('no fim do giro, a próxima face fica de frente, do jeito do molde', () => {
    for (const [a, b] of [['F', 'R'], ['L', 'U'], ['U', 'D'], ['F', 'D'], ['R', 'U']]) {
      const st = turnSteps(pose(a), pose(b))!;
      const m = turnMatrix(pose(a), st, turnDuration(st) + 1);
      expect(m.map((v) => Math.round(v * 1e6) / 1e6 + 0), `${a}→${b}`).toEqual(poseMatrix(pose(b)).map((v) => v + 0));
      // e a face de destino aponta para a câmera
      expect(apply(m, pose(b).out).map((v) => Math.round(v) + 0)).toEqual([0, 0, 1]);
    }
  });
});
