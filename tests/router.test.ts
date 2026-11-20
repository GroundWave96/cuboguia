import { describe, expect, it } from 'vitest';
import { fromLegacyHash, parseRoute, puzzlePath, solvePath } from '../src/core/router';

describe('endereços do site', () => {
  it('cada página tem o seu endereço', () => {
    expect(parseRoute('/', '')).toEqual({ page: 'home' });
    expect(parseRoute('/3x3', '')).toMatchObject({ page: 'input', id: 'cube3' });
    expect(parseRoute('/Pyraminx', '')).toMatchObject({ page: 'input', id: 'pyraminx' });
    expect(parseRoute('/4x4/tutorial', '?m=cfop&s=abc')).toMatchObject({ page: 'solve', id: 'cube4' });
    expect((parseRoute('/4x4/tutorial', '?m=cfop&s=abc') as { params: URLSearchParams }).params.get('m')).toBe('cfop');
    expect(parseRoute('/cronometro', '?p=cube3')).toMatchObject({ page: 'timer' });
    expect(parseRoute('/9x9', '')).toEqual({ page: 'notfound' });
    expect(parseRoute('/3x3/outra', '')).toEqual({ page: 'notfound' });
  });
  it('monta os endereços', () => {
    expect(puzzlePath('cube2')).toBe('/2x2');
    expect(puzzlePath('megaminx')).toBe('/megaminx');
    expect(solvePath('cube3', 'beginner', 'xyz')).toBe('/3x3/tutorial?m=beginner&s=xyz');
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
