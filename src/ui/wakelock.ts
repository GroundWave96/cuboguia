/**
 * Mantém a tela acesa enquanto a página está aberta (tutorial, cronômetro): as mãos estão
 * no cubo. O navegador solta o pedido quando a aba some, então pede de novo ao voltar.
 * Devolve a função que libera.
 */
export function keepScreenOn(): () => void {
  let wake: WakeLockSentinel | null = null;
  let alive = true;
  const request = async () => {
    if (!alive || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      wake = await navigator.wakeLock.request('screen');
      if (!alive) wake.release().catch(() => {});
    } catch {
      /* sem permissão ou sem suporte: só não mantém acesa */
    }
  };
  document.addEventListener('visibilitychange', request);
  request();
  return () => {
    alive = false;
    document.removeEventListener('visibilitychange', request);
    wake?.release().catch(() => {});
  };
}
