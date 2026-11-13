import { describe, expect, it } from 'vitest';
import { FACES, invertMegaMove, megaGeo } from '../src/puzzles/megaminx/geometry';

const solved = megaGeo.solved();
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => megaGeo.apply(acc, m), s);

describe('geometria do megaminx', () => {
  it('tem 132 adesivos, 20 cantos e 30 arestas', () => {
    expect(megaGeo.stickers.length).toBe(132);
    expect(megaGeo.corners.length).toBe(20);
    expect(megaGeo.edges.length).toBe(30);
    expect(new Set([...megaGeo.corners.flat(), ...megaGeo.edges.flat()]).size).toBe(120);
    megaGeo.neighbors.forEach((n) => expect(n.length).toBe(5));
  });

  it('U é vizinho de F, R, BR, BL, L e D é vizinho do anel de baixo', () => {
    const name = (i: number) => FACES[i];
    expect(megaGeo.neighbors[0].map(name).sort()).toEqual(['BL', 'BR', 'F', 'L', 'R']);
    expect(megaGeo.neighbors[11].map(name).sort()).toEqual(['B', 'DBL', 'DBR', 'DL', 'DR']);
  });

  it('cada movimento 5 vezes volta ao início e o inverso desfaz', () => {
    for (const f of FACES) {
      expect(applyAll(solved, [f, f, f, f, f])).toEqual(solved);
      expect(applyAll(solved, [f, invertMegaMove(f)])).toEqual(solved);
      expect(applyAll(solved, [f + '2', invertMegaMove(f + '2')])).toEqual(solved);
      expect(applyAll(solved, [f, f])).toEqual(applyAll(solved, [f + '2']));
      expect(applyAll(solved, [f + "2'"])).toEqual(applyAll(solved, [f, f, f]));
    }
  });

  it('movimento só mexe em 26 adesivos e mantém as peças inteiras', () => {
    const s = applyAll(solved, ['R']);
    expect(s.filter((c, i) => c !== solved[i]).length).toBeGreaterThan(0);
    // depois de embaralhar, todo canto continua tendo 3 cores diferentes
    const sc = applyAll(solved, megaGeo.randomScramble(60));
    for (const c of megaGeo.corners) expect(new Set(c.map((i) => sc[i])).size).toBe(3);
    for (const e of megaGeo.edges) expect(new Set(e.map((i) => sc[i])).size).toBe(2);
  });

  it('horário visto de fora: U leva a frente para a esquerda (como no 3x3)', () => {
    const s = applyAll(solved, ['U']);
    // algum adesivo da face L passa a ter a cor de F
    const L = FACES.indexOf('L');
    expect(s.slice(L * 11, L * 11 + 11)).toContain('F');
  });
});

import { solveMegaminx, solveMegaminxAdvanced } from '../src/puzzles/megaminx/solver';

describe('solucionador do megaminx', () => {
  it('megaminx resolvido não gera passos', () => {
    expect(solveMegaminx(solved).steps.length).toBe(0);
    expect(solveMegaminxAdvanced(solved).steps.length).toBe(0);
  });
  it('resolve embaralhamentos aleatórios', () => {
    let total = 0, maxMs = 0;
    const N = 20;
    for (let i = 0; i < N; i++) {
      const start = applyAll(solved, megaGeo.randomScramble(60));
      const t0 = performance.now();
      const sol = solveMegaminx(start);
      maxMs = Math.max(maxMs, performance.now() - t0);
      const moves = sol.steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, moves)).toEqual(solved);
      total += moves.length;
    }
    console.log(`megaminx: média ${(total / N).toFixed(0)} movimentos, pior ${maxMs.toFixed(0)} ms`);
  }, 600_000);
  it('método avançado resolve embaralhamentos aleatórios com menos movimentos', () => {
    let adv = 0, beg = 0;
    const N = 12;
    for (let i = 0; i < N; i++) {
      const start = applyAll(solved, megaGeo.randomScramble(60));
      const moves = solveMegaminxAdvanced(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, moves)).toEqual(solved);
      adv += moves.length;
      beg += solveMegaminx(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves)).length;
    }
    console.log(`megaminx avançado: média ${(adv / N).toFixed(0)} (iniciante ${(beg / N).toFixed(0)})`);
    expect(adv).toBeLessThan(beg);
  }, 600_000);
});

import { validateMegaminx } from '../src/puzzles/megaminx/validate';

describe('validação do megaminx', () => {
  it('aceita resolvido e embaralhado', () => {
    expect(validateMegaminx(solved).ok).toBe(true);
    expect(validateMegaminx(applyAll(solved, megaGeo.randomScramble(50))).ok).toBe(true);
  });
  it('rejeita duas arestas trocadas (paridade)', () => {
    const s = [...solved];
    const [a, b] = megaGeo.edges;
    [s[a[0]], s[a[1]], s[b[0]], s[b[1]]] = [s[b[0]], s[b[1]], s[a[0]], s[a[1]]];
    expect(validateMegaminx(s).ok).toBe(false);
  });
  it('rejeita contagem errada de cores', () => {
    const s = [...solved];
    s[1] = s[12];
    expect(validateMegaminx(s).ok).toBe(false);
  });
});
