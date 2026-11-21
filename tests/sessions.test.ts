/** Sessões do cronômetro, exportar/importar com sessões e o total de métodos da tela inicial. */
import { beforeEach, describe, expect, it } from 'vitest';
import { MAIN, MAX_SESSIONS, addSession, cleanSessionName, loadSessions, saveSessions, solvesKey } from '../src/core/sessions';
import { exportJson, parseImport } from '../src/core/timerio';
import type { Solve } from '../src/core/timerstats';
import { PUZZLES } from '../src/core/registry';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
const S = (ms: number, at = ms): Solve => ({ ms, pen: 0, scramble: 'R U', at });

describe('sessões do cronômetro', () => {
  beforeEach(() => store.clear());

  it('a principal usa a chave de sempre (ninguém perde os tempos antigos)', () => {
    expect(solvesKey('cube3', MAIN)).toBe('cubo:timer:cube3');
    expect(solvesKey('cube3', 's1')).toBe('cubo:timer:cube3:s1');
    expect(loadSessions('cube3')).toEqual({ list: [{ id: MAIN, name: '' }], cur: MAIN });
  });

  it('cria, guarda por puzzle e lembra a aberta', () => {
    const d = loadSessions('cube3');
    const oh = addSession(d, '  Uma   mão ')!;
    expect(oh).toEqual({ id: 's1', name: 'Uma mão' });
    expect(addSession(d, 'uma MÃO'), 'mesmo nome devolve a mesma').toBe(oh);
    expect(addSession(d, 'Treino')!.id).toBe('s2');
    d.cur = 's2';
    saveSessions('cube3', d);
    expect(loadSessions('cube3').list.map((s) => s.name)).toEqual(['', 'Uma mão', 'Treino']);
    expect(loadSessions('cube3').cur).toBe('s2');
    expect(loadSessions('cube2').list).toHaveLength(1);
  });

  it('nomes limpos e limite de sessões', () => {
    expect(cleanSessionName('<b>OH</b>"')).toBe('bOH/b');
    expect(cleanSessionName('x'.repeat(50))).toHaveLength(24);
    const d = loadSessions('cube3');
    expect(addSession(d, '   ')).toBeNull();
    for (let i = 0; i < MAX_SESSIONS; i++) expect(addSession(d, `S${i}`)).not.toBeNull();
    expect(addSession(d, 'mais uma')).toBeNull();
  });

  it('dado estranho no armazenamento não quebra', () => {
    store.set('cubo:timer:sessions', '{"cube3":{"list":[{"id":"../x","name":"a"},{"id":"s3","name":5}],"cur":"s9"}}');
    expect(loadSessions('cube3')).toEqual({ list: [{ id: MAIN, name: '' }], cur: MAIN });
    store.set('cubo:timer:sessions', 'não é json');
    expect(loadSessions('cube3').cur).toBe(MAIN);
  });
});

describe('exportar e importar com sessões', () => {
  it('as sessões extras vão e voltam pelo nome', () => {
    const text = exportJson({ cube3: [S(9000)] }, 1, { cube3: { 'Uma mão': [S(20000), S(21000)], Vazia: [] } });
    const data = JSON.parse(text);
    expect(data.solves.cube3).toHaveLength(1);
    expect(Object.keys(data.sessions.cube3)).toEqual(['Uma mão']);
    const res = parseImport(text, ['cube3']);
    expect(res.byPuzzle.cube3).toHaveLength(1);
    expect(res.bySession.cube3['Uma mão']).toHaveLength(2);
  });
  it('sem sessões extras, o arquivo é igual ao antigo', () => {
    expect(JSON.parse(exportJson({ cube3: [S(9000)] }, 1))).not.toHaveProperty('sessions');
  });
  it('arquivo só com sessões extras também importa', () => {
    const res = parseImport(exportJson({}, 1, { cube2: { OH: [S(5000)] } }), ['cube2']);
    expect(res.bySession.cube2.OH).toHaveLength(1);
  });
});

describe('tela inicial', () => {
  it('o número de métodos do registro bate com cada puzzle', async () => {
    for (const p of PUZZLES.filter((d) => d.available)) expect((await p.load!()).methods.length, p.id).toBe(p.methods);
  });
});
