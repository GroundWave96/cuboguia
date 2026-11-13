import { describe, expect, it } from 'vitest';
import { NxNGeometry } from '../src/puzzles/nxn/geometry';
import { cornerFacelets } from '../src/puzzles/nxn/pieces';
import { CORNER_FACELETS } from '../src/puzzles/cube3/pieces';
import { makeValidate2 } from '../src/puzzles/cube2/validate';
import { solveBeginner2, SUNE, T_PERM, Y_PERM } from '../src/puzzles/cube2/solver/beginner2';
import { applyCubieMove, optimalMoves, solveOptimal2, toCubies } from '../src/puzzles/cube2/solver/optimal2';
import { applyPerm, composePerm, solvedS, toS } from '../src/puzzles/cube2/solver/kit';

const geo = new NxNGeometry(2);
const solved = geo.solved();
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);
/** embaralha só com U, R, F: o canto de referência (DBL) não sai do lugar */
const scramble = (n = 20) => {
  const out: string[] = [];
  let last = '';
  while (out.length < n) {
    const f = 'URF'[Math.floor(Math.random() * 3)];
    if (f === last) continue;
    out.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
    last = f;
  }
  return out;
};
const validate = makeValidate2(geo);

describe('peças genéricas', () => {
  it('cantos do 3x3 calculados pela geometria batem com a tabela de Kociemba', () => {
    expect(cornerFacelets(new NxNGeometry(3))).toEqual(CORNER_FACELETS);
  });
  it('composição de movimentos em peças bate com a dos adesivos', () => {
    for (let t = 0; t < 30; t++) {
      const seq = scramble(8);
      const viaStickers = toCubies(applyPerm(solvedS, composePerm(seq)));
      const MOVES = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2'];
      let c = { cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0] };
      for (const m of seq) c = applyCubieMove(c, MOVES.indexOf(m));
      expect(c).toEqual(viaStickers);
    }
  });
});

describe('validação 2x2', () => {
  it('aceita resolvido e embaralhado', () => {
    expect(validate(solved).ok).toBe(true);
    expect(validate(applyAll(solved, scramble())).ok).toBe(true);
  });
  it('rejeita canto torcido', () => {
    const s = [...solved];
    const [a, b, c] = cornerFacelets(geo)[0];
    [s[a], s[b], s[c]] = [s[c], s[a], s[b]];
    expect(validate(s).ok).toBe(false);
  });
  it('aceita duas peças trocadas (no 2x2 não existe paridade)', () => {
    expect(validate(applyAll(solved, T_PERM.split(' '))).ok).toBe(true);
  });
});

describe('algoritmos do 2x2 preservam a camada de baixo', () => {
  for (const alg of [SUNE, T_PERM, Y_PERM])
    it(alg, () => {
      const s = applyPerm(solvedS, composePerm(alg.split(' ')));
      for (const i of [12, 13, 14, 15, 6, 7, 10, 11, 18, 19, 22, 23]) expect(s[i]).toBe(solvedS[i]);
    });
});

describe('solucionadores 2x2', () => {
  it('iniciante resolve 300 embaralhamentos', () => {
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const start = applyAll(solved, scramble());
      const moves = solveBeginner2(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, moves)).toEqual(solved);
      total += moves.length;
    }
    console.log(`2x2 iniciante: média ${(total / 300).toFixed(1)} movimentos`);
  });

  it('ótimo resolve 300 embaralhamentos com no máximo 11 movimentos', () => {
    let total = 0, max = 0;
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) {
      const start = applyAll(solved, scramble(25));
      const sol = solveOptimal2(start);
      const moves = sol.steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, moves)).toEqual(solved);
      expect(moves.length).toBeLessThanOrEqual(11);
      total += moves.length;
      max = Math.max(max, moves.length);
    }
    console.log(`2x2 ótimo: média ${(total / 300).toFixed(1)}, máx ${max}, ${((performance.now() - t0) / 300).toFixed(1)} ms/cubo`);
  });

  it('ótimo é realmente ótimo num caso conhecido (R U R\' U\' tem solução de 4)', () => {
    const start = applyAll(solved, ["R", "U", "R'", "U'"]);
    expect(optimalMoves(start).length).toBe(4);
  });

  it('cubo resolvido não gera passos', () => {
    expect(solveBeginner2(solved).steps.length).toBe(0);
    expect(solveOptimal2(solved).steps.length).toBe(0);
  });
});

void toS;
