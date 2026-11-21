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
import { metaPath, metaRoute, pageMeta, structuredData } from '../src/core/meta';

/** o pedaço do HTMLRewriter do Cloudflare que usamos */
interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
  append(content: string, options?: { html: boolean }): void;
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
  // arquivo que não existe (ex.: /llms.txt antigo, /x.php): o Cloudflare devolve o site, que mostra
  // "Página não encontrada"; o código 404 avisa o Google que não é uma página de verdade
  if (!route) return new Response(res.body, { status: 404, headers: res.headers });
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
    .on('html', { element: (el) => el.setAttribute('lang', { pt: 'pt-BR', en: 'en', es: 'es' }[route.lang]) })
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', content(description))
    .on('meta[property="og:title"]', content(title))
    .on('meta[property="og:description"]', content(description))
    .on('meta[property="og:url"]', content(ogUrl))
    .on('meta[property="og:image"]', content(image))
    .on('meta[property="og:image:alt"]', content(title))
    .on('meta[property="og:locale"]', content({ pt: 'pt_BR', en: 'en_US', es: 'es_ES' }[route.lang]))
    .on('meta[name="twitter:title"]', content(title))
    .on('meta[name="twitter:description"]', content(description))
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', url.origin + url.pathname) })
    .on('head', {
      element: (el) => {
        const ld = structuredData(route.meta, route.lang, url.origin);
        if (ld) el.append(`<script type="application/ld+json">${ld}</script>`, { html: true });
        // a mesma página nos outros idiomas (o Google mostra a versão certa para cada pessoa)
        if (route.meta.page !== 'notfound')
          for (const [l, hl] of [['pt', 'pt-BR'], ['en', 'en'], ['es', 'es'], ['pt', 'x-default']] as const)
            el.append(`<link rel="alternate" hreflang="${hl}" href="${url.origin}${metaPath(route.meta, l)}" />`, { html: true });
      },
    })
    .transform(res);
  // o HTML muda conforme o endereço: os caches não podem misturar
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'no-cache');
  // endereço que não existe: mesma tela "Página não encontrada", mas com 404 (sem "soft 404" no Google)
  return new Response(out.body, { status: route.meta.page === 'notfound' ? 404 : out.status, headers });
}
