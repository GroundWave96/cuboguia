/**
 * Página de algoritmos: cada algoritmo resolve exatamente o caso com o nome dele.
 *
 *  - mexe só na última camada (as duas de baixo e os centros continuam resolvidos)
 *  - OLL não mexe na cor de cima já certa do jeito errado; PLL deixa o topo todo amarelo
 *  - todos os casos são diferentes entre si (mesmo girando a camada de cima antes e depois)
 *  - o formato do caso combina com o nome (ponto/L/linha, quantos cantos, tipo de troca)
 *  - o algoritmo alternativo resolve o mesmo caso
 */
import { describe, expect, it } from 'vitest';
import { ALG_CASES, ALG_GROUPS, caseState, cube3, splitAlg, uprightState } from '../src/puzzles/cube3/algs';

const { geo, applyAll } = cube3;
const solved = geo.solved();
const U_LAYER = geo.stickers.filter((s) => s.cubie2[1] === 2).map((s) => s.index);
const BELOW = geo.stickers.filter((s) => s.cubie2[1] !== 2).map((s) => s.index);
const U_FACE = geo.stickers.filter((s) => s.face === 'U').map((s) => s.index);
const AUF = [[], ['U'], ['U2'], ["U'"]];

/** o algoritmo (com ajustes da camada de cima antes e depois) leva o estado a resolvido */
function solvesWithAuf(state: string[], alg: string) {
  for (const a of AUF) for (const b of AUF) if (uprightState(applyAll(state, [...a, ...splitAlg(alg), ...b])).every((c, i) => c === solved[i])) return true;
  return false;
}

/** as peças da camada de cima: posição → posição de origem (pelas cores) */
function lastLayerPerm(state: string[]) {
  const pieces = new Map<string, number[]>();
  for (const i of U_LAYER) {
    const k = geo.stickers[i].cubie2.join(',');
    pieces.set(k, [...(pieces.get(k) ?? []), i]);
  }
  const colorsAt = (s: string[], idx: number[]) => idx.map((i) => s[i]).sort().join('');
  const homes = [...pieces.entries()].filter(([k]) => k !== '0,2,0');
  const where = new Map(homes.map(([k, idx]) => [colorsAt(solved, idx), k]));
  const out: Record<string, string> = {};
  for (const [k, idx] of homes) out[k] = where.get(colorsAt(state, idx))!;
  return out;
}
const isCorner = (k: string) => k.split(',').filter((v) => v !== '0').length === 3;
/** quantas peças fora do lugar, entre cantos e arestas, com a camada de cima no melhor ajuste */
function moved(state: string[]) {
  let best: { corners: string[]; edges: string[] } | null = null;
  for (const a of AUF) {
    const p = lastLayerPerm(applyAll(state, a));
    const corners = Object.keys(p).filter((k) => isCorner(k) && p[k] !== k);
    const edges = Object.keys(p).filter((k) => !isCorner(k) && p[k] !== k);
    if (!best || corners.length + edges.length < best.corners.length + best.edges.length) best = { corners, edges };
  }
  return best!;
}
const opposite = (a: string, b: string) => a.split(',').every((v, i) => Number(v) === -Number(b.split(',')[i]) || (v === '2' && i === 1));

describe('algoritmos da última camada', () => {
  it('todo caso pertence a um grupo que existe', () => {
    for (const c of ALG_CASES) expect(ALG_GROUPS.some((g) => g.id === c.group && g.set === c.set), c.id).toBe(true);
    expect(ALG_CASES.filter((c) => c.set === 'oll')).toHaveLength(10);
    expect(ALG_CASES.filter((c) => c.set === 'pll')).toHaveLength(21);
  });

  for (const c of ALG_CASES)
    it(`${c.id}: ${c.alg}`, () => {
      const s = caseState(c.alg);
      expect(BELOW.every((i) => s[i] === solved[i]), 'só a última camada muda').toBe(true);
      expect(s.every((x, i) => x === solved[i]), 'o caso não é o cubo resolvido').toBe(false);
      const yellowUp = U_FACE.filter((i) => s[i] === 'U').length;
      if (c.set === 'pll') expect(yellowUp, 'PLL: topo todo amarelo').toBe(9);
      else expect(yellowUp).toBeLessThan(9);
      if (c.alt) expect(solvesWithAuf(s, c.alt), `alternativo: ${c.alt}`).toBe(true);
    });

  it('os casos são todos diferentes', () => {
    for (const a of ALG_CASES)
      for (const b of ALG_CASES)
        if (a.id < b.id && a.set === b.set) expect(solvesWithAuf(caseState(a.alg), b.alg), `${a.id} = ${b.id}?`).toBe(false);
  });

  it('OLL: o formato combina com o nome', () => {
    const edgesUp = (id: string) => [1, 3, 5, 7].filter((i) => caseState(ALG_CASES.find((c) => c.id === id)!.alg)[i] === 'U');
    expect(edgesUp('oll-dot')).toEqual([]);
    expect(edgesUp('oll-line')).toHaveLength(2);
    expect([[1, 7], [3, 5]]).toContainEqual(edgesUp('oll-line'));
    expect(edgesUp('oll-l')).toHaveLength(2);
    expect([[1, 7], [3, 5]]).not.toContainEqual(edgesUp('oll-l'));
    const cornersUp = (id: string) => {
      const s = caseState(ALG_CASES.find((c) => c.id === id)!.alg);
      expect([1, 3, 5, 7].every((i) => s[i] === 'U'), `${id}: cruz pronta`).toBe(true);
      return [0, 2, 6, 8].filter((i) => s[i] === 'U').length;
    };
    for (const id of ['oll-sune', 'oll-antisune']) expect(cornersUp(id), id).toBe(1);
    for (const id of ['oll-h', 'oll-pi']) expect(cornersUp(id), id).toBe(0);
    for (const id of ['oll-u', 'oll-t', 'oll-bowtie']) expect(cornersUp(id), id).toBe(2);
  });

  it('PLL: o tipo de troca combina com o grupo', () => {
    for (const c of ALG_CASES.filter((x) => x.set === 'pll')) {
      const m = moved(caseState(c.alg));
      const where = `${c.id}: cantos ${m.corners.length}, arestas ${m.edges.length}`;
      if (c.group === 'pll-edges') expect(m.corners.length, where).toBe(0);
      if (c.group === 'pll-corners') expect(m.edges.length, where).toBe(0);
      if (c.group === 'pll-adjacent' || c.group === 'pll-diagonal') {
        expect(m.corners.length, where).toBe(2);
        expect(m.edges.length, where).toBe(2);
        expect(opposite(m.corners[0], m.corners[1]), `${where}: cantos na diagonal?`).toBe(c.group === 'pll-diagonal');
      }
      // G: três cantos e três arestas giram (com outro ajuste do topo pode parecer 2 + 4)
      if (c.group === 'pll-g') expect(m.corners.length + m.edges.length, where).toBe(6);
    }
    // H troca arestas opostas; Z, vizinhas
    const edgesOf = (id: string) => moved(caseState(ALG_CASES.find((c) => c.id === id)!.alg)).edges;
    expect(edgesOf('pll-h')).toHaveLength(4);
    expect(edgesOf('pll-z')).toHaveLength(4);
    for (const id of ['pll-ua', 'pll-ub']) expect(edgesOf(id), id).toHaveLength(3);
    // T e F trocam arestas opostas; J e R, vizinhas; N troca opostas; V e Y, vizinhas
    for (const id of ['pll-t', 'pll-f', 'pll-na', 'pll-nb']) expect(opposite(...(edgesOf(id) as [string, string])), id).toBe(true);
    for (const id of ['pll-ja', 'pll-jb', 'pll-ra', 'pll-rb', 'pll-v', 'pll-y']) expect(opposite(...(edgesOf(id) as [string, string])), id).toBe(false);
  });

  it('a e b de cada par são o espelho um do outro (não o mesmo caso)', () => {
    const mirror = (alg: string) =>
      splitAlg(alg)
        .map((m) => {
          const f = m.replace(/[^A-Za-z]/g, '');
          const swap: Record<string, string> = { R: 'L', L: 'R', r: 'l', l: 'r' };
          const g = swap[f] ?? f;
          const suf = m.slice(f.length);
          // espelho esquerda↔direita inverte o sentido de tudo (menos M, que troca de lado e de sentido junto, e x)
          const keep = f === 'M' || f === 'x';
          return g + (keep ? suf : suf === "'" ? '' : suf === '2' ? '2' : "'");
        })
        .join(' ');
    for (const [a, b] of [['pll-ja', 'pll-jb'], ['pll-ra', 'pll-rb'], ['pll-na', 'pll-nb'], ['pll-aa', 'pll-ab'], ['pll-ua', 'pll-ub']]) {
      const A = ALG_CASES.find((c) => c.id === a)!;
      const B = ALG_CASES.find((c) => c.id === b)!;
      expect(solvesWithAuf(caseState(B.alg), mirror(A.alg)), `espelho de ${a} resolve ${b}`).toBe(true);
    }
  });
});
