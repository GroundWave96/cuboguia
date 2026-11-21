/**
 * Página de algoritmos: 2x2 (Ortega: face amarela e PBL) e Pyraminx (última camada).
 * Cada algoritmo resolve exatamente o caso com o nome dele.
 */
import { describe, expect, it } from 'vitest';
import { invertAlg, splitAlg } from '../src/puzzles/algkit';
import { CUBE2_CASES, CUBE2_GROUPS, cube2 } from '../src/puzzles/cube2/algs';
import { PYRA_CASES, PYRA_GROUPS, pyra, pyraCaseState } from '../src/puzzles/pyraminx/algs';
import { invertPyraMove } from '../src/puzzles/pyraminx/geometry';

// ------------------------------------------------------------------ 2x2
describe('2x2: face amarela e PBL', () => {
  const { geo, solved, applyAll, caseState, upright, pieceMoves } = cube2;
  const TOP = geo.stickers.filter((s) => s.cubie2[1] === 1).map((s) => s.index);
  const BOTTOM = geo.stickers.filter((s) => s.cubie2[1] === -1).map((s) => s.index);
  const U_FACE = geo.stickers.filter((s) => s.face === 'U').map((s) => s.index);
  const D_FACE = geo.stickers.filter((s) => s.face === 'D').map((s) => s.index);
  const ADJ = [[], ['U'], ['U2'], ["U'"]];
  const byId = (id: string) => CUBE2_CASES.find((c) => c.id === id)!;

  function solvesWith(state: string[], alg: string, onlyOrient: boolean) {
    const done = (s: string[]) => (onlyOrient ? BOTTOM.every((i) => s[i] === solved[i]) && U_FACE.every((i) => s[i] === 'U') : s.every((c, i) => c === solved[i]));
    for (const a of ADJ) for (const b of ADJ) for (const d of [[], ['D'], ['D2'], ["D'"]]) if (done(upright(applyAll(state, [...a, ...splitAlg(alg), ...b, ...d])))) return true;
    return false;
  }

  it('casos e grupos', () => {
    for (const c of CUBE2_CASES) expect(CUBE2_GROUPS.some((g) => g.id === c.group), c.id).toBe(true);
    expect(CUBE2_CASES.filter((c) => c.set === 'c2oll')).toHaveLength(7);
    expect(CUBE2_CASES.filter((c) => c.set === 'pbl')).toHaveLength(6);
  });

  for (const c of CUBE2_CASES)
    it(`${c.id}: ${c.alg}`, () => {
      const s = caseState(c.alg);
      expect(s.every((x, i) => x === solved[i]), 'não é o cubo resolvido').toBe(false);
      if (c.set === 'c2oll') {
        expect(BOTTOM.every((i) => s[i] === solved[i]), 'a camada de baixo continua pronta').toBe(true);
        expect(U_FACE.filter((i) => s[i] === 'U').length).toBeLessThan(4);
      } else {
        expect(U_FACE.every((i) => s[i] === 'U') && D_FACE.every((i) => s[i] === 'D'), 'topo amarelo e base branca').toBe(true);
      }
      if (c.alt) expect(solvesWith(s, c.alt, c.set === 'c2oll'), `alternativo: ${c.alt}`).toBe(true);
    });

  it('os casos são todos diferentes', () => {
    for (const a of CUBE2_CASES)
      for (const b of CUBE2_CASES)
        if (a.id < b.id && a.set === b.set) expect(solvesWith(caseState(a.alg), b.alg, a.set === 'c2oll'), `${a.id} = ${b.id}?`).toBe(false);
  });

  it('face amarela: o formato combina com o nome', () => {
    // cantos de cima vistos de cima: [U, lateral 1, lateral 2] de cada canto
    const corners = [...new Set(TOP.map((i) => geo.stickers[i].cubie2.join(',')))].map((k) => TOP.filter((i) => geo.stickers[i].cubie2.join(',') === k));
    const info = (id: string) => {
      const s = caseState(byId(id).alg);
      const up = corners.filter((cs) => cs.some((i) => geo.stickers[i].face === 'U' && s[i] === 'U'));
      // para cada face lateral, quantos adesivos amarelos
      const side: Record<string, number> = {};
      for (const i of TOP) if (geo.stickers[i].face !== 'U' && s[i] === 'U') side[geo.stickers[i].face] = (side[geo.stickers[i].face] ?? 0) + 1;
      return { up: up.map((cs) => geo.stickers[cs[0]].cubie2), side: Object.values(side).sort() };
    };
    expect(info('c2-sune').up).toHaveLength(1);
    expect(info('c2-antisune').up).toHaveLength(1);
    expect(info('c2-h')).toMatchObject({ up: [], side: [2, 2] });
    expect(info('c2-pi')).toMatchObject({ up: [], side: [1, 1, 2] });
    for (const id of ['c2-u', 'c2-t', 'c2-l']) expect(info(id).up, id).toHaveLength(2);
    const diagonal = (id: string) => {
      const [a, b] = info(id).up;
      return a[0] !== b[0] && a[2] !== b[2];
    };
    expect(diagonal('c2-l')).toBe(true);
    expect(diagonal('c2-u')).toBe(false);
    expect(diagonal('c2-t')).toBe(false);
    expect(info('c2-u').side, 'faróis: os dois adesivos amarelos na mesma lateral').toEqual([2]);
    expect(info('c2-t').side, 'T: um em cada lateral').toEqual([1, 1]);
  });

  it('PBL: o tipo de troca de cada camada combina com o nome', () => {
    /** tipo de troca de uma camada, com o melhor ajuste dessa camada: none, adj ou diag */
    const kind = (s: string[], y: number, turn: string) => {
      let best: [string, string][] | null = null;
      for (const a of ['', turn, turn + '2', turn + "'"]) {
        const m = pieceMoves(a ? applyAll(s, [a]) : s, y);
        if (!best || m.length < best.length) best = m;
      }
      if (!best!.length) return 'none';
      const [p, q] = best!.map(([k]) => k.split(',').map(Number));
      return p[0] !== q[0] && p[2] !== q[2] ? 'diag' : 'adj';
    };
    const expected: Record<string, [string, string]> = {
      'pbl-adj': ['adj', 'none'],
      'pbl-diag': ['diag', 'none'],
      'pbl-adj-adj': ['adj', 'adj'],
      'pbl-diag-diag': ['diag', 'diag'],
      'pbl-adj-diag': ['adj', 'diag'],
      'pbl-diag-adj': ['diag', 'adj'],
    };
    for (const [id, [top, bottom]] of Object.entries(expected)) {
      const s = caseState(byId(id).alg);
      expect([kind(s, 1, 'U'), kind(s, -1, 'D')], id).toEqual([top, bottom]);
    }
  });
});

// ------------------------------------------------------------------ Pyraminx
describe('Pyraminx: última camada', () => {
  const { geo, solved, applyAll, topEdgeStickers } = pyra;
  const AUF = [[], ['U'], ["U'"]];
  const solvesWith = (st: string[], alg: string) =>
    AUF.some((a) => AUF.some((b) => applyAll(st, [...a, ...splitAlg(alg), ...b]).every((c, i) => c === solved[i])));

  it('casos e grupos', () => {
    for (const c of PYRA_CASES) expect(PYRA_GROUPS.some((g) => g.id === c.group), c.id).toBe(true);
    expect(PYRA_CASES).toHaveLength(5);
  });

  for (const c of PYRA_CASES)
    it(`${c.id}: ${c.alg}`, () => {
      const s = pyraCaseState(c.alg);
      expect(s.every((x, i) => x === solved[i] || topEdgeStickers.has(i)), 'só as arestas de cima mudam').toBe(true);
      expect(s.every((x, i) => x === solved[i]), 'não é o resolvido').toBe(false);
      // o 3D anima o algoritmo a partir do caso: tem que terminar resolvido, sem ajuste
      expect(applyAll(s, splitAlg(c.alg)).every((x, i) => x === solved[i]), 'termina resolvido').toBe(true);
      if (c.alt) expect(solvesWith(s, c.alt), `alternativo: ${c.alt}`).toBe(true);
    });

  it('os casos são todos diferentes', () => {
    for (const a of PYRA_CASES) for (const b of PYRA_CASES) if (a.id < b.id) expect(solvesWith(pyraCaseState(a.alg), b.alg), `${a.id} = ${b.id}?`).toBe(false);
  });

  it('o nome diz certo se há ciclo, quantas viradas e o sentido (olhando de cima, verde na frente)', () => {
    const tops = geo.edges.filter((e) => geo.stickers[e[0]].verts.includes(0));
    const mid = (e: number[]) => {
      const [a, b] = geo.stickers[e[0]].verts;
      return geo.vertices[a].map((v, k) => (v + geo.vertices[b][k]) / 2);
    };
    const up = geo.vertices[0];
    const front = geo.normals[0]; // face F (verde)
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a: number[], b: number[]) => a.reduce((t, v, k) => t + v * b[k], 0);
    const right = cross(up, front);
    // na tela vista de cima: x para a direita, y para baixo (a frente fica embaixo)
    const screen = (p: number[]) => [dot(p, right), dot(p, front)];
    for (const c of PYRA_CASES) {
      const s = pyraCaseState(c.alg);
      const key = (e: number[], st: string[]) => e.map((i) => st[i]);
      // para onde a peça em cada posição precisa ir
      const goes = tops.map((e) => {
        const now = key(e, s);
        const home = tops.findIndex((f) => [...key(f, solved)].sort().join() === [...now].sort().join());
        return { to: home, flipped: key(tops[home], solved).join() !== now.join() };
      });
      const flips = goes.filter((g) => g.flipped).length;
      const cycle = goes.some((g, i) => g.to !== i);
      let dir = '';
      if (cycle) {
        const a = screen(mid(tops[0])), b = screen(mid(tops[goes[0].to])), d = screen(mid(tops[goes[goes[0].to].to]));
        const area = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
        dir = area > 0 ? 'horário' : 'anti-horário';
      }
      const name = (c.name as [string, string, string])[0];
      expect(name.includes('Ciclo'), `${c.id}: ciclo`).toBe(cycle);
      expect(name.includes('virad') ? 2 : 0, `${c.id}: viradas`).toBe(flips);
      if (cycle) expect(name, `${c.id}: sentido ${dir}`).toContain(`(${dir})`);
    }
  });

  it('o caso sai do algoritmo ao contrário', () => {
    for (const c of PYRA_CASES) {
      const raw = applyAll(solved, invertAlg(splitAlg(c.alg), invertPyraMove));
      expect(pyraCaseState(c.alg)).toEqual(raw);
    }
  });
});
