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
