/** Títulos das páginas (site e prévia dos links): mesmos nomes do registro e mesmas rotas do site. */
import { afterAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/core/i18n';
import { META_PUZZLES, metaRoute, pageMeta } from '../src/core/meta';
import { PUZZLES } from '../src/core/registry';
import { parseRoute } from '../src/core/router';

describe('títulos das páginas', () => {
  afterAll(() => setLang('pt'));

  it('os nomes dos puzzles são os mesmos do registro', () => {
    for (const p of PUZZLES.filter((d) => d.available)) {
      const m = META_PUZZLES[p.id];
      expect(m, p.id).toBeDefined();
      expect(m.slug).toBe(p.slug);
      expect(m.short).toBe(p.short);
      setLang('pt');
      expect(m.pt).toBe(p.name);
      setLang('en');
      expect(m.en).toBe(p.name);
    }
  });

  it('o servidor entende os endereços igual ao site', () => {
    const paths = ['/', '/en', '/3x3', '/en/3x3', '/2x2/tutorial', '/en/megaminx/tutorial', '/cronometro', '/en/timer', '/algoritmos', '/algoritmos/2x2', '/en/algorithms/pyraminx', '/algoritmos/4x4', '/9x9', '/en/nada', '/3x3/outra'];
    for (const path of paths) {
      const site = parseRoute(path, '');
      const server = metaRoute(path)!;
      expect(server.lang, path).toBe(site.lang);
      expect(server.meta.page, path).toBe(site.page);
      if ('id' in site) expect('id' in server.meta && server.meta.id, path).toBe(site.id);
    }
    expect(metaRoute('/assets/index-abc.js')).toBeNull();
    expect(metaRoute('/og.png')).toBeNull();
  });

  it('inglês em inglês e português em português', () => {
    const PT = /[ãõçáéíóúâêô]|\b(resolva|resolver|cubo mágico|passo a passo|página|cronômetro|algoritmos do)\b/i;
    const pages = [{ page: 'home' }, { page: 'timer' }, { page: 'notfound' }, ...Object.keys(META_PUZZLES).flatMap((id) => [{ page: 'input', id }, { page: 'solve', id }]), ...['cube3', 'cube2', 'pyraminx'].map((id) => ({ page: 'algs', id }))] as Parameters<typeof pageMeta>[0][];
    for (const p of pages) {
      const en = pageMeta(p, 'en');
      expect(`${en.title} ${en.description}`, JSON.stringify(p)).not.toMatch(PT);
      const pt = pageMeta(p, 'pt');
      expect(pt.title).not.toBe(en.title);
    }
  });
});
