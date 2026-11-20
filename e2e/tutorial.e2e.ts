/** Tutorial de todos os puzzles, do primeiro passo até o "resolvido", e continuar de onde parou. */
import { expect, test } from '@playwright/test';
import { openRandomTutorial, trackErrors } from './helpers';

const SLUGS = ['2x2', '3x3', '4x4', '5x5', 'pyraminx', 'skewb', 'megaminx'];
/** tutoriais longos (40 a 60 passos): no GitHub o 3D é desenhado sem placa de vídeo e demora */
const LONG = ['4x4', '5x5', 'megaminx'];

for (const slug of SLUGS)
  test(`${slug}: do início até resolvido`, async ({ page }, info) => {
    const long = LONG.includes(slug);
    if (long) test.slow();
    const check = trackErrors(page);
    await openRandomTutorial(page, slug);
    await expect(page.locator('.step-meta')).toContainText(/Passo 1 de/);
    // anima um movimento e desfaz
    await page.click('[data-act="nextMove"]');
    await expect(page.locator('.chip.done')).toHaveCount(1);
    await page.click('[data-act="prevMove"]');
    await expect(page.locator('.chip.done')).toHaveCount(0);
    // no celular, os longos param aqui (o caminho até o fim já é testado no computador)
    if (long && info.project.name === 'celular') return check();
    // pula passo a passo até o fim
    for (let i = 0; i < 400 && !(await page.locator('.done-panel').count()); i++) await page.click('[data-act="nextStep"]');
    await expect(page.locator('.done-panel h2')).toContainText(/resolvido/i);
    check();
  });

test('passo novo não executa o primeiro movimento sozinho', async ({ page }) => {
  await openRandomTutorial(page, '3x3');
  // termina o passo 1 movimento a movimento
  const n = await page.locator('.chip').count();
  for (let i = 1; i <= n; i++) {
    await page.click('[data-act="nextMove"]');
    await expect(page.locator('.chip.done')).toHaveCount(i);
  }
  await expect(page.locator('.step-ok')).toBeVisible();
  await page.click('[data-act="nextMove"]');
  await expect(page.locator('.step-meta')).toContainText('Passo 2 de');
  await expect(page.locator('.chip.done')).toHaveCount(0);
});

test('continua de onde parou (recarregando e pela tela inicial)', async ({ page }) => {
  const check = trackErrors(page);
  await openRandomTutorial(page, '3x3');
  await page.click('[data-act="nextStep"]');
  await page.click('[data-act="nextStep"]');
  await page.click('[data-act="nextMove"]');
  await expect(page.locator('.chip.done')).toHaveCount(1);
  await expect(page.locator('.step-meta')).toContainText('Passo 3 de');
  const url = page.url();

  // recarregou: volta no mesmo passo, com o movimento feito, e avisa
  await page.reload();
  await page.waitForSelector('.step-panel .chip');
  await expect(page.locator('.resume-note')).toBeVisible();
  await expect(page.locator('.step-meta')).toContainText('Passo 3 de');
  await expect(page.locator('.chip.done')).toHaveCount(1);

  // a tela inicial mostra o tutorial em andamento
  await page.goto('/');
  const item = page.locator('.resume-item:visible').first();
  await expect(item).toContainText('3x3');
  await expect(item).toContainText('Passo 3 de');
  await item.click();
  await page.waitForSelector('.step-panel .chip');
  expect(page.url()).toBe(url);
  await expect(page.locator('.chip.done')).toHaveCount(1);

  // começar do início apaga o progresso. No celular o cubo fica fixo no topo: o aviso precisa estar
  // à vista sem rolar (o Playwright rolaria o botão para baixo do cubo; aqui toca onde a pessoa tocaria)
  await page.waitForTimeout(300);
  const btn = (await page.locator('.resume-note [data-act="restart"]').boundingBox())!;
  const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.resume-note'), [btn.x + btn.width / 2, btn.y + btn.height / 2]);
  expect(hit, 'o aviso fica visível (não fica atrás do cubo)').toBe(true);
  await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await expect(page.locator('.resume-note')).toBeHidden();
  await expect(page.locator('.step-meta')).toContainText('Passo 1 de');
  await page.goto('/');
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('.resume-item')).toHaveCount(0);
  check();
});

test('trocar o idioma no meio do tutorial mantém o passo', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'o seletor fica no menu do celular');
  const check = trackErrors(page);
  await openRandomTutorial(page, '3x3');
  await page.click('[data-act="nextStep"]');
  await page.click('[data-act="nextMove"]');
  await expect(page.locator('.chip.done')).toHaveCount(1);
  await page.click('.nav-lang [data-lang="en"]');
  await expect(page).toHaveURL(/\/en\/3x3\/tutorial/);
  await expect(page.locator('.step-meta')).toContainText('Step 2 of');
  await expect(page.locator('.chip.done')).toHaveCount(1);
  await expect(page.locator('.resume-note')).toBeHidden();
  await page.click('.nav-lang [data-lang="pt"]');
  await expect(page.locator('.step-meta')).toContainText('Passo 2 de');
  await expect(page.locator('.chip.done')).toHaveCount(1);
  // recarregar de verdade continua mostrando o aviso
  await page.reload();
  await expect(page.locator('.resume-note')).toBeVisible();
  check();
});

test('início: só o tutorial mais recente à vista, os outros em "+ N outros", e o X esquece', async ({ page }) => {
  const check = trackErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const t = Date.now();
    const p = (puzzle: string, state: string, ago: number) => ({ puzzle, method: 'beginner', state, step: 2, pos: 5, steps: 10, total: 40, sig: 'x', t: t - ago });
    localStorage.setItem('cubo:progress', JSON.stringify([p('pyraminx', 'aaa', 1000), p('cube3', 'bbb', 60000), p('cube2', 'ccc', 120000)]));
  });
  await page.goto('/');
  const box = page.locator('.resume-home:visible');
  await expect(box.locator('> .resume-row')).toHaveCount(1);
  await expect(box.locator('> .resume-row')).toContainText('Pyraminx');
  await expect(box.locator('.resume-more summary')).toHaveText('+ 2 outros');
  // esquece o mais recente: o próximo sobe
  await box.locator('> .resume-row .resume-x').click();
  await expect(box.locator('> .resume-row')).toContainText('Cubo 3x3');
  await expect(box.locator('.resume-more summary')).toHaveText('+ 1 outro');
  // abre os outros e esquece o último de lá
  await box.locator('.resume-more summary').click();
  await box.locator('.resume-more .resume-x').click();
  await expect(box.locator('.resume-more')).toHaveCount(0);
  await box.locator('.resume-x').click();
  await expect(page.locator('.resume-home')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('cubo:progress'))).toBeNull();
  await page.reload();
  await expect(page.locator('.resume-home')).toHaveCount(0);
  check();
});
