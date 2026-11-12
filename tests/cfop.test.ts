import { describe, expect, it } from 'vitest';
import { NxNGeometry } from '../src/puzzles/nxn/geometry';
import { ALG_CHECKS, algPreserves, solveCFOP } from '../src/puzzles/cube3/solver/cfop';

const geo = new NxNGeometry(3);
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);
const solved = geo.solved();

describe('algoritmos do CFOP', () => {
  for (const [list, check] of ALG_CHECKS)
    for (const a of list)
      it(`${a.name}: ${a.alg}`, () => {
        expect(algPreserves(a.alg, check)).toBe(true);
      });
});

describe('solucionador CFOP', () => {
  it('cubo resolvido não gera passos', () => {
    expect(solveCFOP(solved).steps.length).toBe(0);
  });

  it('resolve 150 embaralhamentos aleatórios', () => {
    let total = 0, maxMoves = 0, maxMs = 0;
    const t0 = performance.now();
    for (let i = 0; i < 150; i++) {
      const start = applyAll(solved, geo.randomScramble(25));
      const t = performance.now();
      const sol = solveCFOP(start);
      maxMs = Math.max(maxMs, performance.now() - t);
      const moves = sol.steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, moves)).toEqual(solved);
      total += moves.length;
      maxMoves = Math.max(maxMoves, moves.length);
    }
    const ms = performance.now() - t0;
    console.log(`CFOP: média ${(total / 150).toFixed(1)} movimentos, máx ${maxMoves}, ${(ms / 150).toFixed(0)} ms/cubo (pior ${maxMs.toFixed(0)} ms)`);
  }, 600_000);
});
