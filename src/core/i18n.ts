/**
 * Idioma do site: português (padrão), inglês (endereços com /en) e espanhol (/es).
 *
 * Os textos ficam junto do código que os usa: tr('Próximo passo', 'Next step', 'Siguiente paso').
 * O idioma é decidido pelo endereço a cada troca de página (router.ts), então todo texto
 * deve ser montado na hora de mostrar — nunca guardado em constante no carregamento.
 */
export type Lang = 'pt' | 'en' | 'es';
export const LANGS: Lang[] = ['pt', 'en', 'es'];
/** código do idioma para o HTML, a voz e os números */
export const LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en', es: 'es' };

let lang: Lang = 'pt';

export const getLang = () => lang;
export const isEn = () => lang === 'en';

export function setLang(l: Lang) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE[l];
}

/**
 * Texto curto para caixas estreitas: a setinha ↻/↺ não fica sozinha na linha de baixo e
 * "counterclockwise" pode quebrar como "counter-/clockwise" (hífen só aparece se quebrar).
 */
export const fitText = (s: string) => s.replace(/ ([↻↺])/g, '\u00a0$1').replace(/(counter)(clockwise)/gi, '$1\u00ad$2');

/** o texto no idioma atual */
export const tr = (pt: string, en: string, es: string) => (lang === 'en' ? en : lang === 'es' ? es : pt);

/** objeto chave → texto, sempre no idioma atual (ex.: nome das cores por chave) */
export function i18nMap(entries: Record<string, [string, string, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, [pt, en, es]] of Object.entries(entries)) Object.defineProperty(out, k, { enumerable: true, get: () => tr(pt, en, es) });
  return out;
}

/** singular ou plural no idioma atual */
export const plural = (n: number, ptOne: string, ptMany: string, enOne: string, enMany: string, esOne: string, esMany: string) =>
  tr(n === 1 ? ptOne : ptMany, n === 1 ? enOne : enMany, n === 1 ? esOne : esMany);
