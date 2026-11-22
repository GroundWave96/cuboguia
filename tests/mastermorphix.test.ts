/** Mastermorphix: o 3x3 de dentro, a forma de pirâmide e a solução. */
import { describe, expect, it } from 'vitest';
import { CUBIES, NORMALS, ROTS, STICKERS, applyPieces, centerTurns, isPieces, readPyramid, rotate, solvedPieces, solvedPyramid, toPyramid } from '../src/puzzles/mastermorphix/model';
import { allMacros, centerFix, macroKeepsPieces, solveMorph, toPieces } from '../src/puzzles/mastermorphix/solver';

const HALF = ['U2', 'D2', 'R2', 'L2', 'F2', 'B2'];
const rnd = (n: number, seed: number, list = HALF) => {
  let x = seed;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    let m = list[x % list.length];
    while (out.length && out[out.length - 1][0] === m[0]) m = list[(x = (x * 7 + 3) % 2147483648) % list.length];
    out.push(m);
  }
  return out;
};
const run = (s: string[], moves: string[]) => moves.reduce((st, m) => applyPieces(st, m), s);

describe('Mastermorphix — modelo', () => {
  it('24 rotações, 26 peças e 40 adesivos (10 por face, um de cada tipo)', () => {
    expect(ROTS).toHaveLength(24);
    expect(CUBIES).toHaveLength(26);
    expect(STICKERS).toHaveLength(40);
    for (let f = 0; f < 4; f++) {
      const kinds = STICKERS.filter((s) => s.face === f).map((s) => s.kind).sort();
      expect(kinds).toEqual(['center', 'kite', 'kite', 'kite', 'mid', 'mid', 'mid', 'tip', 'tip', 'tip']);
    }
  });

  it('½ volta mantém a pirâmide; ¼ de volta muda a forma; e volta', () => {
    const s0 = solvedPieces();
    expect(toPyramid(s0)).toEqual(solvedPyramid());
    for (const m of ['U', 'R', 'F', 'D', 'L', 'B']) {
      expect(toPyramid(applyPieces(s0, m)), m).toBeNull();
      expect(toPyramid(applyPieces(s0, m + '2')), m + '2').not.toBeNull();
      expect(toPyramid(run(s0, [m, m, m, m]))).toEqual(solvedPyramid());
    }
    // o centro ½ volta troca as cores, mas a forma continua de pirâmide
    const u2 = toPyramid(applyPieces(s0, 'U2'))!;
    expect(u2).not.toEqual(solvedPyramid());
  });

  it('as cores de uma pirâmide embaralhada viram de novo as mesmas cores', () => {
    for (let seed = 1; seed < 40; seed++) {
      const pyr = toPyramid(run(solvedPieces(), rnd(25, seed)))!;
      const r = readPyramid(pyr);
      expect(r.error, `seed ${seed}`).toBeNull();
      expect(toPyramid(r.pieces!)).toEqual(pyr);
    }
  });

  it('pinturas impossíveis são recusadas', () => {
    const s = solvedPyramid();
    expect(readPyramid(s.map((c, i) => (i === 0 ? 'F' : c))).error).toBe('colors');
    // duas pontas trocadas de lugar (cada uma no vértice da outra) não existe
    const bad = [...s];
    const t0 = STICKERS.filter((x) => x.kind === 'tip' && x.face === 0)[0].index;
    const t1 = STICKERS.filter((x) => x.kind === 'tip' && x.face === 1)[0].index;
    [bad[t0], bad[t1]] = [bad[t1], bad[t0]];
    expect(readPyramid(bad).error).not.toBeNull();
  });
});

describe('Mastermorphix — solução', () => {
  it('os algoritmos dos meios não mexem em cantos nem arestas', () => {
    const ms = allMacros();
    expect(ms.length).toBeGreaterThan(20);
    for (const m of ms) {
      expect(macroKeepsPieces(m), m.parts.map((p) => p.moves.join(' ')).join()).toBe(true);
      expect(m.effect.some(Boolean)).toBe(true);
    }
    // ½ volta em um centro só: 12 movimentos
    expect(centerFix([2, 0, 0, 0, 0, 0]).reduce((a, m) => a + m.length, 0)).toBe(12);
    // quaisquer giros (soma par) têm conserto
    expect(centerFix([1, 3, 0, 2, 1, 1]).length).toBeGreaterThan(0);
  });

  for (const method of ['beginner', 'cfop'])
    it(`${method}: resolve e a pirâmide volta inteira, com os meios certos`, () => {
      for (let seed = 1; seed < 25; seed++) {
        const scr = rnd(25, seed * 7 + 3);
        const pyr = toPyramid(run(solvedPieces(), scr))!;
        const sol = solveMorph(pyr, method);
        let s: string[] = toPieces(pyr);
        for (const st of sol.steps) for (const g of st.segments) for (const m of g.moves) s = applyPieces(s, m);
        expect(isPieces(s)).toBe(true);
        expect(toPyramid(s), `seed ${seed}`).toEqual(solvedPyramid());
        expect(Object.values(centerTurns(s)).every((k) => k === 0)).toBe(true);
      }
    });
});

describe('Mastermorphix — qualquer pirâmide possível', () => {
  /** monta uma pirâmide sorteando peças (cada tipo no lugar do seu tipo, girada sem mudar a forma) */
  function randomPyramid(seed: number): string[] {
    let x = seed;
    const r = (n: number) => ((x = (x * 1103515245 + 12345) % 2147483648), x % n);
    const shuffle = <T,>(a: T[]) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = r(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const rot = new Array(26).fill(0);
    const byKind = (k: string) => CUBIES.map((_, i) => i).filter((i) => STICKERS.some((s) => s.cubie === i && s.kind === k));
    for (const kind of ['tip', 'center', 'kite', 'mid']) {
      const slots = byKind(kind);
      const pieces = kind === 'mid' ? slots : shuffle([...slots]);
      slots.forEach((slot, j) => {
        const h = pieces[j];
        const faces = (c: number) => [...new Set(STICKERS.filter((s) => s.cubie === c).map((s) => s.face))].sort().join();
        const ok = ROTS.map((_, ri) => ri).filter((ri) => {
          const p = rotate(ri, CUBIES[h]);
          if (p.join() !== CUBIES[slot].join()) return false;
          // as faces da peça caem exatamente nas faces do lugar
          const hf = STICKERS.filter((s) => s.cubie === h).map((s) => s.face);
          const moved = hf.map((f) => rotate(ri, NORMALS[f]).join());
          return moved.every((m) => NORMALS.some((n) => n.join() === m)) && moved.map((m) => NORMALS.findIndex((n) => n.join() === m)).sort().join() === faces(slot);
        });
        rot[h] = ok[r(ok.length)];
      });
    }
    return toPyramid(['@', 'D', 'F', 'L', 'R', ...rot.map(String)])!;
  }

  it('resolve todas as que existem de verdade', () => {
    let solved = 0;
    for (let seed = 1; seed <= 160 && solved < 25; seed++) {
      const pyr = randomPyramid(seed);
      expect(pyr).not.toBeNull();
      if (readPyramid(pyr).error) continue; // sorteio impossível (paridade, giro dos cantos)
      const sol = solveMorph(pyr, seed % 2 ? 'cfop' : 'beginner');
      let s: string[] = toPieces(pyr);
      for (const st of sol.steps) for (const g of st.segments) for (const m of g.moves) s = applyPieces(s, m);
      expect(toPyramid(s), `seed ${seed}`).toEqual(solvedPyramid());
      solved++;
    }
    expect(solved).toBe(25);
  });
});

describe('Mastermorphix — câmera', () => {
  it('moldes dentro do quadro e o ponto de leitura dentro de cada região', async () => {
    const impl = (await import('../src/puzzles/mastermorphix')).default;
    expect(impl.scan).toHaveLength(4);
    const inside = (p: [number, number], poly: [number, number][]) => {
      let s = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        s += Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
      }
      return Math.abs(s) === poly.length;
    };
    for (const f of impl.scan) {
      expect(f.grid.flat()).toHaveLength(10);
      for (const c of f.cells!) {
        for (const [x, y] of c.poly) expect(x >= 0 && x <= 1 && y >= 0 && y <= 1).toBe(true);
        expect(inside(c.center, c.poly)).toBe(true);
      }
    }
    // todas as 40 posições aparecem uma vez
    expect(new Set(impl.scan.flatMap((f) => f.grid.flat())).size).toBe(40);
  });

  it('faces mostradas fora de ordem ou giradas são remontadas', async () => {
    const impl = (await import('../src/puzzles/mastermorphix')).default;
    const pyr = toPyramid(run(solvedPieces(), rnd(25, 11)))!;
    expect(impl.repairScan!(pyr)).toEqual(pyr);
    // 2ª e 3ª faces trocadas (girou para o outro lado)
    const g = impl.scan.map((f) => f.grid.flat());
    const swapped = [...pyr];
    g[1].forEach((idx, k) => (swapped[idx] = pyr[g[2][k]]));
    g[2].forEach((idx, k) => (swapped[idx] = pyr[g[1][k]]));
    expect(impl.validate(swapped).ok).toBe(false);
    const fixed = impl.repairScan!(swapped);
    expect(impl.validate(fixed).ok).toBe(true);
  });
});

describe('Mastermorphix — as fotos de verdade', () => {
  // as 4 faces de cada lote de fotos (tests/cube images/mastermorphix), na ordem das regiões
  const K: Record<string, string> = { G: 'F', Y: 'D', R: 'L', B: 'R' };
  const lots: Record<string, string[]> = {
    escuro: ['GRBGYRYGRG', 'RRRBBYBRGR', 'YYGRGGBYYY', 'BGYBRGBBYB'],
    claro: ['YRYBRRGRBG', 'RBGYGBGBGG', 'BBGBBYGYYG', 'RYRRYYRYRB'],
  };
  for (const [name, faces] of Object.entries(lots))
    it(`${name}: as 4 fotos formam um Mastermorphix possível, que o site resolve`, async () => {
      const impl = (await import('../src/puzzles/mastermorphix')).default;
      const s = new Array(40).fill('?');
      impl.scan.forEach((f, slot) => f.grid.flat().forEach((idx, k) => (s[idx] = K[faces[slot][k]])));
      const fixed = impl.repairScan!(s);
      expect(impl.validate(fixed).ok).toBe(true);
      const sol = impl.solve(fixed, 'cfop');
      let st: string[] = fixed;
      for (const step of sol.steps) for (const g of step.segments) for (const m of g.moves) st = impl.applyMove(st, m);
      expect(st).toEqual(solvedPyramid(readPyramid(fixed).keys));
    });
});
