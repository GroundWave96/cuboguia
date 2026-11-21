/**
 * Título e descrição de cada página, nos dois idiomas.
 *
 * Usado pelo site (aba do navegador, Google) e pela função do servidor que monta a prévia dos
 * links (WhatsApp, redes sociais), que não roda o JavaScript da página. Por isso este arquivo não
 * importa o registro dos puzzles (que traria o 3D junto): os nomes ficam aqui, e
 * tests/meta.test.ts confere que batem com o registro e com o roteador.
 */
export type MetaLang = 'pt' | 'en';
export type MetaPage = { page: 'home' } | { page: 'timer' } | { page: 'faq' } | { page: 'notfound' } | { page: 'input' | 'solve' | 'algs' | 'notation' | 'patterns'; id: string };

/** id → [nome pt, nome en, nome curto] */
export const META_PUZZLES: Record<string, { slug: string; pt: string; en: string; short: string }> = {
  cube2: { slug: '2x2', pt: 'Cubo 2x2', en: '2x2 Cube', short: '2x2' },
  cube3: { slug: '3x3', pt: 'Cubo 3x3', en: '3x3 Cube', short: '3x3' },
  cube4: { slug: '4x4', pt: 'Cubo 4x4', en: '4x4 Cube', short: '4x4' },
  cube5: { slug: '5x5', pt: 'Cubo 5x5', en: '5x5 Cube', short: '5x5' },
  cube6: { slug: '6x6', pt: 'Cubo 6x6', en: '6x6 Cube', short: '6x6' },
  cube7: { slug: '7x7', pt: 'Cubo 7x7', en: '7x7 Cube', short: '7x7' },
  pyraminx: { slug: 'pyraminx', pt: 'Pyraminx', en: 'Pyraminx', short: 'Pyraminx' },
  skewb: { slug: 'skewb', pt: 'Skewb', en: 'Skewb', short: 'Skewb' },
  megaminx: { slug: 'megaminx', pt: 'Megaminx', en: 'Megaminx', short: 'Megaminx' },
};
const ALG_IDS = ['cube3', 'cube2', 'pyraminx'];
const NOTATION_IDS = ['cube3', 'cube5', 'pyraminx', 'skewb', 'megaminx'];
const PATTERN_IDS = ['cube3', 'cube4', 'cube5'];
const SITE = 'CuboGuia';

export function pageMeta(p: MetaPage, lang: MetaLang): { title: string; description: string } {
  const t = (pt: string, en: string) => (lang === 'en' ? en : pt);
  const home = t(
    'Informe as cores do seu cubo mágico (pintando em 3D ou pela câmera) e siga um tutorial animado, passo a passo, para resolvê-lo.',
    'Enter your Rubik’s cube colors (painting in 3D or with the camera) and follow an animated step-by-step tutorial to solve it.',
  );
  if (p.page === 'home') return { title: t(`${SITE} — resolva seu cubo mágico passo a passo`, `${SITE} — solve your Rubik’s cube step by step`), description: home };
  if (p.page === 'faq')
    return {
      title: t(`Perguntas frequentes sobre o cubo mágico — ${SITE}`, `Rubik’s cube FAQ — ${SITE}`),
      description: t(
        'Cubo "impossível", quanto tempo leva para aprender, iniciante ou CFOP, como usar a câmera, qual cubo comprar e como ficar mais rápido.',
        'An “impossible” cube, how long it takes to learn, beginner or CFOP, using the camera, which cube to buy and how to get faster.',
      ),
    };
  if (p.page === 'notfound') return { title: t(`Página não encontrada — ${SITE}`, `Page not found — ${SITE}`), description: home };
  if (p.page === 'timer')
    return {
      title: t(`Cronômetro de cubo mágico (estilo competição) — ${SITE}`, `Rubik’s cube timer (competition style) — ${SITE}`),
      description: t(
        'Cronômetro de speedcubing no navegador: dois dedos no celular, inspeção de 15 s, embaralhos oficiais, média de 5 e de 12, recordes, gráfico e desafios com amigos.',
        'Speedcubing timer in your browser: two-finger start on phones, 15 s inspection, official-style scrambles, ao5 and ao12, records, a chart and challenges with friends.',
      ),
    };
  const pz = META_PUZZLES[p.id] ?? META_PUZZLES.cube3;
  const name = t(pz.pt, pz.en);
  if (p.page === 'algs') {
    if (p.id === 'cube2')
      return {
        title: t(`Algoritmos do 2x2 (Ortega), com animação 3D — ${SITE}`, `2x2 algorithms (Ortega), with 3D animation — ${SITE}`),
        description: t(
          'Método Ortega do 2x2: os 7 casos da face amarela e os 6 da PBL, com desenho, animação 3D, como montar o caso e modo treino.',
          'The 2x2 Ortega method: the 7 yellow-face cases and the 6 PBL cases, with pictures, 3D animation, how to set them up and a practice mode.',
        ),
      };
    if (p.id === 'pyraminx')
      return {
        title: t(`Algoritmos do Pyraminx, com animação 3D — ${SITE}`, `Pyraminx algorithms, with 3D animation — ${SITE}`),
        description: t(
          'Os 5 casos da última camada do Pyraminx (as 3 arestas de cima), com desenho, animação 3D, como montar o caso e modo treino.',
          'The 5 Pyraminx last-layer cases (the 3 top edges), with pictures, 3D animation, how to set them up and a practice mode.',
        ),
      };
    return {
      title: t(`Algoritmos OLL e PLL do cubo mágico, com animação 3D — ${SITE}`, `OLL and PLL algorithms for the Rubik’s cube, with 3D animation — ${SITE}`),
      description: t(
        'OLL em 2 etapas, OLL completa (57) e PLL completa (21) do CFOP: desenho de cada caso, o algoritmo animado em 3D, como montar o caso no seu cubo e um modo treino.',
        'CFOP 2-look OLL, full OLL (57) and full PLL (21): a picture of each case, the algorithm animated in 3D, how to set it up on your cube, and a practice mode.',
      ),
    };
  }
  if (p.page === 'patterns')
    return {
      title: t(`Padrões bonitos para o ${pz.short} (xadrez, cubo dentro do cubo…) — ${SITE}`, `${pz.short} cube patterns (checkerboard, cube in a cube…) — ${SITE}`),
      description: t(
        `Figuras para montar no ${name} resolvido: xadrez, cubo dentro do cubo, cruz e outras, com os movimentos animados em 3D.`,
        `Pictures to make on a solved ${name}: checkerboard, cube in a cube, cross and more, with the moves animated in 3D.`,
      ),
    };
  if (p.page === 'notation') {
    if (p.id === 'cube3')
      return {
        title: t(`Notação do cubo mágico (R, U', F2…) animada em 3D — ${SITE}`, `Rubik’s cube notation (R, U', F2…) animated in 3D — ${SITE}`),
        description: t(
          'Aprenda o que quer dizer cada letra dos algoritmos e tutoriais de cubo mágico: faces, sentido, duas camadas, fatias do meio e giros do cubo inteiro, cada um animado em 3D.',
          'Learn what each letter in Rubik’s cube algorithms and tutorials means: faces, direction, two layers, middle slices and whole-cube rotations, each animated in 3D.',
        ),
      };
    const label = p.id === 'cube5' ? t('dos cubos grandes (4x4 a 7x7)', 'for big cubes (4x4 to 7x7)') : t(`do ${pz.short}`, `for the ${pz.short}`);
    return {
      title: t(`Notação ${label} animada em 3D — ${SITE}`, `Notation ${label} animated in 3D — ${SITE}`),
      description: t(
        `O que quer dizer cada movimento ${label}, com animação 3D de cada um.`,
        `What each move ${label} means, with a 3D animation of each one.`,
      ),
    };
  }
  if (p.page === 'solve')
    return {
      title: t(`Tutorial: resolvendo o ${name} passo a passo — ${SITE}`, `Tutorial: solving the ${name} step by step — ${SITE}`),
      description: t(
        `Tutorial animado em 3D para resolver o ${pz.short}, passo a passo, a partir das cores do seu puzzle.`,
        `Animated 3D tutorial to solve the ${pz.short}, step by step, from your puzzle’s colors.`,
      ),
    };
  return {
    title: t(`Como resolver o ${name} — tutorial passo a passo em 3D | ${SITE}`, `How to solve the ${name} — step-by-step 3D tutorial | ${SITE}`),
    description: t(
      `Aprenda a resolver o ${pz.short}: informe as cores do seu ${pz.short} (pintando em 3D ou pela câmera) e siga um tutorial animado, do iniciante ao avançado. Grátis.`,
      `Learn to solve the ${pz.short}: enter your ${pz.short}’s colors (painting in 3D or with the camera) and follow an animated tutorial, from beginner to advanced. Free.`,
    ),
  };
}

/** a página de um endereço, sem o roteador do site (para o servidor). null = não é uma página */
export function metaRoute(pathname: string): { lang: MetaLang; meta: MetaPage } | null {
  let parts = pathname.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const lang: MetaLang = parts[0] === 'en' ? 'en' : 'pt';
  if (lang === 'en') parts = parts.slice(1);
  const bySlug = (slug: string) => Object.keys(META_PUZZLES).find((id) => META_PUZZLES[id].slug === slug.toLowerCase());
  if (!parts.length) return { lang, meta: { page: 'home' } };
  // arquivos (com extensão) não são páginas
  if (parts[parts.length - 1].includes('.')) return null;
  if ((parts[0] === 'cronometro' || parts[0] === 'timer') && parts.length === 1) return { lang, meta: { page: 'timer' } };
  if ((parts[0] === 'perguntas' || parts[0] === 'faq') && parts.length === 1) return { lang, meta: { page: 'faq' } };
  if (parts[0] === 'algoritmos' || parts[0] === 'algorithms') {
    if (parts.length === 1) return { lang, meta: { page: 'algs', id: 'cube3' } };
    const id = bySlug(parts[1]);
    if (parts.length === 2 && id && id !== 'cube3' && ALG_IDS.includes(id)) return { lang, meta: { page: 'algs', id } };
    return { lang, meta: { page: 'notfound' } };
  }
  if (parts[0] === 'padroes' || parts[0] === 'patterns') {
    if (parts.length === 1) return { lang, meta: { page: 'patterns', id: 'cube3' } };
    const id = bySlug(parts[1]);
    if (parts.length === 2 && id && id !== 'cube3' && PATTERN_IDS.includes(id)) return { lang, meta: { page: 'patterns', id } };
    return { lang, meta: { page: 'notfound' } };
  }
  if (parts[0] === 'notacao' || parts[0] === 'notation') {
    if (parts.length === 1) return { lang, meta: { page: 'notation', id: 'cube3' } };
    const id = bySlug(parts[1]);
    if (parts.length === 2 && id && id !== 'cube3' && NOTATION_IDS.includes(id)) return { lang, meta: { page: 'notation', id } };
    return { lang, meta: { page: 'notfound' } };
  }
  const id = bySlug(parts[0]);
  if (id && parts.length === 1) return { lang, meta: { page: 'input', id } };
  if (id && parts.length === 2 && parts[1] === 'tutorial') return { lang, meta: { page: 'solve', id } };
  return { lang, meta: { page: 'notfound' } };
}

/** endereço de uma página (sem o roteador do site, que traria o registro dos puzzles) */
function metaPath(p: MetaPage, lang: MetaLang): string {
  const en = lang === 'en';
  const slug = 'id' in p ? (META_PUZZLES[p.id]?.slug ?? '3x3') : '';
  const pre = en ? '/en' : '';
  switch (p.page) {
    case 'home':
    case 'notfound':
      return en ? '/en' : '/';
    case 'timer':
      return en ? '/en/timer' : '/cronometro';
    case 'faq':
      return en ? '/en/faq' : '/perguntas';
    case 'algs':
      return (en ? '/en/algorithms' : '/algoritmos') + (p.id === 'cube3' ? '' : `/${slug}`);
    case 'notation':
      return (en ? '/en/notation' : '/notacao') + (p.id === 'cube3' ? '' : `/${slug}`);
    case 'patterns':
      return (en ? '/en/patterns' : '/padroes') + (p.id === 'cube3' ? '' : `/${slug}`);
    case 'input':
      return `${pre}/${slug}`;
    case 'solve':
      return `${pre}/${slug}/tutorial`;
  }
}

/** a "trilha" da página (Início › Cubo 3x3 › Tutorial), como o Google mostra no resultado */
export function breadcrumbs(p: MetaPage, lang: MetaLang): { name: string; path: string }[] {
  const t = (pt: string, en: string) => (lang === 'en' ? en : pt);
  if (p.page === 'home' || p.page === 'notfound') return [];
  const out = [{ name: t('Início', 'Home'), path: metaPath({ page: 'home' }, lang) }];
  const pz = 'id' in p ? META_PUZZLES[p.id] : undefined;
  const name = pz ? t(pz.pt, pz.en) : '';
  if (p.page === 'timer') out.push({ name: t('Cronômetro', 'Timer'), path: metaPath(p, lang) });
  else if (p.page === 'faq') out.push({ name: t('Perguntas frequentes', 'FAQ'), path: metaPath(p, lang) });
  else if (p.page === 'algs' || p.page === 'notation' || p.page === 'patterns') {
    const top = { page: p.page, id: 'cube3' } as MetaPage;
    const label = { algs: t('Algoritmos', 'Algorithms'), notation: t('Notação', 'Notation'), patterns: t('Padrões', 'Patterns') }[p.page];
    out.push({ name: label, path: metaPath(top, lang) });
    if (p.id !== 'cube3') out.push({ name: pz!.short, path: metaPath(p, lang) });
  } else if (p.page === 'input') out.push({ name, path: metaPath(p, lang) });
  else if (p.page === 'solve') {
    out.push({ name, path: metaPath({ page: 'input', id: p.id }, lang) });
    out.push({ name: t('Tutorial', 'Tutorial'), path: metaPath(p, lang) });
  }
  return out;
}

/** dados estruturados (schema.org) da página: o nome do site na inicial e a trilha nas outras */
export function structuredData(p: MetaPage, lang: MetaLang, origin: string): string | null {
  const crumbs = breadcrumbs(p, lang);
  const data =
    p.page === 'home'
      ? { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: origin + metaPath(p, lang), inLanguage: lang === 'en' ? 'en' : 'pt-BR' }
      : crumbs.length
        ? {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: origin + c.path })),
          }
        : null;
  // "<" escapado: o texto não pode fechar a tag <script>
  return data ? JSON.stringify(data).replace(/</g, '\u003c') : null;
}
