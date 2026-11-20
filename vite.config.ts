import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** arquivos da pasta public que não precisam ir para o aparelho */
const SKIP_PUBLIC = new Set(['robots.txt', 'sitemap.xml', '_headers', '_redirects', 'fonts/OFL.txt']);

function listPublic(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return listPublic(p, root);
    const rel = relative(root, p).replace(/\\/g, '/');
    return SKIP_PUBLIC.has(rel) ? [] : [rel];
  });
}

/**
 * Gera o sw.js no build: a lista de todos os arquivos do site (para funcionar sem
 * internet) e uma versão que muda quando qualquer arquivo muda.
 */
function serviceWorker(): Plugin {
  return {
    name: 'cuboguia-sw',
    apply: 'build',
    // depois dos outros: o index.html só entra na lista quando o Vite já o gerou
    enforce: 'post',
    generateBundle(_, bundle) {
      const hash = createHash('sha256');
      const files = Object.values(bundle)
        .map((f) => {
          hash.update(f.fileName);
          hash.update(f.type === 'chunk' ? f.code : typeof f.source === 'string' ? f.source : Buffer.from(f.source));
          return f.fileName;
        })
        .filter((f) => !f.endsWith('.map'));
      const pub = listPublic('public');
      for (const f of pub) hash.update(f).update(readFileSync(join('public', f)));
      // a página principal vai como "/" (o Cloudflare redireciona /index.html → /)
      const urls = [...files, ...pub].map((f) => (f === 'index.html' ? '/' : `/${f}`)).sort();
      const template = readFileSync('pwa/sw.js', 'utf8');
      hash.update(template);
      const version = hash.digest('hex').slice(0, 12);
      const source = template
        .replace("const VERSION = '__VERSION__';", `const VERSION = ${JSON.stringify(version)};`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(urls, null, 1)};`);
      if (source.includes('__VERSION__;') || source.includes('= __PRECACHE__') || !urls.includes('/')) throw new Error('sw.js: não consegui montar a lista de arquivos');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// `npm run dev:https` sobe o servidor com HTTPS na rede local, para testar a
// câmera no celular (navegadores só liberam câmera em HTTPS ou localhost).
export default defineConfig(({ mode }) => ({
  plugins: [...(mode === 'https' ? [basicSsl()] : []), serviceWorker()],
  build: {
    // three.js sozinho já passa de 500 kB
    chunkSizeWarningLimit: 900,
  },
}));
