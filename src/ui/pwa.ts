/**
 * Aplicativo: o service worker (site sem internet), o aviso de versão nova e o botão
 * "Instalar app" (Android/computador pelo navegador; no iPhone, com as instruções).
 */
import { tr } from '../core/i18n';
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
export function refreshInstall() {
  const can = !standalone() && (deferred !== null || isIos());
  document.querySelectorAll<HTMLElement>('[data-install]').forEach((b) => (b.hidden = !can));
}

function iosHelp() {
  const box = document.createElement('div');
  box.className = 'pwa-sheet';
  box.innerHTML = `
    <div class="pwa-sheet-box card" role="dialog" aria-modal="true" aria-labelledby="pwa-t">
      <h3 id="pwa-t">${icon('download')}${tr('Instalar o CuboGuia', 'Install CuboGuia', 'Instalar CuboGuia')}</h3>
      <ol>
        <li>${tr(`No Safari, toque em <b>Compartilhar</b> ${icon('shareIos')} (na barra de baixo ou de cima).`, `In Safari, tap <b>Share</b> ${icon('shareIos')} (in the bottom or top bar).`, `En Safari, toca <b>Compartir</b> ${icon('shareIos')} (en la barra de abajo o de arriba).`)}</li>
        <li>${tr('Role e toque em <b>Adicionar à Tela de Início</b>.', 'Scroll down and tap <b>Add to Home Screen</b>.', 'Desliza hacia abajo y toca <b>Añadir a pantalla de inicio</b>.')}</li>
        <li>${tr('Toque em <b>Adicionar</b>. O CuboGuia aparece como um app, e funciona até sem internet.', 'Tap <b>Add</b>. CuboGuia shows up as an app, and it even works offline.', 'Toca <b>Añadir</b>. CuboGuia aparece como una app, y funciona incluso sin internet.')}</li>
      </ol>
      <button class="btn primary full" data-close>${tr('Entendi', 'Got it', 'Entendido')}</button>
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
    if (outcome === 'accepted') toast(tr('Instalando o CuboGuia…', 'Installing CuboGuia…', 'Instalando CuboGuia…'));
  } else if (isIos()) iosHelp();
}

function updateBanner(worker: ServiceWorker) {
  if (document.querySelector('.pwa-update')) return;
  const bar = document.createElement('div');
  bar.className = 'pwa-update';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>${tr('Há uma <b>nova versão</b> do CuboGuia.', 'A <b>new version</b> of CuboGuia is available.', 'Hay una <b>nueva versión</b> de CuboGuia disponible.')}</span><button class="btn primary sm" data-up>${tr('Atualizar', 'Update', 'Actualizar')}</button><button class="btn ghost sm" data-later>${tr('Depois', 'Later', 'Más tarde')}</button>`;
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
    toast(tr('CuboGuia instalado! Ele funciona até sem internet.', 'CuboGuia installed! It even works offline.', '¡CuboGuia instalado! Funciona incluso sin internet.'), 4000);
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-install]')) install();
  });
  refreshInstall();

  // o service worker só existe no site publicado (no `npm run dev` ele atrapalharia)
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // a pessoa já mexeu na página? (tocou, clicou, digitou) — antes disso, atualizar é seguro
  let touched = false;
  for (const ev of ['pointerdown', 'keydown', 'touchstart'])
    window.addEventListener(ev, () => (touched = true), { once: true, passive: true, capture: true });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      let hasController = !!navigator.serviceWorker.controller;
      // versão nova esperando: se a página acabou de abrir e ninguém mexeu nela, atualiza na
      // hora (senão a versão velha, guardada para funcionar offline, fica até tocar em
      // "Atualizar"); se já estiver em uso, só oferece — nunca recarrega no meio de uma resolução
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        const check = () => {
          if (w.state !== 'installed' || !navigator.serviceWorker.controller) return;
          if (!touched && document.visibilityState === 'visible') w.postMessage('SKIP_WAITING');
          else updateBanner(w);
        };
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
  window.addEventListener('offline', () => toast(tr('Sem internet — o CuboGuia continua funcionando.', 'You’re offline — CuboGuia keeps working.', 'Estás sin conexión: CuboGuia sigue funcionando.'), 3500));
}
