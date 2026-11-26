/** Câmera: lê as 6 faces, revisão, refazer só uma face e usar a leitura. */
import { expect, test, type Page } from '@playwright/test';
import { fakeCamera, trackErrors } from './helpers';

async function captureFaces(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.waitForSelector('[data-act="capture"]:not([disabled])');
    const before = await page.locator('.scan-progress span').getAttribute('style');
    // a câmera de mentira demora um pouco para mandar o primeiro quadro: repete até valer
    for (let t = 0; t < 20; t++) {
      await page.click('[data-act="capture"]');
      await page.waitForTimeout(400);
      if (await page.locator('.scan-review').count()) break;
      const now = await page.locator('.scan-progress span').getAttribute('style').catch(() => null);
      if (now !== before) break;
    }
  }
}

test('3x3: lê as faces, refaz uma e usa a leitura', async ({ page, context, baseURL }) => {
  const check = trackErrors(page);
  await context.grantPermissions(['camera'], { origin: baseURL });
  await fakeCamera(page);
  await page.goto('/3x3?debug');
  await page.evaluate(() => localStorage.setItem('cuboguia.autoCapture', '0'));
  await page.reload();
  await page.click('[data-tab="camera"]');
  await page.click('[data-act="start"]');
  await captureFaces(page, 6);
  await expect(page.locator('.review-face')).toHaveCount(6);
  // refaz só a terceira face
  await page.click('.review-face[data-face="2"]');
  await page.waitForSelector('.back-review');
  await captureFaces(page, 1);
  await expect(page.locator('.scan-review')).toBeVisible();
  await page.click('[data-act="use"]');
  await expect(page.locator('.scan-card')).toBeVisible();
  // modo debug: código da amostra para copiar
  await page.click('.debug-sample summary');
  await expect(page.locator('.debug-sample textarea')).not.toHaveValue('');
  check();
});

test('2x2: entre uma face e a próxima, o cubinho mostra o giro (e dá para ver de novo)', async ({ page, context, baseURL }) => {
  const check = trackErrors(page);
  await context.grantPermissions(['camera'], { origin: baseURL });
  await fakeCamera(page);
  await page.goto('/2x2');
  await page.evaluate(() => localStorage.setItem('cuboguia.autoCapture', '0'));
  await page.reload();
  await page.click('[data-tab="camera"]');
  await page.click('[data-act="start"]');
  // na 1ª face não há giro para mostrar
  await expect(page.locator('.turn-replay')).toBeHidden();
  await captureFaces(page, 1);
  await expect(page.locator('.scan-step')).toHaveText('2/6');
  await expect(page.locator('.turn-replay')).toBeVisible();
  await page.click('.turn-replay');
  await page.waitForTimeout(1700);
  // o resto da leitura continua igual
  await captureFaces(page, 5);
  await expect(page.locator('.review-face')).toHaveCount(6);
  check();
});
