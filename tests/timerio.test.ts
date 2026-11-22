/** Cronômetro: recordes, médias móveis, exportar e importar (CuboGuia e csTimer). */
import { describe, expect, it } from 'vitest';
import { newRecords, rollingAverage, type Solve } from '../src/core/timerstats';
import { ImportError, exportJson, mergeSolves, parseImport } from '../src/core/timerio';

const S = (ms: number, pen: Solve['pen'] = 0, at = ms): Solve => ({ ms, pen, scramble: 'R U', at });
const PUZZLES = ['cube2', 'cube3', 'cube4', 'cube5', 'cube6', 'cube7', 'pyraminx', 'skewb', 'megaminx', 'mastermorphix'];

describe('recordes', () => {
  it('o primeiro tempo não comemora; um tempo melhor comemora', () => {
    expect(newRecords([S(10000)])).toEqual([]);
    expect(newRecords([S(10000), S(12000)])).toEqual([]);
    expect(newRecords([S(10000), S(9000)])).toEqual(['single']);
    // igual ao melhor não é recorde
    expect(newRecords([S(10000), S(10000)])).toEqual([]);
  });

  it('DNF e +2 contam como nas competições', () => {
    expect(newRecords([S(10000), S(5000, 'dnf')])).toEqual([]);
    expect(newRecords([S(10000), S(8500, 2)])).toEqual([]); // 10.50 com o +2
    expect(newRecords([S(10000), S(7000, 2)])).toEqual(['single']);
    // antes só havia DNF: não havia recorde para bater
    expect(newRecords([S(10000, 'dnf'), S(12000)])).toEqual([]);
  });

  it('média de 5: só depois de já existir uma', () => {
    const five = [12, 11, 13, 12, 14].map((s) => S(s * 1000));
    expect(newRecords(five)).toEqual([]); // primeira média de 5
    expect(newRecords([...five, S(9000)])).toEqual(['single', 'ao5']);
    // média de 5 antes: 12.33; com 11.50 vira 12.17 (sem recorde de tempo: o melhor é 11.00)
    expect(newRecords([...five, S(11500)])).toEqual(['ao5']);
    expect(newRecords([...five, S(12500)])).toEqual([]);
  });

  it('média móvel por resolução', () => {
    const list = [10, 11, 12, 13, 14, 15].map((s) => S(s * 1000));
    const r = rollingAverage(list, 5);
    expect(r.slice(0, 4)).toEqual([null, null, null, null]);
    expect(r[4]).toBeCloseTo(12000);
    expect(r[5]).toBeCloseTo(13000);
  });
});

describe('exportar e importar', () => {
  it('o arquivo do CuboGuia volta igual', () => {
    const data = { cube3: [S(9000, 0, 1), S(12000, 2, 2)], cube2: [S(4000, 'dnf', 3)], megaminx: [] };
    const res = parseImport(exportJson(data), PUZZLES);
    expect(res.source).toBe('cuboguia');
    expect(res.byPuzzle).toEqual({ cube3: data.cube3, cube2: data.cube2 });
    expect(res.skipped).toBe(0);
  });

  it('ignora tempos estragados e puzzles desconhecidos', () => {
    const text = JSON.stringify({
      app: 'cuboguia',
      version: 1,
      solves: { cube3: [S(9000, 0, 5), { ms: -1, pen: 0, scramble: '', at: 1 }, { ms: 5000, pen: 3, scramble: '', at: 1 }, 'x'], cube9: [S(1000)] },
    });
    const res = parseImport(text, PUZZLES);
    expect(res.byPuzzle.cube3).toHaveLength(1);
    expect(res.skipped).toBe(4);
  });

  it('lê o arquivo do csTimer (sessões, penalidades e tipo de puzzle)', () => {
    const text = JSON.stringify({
      session1: [
        [[0, 11234], "R U R' U'", '', 1700000000],
        [[2000, 9000], 'F R', '', 1700000100],
        [[-1, 15000], 'U2', '', 1700000200],
      ],
      session2: [[[0, 4321], 'R U', '', 1700000300]],
      session3: [[[0, 60000], 'Rw', '', 1700000400]],
      properties: { sessionData: JSON.stringify({ 1: { name: 1, opt: {} }, 2: { name: 2, opt: { scrType: '222so' } }, 3: { name: 3, opt: { scrType: 'clkwca' } } }) },
    });
    const res = parseImport(text, PUZZLES);
    expect(res.source).toBe('cstimer');
    expect(res.byPuzzle.cube3).toEqual([
      { ms: 11234, pen: 0, scramble: "R U R' U'", at: 1700000000000 },
      { ms: 9000, pen: 2, scramble: 'F R', at: 1700000100000 },
      { ms: 15000, pen: 'dnf', scramble: 'U2', at: 1700000200000 },
    ]);
    expect(res.byPuzzle.cube2).toHaveLength(1);
    expect(res.skipped).toBe(1); // o relógio (clock) não existe no site
  });

  it('arquivos que não são de tempos dão um erro claro', () => {
    const reason = (t: string) => {
      try {
        parseImport(t, PUZZLES);
        return 'ok';
      } catch (e) {
        return e instanceof ImportError ? e.reason : 'outro';
      }
    };
    expect(reason('não é json')).toBe('json');
    expect(reason('[1,2]')).toBe('format');
    expect(reason('{"foo":1}')).toBe('format');
    expect(reason('{"app":"cuboguia","solves":{}}')).toBe('empty');
  });

  it('juntar não repete a mesma resolução e mantém a ordem', () => {
    const a = [S(9000, 0, 10), S(8000, 0, 30)];
    const b = [S(9000, 0, 10), S(7000, 0, 20), S(7000, 0, 20)];
    const { merged, added } = mergeSolves(a, b);
    expect(added).toBe(1);
    expect(merged.map((s) => s.at)).toEqual([10, 20, 30]);
  });
});
