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
    ['/6x6', /6x6/],
    ['/en/7x7', /7x7/],
    ['/en/skewb', /Skewb/],
    ['/algoritmos', /OLL e PLL/],
    ['/en/algorithms', /OLL and PLL/],
    ['/algoritmos/2x2', /2x2/],
    ['/en/algorithms/pyraminx', /Pyraminx/],
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

test('link de sugestão: abre o e-mail com o endereço da página', async ({ page }, info) => {
  const check = trackErrors(page);
  // não deixa o navegador abrir o programa de e-mail de verdade
  const block = () =>
    page.evaluate(() =>
      document.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('a[data-feedback]')) e.preventDefault();
      }),
    );
  await page.goto('/3x3');
  await block();
  const link = info.project.name === 'celular' ? page.locator('.drawer-feedback') : page.locator('.footer-feedback');
  if (info.project.name === 'celular') await page.click('.menu-btn');
  await expect(link).toHaveText('Mandar sugestão ou avisar erro');
  await link.click();
  const href = (await link.getAttribute('href'))!;
  expect(href).toMatch(/^mailto:gabrielhfp96@gmail\.com\?subject=/);
  expect(decodeURIComponent(href)).toContain(`Página: ${page.url()}`);
  // em inglês
  await page.goto('/en');
  await expect(page.locator('.footer-feedback')).toHaveText('Send a suggestion or report a bug');
  await block();
  await page.locator('.footer-feedback').click();
  expect(decodeURIComponent((await page.locator('.footer-feedback').getAttribute('href'))!)).toContain('Page: ');
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

test('prévia dos links: cada página com o título e o idioma dela', async ({ request }) => {
  const meta = async (path: string) => {
    const html = await (await request.get(path)).text();
    const get = (re: RegExp) => html.match(re)?.[1];
    return { lang: get(/<html lang="([^"]+)"/), title: get(/<meta property="og:title" content="([^"]*)"/), image: get(/<meta property="og:image" content="([^"]*)"/) };
  };
  expect(await meta('/en/3x3')).toMatchObject({ lang: 'en', title: 'How to solve the 3x3 Cube — step-by-step 3D tutorial | CuboGuia' });
  expect(await meta('/pyraminx')).toMatchObject({ lang: 'pt-BR', title: 'Como resolver o Pyraminx — tutorial passo a passo em 3D | CuboGuia' });
  expect((await meta('/en/algorithms/2x2')).title).toContain('2x2 algorithms');
  expect((await meta('/en/timer?p=cube2&e=R%20U&t=4560&n=Sam')).title).toBe('Sam challenged you: 4.56 on the 2x2');
  expect((await meta('/cronometro?p=cube3&e=R&t=dnf')).image).toMatch(/og-desafio\.png$/);
  expect((await meta('/en')).image).toMatch(/og\.png$/);
});
