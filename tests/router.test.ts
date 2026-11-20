import { describe, expect, it } from 'vitest';
import { fromLegacyHash, parseRoute, pathInLang, puzzlePath, solvePath } from '../src/core/router';

describe('endereços do site', () => {
  it('cada página tem o seu endereço', () => {
    expect(parseRoute('/', '')).toEqual({ lang: 'pt', page: 'home' });
    expect(parseRoute('/en', '')).toEqual({ lang: 'en', page: 'home' });
    expect(parseRoute('/en/4x4', '')).toMatchObject({ lang: 'en', page: 'input', id: 'cube4' });
    expect(parseRoute('/en/timer', '?p=cube3')).toMatchObject({ lang: 'en', page: 'timer' });
    expect(parseRoute('/3x3', '')).toMatchObject({ page: 'input', id: 'cube3' });
    expect(parseRoute('/Pyraminx', '')).toMatchObject({ page: 'input', id: 'pyraminx' });
    expect(parseRoute('/4x4/tutorial', '?m=cfop&s=abc')).toMatchObject({ page: 'solve', id: 'cube4' });
    expect((parseRoute('/4x4/tutorial', '?m=cfop&s=abc') as { params: URLSearchParams }).params.get('m')).toBe('cfop');
    expect(parseRoute('/cronometro', '?p=cube3')).toMatchObject({ page: 'timer' });
    expect(parseRoute('/9x9', '')).toEqual({ lang: 'pt', page: 'notfound' });
    expect(parseRoute('/3x3/outra', '')).toEqual({ lang: 'pt', page: 'notfound' });
  });
  it('monta os endereços', () => {
    expect(puzzlePath('cube2')).toBe('/2x2');
    expect(puzzlePath('megaminx')).toBe('/megaminx');
    expect(solvePath('cube3', 'beginner', 'xyz')).toBe('/3x3/tutorial?m=beginner&s=xyz');
  });
  it('o mesmo endereço no outro idioma', () => {
    expect(pathInLang('/3x3/tutorial', '?m=cfop&s=1', 'en')).toBe('/en/3x3/tutorial?m=cfop&s=1');
    expect(pathInLang('/en/3x3/tutorial', '?m=cfop&s=1', 'pt')).toBe('/3x3/tutorial?m=cfop&s=1');
    expect(pathInLang('/cronometro', '?p=cube2&t=1', 'en')).toBe('/en/timer?p=cube2&t=1');
    expect(pathInLang('/en/timer', '', 'pt')).toBe('/cronometro');
    expect(pathInLang('/en', '', 'pt')).toBe('/');
    expect(pathInLang('/', '', 'en')).toBe('/en');
    expect(puzzlePath('skewb', 'en')).toBe('/en/skewb');
  });
  it('links antigos com # continuam funcionando', () => {
    expect(fromLegacyHash('#/')).toBe('/');
    expect(fromLegacyHash('#/p/cube3')).toBe('/3x3');
    expect(fromLegacyHash('#/p/skewb/solve?m=optimal&s=01')).toBe('/skewb/tutorial?m=optimal&s=01');
    expect(fromLegacyHash('#/cronometro?p=cube2&e=R%20U&t=1200')).toBe('/cronometro?p=cube2&e=R%20U&t=1200');
    expect(fromLegacyHash('#/p/naoexiste')).toBe('/');
    expect(fromLegacyHash('#como-funciona')).toBeNull();
    expect(fromLegacyHash('')).toBeNull();
  });
});
