// título, descrição e idioma de cada página na prévia dos links (veja server/page-preview.ts)
import { pagePreview, type PagesContext } from '../server/page-preview';

export const onRequest = (ctx: PagesContext) => pagePreview(ctx);
