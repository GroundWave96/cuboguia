/**
 * Prévia do link de desafio (Cloudflare Pages Functions).
 *
 * WhatsApp, Telegram e redes sociais leem só o HTML da página, sem rodar o JavaScript.
 * Para o link do desafio, esta função pega a página normal (o index.html do site) e troca
 * o título, a descrição e a imagem da prévia: "Ana te desafiou: 12.34 no 3x3".
 * Sem desafio no endereço (ou com um desafio inválido), devolve a página sem mexer.
 */
import { PREVIEW_NAMES, challengePreview, readChallenge } from '../src/core/challenge';

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

export async function challengePreviewResponse(ctx: PagesContext, lang: 'pt' | 'en'): Promise<Response> {
  const res = await ctx.next();
  const url = new URL(ctx.request.url);
  const c = readChallenge(url.searchParams, Object.keys(PREVIEW_NAMES));
  if (!c || !res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const { title, description } = challengePreview(c, lang);
  const content = (value: string) => ({ element: (el: RewriterElement) => el.setAttribute('content', value) });
  const out = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', content(description))
    .on('meta[property="og:title"]', content(title))
    .on('meta[property="og:description"]', content(description))
    .on('meta[property="og:url"]', content(url.href))
    .on('meta[property="og:image"]', content(`${url.origin}/og-desafio.png`))
    .on('meta[property="og:image:alt"]', content(title))
    .on('meta[name="twitter:title"]', content(title))
    .on('meta[name="twitter:description"]', content(description))
    .transform(res);
  // cada desafio é uma página diferente: os caches não podem misturar
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(out.body, { status: out.status, headers });
}
