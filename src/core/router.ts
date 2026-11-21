/**
 * Endereços do site (sem #, para o Google e para a contagem de visitas):
 *
 *   /                      início                      /en
 *   /3x3                   informar as cores do 3x3    /en/3x3
 *   /3x3/tutorial?m=&s=    tutorial                    /en/3x3/tutorial?m=&s=
 *   /cronometro?p=&e=&t=   cronômetro (e desafio)      /en/timer?p=&e=&t=
 *   /algoritmos            OLL e PLL (3x3)             /en/algorithms
 *   /algoritmos/2x2        algoritmos do 2x2 (e /pyraminx) /en/algorithms/2x2
 *   /notacao               notação animada (3x3)       /en/notation
 *   /notacao/5x5           notação de outro puzzle     /en/notation/5x5
 *   /padroes, /perguntas   padrões e perguntas         /en/patterns, /en/faq
 *
 * Em espanhol: /es, /es/3x3, /es/cronometro, /es/algoritmos, /es/notacion, /es/patrones,
 * /es/preguntas (os nomes de cada página ficam em SEGMENTS, src/core/meta.ts).
 * Os links antigos (#/p/cube3, #/cronometro?...) continuam funcionando: viram o novo.
 */
import { getLang, type Lang } from './i18n';
import { LANG_PREFIX, SEGMENTS, langOfParts, segmentOf } from './meta';
import { PUZZLES } from './registry';

export const slugOf = (id: string) => PUZZLES.find((p) => p.id === id)?.slug ?? id;
export const idOfSlug = (slug: string) => PUZZLES.find((p) => p.slug === slug.toLowerCase())?.id;

/** começo dos endereços no idioma (ou no idioma atual) */
const prefix = (lang: Lang = getLang()) => LANG_PREFIX[lang];
/** endereço de uma página no idioma (com o puzzle, quando não é o 3x3) */
const segPath = (seg: keyof typeof SEGMENTS, lang: Lang, id = 'cube3') => `${prefix(lang)}/${SEGMENTS[seg][lang]}${id === 'cube3' ? '' : `/${slugOf(id)}`}`;
export const homePath = (lang: Lang = getLang()) => prefix(lang) || '/';
export const puzzlePath = (id: string, lang?: Lang) => `${prefix(lang)}/${slugOf(id)}`;
export const solvePath = (id: string, method: string, state: string, lang?: Lang) => `${prefix(lang)}/${slugOf(id)}/tutorial?m=${method}&s=${state}`;
export const timerPath = (lang: Lang = getLang()) => segPath('timer', lang);
/** puzzles com página de algoritmos (o 3x3 é a página principal) */
export const ALG_PUZZLES = ['cube3', 'cube2', 'pyraminx'];
export const algsPath = (lang: Lang = getLang(), id = 'cube3') => segPath('algs', lang, id);

/** puzzles com página de notação (o 3x3 é a principal; o 5x5 mostra a dos cubos grandes) */
export const NOTATION_PUZZLES = ['cube3', 'cube5', 'pyraminx', 'skewb', 'megaminx'];
/** a página de notação que serve para um puzzle (2x2 → 3x3, 4x4 a 7x7 → 5x5) */
export const notationIdFor = (id: string) => (NOTATION_PUZZLES.includes(id) ? id : /^cube[4-9]$/.test(id) ? 'cube5' : 'cube3');
/** puzzles com página de padrões (a mesma lista de src/puzzles/patterns.ts, conferida nos testes) */
export const PATTERN_PUZZLES_R = ['cube3', 'cube4', 'cube5'];
export const patternsPath = (lang: Lang = getLang(), id = 'cube3') => segPath('patterns', lang, id);
export const faqPath = (lang: Lang = getLang()) => segPath('faq', lang);
export const notationPath = (lang: Lang = getLang(), id = 'cube3') => segPath('notation', lang, id);

let onChange: (() => void) | null = null;
export function setRouteHandler(fn: () => void) {
  onChange = fn;
}

/** vai para outro endereço do site sem recarregar a página */
export function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  onChange?.();
}

/** endereço antigo com # → endereço novo (ou null se não for um endereço antigo) */
export function fromLegacyHash(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const [path, query = ''] = hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean);
  const q = query ? `?${query}` : '';
  if (!parts.length) return '/';
  if (parts[0] === 'cronometro') return timerPath('pt') + q;
  if (parts[0] === 'p' && parts[1] && PUZZLES.some((p) => p.id === parts[1])) return parts[2] === 'solve' ? `/${slugOf(parts[1])}/tutorial${q}` : puzzlePath(parts[1]);
  return '/';
}

export type Route = { lang: Lang } & (
  | { page: 'home' }
  | { page: 'timer'; params: URLSearchParams }
  | { page: 'algs'; id: string; params: URLSearchParams }
  | { page: 'notation'; id: string; params: URLSearchParams }
  | { page: 'faq' }
  | { page: 'patterns'; id: string }
  | { page: 'input'; id: string; params: URLSearchParams }
  | { page: 'solve'; id: string; params: URLSearchParams }
  | { page: 'notfound' }
);

export function parseRoute(pathname: string, search: string): Route {
  let parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const lang: Lang = langOfParts(parts);
  if (lang !== 'pt') parts = parts.slice(1);
  const params = new URLSearchParams(search);
  if (!parts.length) return { lang, page: 'home' };
  const seg = segmentOf(parts[0]);
  if (seg === 'timer' && parts.length === 1) return { lang, page: 'timer', params };
  if (seg === 'faq' && parts.length === 1) return { lang, page: 'faq' };
  if (seg === 'patterns') {
    if (parts.length === 1) return { lang, page: 'patterns', id: 'cube3' };
    const pt = idOfSlug(parts[1]);
    if (parts.length === 2 && pt && PATTERN_PUZZLES_R.includes(pt) && pt !== 'cube3') return { lang, page: 'patterns', id: pt };
    return { lang, page: 'notfound' };
  }
  if (seg === 'algs') {
    if (parts.length === 1) return { lang, page: 'algs', id: 'cube3', params };
    const alg = idOfSlug(parts[1]);
    if (parts.length === 2 && alg && ALG_PUZZLES.includes(alg) && alg !== 'cube3') return { lang, page: 'algs', id: alg, params };
    return { lang, page: 'notfound' };
  }
  if (seg === 'notation') {
    if (parts.length === 1) return { lang, page: 'notation', id: 'cube3', params };
    const nt = idOfSlug(parts[1]);
    if (parts.length === 2 && nt && NOTATION_PUZZLES.includes(nt) && nt !== 'cube3') return { lang, page: 'notation', id: nt, params };
    return { lang, page: 'notfound' };
  }
  const id = idOfSlug(parts[0]);
  if (id && parts.length === 1) return { lang, page: 'input', id, params };
  if (id && parts.length === 2 && parts[1] === 'tutorial') return { lang, page: 'solve', id, params };
  return { lang, page: 'notfound' };
}

/** o mesmo endereço no outro idioma (a página e os parâmetros continuam) */
export function pathInLang(pathname: string, search: string, lang: Lang): string {
  const r = parseRoute(pathname, search);
  const q = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : '';
  if (r.page === 'timer') return timerPath(lang) + q;
  if (r.page === 'faq') return faqPath(lang);
  if (r.page === 'patterns') return patternsPath(lang, r.id);
  if (r.page === 'algs') return algsPath(lang, r.id) + q;
  if (r.page === 'notation') return notationPath(lang, r.id) + q;
  if (r.page === 'input') return puzzlePath(r.id, lang) + q;
  if (r.page === 'solve') return `${prefix(lang)}/${slugOf(r.id)}/tutorial${q}`;
  return homePath(lang);
}
