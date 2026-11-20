/** Tutorial de todos os puzzles, do primeiro passo até o "resolvido", e continuar de onde parou. */
import { expect, test } from '@playwright/test';
import { openRandomTutorial, trackErrors } from './helpers';

const SLUGS = ['2x2', '3x3', '4x4', '5x5', 'pyraminx', 'skewb', 'megaminx'];

for (const slug of SLUGS)
  test(`${slug}: do início até resolvido`, async ({ page }) => {
    const check = trackErrors(page);
    await openRandomTutorial(page, slug);
    await expect(page.locator('.step-meta')).toContainText(/Passo 1 de/);
    // anima um movimento e desfaz
    await page.click('[data-act="nextMove"]');
    await expect(page.locator('.chip.done')).toHaveCount(1);
    await page.click('[data-act="prevMove"]');
    await expect(page.locator('.chip.done')).toHaveCount(0);
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
