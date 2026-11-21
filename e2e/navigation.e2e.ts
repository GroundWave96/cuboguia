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
    ['/notacao', /notação/],
    ['/perguntas', /Perguntas frequentes/],
    ['/padroes/4x4', /Padrões/],
    ['/en/patterns', /patterns/],
    ['/en/faq', /Frequently asked/],
    ['/en/notation/megaminx', /notation/],
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
  // endereço que não existe: a tela "Página não encontrada", com o código 404 (o Google não indexa)
  // (o status vem do servidor; a página em si pode sair do cache do modo offline)
  expect((await page.request.get('/9x9')).status()).toBe(404);
  await page.goto('/9x9');
  await expect(page.locator('h2').first()).toHaveText('Página não encontrada');
  for (const f of ['/en/3x3/outra', '/algoritmos/megaminx', '/nada.php', '/.well-known/ard.json']) expect((await page.request.get(f)).status(), f).toBe(404);
  for (const f of ['/sitemap.xml', '/robots.txt', '/site.webmanifest', '/llms.txt']) expect((await page.request.get(f)).status(), f).toBe(200);
  expect(await (await page.request.get('/llms.txt')).text()).toMatch(/^# CuboGuia/);
  check();
});

test('notação: cada movimento anima no 3D', async ({ page }) => {
  const check = trackErrors(page);
  await page.goto('/notacao');
  await expect(page.locator('h1')).toHaveText('Aprenda a notação');
  const card = page.locator(`.nt-move[data-m="R'"]`).first();
  await card.click();
  await expect(card).toHaveClass(/\bon\b/);
  await expect(page.locator('.move-badge strong')).toHaveText("R'");
  await expect(page.locator('.move-badge')).toContainText('anti-horário');
  // volta sozinho ao cubo arrumado
  await expect(card).not.toHaveClass(/\bon\b/, { timeout: 6000 });
  for (const [slug, m] of [
    ['5x5', '2R'],
    ['pyraminx', 'U'],
    ['skewb', 'R'],
    ['megaminx', 'U'],
  ]) {
    await page.click(`.al-puzzles a[href="/notacao/${slug}"]`);
    await expect(page).toHaveURL(new RegExp(`/notacao/${slug}$`));
    await page.locator(`.nt-move[data-m="${m}"]`).first().click();
    await expect(page.locator('.move-badge strong')).toHaveText(m);
  }
  check();
});

test('tela inicial: soma os métodos sem carregar os puzzles', async ({ page }) => {
  const check = trackErrors(page);
  const loaded: string[] = [];
  page.on('request', (r) => {
    const m = /assets\/(cube\d|pyraminx|skewb|megaminx)-/.exec(r.url());
    if (m) loaded.push(m[1]);
  });
  await page.goto('/');
  await page.locator('#stat-methods').scrollIntoViewIfNeeded();
  await expect(page.locator('#stat-methods')).toHaveText('18');
  await page.waitForTimeout(1500);
  // só a vitrine carrega um puzzle (e o próximo dela), não os 9
  expect(new Set(loaded).size).toBeLessThanOrEqual(2);
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
  // dados para o Google: nome do site na inicial e a trilha nas outras páginas
  const ld = async (path: string) => JSON.parse((await (await request.get(path)).text()).match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
  expect(await ld('/')).toMatchObject({ '@type': 'WebSite', name: 'CuboGuia' });
  const crumbs = await ld('/en/skewb/tutorial');
  expect(crumbs['@type']).toBe('BreadcrumbList');
  expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Home', 'Skewb', 'Tutorial']);
});

test('tema claro: segue a escolha, fica guardado e troca pelo menu', async ({ page }, info) => {
  const check = trackErrors(page);
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/cronometro');
  expect(await theme(), 'segue o aparelho').toBe('light');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg()).toBe('rgb(243, 245, 250)');
  // troca pelo botão (no celular, dentro do menu)
  if (info.project.name === 'celular') {
    await page.click('.menu-btn');
    await page.click('.drawer-theme');
  } else await page.click('.theme-btn');
  expect(await theme()).toBe('dark');
  expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#0b0e17');
  // a escolha vale mais que o aparelho e continua depois de recarregar
  await page.reload();
  expect(await theme()).toBe('dark');
  expect(await bg()).toBe('rgb(11, 14, 23)');
  check();
});

test('padrões: monta no 3D marcando o movimento e desfaz', async ({ page }) => {
  const check = trackErrors(page);
  await page.goto('/padroes');
  await expect(page.locator('h1')).toHaveText('Padrões bonitos');
  await expect(page.locator('.pt-card')).toHaveCount(12);
  const card = page.locator('.pt-card[data-p="xadrez"]');
  await card.locator('.pt-pic').click();
  await expect(card).toHaveClass(/\bon\b/);
  // o movimento da vez fica marcado na sequência
  await expect(card.locator('.pt-alg span.now')).toHaveCount(1);
  await expect(page.locator('.pt-tools')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.move-badge span')).toHaveText('Xadrez: pronto!');
  await expect(card.locator('.pt-alg span.done')).toHaveCount(3);
  await page.click('[data-undo]');
  await expect(page.locator('.move-badge span')).toHaveText('De volta ao resolvido', { timeout: 8000 });
  // outro cubo: a aba leva para os padrões dele
  await page.click('.al-puzzles a[href="/padroes/5x5"]');
  await expect(page).toHaveURL(/\/padroes\/5x5$/);
  await expect(page.locator('.pt-card[data-p="cruz"]')).toHaveCount(1);
  check();
});

test('tela inicial: "Depois de resolver" e perguntas frequentes', async ({ page }) => {
  const check = trackErrors(page);
  await page.goto('/');
  const cards = page.locator('.after-card');
  await expect(cards).toHaveCount(5);
  await cards.nth(0).click();
  await expect(page).toHaveURL(/\/notacao$/);
  await page.goto('/');
  // atalho direto para uma resposta
  await page.click('.faq-q[href$="#comprar"]');
  await expect(page).toHaveURL(/\/perguntas#comprar$/);
  await expect(page.locator('.faq-item#comprar')).toHaveAttribute('open', '');
  await expect(page.locator('.faq-item[open]')).toHaveCount(1);
  await page.goto('/');
  await page.click('.faq-cta-go');
  await expect(page).toHaveURL(/\/perguntas$/);
  await expect(page.locator('h1')).toHaveText('Perguntas frequentes');
  // a primeira vem aberta; abrir outra fecha a anterior (uma de cada vez)
  await expect(page.locator('.faq-item').first()).toHaveAttribute('open', '');
  const q = page.locator('.faq-item#camera');
  await q.locator('summary').click();
  await expect(q.locator('.faq-a')).toContainText('iluminado');
  await expect(page.locator('.faq-item[open]')).toHaveCount(1);
  await expect(page).toHaveURL(/#camera$/);
  // tocar de novo fecha
  await q.locator('summary').click();
  await expect(page.locator('.faq-item[open]')).toHaveCount(0);
  // os links das respostas levam para as páginas do site
  await page.locator('.faq-item#comecar summary').click();
  await page.click('.faq-item#comecar .faq-a a');
  await expect(page).toHaveURL(/\/notacao$/);
  check();
});
