/**
 * Idioma do site: português (padrão) e inglês (endereços com /en).
 *
 * Os textos ficam junto do código que os usa: tr('Próximo passo', 'Next step').
 * O idioma é decidido pelo endereço a cada troca de página (router.ts), então todo texto
 * deve ser montado na hora de mostrar — nunca guardado em constante no carregamento.
 */
export type Lang = 'pt' | 'en';

let lang: Lang = 'pt';

export const getLang = () => lang;
export const isEn = () => lang === 'en';

export function setLang(l: Lang) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'en' ? 'en' : 'pt-BR';
}

/** o texto no idioma atual */
export const tr = (pt: string, en: string) => (lang === 'en' ? en : pt);

/** objeto chave → texto, sempre no idioma atual (ex.: nome das cores por chave) */
export function i18nMap(entries: Record<string, [string, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, [pt, en]] of Object.entries(entries)) Object.defineProperty(out, k, { enumerable: true, get: () => tr(pt, en) });
  return out;
}

/** número com a vírgula/ponto do idioma (só para textos; tempos do cronômetro usam ponto) */
export const plural = (n: number, ptOne: string, ptMany: string, enOne: string, enMany: string) => tr(n === 1 ? ptOne : ptMany, n === 1 ? enOne : enMany);
