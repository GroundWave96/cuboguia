/** Animação da câmera: o giro que leva de uma face do molde à próxima, em todos os puzzles. */
import { describe, expect, it } from 'vitest';
import { apply, poseMatrix, turnDuration, turnMatrix, turnSteps, type Pose, type TurnStep, type V3 } from '../src/ui/scanturn';
import { buildScan } from '../src/puzzles/nxn/layout';
import { NxNGeometry } from '../src/puzzles/nxn/geometry';
import { CUBE3_COLORS } from '../src/puzzles/cube3/colors';
import { PUZZLES, loadPuzzle } from '../src/core/registry';

const scan = buildScan(new NxNGeometry(2), CUBE3_COLORS);
const pose = (face: string) => scan.find((f) => f.face === face)!.pose as Pose;
const deg = (r: number) => Math.round((r * 180) / Math.PI);
/** "y-90": eixo da tela (quando é um dos três) e ângulo com sinal */
const name = (s: TurnStep) => {
  const k = s.axis.findIndex((v) => Math.abs(Math.abs(v) - 1) < 1e-6);
  return k < 0 ? `?${deg(s.angle)}` : `${'xyz'[k]}${deg(s.angle * Math.sign(s.axis[k]))}`;
};
const steps = (a: string, b: string) => turnSteps(pose(a), pose(b))!.map(name);
const round = (m: number[]) => m.map((v) => Math.round(v * 1e5) / 1e5 + 0);

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
});

describe('câmera — giro entre as faces de todos os puzzles', () => {
  for (const def of PUZZLES.filter((p) => p.available))
    it(`${def.id}: cada passo termina na pose da próxima face, com no máximo 2 movimentos`, async () => {
      const impl = await loadPuzzle(def.id);
      const faces = impl.scan;
      expect(faces.every((f) => f.pose), 'todas as faces com pose').toBe(true);
      const log: string[] = [];
      for (const f of faces) {
        const M = poseMatrix(f.pose as Pose);
        // direções ortonormais
        const MMt = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => M[i * 3] * M[j * 3] + M[i * 3 + 1] * M[j * 3 + 1] + M[i * 3 + 2] * M[j * 3 + 2]));
        expect(round(MMt), `${def.id} ${f.face} ortonormal`).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
        if (f.cells) {
          // faces poligonais: o encaixe no quadro, e o centro da face no centro do quadro
          expect(f.pose!.center && f.pose!.scale && f.pose!.origin, `${def.id} ${f.face} encaixe`).toBeTruthy();
          const v = apply(M, f.pose!.origin as V3);
          expect(Math.abs(v[0]) + Math.abs(v[1]), `${def.id} ${f.face} centrada`).toBeLessThan(1e-6);
        }
      }
      for (let i = 1; i < faces.length; i++) {
        const a = faces[i - 1].pose as Pose, b = faces[i].pose as Pose;
        const st = turnSteps(a, b);
        expect(st, `${def.id} ${i}`).not.toBeNull();
        expect(st!.length).toBeGreaterThan(0);
        expect(st!.length).toBeLessThanOrEqual(2);
        const end = turnMatrix(a, st!, turnDuration(st!) + 1);
        expect(round(end), `${def.id} ${faces[i - 1].face}→${faces[i].face}`).toEqual(round(poseMatrix(b)));
        log.push(`${faces[i - 1].face}→${faces[i].face}: ${st!.map((s) => `${deg(s.angle)}°`).join(' + ')}`);
      }
      console.log(def.id, log.join(' · '));
    });

  it('Megaminx e Kilominx: dar a volta no anel de cima é 1 passo de 72° em volta do topo', async () => {
    for (const id of ['megaminx', 'kilominx']) {
      const faces = (await loadPuzzle(id)).scan;
      for (let i = 1; i < 5; i++) {
        const st = turnSteps(faces[i - 1].pose as Pose, faces[i].pose as Pose)!;
        expect(st, id).toHaveLength(1);
        expect(Math.abs(deg(st[0].angle))).toBe(72);
      }
    }
  });

  it('Pyraminx e Mastermorphix: ⅓ de volta em volta da ponta de cima entre as 3 faces de lado', async () => {
    for (const id of ['pyraminx', 'mastermorphix']) {
      const faces = (await loadPuzzle(id)).scan;
      for (let i = 1; i < 3; i++) {
        const st = turnSteps(faces[i - 1].pose as Pose, faces[i].pose as Pose)!;
        expect(st, id).toHaveLength(1);
        expect(Math.abs(deg(st[0].angle))).toBe(120);
      }
    }
  });
});
