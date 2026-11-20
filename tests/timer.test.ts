import { describe, expect, it } from 'vitest';
import { averageOf, best, bestAverage, fmt, fmtSolve, inspectionPenalty, mean, type Penalty, type Solve } from '../src/core/timerstats';

const s = (ms: number, pen: Penalty = 0): Solve => ({ ms, pen, scramble: '', at: 0 });

describe('cronômetro — estatísticas (padrão WCA)', () => {
  it('formata como nas competições', () => {
    expect(fmt(9810)).toBe('9.81');
    expect(fmt(62350)).toBe('1:02.35');
    expect(fmt(5)).toBe('0.00');
    expect(fmt(599999)).toBe('9:59.99');
    expect(fmt(Infinity)).toBe('DNF');
    expect(fmt(null)).toBe('—');
    expect(fmtSolve(s(12340, 2))).toBe('14.34+');
    expect(fmtSolve(s(12340, 'dnf'))).toBe('DNF(12.34)');
  });

  it('média de 5 tira o melhor e o pior', () => {
    expect(averageOf([s(10000), s(12000), s(11000), s(30000), s(9000)], 5)).toBe(11000);
    expect(averageOf([s(10000), s(12000), s(11000), s(9000)], 5)).toBeNull();
  });

  it('+2 entra no tempo; um DNF é o pior; dois DNF = média DNF', () => {
    expect(averageOf([s(10000), s(10000, 2), s(11000), s(9000), s(13000)], 5)).toBe(11000);
    expect(averageOf([s(10000), s(12000), s(11000), s(9000, 'dnf'), s(9500)], 5)).toBe(11000);
    expect(averageOf([s(10000), s(12000, 'dnf'), s(11000), s(9000, 'dnf'), s(9500)], 5)).toBe(Infinity);
  });

  it('média de 12 usa só os últimos 12', () => {
    const list = [s(60000), ...Array.from({ length: 12 }, (_, i) => s(10000 + i * 100))];
    // últimos 12: 10.0 … 11.1 → tira 10.0 e 11.1 → média de 10.1 … 11.0 = 10.55
    expect(averageOf(list, 12)).toBe(10550);
  });

  it('melhor, média geral e melhor média', () => {
    const list = [s(15000), s(12000, 'dnf'), s(11000), s(14000, 2), s(13000), s(10000), s(20000)];
    expect(best(list)).toBe(10000);
    expect(mean(list)).toBeCloseTo((15000 + 11000 + 16000 + 13000 + 10000 + 20000) / 6);
    // ao5 da 1ª à 5ª: DNF é o pior, tira 11.0 → (13 + 15 + 16)/3; da 2ª à 6ª: (11 + 13 + 16)/3; da 3ª à 7ª: (13 + 16 + 11)/3... a menor
    expect(bestAverage(list, 5)).toBeCloseTo((11000 + 13000 + 16000) / 3);
  });

  it('inspeção: até 15 s nada, até 17 s +2, depois DNF', () => {
    expect(inspectionPenalty(14000)).toBe(0);
    expect(inspectionPenalty(15000)).toBe(0);
    expect(inspectionPenalty(16500)).toBe(2);
    expect(inspectionPenalty(17500)).toBe('dnf');
  });
});

describe('cronômetro — desafio pelo link', async () => {
  const { challengeQuery, readChallenge } = await import('../src/core/challenge');
  const P = ['cube3', 'megaminx', 'pyraminx'];
  it('ida e volta: embaralho, tempo e nome', () => {
    const c = { puzzle: 'cube3', scramble: ["R", "U'", "F2", "2R", "Rw'"], ms: 12340, name: 'Gabi' };
    expect(readChallenge(new URLSearchParams(challengeQuery(c)), P)).toEqual(c);
    const dnf = { ...c, ms: null, name: '' };
    expect(readChallenge(new URLSearchParams(challengeQuery(dnf)), P)).toEqual(dnf);
    const mega = { puzzle: 'megaminx', scramble: ["DBR2'", 'BL', "u'"], ms: 90000, name: '' };
    expect(readChallenge(new URLSearchParams(challengeQuery(mega)), P)).toEqual(mega);
  });
  it('recusa links estranhos', () => {
    const q = (o: Record<string, string>) => readChallenge(new URLSearchParams(o), P);
    expect(q({ p: 'cube9', e: 'R', t: '1000' })).toBeNull(); // puzzle que não existe
    expect(q({ p: 'cube3', e: '<script>', t: '1000' })).toBeNull(); // movimento sem formato de movimento
    expect(q({ p: 'cube3', e: 'R', t: '-5' })).toBeNull();
    expect(q({ p: 'cube3', e: 'R', t: '1e9' })).toBeNull();
    expect(q({ p: 'cube3', e: Array(200).fill('R').join(' '), t: '1000' })).toBeNull(); // embaralho enorme
    expect(q({ p: 'cube3', t: '1000' })).toBeNull();
  });
  it('nome: sem tags nem caracteres de controle, no máximo 24 letras', () => {
    const c = readChallenge(new URLSearchParams({ p: 'cube3', e: 'R', t: '1000', n: '  <b>Ana</b>\u0007 ' + 'x'.repeat(40) }), P)!;
    expect(c.name).not.toMatch(/[<>\u0007]/);
    expect(c.name.length).toBeLessThanOrEqual(24);
  });
});
