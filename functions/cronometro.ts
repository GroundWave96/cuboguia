// prévia do link de desafio em português (veja server/challenge-preview.ts)
import { challengePreviewResponse, type PagesContext } from '../server/challenge-preview';

export const onRequestGet = (ctx: PagesContext) => challengePreviewResponse(ctx, 'pt');
