/**
 * 6x6 e 7x7 (src/puzzles/nxn/big.ts): peças, algoritmos de paridade, validação e solução.
 */
import { describe, expect, it } from 'vitest';
import cube6 from '../src/puzzles/cube6';
import cube7 from '../src/puzzles/cube7';
import { getBigCube, ollParityAlg, pllParityAlg, wingParityAlg } from '../src/puzzles/nxn/big';
import { describeNxNMove } from '../src/puzzles/nxn/text';
import type { PuzzleImpl } from '../src/core/types';

const CUBES: [number, PuzzleImpl][] = [
  [6, cube6],
  [7, cube7],
];
const run = (impl: PuzzleImpl, s: string[], moves: string[]) => moves.reduce((x, m) => impl.applyMove(x, m), s);
const same = (a: string[], b: string[]) => a.join('') === b.join('');
const changed = (a: string[], b: string[]) => a.flatMap((c, i) => (c !== b[i] ? [i] : []));

for (const [n, impl] of CUBES) {
  const cube = getBigCube(n);
  const solved = impl.solvedState();
  const scrambled = () => run(impl, solved, impl.scramble());

  describe(`${n}x${n} — peças e notação`, () => {
    it('tipos de peça: centros e pontas com 24 posições cada', () => {
      expect(cube.CENTER_ORBITS.length).toBe(n === 6 ? 4 : 6);
      expect(cube.CENTER_ORBITS.every((o) => o.length === 24)).toBe(true);
      expect(cube.WING_ORBITS.map((o) => o.length)).toEqual([24, 24]);
      expect(cube.WING_LAYER.sort()).toEqual([2, 3]);
      expect(cube.FACE_CENTERS.flat().length + cube.FIXED_CENTERS.length).toBe(6 * (n - 2) ** 2);
    });
    it('3R é só a 3ª camada: 3Rw = R + 2R + 3R', () => {
      expect(same(run(impl, run(impl, solved, ['3Rw']), ["R'", "2R'", "3R'"]), solved)).toBe(true);
    });
    it('a descrição do 3R fala da 3ª camada', () => {
      expect(describeNxNMove('3R', false)).toMatch(/^3ª camada da direita/);
      expect(describeNxNMove("2U'", false)).toMatch(/^2ª camada de cima/);
    });
    it('embaralho válido e sem mexer na fatia do meio', () => {
      const sc = impl.scramble();
      expect(sc.length).toBe(n === 6 ? 80 : 100);
      expect(sc.some((m) => /^[MES]/.test(m))).toBe(false);
      if (n === 7) expect(cube.FIXED_CENTERS.every((i) => run(impl, solved, sc)[i] === solved[i])).toBe(true);
    });
  });

  describe(`${n}x${n} — algoritmos de paridade`, () => {
    for (const k of [2, 3])
      it(`paridade das pontas da camada ${k}: troca só 2 pontas`, () => {
        const d = changed(run(impl, solved, wingParityAlg(k).split(' ')), solved);
        expect(d.length).toBe(4);
        expect(d.every((i) => cube.slotOf[i] === 1), 'só na aresta da frente de cima').toBe(true);
      });
    if (n === 6) {
      it('paridade OLL: vira só a aresta da frente de cima', () => {
        const s = run(impl, solved, ollParityAlg(6).split(' '));
        const d = changed(s, solved);
        expect(d.length).toBe(8);
        expect(d.every((i) => cube.slotOf[i] === 1)).toBe(true);
      });
      it('paridade PLL: troca só as arestas de cima da frente e de trás', () => {
        const d = changed(run(impl, solved, pllParityAlg(6).split(' ')), solved);
        expect(d.length).toBe(8);
        expect(d.every((i) => cube.slotOf[i] === 1 || cube.slotOf[i] === 3)).toBe(true);
      });
    }
  });

  describe(`${n}x${n} — validação`, () => {
    it('resolvido e embaralhado são válidos', () => {
      expect(impl.validate(solved).ok).toBe(true);
      for (let k = 0; k < 5; k++) expect(impl.validate(scrambled()).ok).toBe(true);
    });
    it('ponta com as cores ao contrário é apontada', () => {
      const s = [...solved];
      const p = cube.WING_ORBITS[0][0];
      [s[p], s[cube.partner(p)]] = [s[cube.partner(p)], s[p]];
      const r = impl.validate(s);
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/ponta/);
    });
    it('centros trocados entre tipos diferentes são apontados', () => {
      const s = [...solved];
      const [a, b] = [cube.CENTER_ORBITS[0][0], cube.CENTER_ORBITS[1].find((i) => solved[i] !== solved[cube.CENTER_ORBITS[0][0]])!];
      [s[a], s[b]] = [s[b], s[a]];
      const r = impl.validate(s);
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/centros/);
    });
    it('canto girado é apontado', () => {
      const s = [...solved];
      const c = cube.CORNERS[0];
      [s[c[0]], s[c[1]], s[c[2]]] = [s[c[1]], s[c[2]], s[c[0]]];
      expect(impl.validate(s).ok).toBe(false);
    });
    it('falta pintar', () => {
      const s = [...solved];
      s[3] = '?';
      expect(impl.validate(s).errors[0]).toMatch(/falta 1 adesivo/);
    });
  });

  describe(`${n}x${n} — solução`, () => {
    const check = (start: string[], method: string) => {
      const sol = impl.solve(start, method);
      const moves = sol.steps.flatMap((st) => st.segments.flatMap((sg) => sg.moves));
      expect(same(run(impl, start, moves), solved), 'termina resolvido').toBe(true);
      expect(sol.steps.every((st) => st.focus.length && st.focus.every((i) => i >= 0 && i < impl.stickerCount))).toBe(true);
      expect(sol.steps.every((st) => sol.stages.some((sg) => sg.id === st.stageId))).toBe(true);
      expect(sol.steps.every((st) => st.segments.every((sg) => sg.moves.length > 0))).toBe(true);
      return sol;
    };
    for (const method of ['beginner', 'cfop'])
      it(`resolve embaralhados (${method})`, () => {
        for (let k = 0; k < 5; k++) check(scrambled(), method);
      }, 120000);
    it('com paridade nas pontas', () => {
      const sol = check(run(impl, solved, wingParityAlg(2).split(' ')), 'beginner');
      expect(sol.steps.some((st) => st.title.includes('Paridade'))).toBe(true);
    });
    if (n === 6) {
      it('com paridade OLL e PLL', () => {
        const oll = check(run(impl, solved, ollParityAlg(6).split(' ')), 'beginner');
        expect(oll.steps.some((st) => st.stageId === 'parity' && st.title.includes('OLL'))).toBe(true);
        const pll = check(run(impl, solved, pllParityAlg(6).split(' ')), 'beginner');
        expect(pll.steps.some((st) => st.stageId === 'parity' && st.title.includes('PLL'))).toBe(true);
      });
    }
    it('já resolvido não tem passos', () => {
      expect(impl.solve(solved, 'beginner').steps.length).toBe(0);
    });
    it('cabe num tutorial: até ~1300 movimentos', () => {
      const sol = impl.solve(scrambled(), 'beginner');
      const total = sol.steps.reduce((a, st) => a + st.segments.reduce((b, sg) => b + sg.moves.length, 0), 0);
      expect(total).toBeLessThan(n === 6 ? 1000 : 1300);
    });
  });
}

describe('6x6 — câmera', () => {
  it('recupera a leitura nos enganos comuns', () => {
    const turn = <T>(img: T[]) => Array.from({ length: 36 }, (_, k) => img[(5 - (k % 6)) * 6 + ((k / 6) | 0)]);
    const mistakes: ((m: string[][]) => string[][])[] = [
      (m) => [m[0], m[3], m[2], m[1], m[4], m[5]],
      (m) => [m[0], m[1], m[2], m[3], turn(m[4]), m[5]],
      (m) => [m[0], m[1], m[2], m[3], m[5], m[4]],
    ];
    let ok = 0, total = 0;
    for (let t = 0; t < 10; t++) {
      const truth = run(cube6, cube6.solvedState(), cube6.scramble());
      const imgs = cube6.scan.map((f) => f.grid.flat().map((i) => truth[i]));
      for (const fn of mistakes) {
        const wi = fn(imgs);
        const wrong = [...truth];
        cube6.scan.forEach((f, k) => f.grid.flat().forEach((i, j) => (wrong[i] = wi[k][j])));
        if (cube6.validate(wrong).ok) continue;
        total++;
        const fixed = cube6.repairScan!(wrong);
        if (fixed.join() === truth.join()) ok++;
      }
    }
    expect(ok / total).toBeGreaterThan(0.9);
  });
});
