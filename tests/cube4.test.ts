import { describe, expect, it } from 'vitest';
import cube4 from '../src/puzzles/cube4';
import { SLOTS, WING_POSITIONS, geo4 as geo, partner, project3 } from '../src/puzzles/cube4/pieces';
import { OLL_PARITY, PLL_PARITY, parities3, wingCycles } from '../src/puzzles/cube4/solver';

const solved = () => cube4.solvedState();
const run = (s: string[], moves: string[]) => moves.reduce((a, m) => cube4.applyMove(a, m), s);
const scrambled = () => run(solved(), cube4.scramble());
const kindOf = (i: number) => {
  const c = i % 16, r = (c / 4) | 0, k = c % 4;
  const e = (x: number) => x === 0 || x === 3;
  return e(r) && e(k) ? 'canto' : e(r) || e(k) ? 'ponta' : 'centro';
};

describe('4x4 — peças', () => {
  it('24 pontas em 12 lugares de aresta', () => {
    expect(WING_POSITIONS.length).toBe(24);
    expect(new Set(SLOTS.flat()).size).toBe(24);
  });
  it('todos os ciclos de 3 pontas (4048) mexem só nas 3 pontas', () => {
    const cycles = wingCycles();
    expect(cycles.length).toBe(4048);
    for (const c of cycles.slice(0, 200)) {
      const ids = geo.solved().map((_, i) => i);
      const s = run(ids as unknown as string[], c.moves) as unknown as number[];
      const moved = s.map((v, i) => (v !== i ? i : -1)).filter((i) => i >= 0);
      expect(moved.length).toBe(6);
      // a ponta que estava em p[0] foi para p[1]
      expect(s[c.p[1]]).toBe(c.p[0]);
    }
  });
});

describe('4x4 — paridades', () => {
  const effect = (alg: string) => {
    const s = run(solved().map((_, i) => String(i)), alg.split(' '));
    const moved = s.map((v, i) => (v !== String(i) ? i : -1)).filter((i) => i >= 0);
    const col = run(solved(), alg.split(' '));
    return { moved, col };
  };
  it('OLL: vira só a aresta da frente de cima (centros voltam com a cor certa)', () => {
    const { moved, col } = effect(OLL_PARITY);
    expect(moved.filter((i) => kindOf(i) === 'ponta').sort()).toEqual(SLOTS[1].flatMap((p) => [p, partner(p)]).sort());
    expect(moved.some((i) => kindOf(i) === 'canto')).toBe(false);
    expect(col.every((c, i) => kindOf(i) !== 'centro' || c === solved()[i])).toBe(true);
    expect(parities3(project3(col))).toEqual({ oll: true, pll: false });
  });
  it('PLL: troca só as arestas da frente e de trás de cima', () => {
    const { moved, col } = effect(PLL_PARITY);
    expect(moved.filter((i) => kindOf(i) === 'ponta').length).toBe(8);
    expect(moved.some((i) => kindOf(i) === 'canto')).toBe(false);
    expect(col.every((c, i) => kindOf(i) !== 'centro' || c === solved()[i])).toBe(true);
    expect(parities3(project3(col))).toEqual({ oll: false, pll: true });
  });
});

describe('4x4 — solução', () => {
  it('resolvido não gera passos', () => {
    expect(cube4.solve(solved(), 'beginner').steps.length).toBe(0);
  });
  for (const method of ['beginner', 'cfop'])
    it(`resolve embaralhados (${method})`, () => {
      let total = 0, worst = 0, worstMs = 0, oll = 0, pll = 0;
      const N = 25;
      for (let t = 0; t < N; t++) {
        const s = scrambled();
        expect(cube4.validate(s).ok).toBe(true);
        const t0 = performance.now();
        const sol = cube4.solve(s, method);
        worstMs = Math.max(worstMs, performance.now() - t0);
        const moves = sol.steps.flatMap((st) => st.segments.flatMap((g) => g.moves));
        expect(run(s, moves)).toEqual(solved());
        total += moves.length;
        worst = Math.max(worst, moves.length);
        if (sol.steps.some((st) => st.title.startsWith('Paridade OLL'))) oll++;
        if (sol.steps.some((st) => st.title.startsWith('Paridade PLL'))) pll++;
      }
      console.log(`4x4 ${method}: média ${(total / N).toFixed(0)} movimentos, máx ${worst}, pior ${worstMs.toFixed(0)} ms; paridade OLL em ${oll}, PLL em ${pll} de ${N}`);
    });
  it('resolve casos com cada paridade', () => {
    // a partir de um cubo resolvido: só a paridade OLL, só a PLL, as duas
    for (const algs of [[OLL_PARITY], [PLL_PARITY], [OLL_PARITY, PLL_PARITY]]) {
      const s = run(run(solved(), algs.join(' ').split(' ')), ['R', 'U', "F'", 'D2']);
      const sol = cube4.solve(s, 'beginner');
      expect(run(s, sol.steps.flatMap((st) => st.segments.flatMap((g) => g.moves)))).toEqual(solved());
    }
  });
});

describe('4x4 — validação', () => {
  it('resolvido e embaralhado são válidos', () => {
    expect(cube4.validate(solved()).ok).toBe(true);
    expect(cube4.validate(scrambled()).ok).toBe(true);
  });
  it('canto girado é impossível', () => {
    const s = scrambled();
    const [a, b, c] = [0 * 16 + 15, 1 * 16 + 0, 2 * 16 + 3]; // canto URF
    [s[a], s[b], s[c]] = [s[b], s[c], s[a]];
    const r = cube4.validate(s);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/canto/i);
  });
  it('ponta com as cores ao contrário é apontada', () => {
    const s = solved();
    const p = WING_POSITIONS[0];
    [s[p], s[partner(p)]] = [s[partner(p)], s[p]];
    const r = cube4.validate(s);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/ponta/i);
  });
  it('cor sobrando é apontada', () => {
    const s = solved();
    s[5] = 'R';
    expect(cube4.validate(s).ok).toBe(false);
  });
});

describe('4x4 — câmera', () => {
  it('recupera a leitura nos enganos comuns', () => {
    const turn = <T>(img: T[]) => Array.from({ length: 16 }, (_, k) => img[(3 - (k % 4)) * 4 + ((k / 4) | 0)]);
    const mistakes: ((m: string[][]) => string[][])[] = [
      (m) => [m[0], m[3], m[2], m[1], m[4], m[5]],
      (m) => [m[0], m[1], m[2], m[3], turn(m[4]), m[5]],
      (m) => [m[0], m[1], m[2], m[3], m[5], m[4]],
    ];
    let ok = 0, n = 0;
    for (let t = 0; t < 30; t++) {
      const truth = scrambled();
      const imgs = cube4.scan.map((f) => f.grid.flat().map((i) => truth[i]));
      for (const fn of mistakes) {
        const wi = fn(imgs);
        const wrong = [...truth];
        cube4.scan.forEach((f, k) => f.grid.flat().forEach((i, j) => (wrong[i] = wi[k][j])));
        if (cube4.validate(wrong).ok) continue;
        n++;
        const fixed = cube4.repairScan!(wrong);
        expect(cube4.scanOrder!(wrong).map((i) => wrong[i])).toEqual(fixed);
        if (fixed.join() === truth.join()) ok++;
      }
    }
    console.log(`4x4 câmera: recuperou ${ok}/${n}`);
    expect(ok / n).toBeGreaterThan(0.9);
  });
});
