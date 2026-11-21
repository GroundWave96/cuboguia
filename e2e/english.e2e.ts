/** Versão em inglês: nada em português em nenhuma tela. */
import { expect, test } from '@playwright/test';
import { openRandomTutorial, portugueseLeft, trackErrors } from './helpers';

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
  for (const path of ['/en/patterns', '/en/patterns/4x4']) {
    await page.goto(path);
    bad.push(...(await portugueseLeft(page, path)));
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

/** português ou inglês que sobrou na versão em espanhol */
const NOT_ES = /[ãõçÃÕÇ]|\b(não|você|uma|com|faça|então|também|peça|peças|canto|cantos|camada|camadas|embaixo|aresta|arestas|the|and|with|step|steps|edge|edges|corner|corners|layer|layers|moves|white|yellow|green|solve|timer|scramble)\b/i;

test('versão em espanhol: telas em espanhol, do início ao fim do tutorial', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'o celular já é testado em português');
  test.slow();
  const check = trackErrors(page);
  const bad: string[] = [];
  await page.goto('/es');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('es');
  await expect(page.locator('h1')).toContainText('Resuelve');
  bad.push(...(await portugueseLeft(page, '/es', NOT_ES)));
  await openRandomTutorial(page, '3x3', '/es');
  await expect(page.locator('.step-meta')).toContainText(/Paso 1 de/);
  bad.push(...(await portugueseLeft(page, '/es/3x3 tutorial', NOT_ES)));
  for (const path of ['/es/3x3', '/es/megaminx', '/es/cronometro', '/es/algoritmos', '/es/algoritmos/2x2', '/es/notacion', '/es/notacion/5x5', '/es/patrones/4x4', '/es/preguntas', '/es/nada']) {
    await page.goto(path);
    await page.waitForTimeout(300);
    bad.push(...(await portugueseLeft(page, path, NOT_ES)));
  }
  expect([...new Set(bad)]).toEqual([]);
  // seletor de idioma: mesma página em espanhol e de volta
  await page.goto('/padroes');
  await page.click('.nav-lang [data-lang="es"]');
  await expect(page).toHaveURL(/\/es\/patrones$/);
  await expect(page.locator('h1')).toHaveText('Patrones bonitos');
  await page.click('.nav-lang [data-lang="pt"]');
  await expect(page).toHaveURL(/\/padroes$/);
  check();
});

test('prévia em espanhol para o WhatsApp', async ({ request }) => {
  const html = await (await request.get('/es/cronometro?p=cube3&e=R%20U&t=12340&n=Ana')).text();
  expect(html).toContain('<html lang="es"');
  expect(html).toMatch(/<meta property="og:title" content="Ana te retó: 12\.34 en el 3x3"/);
  expect(html).toContain('hreflang="es"');
});
