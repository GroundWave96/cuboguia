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

describe('2x2 — câmera começando por qualquer face', () => {
  it('gira o cubo lido até o canto de referência ficar no lugar', async () => {
    const cube2 = (await import('../src/puzzles/cube2')).default;
    const { NxNGeometry } = await import('../src/puzzles/nxn/geometry');
    const g = new NxNGeometry(2);
    for (let t = 0; t < 30; t++) {
      const start = cube2.scramble(15).reduce((s, m) => cube2.applyMove(s, m), cube2.solvedState());
      // o usuário segurou o cubo virado de um jeito qualquer
      const turns = Array.from({ length: 6 }, () => ['Rw', 'Uw', 'Fw'][Math.floor(Math.random() * 3)]);
      const seen = turns.reduce((s, m) => g.apply(s, m), start);
      const fixedBack = cube2.normalize!(seen);
      expect(fixedBack.join('')).toBe(start.join(''));
      expect(cube2.validate(fixedBack).ok).toBe(true);
    }
  });
});

describe('2x2 — câmera com faces mostradas fora de ordem ou giradas', () => {
  it('recupera o cubo certo nos enganos comuns', async () => {
    const cube2 = (await import('../src/puzzles/cube2')).default;
    const { NxNGeometry } = await import('../src/puzzles/nxn/geometry');
    const g = new NxNGeometry(2);
    const turn = (img: string[]) => [img[2], img[0], img[3], img[1]];
    const mistakes: [string, (imgs: string[][]) => string[][]][] = [
      ['girou para a direita', (m) => [m[0], m[3], m[2], m[1], m[4], m[5]]],
      ['topo girado ¼', (m) => [m[0], m[1], m[2], m[3], turn(m[4]), m[5]]],
      ['base girada ½', (m) => [m[0], m[1], m[2], m[3], m[4], turn(turn(m[5]))]],
      ['topo e base trocados', (m) => [m[0], m[1], m[2], m[3], m[5], m[4]]],
      ['direita + topo girado', (m) => [m[0], m[3], m[2], m[1], turn(m[4]), m[5]]],
    ];
    const stats: Record<string, [number, number, number]> = {};
    for (let t = 0; t < 150; t++) {
      const truth = cube2.scramble(15).reduce((s, m) => cube2.applyMove(s, m), cube2.solvedState());
      // o usuário segurou o cubo de um jeito qualquer
      const held = Array.from({ length: 4 }, () => ['Rw', 'Uw', 'Fw'][Math.floor(Math.random() * 3)]).reduce((s, m) => g.apply(s, m), truth);
      const imgs = cube2.scan.map((f) => f.grid.flat().map((i) => held[i]));
      for (const [name, fn] of mistakes) {
        const wrongImgs = fn(imgs);
        const wrong = [...held];
        cube2.scan.forEach((f, k) => f.grid.flat().forEach((i, j) => (wrong[i] = wrongImgs[k][j])));
        stats[name] ??= [0, 0, 0];
        const before = cube2.validate(cube2.normalize!(wrong)).ok;
        const fixed = cube2.normalize!(cube2.repairScan!(wrong));
        if (before) stats[name][2]++; // o engano por acaso ainda forma um cubo válido
        else if (fixed.join('') === truth.join('')) stats[name][0]++;
        stats[name][1]++;
      }
    }
    console.log(Object.entries(stats).map(([k, [ok, n, val]]) => `${k}: recuperou ${ok}/${n - val} (${val} enganos que já davam um cubo válido)`).join('\n'));
    for (const [, [ok, n, val]] of Object.entries(stats)) expect(ok / (n - val)).toBeGreaterThan(0.97);
  });
});
