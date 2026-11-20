/** Continuar o tutorial de onde parou (progresso guardado no navegador). */
import { beforeEach, describe, expect, it } from 'vitest';
import { clearProgress, listProgress, loadProgress, movesSignature, saveProgress, type Progress } from '../src/core/progress';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

const moves = ['R', 'U', "R'", "U'"];
const sig = movesSignature(moves);
const base: Progress = { puzzle: 'cube3', method: 'beginner', state: 'abc', step: 2, pos: 3, steps: 5, total: 4, sig, t: Date.now() };

describe('progresso do tutorial', () => {
  beforeEach(() => store.clear());

  it('salva e recupera o mesmo tutorial', () => {
    saveProgress(base);
    expect(loadProgress('cube3', 'beginner', 'abc', sig)).toMatchObject({ step: 2, pos: 3 });
    expect(loadProgress('cube3', 'cfop', 'abc', sig)).toBeNull();
    expect(loadProgress('cube3', 'beginner', 'abd', sig)).toBeNull();
  });

  it('ignora o progresso se a solução mudou', () => {
    saveProgress(base);
    expect(loadProgress('cube3', 'beginner', 'abc', movesSignature(['R', 'U', "R'", 'U']))).toBeNull();
    expect(movesSignature(moves)).toBe(sig);
    expect(movesSignature([...moves, 'F'])).not.toBe(sig);
  });

  it('no início ou no fim do tutorial apaga o registro', () => {
    saveProgress(base);
    saveProgress({ ...base, pos: 4 });
    expect(listProgress()).toEqual([]);
    saveProgress(base);
    saveProgress({ ...base, step: 0, pos: 0 });
    expect(listProgress()).toEqual([]);
  });

  it('mais recente primeiro, sem repetir e com limite', () => {
    for (let i = 0; i < 20; i++) saveProgress({ ...base, state: 's' + i, t: Date.now() + i });
    saveProgress({ ...base, state: 's3', pos: 1, t: Date.now() + 100 });
    const list = listProgress();
    expect(list.length).toBe(4);
    expect(list[0]).toMatchObject({ state: 's3', pos: 1 });
    expect(list.filter((p) => p.state === 's3').length).toBe(1);
    clearProgress('cube3', 'beginner', 's3');
    expect(listProgress().some((p) => p.state === 's3')).toBe(false);
  });

  it('esquece tutoriais muito antigos e dados estragados', () => {
    saveProgress({ ...base, t: Date.now() - 90 * 24 * 3600 * 1000 });
    expect(listProgress()).toEqual([]);
    store.set('cubo:progress', '[{"puzzle":1},"x",null]');
    expect(listProgress()).toEqual([]);
    store.set('cubo:progress', 'não é json');
    expect(listProgress()).toEqual([]);
  });

  it('o mesmo cubo gera sempre a mesma solução (o progresso continua válido)', async () => {
    const { PUZZLES } = await import('../src/core/registry');
    for (const def of PUZZLES.filter((p) => p.available)) {
      const impl = await def.load!();
      const s = impl.scramble().reduce((st, m) => impl.applyMove(st, m), impl.solvedState());
      for (const m of impl.methods) {
        const a = impl.solve(s, m.id).steps.flatMap((st) => st.segments.flatMap((sg) => sg.moves));
        const b = impl.solve([...s], m.id).steps.flatMap((st) => st.segments.flatMap((sg) => sg.moves));
        expect(movesSignature(b), `${def.id} ${m.id}`).toBe(movesSignature(a));
      }
    }
  }, 120000);
});
