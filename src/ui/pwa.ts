/**
 * Aplicativo: o service worker (site sem internet), o aviso de versão nova e o botão
 * "Instalar app" (Android/computador pelo navegador; no iPhone, com as instruções).
 */
import { icon } from './icons';
import { toast } from './toast';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferred: InstallPrompt | null = null;

/** mostra/esconde os botões "Instalar app" do menu */
function refreshInstall() {
  const can = !standalone() && (deferred !== null || isIos());
  document.querySelectorAll<HTMLElement>('[data-install]').forEach((b) => (b.hidden = !can));
}

function iosHelp() {
  const box = document.createElement('div');
  box.className = 'pwa-sheet';
  box.innerHTML = `
    <div class="pwa-sheet-box card" role="dialog" aria-modal="true" aria-labelledby="pwa-t">
      <h3 id="pwa-t">${icon('download')}Instalar o CuboGuia</h3>
      <ol>
        <li>No Safari, toque em <b>Compartilhar</b> ${icon('shareIos')} (na barra de baixo ou de cima).</li>
        <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
        <li>Toque em <b>Adicionar</b>. O CuboGuia aparece como um app, e funciona até sem internet.</li>
      </ol>
      <button class="btn primary full" data-close>Entendi</button>
    </div>`;
  const close = () => box.remove();
  box.addEventListener('click', (e) => {
    if (e.target === box || (e.target as HTMLElement).closest('[data-close]')) close();
  });
  document.body.appendChild(box);
}

async function install() {
  if (deferred) {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    refreshInstall();
    if (outcome === 'accepted') toast('Instalando o CuboGuia…');
  } else if (isIos()) iosHelp();
}

function updateBanner(worker: ServiceWorker) {
  if (document.querySelector('.pwa-update')) return;
  const bar = document.createElement('div');
  bar.className = 'pwa-update';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>Há uma <b>nova versão</b> do CuboGuia.</span><button class="btn primary sm" data-up>Atualizar</button><button class="btn ghost sm" data-later aria-label="Depois">Depois</button>`;
  bar.querySelector('[data-up]')!.addEventListener('click', () => {
    bar.querySelector<HTMLButtonElement>('[data-up]')!.disabled = true;
    worker.postMessage('SKIP_WAITING');
  });
  bar.querySelector('[data-later]')!.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}

export function setupApp() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // o navegador não mostra a própria faixa: o botão fica no menu
    deferred = e as InstallPrompt;
    refreshInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    refreshInstall();
    toast('CuboGuia instalado! Ele funciona até sem internet.', 4000);
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-install]')) install();
  });
  refreshInstall();

  // o service worker só existe no site publicado (no `npm run dev` ele atrapalharia)
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      let hasController = !!navigator.serviceWorker.controller;
      // versão nova esperando: oferece atualizar (nunca recarrega sozinho no meio de uma resolução)
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        const check = () => w.state === 'installed' && navigator.serviceWorker.controller && updateBanner(w);
        check();
        w.addEventListener('statechange', check);
      };
      watch(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // a primeira instalação não recarrega (a página já é a versão certa); a troca de
        // versão (botão "Atualizar") sim — a página velha pediria arquivos que não existem mais
        if (!hasController) {
          hasController = true;
          return;
        }
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      // procura versão nova quando o app volta a aparecer na tela (ex.: aberto há dias)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch {
      /* sem service worker: o site funciona normalmente, só não fica disponível offline */
    }
  });
  window.addEventListener('offline', () => toast('Sem internet — o CuboGuia continua funcionando.', 3500));
}
