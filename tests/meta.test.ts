/** Títulos das páginas (site e prévia dos links): mesmos nomes do registro e mesmas rotas do site. */
import { afterAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/core/i18n';
import { META_PUZZLES, breadcrumbs, metaRoute, pageMeta, structuredData } from '../src/core/meta';
import { PUZZLES } from '../src/core/registry';
import { parseRoute, pathInLang } from '../src/core/router';

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
    const paths = ['/', '/en', '/3x3', '/en/3x3', '/2x2/tutorial', '/en/megaminx/tutorial', '/cronometro', '/en/timer', '/algoritmos', '/algoritmos/2x2', '/en/algorithms/pyraminx', '/algoritmos/4x4', '/notacao', '/notacao/5x5', '/en/notation/megaminx', '/notacao/2x2', '/en/notation/x', '/9x9', '/en/nada', '/3x3/outra', '/perguntas', '/en/faq', '/perguntas/x'];
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
    const pages = [{ page: 'home' }, { page: 'timer' }, { page: 'faq' }, { page: 'notfound' }, ...Object.keys(META_PUZZLES).flatMap((id) => [{ page: 'input', id }, { page: 'solve', id }]), ...['cube3', 'cube2', 'pyraminx'].map((id) => ({ page: 'algs', id })), ...['cube3', 'cube5', 'pyraminx', 'skewb', 'megaminx'].map((id) => ({ page: 'notation', id }))] as Parameters<typeof pageMeta>[0][];
    for (const p of pages) {
      const en = pageMeta(p, 'en');
      expect(`${en.title} ${en.description}`, JSON.stringify(p)).not.toMatch(PT);
      const pt = pageMeta(p, 'pt');
      expect(pt.title).not.toBe(en.title);
    }
  });
});

describe('trilha da página e dados para o Google', () => {
  it('a trilha aponta para páginas que existem, no mesmo idioma', () => {
    expect(breadcrumbs({ page: 'solve', id: 'cube3' }, 'pt')).toEqual([
      { name: 'Início', path: '/' },
      { name: 'Cubo 3x3', path: '/3x3' },
      { name: 'Tutorial', path: '/3x3/tutorial' },
    ]);
    expect(breadcrumbs({ page: 'algs', id: 'cube2' }, 'en').map((c) => c.path)).toEqual(['/en', '/en/algorithms', '/en/algorithms/2x2']);
    expect(breadcrumbs({ page: 'faq' }, 'pt').map((c) => c.name)).toEqual(['Início', 'Perguntas frequentes']);
    expect(breadcrumbs({ page: 'notfound' }, 'pt')).toEqual([]);
    for (const path of ['/cronometro', '/en/timer', '/perguntas', '/notacao/skewb', '/en/7x7', '/pyraminx/tutorial', '/algoritmos']) {
      const r = metaRoute(path)!;
      const crumbs = breadcrumbs(r.meta, r.lang);
      expect(crumbs.at(-1)!.path, path).toBe(path);
      for (const c of crumbs) expect(metaRoute(c.path)!.meta.page, c.path).not.toBe('notfound');
    }
  });
  it('JSON válido e sem fechar a tag <script>', () => {
    const home = JSON.parse(structuredData({ page: 'home' }, 'en', 'https://x.dev')!);
    expect(home).toMatchObject({ '@type': 'WebSite', name: 'CuboGuia', url: 'https://x.dev/en' });
    const bc = JSON.parse(structuredData({ page: 'notation', id: 'megaminx' }, 'pt', 'https://x.dev')!);
    expect(bc.itemListElement.map((i: { item: string }) => i.item)).toEqual(['https://x.dev/', 'https://x.dev/notacao', 'https://x.dev/notacao/megaminx']);
    expect(structuredData({ page: 'notfound' }, 'pt', 'https://x.dev')).toBeNull();
    expect(structuredData({ page: 'timer' }, 'pt', 'https://x.dev')).not.toContain('<');
  });
  it('perguntas frequentes nos dois idiomas', () => {
    expect(pathInLang('/perguntas', '', 'en')).toBe('/en/faq');
    expect(pathInLang('/en/faq', '', 'pt')).toBe('/perguntas');
  });
});
