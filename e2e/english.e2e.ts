/** Versão em inglês: nada em português em nenhuma tela. */
import { expect, test } from '@playwright/test';
import { portugueseLeft, trackErrors } from './helpers';

test.use({ locale: 'en-US' });

test('telas em inglês, do início ao fim do tutorial', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'um basta');
  test.setTimeout(240_000);
  const check = trackErrors(page);
  const bad: string[] = [];
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  bad.push(...(await portugueseLeft(page, '/en')));
  for (const id of ['3x3', 'megaminx', 'skewb']) {
    await page.goto(`/en/${id}`);
    await page.waitForSelector('.palette');
    bad.push(...(await portugueseLeft(page, `/en/${id} paint`)));
    await page.click('[data-act="clear"]');
    await page.click('[data-act="solve"]');
    bad.push(...(await portugueseLeft(page, `/en/${id} validation`)));
    await page.click('[data-tab="camera"]');
    bad.push(...(await portugueseLeft(page, `/en/${id} camera`)));
    await page.click('[data-tab="paint"]');
    await page.click('[data-act="random"]');
    await page.click('[data-act="solve"]');
    await page.waitForSelector('.step-panel .chip', { timeout: 45_000 });
    await page.click('details.notation summary');
    bad.push(...(await portugueseLeft(page, `/en/${id} tutorial`)));
    for (let i = 0; i < 400 && !(await page.locator('.done-panel').count()); i++) await page.keyboard.press('PageDown');
    bad.push(...(await portugueseLeft(page, `/en/${id} done`)));
  }
  await page.goto('/en/faq');
  for (const d of await page.locator('.faq-item').all()) if ((await d.getAttribute('open')) === null) await d.locator('summary').click();
  bad.push(...(await portugueseLeft(page, '/en/faq')));
  for (const path of ['/en/notation', '/en/notation/5x5', '/en/notation/pyraminx']) {
    await page.goto(path);
    await page.locator('.nt-move').first().click();
    await page.click('details.nt-summary summary');
    bad.push(...(await portugueseLeft(page, path)));
  }
  await page.goto('/en/timer');
  await expect(page.locator('.tm-scr-text')).not.toBeEmpty();
  await page.click('.tm-info-btn');
  bad.push(...(await portugueseLeft(page, '/en/timer')));
  await page.goto('/en/algorithms');
  await page.click('details.notation summary');
  bad.push(...(await portugueseLeft(page, '/en/algorithms')));
  await page.click('[data-tab="pll"]');
  await page.click('[data-open="pll-v"]');
  bad.push(...(await portugueseLeft(page, '/en/algorithms 3D')));
  await page.keyboard.press('Escape');
  await page.click('[data-tab="train"]');
  await page.click('[data-treveal]');
  bad.push(...(await portugueseLeft(page, '/en/algorithms practice')));
  for (const slug of ['2x2', 'pyraminx']) {
    await page.goto(`/en/algorithms/${slug}`);
    await page.click('details.notation summary');
    bad.push(...(await portugueseLeft(page, `/en/algorithms/${slug}`)));
    await page.locator('[data-open]').first().click();
    bad.push(...(await portugueseLeft(page, `/en/algorithms/${slug} 3D`)));
    await page.keyboard.press('Escape');
  }
  await page.goto('/en/nothing-here');
  bad.push(...(await portugueseLeft(page, '/en/404')));
  expect([...new Set(bad)]).toEqual([]);
  check();
});

test('seletor de idioma leva para a mesma página', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'o seletor fica no menu do celular');
  await page.goto('/3x3');
  await page.click('.nav-lang [data-lang="en"]');
  await expect(page).toHaveURL(/\/en\/3x3$/);
  await page.click('.nav-lang [data-lang="pt"]');
  await expect(page).toHaveURL(/\/3x3$/);
});
