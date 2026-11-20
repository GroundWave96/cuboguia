// prévia do link de desafio em inglês (veja server/challenge-preview.ts)
import { challengePreviewResponse, type PagesContext } from '../../server/challenge-preview';

export const onRequestGet = (ctx: PagesContext) => challengePreviewResponse(ctx, 'en');
