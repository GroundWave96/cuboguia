/** Aplicativo: o site fica guardado no aparelho e funciona sem internet. */
import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

test('depois da primeira visita, abre e resolve sem internet', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'computador', 'um basta');
  const check = trackErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  // espera o service worker terminar de guardar tudo
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    const k = keys.find((x) => x.startsWith('cuboguia-'));
    return !!k && (await (await caches.open(k)).keys()).length > 20;
  });
  await context.setOffline(true);
  for (const path of ['/', '/megaminx', '/cronometro', '/en/skewb']) {
    const res = await page.goto(path);
    expect(res?.ok(), path).toBe(true);
  }
  await page.goto('/2x2');
  await page.click('[data-act="random"]');
  await page.click('[data-act="solve"]');
  await page.waitForSelector('.step-panel .chip');
  expect(await page.evaluate(async () => (await document.fonts.load('600 16px "Space Grotesk"')).length > 0)).toBe(true);
  await context.setOffline(false);
  check();
});
