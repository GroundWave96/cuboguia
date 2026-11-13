import { describe, expect, it } from 'vitest';
import { pyraGeo as geo, invertPyraMove } from '../src/puzzles/pyraminx/geometry';

const solved = geo.solved();
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);

describe('geometria do pyraminx', () => {
  it('36 adesivos: 4 pontas, 4 centros, 6 arestas', () => {
    expect(geo.stickers.length).toBe(36);
    expect(geo.tips.every((t) => t.length === 3)).toBe(true);
    expect(geo.centers.every((t) => t.length === 3)).toBe(true);
    expect(geo.edges.length).toBe(6);
    expect(geo.edges.every((e) => e.length === 2)).toBe(true);
  });
  it('camada grande tem 12 adesivos e a ponta 3', () => {
    expect(geo.layer('U').length).toBe(12);
    expect(geo.layer('u').length).toBe(3);
  });
  it('cada giro 3 vezes volta ao início e o inverso desfaz', () => {
    for (const m of ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b']) {
      expect(applyAll(solved, [m, m, m])).toEqual(solved);
      expect(applyAll(solved, [m, invertPyraMove(m)])).toEqual(solved);
    }
  });
  it('peças continuam inteiras depois de embaralhar', () => {
    const s = applyAll(solved, ['U', "L'", 'R', 'B', "U'", 'L', 'b', "r'"]);
    for (const c of [...geo.tips, ...geo.centers]) expect(new Set(c.map((i) => s[i])).size).toBe(3);
    for (const e of geo.edges) expect(new Set(e.map((i) => s[i])).size).toBe(2);
  });
});

import { solvePyraBeginner, solvePyraOptimal } from '../src/puzzles/pyraminx/solver';

/** embaralha com os 4 eixos e reorienta o puzzle inteiro para o centro de referência (B) ficar no lugar */
function realScramble(): string[] {
  const moves = ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'];
  let s = solved;
  for (let i = 0; i < 25; i++) s = geo.apply(s, moves[Math.floor(Math.random() * 8)] + (Math.random() < 0.5 ? '' : "'"));
  // gera as 12 rotações do tetraedro
  const rots: Int32Array[] = [Int32Array.from({ length: 36 }, (_, i) => i)];
  const gens = [0, 1, 2, 3].map((v) => geo.wholeRotation(v));
  for (let k = 0; k < rots.length; k++)
    for (const g of gens) {
      const c = new Int32Array(36);
      for (let i = 0; i < 36; i++) c[i] = rots[k][g[i]];
      if (!rots.some((r) => r.every((x, i) => x === c[i]))) rots.push(c);
    }
  expect(rots.length).toBe(12);
  // a única rotação que deixa cada centro no seu vértice (como a pessoa segura o puzzle)
  for (const r of rots) {
    const t = Array.from({ length: 36 }, (_, i) => s[r[i]]);
    if (geo.centers.every((c) => c.map((i) => t[i]).sort().join() === c.map((i) => solved[i]).sort().join())) return t;
  }
  throw new Error('não reorientou');
}

describe('solucionadores do pyraminx', () => {
  it('resolvido não gera passos', () => {
    expect(solvePyraBeginner(solved).steps.length).toBe(0);
    expect(solvePyraOptimal(solved).steps.length).toBe(0);
  });
  it('resolvem 200 estados aleatórios reais (com giros de B e reorientação)', () => {
    let nb = 0, no = 0, maxO = 0;
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const start = realScramble();
      const mb = solvePyraBeginner(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, mb)).toEqual(solved);
      const mo = solvePyraOptimal(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, mo)).toEqual(solved);
      nb += mb.length;
      no += mo.length;
      maxO = Math.max(maxO, mo.filter((m) => m[0] === m[0].toUpperCase()).length);
    }
    console.log(`pyraminx: iniciante ${(nb / 200).toFixed(1)}, ótimo ${(no / 200).toFixed(1)} (máx ${maxO} sem pontas), ${((performance.now() - t0) / 200).toFixed(1)} ms/estado`);
  }, 300_000);
});

import { validatePyraminx } from '../src/puzzles/pyraminx/validate';
import { pyraPieces } from '../src/puzzles/pyraminx/layout';
import { LAYER_CUT, TIP_CUT } from '../src/puzzles/pyraminx/geometry';

describe('validação e visual do pyraminx', () => {
  it('aceita resolvido e embaralhado; rejeita aresta virada e cores trocadas', () => {
    expect(validatePyraminx(solved).ok).toBe(true);
    expect(validatePyraminx(realScramble()).ok).toBe(true);
    const flip = [...solved];
    const [a, b] = geo.edges[0];
    [flip[a], flip[b]] = [flip[b], flip[a]];
    expect(validatePyraminx(flip).ok).toBe(false);
    const wrong = [...solved];
    wrong[0] = wrong[9];
    expect(validatePyraminx(wrong).ok).toBe(false);
  });
  it('núcleo abaixo de todos os cortes e peças de cada camada acima do corte', () => {
    const { core, pieces } = pyraPieces();
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (let v = 0; v < 4; v++) {
      const ax = geo.axis(v);
      for (const p of core.flat()) expect(dot(p, ax)).toBeLessThan(LAYER_CUT);
      for (const [mv, cut] of [['ULRB'[v], LAYER_CUT], ['ulrb'[v], TIP_CUT]] as const) {
        const layer = new Set(geo.layer(mv));
        for (const pc of pieces) if (pc.stickers.some((i) => layer.has(i))) for (const p of pc.faces.flat()) expect(dot(p, ax)).toBeGreaterThan(cut);
      }
    }
  });
});
