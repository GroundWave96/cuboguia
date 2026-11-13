import { describe, expect, it } from 'vitest';
import cube5 from '../src/puzzles/cube5';
import { WINGS, geo5, partner } from '../src/puzzles/cube5/pieces';
import { PARITY_ALG } from '../src/puzzles/cube5/solver';

const apply = (s: string[], moves: string[]) => moves.reduce((x, m) => cube5.applyMove(x, m), s);
const solved = cube5.solvedState();
const same = (a: string[], b: string[]) => a.join('') === b.join('');

describe('5x5 — notação', () => {
  it('2R é só a segunda camada: Rw = R + 2R', () => {
    expect(same(apply(apply(solved, ['Rw']), ["R'", "2R'"]), solved)).toBe(true);
  });
  it('M é a fatia do meio no sentido do L: 3Lw = Lw + M', () => {
    expect(same(apply(apply(solved, ['3Lw']), ["Lw'", "M'"]), solved)).toBe(true);
  });
  it('inverso de fatias', () => {
    for (const m of ['2R', "2U'", '2F2', 'M', "E'", 'S2']) expect(same(apply(solved, [m, cube5.invertMove(m)]), solved)).toBe(true);
  });
});

describe('5x5 — peças', () => {
  it('24 pontas de aresta', () => expect(WINGS.length).toBe(24));
  it('paridade troca só as duas pontas de uma aresta', () => {
    const s = apply(solved, PARITY_ALG.split(' '));
    const diff = s.map((c, i) => (c !== solved[i] ? i : -1)).filter((i) => i >= 0);
    expect(diff.length).toBe(4);
  });
});

describe('5x5 — validação', () => {
  it('resolvido e embaralhado são válidos', () => {
    expect(cube5.validate(solved).ok).toBe(true);
    expect(cube5.validate(apply(solved, cube5.scramble(60))).ok).toBe(true);
  });
  it('ponta virada é inválida', () => {
    const s = [...solved];
    const [a, b] = WINGS[0];
    [s[a], s[b]] = [s[b], s[a]];
    const r = cube5.validate(s);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/ponta/);
  });
  it('pontas trocadas (paridade) continuam válidas', () => {
    expect(cube5.validate(apply(solved, PARITY_ALG.split(' '))).ok).toBe(true);
  });
  it('centros com cores trocadas entre tipos são inválidos', () => {
    const s = [...solved];
    // troca um centro em X do topo com um centro em cruz da frente
    [s[6], s[2 * 25 + 7]] = [s[2 * 25 + 7], s[6]];
    expect(cube5.validate(s).ok).toBe(false);
  });
  it('falta pintar', () => {
    const s = [...solved];
    s[3] = '?';
    expect(cube5.validate(s).errors[0]).toMatch(/faltam 1/);
  });
});

describe('5x5 — solução', () => {
  for (const method of ['beginner', 'cfop']) {
    it(`resolve embaralhados (${method})`, () => {
      for (let k = 0; k < 8; k++) {
        const start = apply(solved, cube5.scramble(60));
        const sol = cube5.solve(start, method);
        const end = apply(start, sol.steps.flatMap((st) => st.segments.flatMap((sg) => sg.moves)));
        expect(same(end, solved)).toBe(true);
        expect(sol.steps.every((st) => st.focus.every((i) => i >= 0 && i < 150))).toBe(true);
      }
    }, 120000);
  }
  it('com paridade nas arestas', () => {
    const start = apply(solved, PARITY_ALG.split(' '));
    const sol = cube5.solve(start, 'beginner');
    const end = apply(start, sol.steps.flatMap((st) => st.segments.flatMap((sg) => sg.moves)));
    expect(same(end, solved)).toBe(true);
    expect(sol.steps.some((st) => st.title.includes('Paridade'))).toBe(true);
  });
  it('já resolvido não tem passos', () => {
    expect(cube5.solve(solved, 'beginner').steps.length).toBe(0);
  });
});
void geo5; void partner;
