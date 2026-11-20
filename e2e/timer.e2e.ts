/** Cronômetro: espaço no computador, dois dedos no celular, inspeção e desafio por link. */
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { trackErrors } from './helpers';

const saved = (page: Page, id = 'cube3') => page.evaluate((id) => JSON.parse(localStorage.getItem('cubo:timer:' + id) ?? '[]').length, id);

async function solveWithSpace(page: Page, ms: number) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('Space');
  await page.waitForTimeout(ms);
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
}

test('computador: segurar espaço, soltar e parar', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'teclado');
  const check = trackErrors(page);
  await page.goto('/cronometro');
  await expect(page.locator('.tm-scr-text')).not.toBeEmpty();
  // toque curto não começa
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  expect(await saved(page)).toBe(0);
  for (let k = 0; k < 5; k++) await solveWithSpace(page, 300 + k * 100);
  expect(await saved(page)).toBe(5);
  await expect(page.locator('.tm-stats')).toContainText('Média de 5');
  // +2 no último
  const before = await page.locator('.tm-time').innerText();
  await page.click('[data-last="2"]');
  await expect(page.locator('.tm-time')).not.toHaveText(before);
  // inspeção de 15 s
  await page.click('[data-opt="inspection"]');
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  await expect(page.locator('.tm-pad')).toHaveClass(/inspect/);
  check();
});

test('celular: dois dedos para começar e para parar', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'toque');
  const check = trackErrors(page);
  await page.goto('/cronometro');
  await expect(page.locator('.tm-scr-text')).not.toBeEmpty();
  const cdp = await context.newCDPSession(page);
  const box = (await page.locator('.tm-pad').boundingBox())!;
  const A = { x: box.x + box.width * 0.25, y: box.y + box.height / 2 };
  const B = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 };
  const touch = (type: 'touchStart' | 'touchEnd', pts: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ ...p, id: i })) });
  // um dedo só não arma
  await touch('touchStart', [A]);
  await page.waitForTimeout(600);
  await touch('touchEnd', []);
  await expect(page.locator('body')).not.toHaveClass(/timing/);
  // dois dedos: segura, solta, conta
  await touch('touchStart', [A, B]);
  await page.waitForTimeout(600);
  await touch('touchEnd', []);
  await expect(page.locator('body')).toHaveClass(/timing/);
  await page.waitForTimeout(500);
  await touch('touchStart', [A, B]);
  await touch('touchEnd', []);
  await expect(page.locator('body')).not.toHaveClass(/timing/);
  expect(await saved(page)).toBe(1);
  check();
});

test('desafio: o amigo recebe o mesmo embaralho e o tempo', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'computador', 'um basta');
  const check = trackErrors(page);
  await page.goto('/cronometro');
  await page.click('[data-pz="cube2"]');
  await expect(page.locator('.tm-scr-text')).toHaveText(/[RUF]/);
  const scramble = await page.locator('.tm-scr-text').innerText();
  await solveWithSpace(page, 900);
  await page.click('[data-last="share"]');
  await page.fill('.tm-name input', 'Ana <b>');
  const link = await page.locator('.tm-share-link').inputValue();
  expect(new URL(link).pathname).toBe('/cronometro');
  // prévia para o WhatsApp: o servidor já manda o título do desafio no HTML
  const html = await (await page.request.get(new URL(link).pathname + new URL(link).search)).text();
  expect(html).toMatch(/<meta property="og:title" content="Ana b te desafiou: [\d:.]+ no 2x2"/);
  expect(html).toContain('/og-desafio.png');

  const friend = await browser.newPage();
  await friend.goto(link.replace(/^https?:\/\/[^/]+/, info.project.use.baseURL!));
  await expect(friend.locator('.tm-challenge')).toBeVisible();
  await expect(friend.locator('.tm-scr-text')).toHaveText(scramble);
  await expect(friend.locator('.tm-ch-text')).toContainText('Ana');
  expect(await friend.locator('.tm-ch-text b b').count()).toBe(0);
  // link adulterado não abre desafio
  await friend.goto(info.project.use.baseURL + '/cronometro?p=cube3&e=R%20XYZ9&t=1000&n=x');
  await expect(friend.locator('.tm-challenge')).toBeHidden();
  await friend.close();
  check();
});

test('recorde, gráfico e exportar/importar os tempos', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'teclado');
  const check = trackErrors(page);
  // 6 tempos antigos (o melhor é 20 s)
  await page.addInitScript(() => {
    if (localStorage.getItem('cubo:timer:cube3')) return;
    const t = Date.now() - 1e7;
    localStorage.setItem('cubo:timer:cube3', JSON.stringify([25, 22, 20, 24, 23, 26].map((s, i) => ({ ms: s * 1000, pen: 0, scramble: 'R U', at: t + i * 1000 }))));
  });
  await page.goto('/cronometro');
  await expect(page.locator('.tm-chart')).toBeVisible();
  await expect(page.locator('.tc-dots circle')).toHaveCount(6);
  await expect(page.locator('.tm-pb')).toBeHidden();
  // resolução bem rápida: recorde de tempo e de média de 5
  await solveWithSpace(page, 300);
  await expect(page.locator('.tm-pb')).toBeVisible();
  await expect(page.locator('.tm-pb')).toContainText('Novo recorde!');
  await expect(page.locator('.tm-pb')).toContainText('Melhor tempo e melhor média de 5');
  await expect(page.locator('.tm-times li').first().locator('.tm-best')).toBeVisible();
  // DNF no último tempo: deixa de ser recorde
  await page.click('[data-last="dnf"]');
  await expect(page.locator('.tm-pb')).toBeHidden();
  // passar o mouse no gráfico mostra o tempo
  await page.locator('.tc-svg').scrollIntoViewIfNeeded();
  const box = (await page.locator('.tc-svg').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.tc-tip')).toBeVisible();

  // exportar
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
  expect(download.suggestedFilename()).toMatch(/^cuboguia-tempos-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.app).toBe('cuboguia');
  expect(exported.solves.cube3).toHaveLength(7);

  // apagar tudo e importar de volta, mais um arquivo do csTimer com 2x2
  page.once('dialog', (d) => d.accept());
  await page.click('[data-act="clear"]');
  await expect(page.locator('.tm-times li.tm-empty')).toBeVisible();
  await page.setInputFiles('.tm-file', { name: 'tempos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('.toast').last()).toContainText('7 tempos importados');
  await expect(page.locator('.tm-times li')).toHaveCount(7);
  const cs = { session1: [[[0, 4321], 'R U', '', 1700000000]], properties: { sessionData: JSON.stringify({ 1: { opt: { scrType: '222so' } } }) } };
  await page.setInputFiles('.tm-file', { name: 'cstimer.txt', mimeType: 'text/plain', buffer: Buffer.from(JSON.stringify(cs)) });
  await expect(page.locator('.toast').last()).toContainText('(csTimer)');
  await page.click('[data-pz="cube2"]');
  await expect(page.locator('.tm-times li')).toHaveCount(1);
  await expect(page.locator('.tm-times')).toContainText('4.32');
  // arquivo qualquer: avisa sem quebrar
  await page.setInputFiles('.tm-file', { name: 'foto.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
  await expect(page.locator('.toast').last()).toContainText('Não reconheci');
  check();
});
