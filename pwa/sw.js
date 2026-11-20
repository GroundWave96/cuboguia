/**
 * Service worker do CuboGuia: guarda o site no aparelho para abrir rápido e sem internet.
 *
 * O build (vite.config.ts) troca __VERSION__ e __PRECACHE__ pela versão e pela lista de
 * arquivos do site. Cada versão tem o próprio cache:
 *  - instala: baixa tudo da versão nova num cache novo (a versão antiga continua servindo)
 *  - a página mostra "Nova versão — Atualizar"; ao tocar, esta versão assume e a página recarrega
 *  - ativa: apaga os caches das versões antigas
 *
 * Páginas (/, /3x3, /3x3/tutorial...) → o index.html guardado (o site monta a página).
 * Arquivos do site → do cache (com o nome versionado, nunca mudam).
 * As fontes ficam em /fonts e entram na lista como qualquer outro arquivo.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `cuboguia-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // cache: 'reload' = pega do servidor, não do cache HTTP do navegador
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cuboguia-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // páginas: o site monta todas a partir do index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      // guardado como '/' (o Cloudflare redireciona /index.html → /, e navegação não aceita resposta redirecionada)
      caches.match('/', { cacheName: CACHE }).then((hit) => hit || fetch(req)),
    );
    return;
  }

  // arquivos do site: do cache; o que não está na lista vai para a internet
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
