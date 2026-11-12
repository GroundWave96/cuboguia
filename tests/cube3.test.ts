import { describe, expect, it } from 'vitest';
import { NxNGeometry } from '../src/puzzles/nxn/geometry';
import { solveBeginner } from '../src/puzzles/cube3/solver/beginner';
import { validateCube3 } from '../src/puzzles/cube3/validate';

const geo = new NxNGeometry(3);
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);
const solved = geo.solved();

describe('geometria 3x3', () => {
  it('cada movimento repetido 4 vezes volta ao início', () => {
    for (const f of ['U', 'R', 'F', 'D', 'L', 'B']) {
      expect(applyAll(solved, [f, f, f, f])).toEqual(solved);
      expect(applyAll(solved, [f, f + "'"])).toEqual(solved);
      expect(applyAll(solved, [f, f])).toEqual(applyAll(solved, [f + '2']));
    }
  });

  it('sexy move tem ordem 6', () => {
    const six = Array.from({ length: 6 }, () => ['R', 'U', "R'", "U'"]).flat();
    expect(applyAll(solved, six)).toEqual(solved);
  });

  it('R move adesivos de F para U (horário visto da direita)', () => {
    const s = geo.apply(solved, 'R');
    // canto superior-direito de U (índice 8) recebe a cor de F
    expect(s[8]).toBe('F');
    // U recebe F → U[2] (UBR) também F
    expect(s[2]).toBe('F');
  });
});

describe('validação', () => {
  it('aceita cubo resolvido e embaralhado', () => {
    expect(validateCube3(solved).ok).toBe(true);
    expect(validateCube3(applyAll(solved, geo.randomScramble(30))).ok).toBe(true);
  });
  it('rejeita canto torcido', () => {
    const s = [...solved];
    // gira o canto URF: U9(8) R1(9) F3(20)
    [s[8], s[9], s[20]] = [s[20], s[8], s[9]];
    const r = validateCube3(s);
    expect(r.ok).toBe(false);
  });
  it('rejeita duas arestas trocadas', () => {
    const s = [...solved];
    // troca UR (5,10) com UF (7,19)
    [s[5], s[10], s[7], s[19]] = [s[7], s[19], s[5], s[10]];
    expect(validateCube3(s).ok).toBe(false);
  });
});

describe('solucionador iniciante', () => {
  it('resolve o cubo já resolvido sem passos', () => {
    expect(solveBeginner(solved).steps.length).toBe(0);
  });

  it('resolve 300 embaralhamentos aleatórios', () => {
    let total = 0;
    let maxMoves = 0;
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) {
      const start = applyAll(solved, geo.randomScramble(25));
      const sol = solveBeginner(start);
      const moves = sol.steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, moves)).toEqual(solved);
      total += moves.length;
      maxMoves = Math.max(maxMoves, moves.length);
    }
    const ms = performance.now() - t0;
    console.log(`média ${(total / 300).toFixed(1)} movimentos, máx ${maxMoves}, ${(ms / 300).toFixed(1)} ms por cubo`);
  }, 120_000);
});
