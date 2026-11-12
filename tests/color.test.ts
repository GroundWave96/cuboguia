import { describe, expect, it } from 'vitest';
import { balancedAssign, classifyCubeColor, rgbToLab, type RGB } from '../src/core/color';
import { NxNGeometry } from '../src/puzzles/nxn/geometry';

const geo = new NxNGeometry(3);
// cores "de câmera" com variação de iluminação
const BASE: Record<string, RGB> = {
  U: [210, 200, 50], R: [235, 115, 35], F: [35, 165, 85],
  D: [210, 212, 208], L: [180, 28, 42], B: [25, 75, 175],
};

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

describe('classificador por matiz', () => {
  const cases: [RGB, string][] = [
    // valores parecidos com os da foto do celular (laranja bem avermelhado)
    [[232, 80, 50], 'laranja'],
    [[240, 95, 60], 'laranja'],
    [[190, 70, 40], 'laranja'], // laranja na sombra
    [[250, 140, 40], 'laranja'],
    [[150, 22, 25], 'vermelho'],
    [[185, 30, 45], 'vermelho'],
    [[215, 35, 45], 'vermelho'],
    [[120, 15, 25], 'vermelho'],
    [[70, 175, 70], 'verde'],
    [[30, 140, 90], 'verde'],
    [[215, 220, 40], 'amarelo'],
    [[230, 200, 50], 'amarelo'],
    [[20, 80, 180], 'azul'],
    [[40, 110, 200], 'azul'],
    [[215, 220, 225], 'branco'],
    [[225, 205, 175], 'branco'], // branco sob luz amarelada
    [[180, 190, 210], 'branco'], // branco sob luz fria
  ];
  it.each(cases)('%j → %s', (rgb, expected) => {
    expect(classifyCubeColor(rgb)).toBe(expected);
  });
});

describe('classificação de cores da câmera', () => {
  it('recupera o estado com ruído e variação de brilho', () => {
    const rnd = seeded(42);
    let ok = 0;
    for (let t = 0; t < 50; t++) {
      const state = geo.randomScramble(25).reduce((s, m) => geo.apply(s, m), geo.solved());
      const samples = state.map((k, i) => {
        const face = Math.floor(i / 9);
        const light = 0.75 + 0.1 * face / 5 + rnd() * 0.25; // cada face com iluminação diferente
        return rgbToLab(BASE[k].map((v) => Math.min(255, Math.max(0, v * light + (rnd() - 0.5) * 24))) as RGB);
      });
      const refs = ['U', 'R', 'F', 'D', 'L', 'B'].map((k, f) => ({ key: k, lab: samples[f * 9 + 4] }));
      const fixed = new Map([4, 13, 22, 31, 40, 49].map((i, f) => [i, 'URFDLB'[f]]));
      const out = balancedAssign(samples, refs, 9, fixed);
      if (out.join('') === state.join('')) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(48);
  });
});
