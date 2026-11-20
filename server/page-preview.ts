/**
 * Prévia dos links (Cloudflare Pages Functions, functions/_middleware.ts).
 *
 * WhatsApp, Telegram e redes sociais leem só o HTML, sem rodar o JavaScript da página. O site é
 * um index.html só, então sem isto todo link mostraria o título da página inicial em português.
 * Aqui cada página sai com o título, a descrição e o idioma certos (os mesmos de src/core/meta.ts),
 * e o link de desafio do cronômetro sai com "Ana te desafiou: 12.34 no 3x3".
 * Arquivos (js, css, imagens) nem passam por aqui: veja public/_routes.json.
 */
import { PREVIEW_NAMES, challengePreview, readChallenge } from '../src/core/challenge';
import { metaRoute, pageMeta } from '../src/core/meta';

/** o pedaço do HTMLRewriter do Cloudflare que usamos */
interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
}
declare class HTMLRewriter {
  on(selector: string, handler: { element(el: RewriterElement): void }): HTMLRewriter;
  transform(res: Response): Response;
}

export interface PagesContext {
  request: Request;
  next(): Promise<Response>;
}

export async function pagePreview(ctx: PagesContext): Promise<Response> {
  const { request } = ctx;
  const res = await ctx.next();
  if (request.method !== 'GET' || !res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const url = new URL(request.url);
  const route = metaRoute(url.pathname);
  if (!route) return res;
  let { title, description } = pageMeta(route.meta, route.lang);
  let image = `${url.origin}/og.png`;
  let ogUrl = url.origin + url.pathname;
  if (route.meta.page === 'timer') {
    const c = readChallenge(url.searchParams, Object.keys(PREVIEW_NAMES));
    if (c) {
      ({ title, description } = challengePreview(c, route.lang));
      image = `${url.origin}/og-desafio.png`;
      ogUrl = url.href;
    }
  }
  const content = (value: string) => ({ element: (el: RewriterElement) => el.setAttribute('content', value) });
  const out = new HTMLRewriter()
    .on('html', { element: (el) => el.setAttribute('lang', route.lang === 'en' ? 'en' : 'pt-BR') })
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', content(description))
    .on('meta[property="og:title"]', content(title))
    .on('meta[property="og:description"]', content(description))
    .on('meta[property="og:url"]', content(ogUrl))
    .on('meta[property="og:image"]', content(image))
    .on('meta[property="og:image:alt"]', content(title))
    .on('meta[property="og:locale"]', content(route.lang === 'en' ? 'en_US' : 'pt_BR'))
    .on('meta[name="twitter:title"]', content(title))
    .on('meta[name="twitter:description"]', content(description))
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', url.origin + url.pathname) })
    .transform(res);
  // o HTML muda conforme o endereço: os caches não podem misturar
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(out.body, { status: out.status, headers });
}
