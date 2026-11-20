/** Endereços, navegação sem recarregar, links antigos e fontes do próprio site. */
import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

test('cada endereço abre direto (como um link compartilhado)', async ({ page }) => {
  const check = trackErrors(page);
  for (const [path, h] of [
    ['/', /cubo/i],
    ['/3x3', /3x3/],
    ['/pyraminx', /Pyraminx/],
    ['/megaminx', /Megaminx/],
    ['/en/skewb', /Skewb/],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1').first()).toContainText(h);
  }
  await page.goto('/cronometro');
  await expect(page.locator('.tm-scr-text')).not.toBeEmpty();
  await page.goto('/9x9');
  await expect(page.locator('h2').first()).toHaveText('Página não encontrada');
  for (const f of ['/sitemap.xml', '/robots.txt', '/site.webmanifest']) expect((await page.request.get(f)).status(), f).toBe(200);
  check();
});

test('navega pelos links sem recarregar a página', async ({ page }) => {
  const check = trackErrors(page);
  await page.goto('/');
  let loads = 0;
  page.on('load', () => loads++);
  await page.click('.pz-card[href="/3x3"]');
  await expect(page).toHaveURL(/\/3x3$/);
  await page.click('[data-act="random"]');
  await page.click('[data-act="solve"]');
  await page.waitForSelector('.step-panel .chip');
  await expect(page).toHaveURL(/\/3x3\/tutorial\?/);
  const tutorial = page.url();
  await page.click('.method-switch a:not(.on)');
  await page.waitForSelector('.step-panel .chip');
  expect(page.url()).not.toBe(tutorial);
  await page.goBack();
  await expect(page).toHaveURL(tutorial);
  await page.waitForSelector('.step-panel .chip');
  expect(loads).toBe(0);
  // o endereço do tutorial abre direto (recarregar no meio do tutorial)
  await page.goto(tutorial);
  await page.waitForSelector('.step-panel .chip');
  check();
});

test('links antigos com # continuam funcionando', async ({ page }) => {
  await page.goto('/#/p/cube2');
  await expect(page).toHaveURL(/\/2x2$/);
  await page.goto('/#/cronometro?p=cube2&e=R%20U%20F&t=1500&n=Ana');
  await expect(page.locator('.tm-challenge')).toBeVisible();
  await expect(page.locator('.tm-ch-text')).toContainText('Ana');
});

test('fontes vêm do próprio site, sem chamar o Google', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && !u.protocol.startsWith('data')) external.push(u.hostname);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(external.filter((h) => /google|gstatic/.test(h))).toEqual([]);
  expect(await page.evaluate(async () => (await document.fonts.load('600 16px "Space Grotesk"')).length > 0)).toBe(true);
  expect(await page.evaluate(async () => (await document.fonts.load('400 16px "Inter"')).length > 0)).toBe(true);
});
