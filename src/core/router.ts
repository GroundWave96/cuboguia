/**
 * Endereços do site (sem #, para o Google e para a contagem de visitas):
 *
 *   /                      início
 *   /3x3                   informar as cores do 3x3 (pintar ou câmera)
 *   /3x3/tutorial?m=&s=    tutorial (método e estado do cubo no endereço)
 *   /cronometro?p=&e=&t=   cronômetro (com desafio opcional)
 *
 * Os links antigos (#/p/cube3, #/cronometro?...) continuam funcionando: viram o novo.
 */
import { PUZZLES } from './registry';

export const slugOf = (id: string) => PUZZLES.find((p) => p.id === id)?.slug ?? id;
export const idOfSlug = (slug: string) => PUZZLES.find((p) => p.slug === slug.toLowerCase())?.id;

export const puzzlePath = (id: string) => `/${slugOf(id)}`;
export const solvePath = (id: string, method: string, state: string) => `/${slugOf(id)}/tutorial?m=${method}&s=${state}`;
export const TIMER_PATH = '/cronometro';

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
  if (parts[0] === 'cronometro') return TIMER_PATH + q;
  if (parts[0] === 'p' && parts[1] && PUZZLES.some((p) => p.id === parts[1])) return parts[2] === 'solve' ? `/${slugOf(parts[1])}/tutorial${q}` : puzzlePath(parts[1]);
  return '/';
}

export type Route =
  | { page: 'home' }
  | { page: 'timer'; params: URLSearchParams }
  | { page: 'input'; id: string; params: URLSearchParams }
  | { page: 'solve'; id: string; params: URLSearchParams }
  | { page: 'notfound' };

export function parseRoute(pathname: string, search: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(search);
  if (!parts.length) return { page: 'home' };
  if (parts[0] === 'cronometro' && parts.length === 1) return { page: 'timer', params };
  const id = idOfSlug(parts[0]);
  if (id && parts.length === 1) return { page: 'input', id, params };
  if (id && parts.length === 2 && parts[1] === 'tutorial') return { page: 'solve', id, params };
  return { page: 'notfound' };
}
