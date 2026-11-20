/** Página de algoritmos: casos, 3D animado (inclusive com rotação do cubo), aprendidos e treino. */
import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

test('lista, 3D, aprendidos e treino', async ({ page }) => {
  const check = trackErrors(page);
  await page.goto('/algoritmos');
  await expect(page.locator('.al-card')).toHaveCount(10);
  await page.click('[data-tab="pll"]');
  await expect(page.locator('.al-card')).toHaveCount(21);

  // Aa começa e termina com rotação do cubo inteiro (x): anima tudo até o fim
  await page.click('[data-open="pll-aa"]');
  await expect(page.locator('.al-viewer')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('cubo:speed', '2.5'));
  await page.click('[data-v="play"]');
  await expect(page.locator('.al-v-move')).toContainText(/Pronto/, { timeout: 30_000 });
  await expect(page.locator('.al-v-alg .al-mv.done')).toHaveCount(11);
  await page.keyboard.press('Escape');
  await expect(page.locator('.al-viewer')).toBeHidden();

  // marcar como aprendido fica guardado
  await page.click('[data-learn="pll-t"]');
  await expect(page.locator('.al-count')).toContainText('PLL 1/21');
  await page.reload();
  await expect(page.locator('.al-count')).toContainText('PLL 1/21');

  // treino: mostra a resposta e passa para o próximo
  await page.click('[data-tab="train"]');
  await expect(page.locator('.al-train-pic svg')).toBeVisible();
  await page.click('[data-treveal]');
  await expect(page.locator('.al-train-side h3')).not.toBeEmpty();
  await page.click('[data-tnext]');
  await expect(page.locator('[data-treveal]')).toBeVisible();
  check();
});

test('OLL completa, 2x2 e Pyraminx: casos e 3D até o fim', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'um basta');
  const check = trackErrors(page);
  await page.goto('/algoritmos');
  await page.evaluate(() => localStorage.setItem('cubo:speed', '2.5'));
  await page.click('[data-tab="oll"]');
  await expect(page.locator('.al-card')).toHaveCount(57);
  for (const [slug, tabs, cards] of [['2x2', ['c2oll', 'pbl'], [7, 6]], ['pyraminx', ['pyra-top'], [5]]] as const) {
    await page.click(`.al-puzzles a[href="/algoritmos/${slug}"]`);
    await expect(page).toHaveURL(new RegExp(`/algoritmos/${slug}$`));
    for (let i = 0; i < tabs.length; i++) {
      await page.click(`[data-tab="${tabs[i]}"]`);
      await expect(page.locator('.al-card')).toHaveCount(cards[i]);
      // anima o último caso da aba até o fim
      await page.locator('[data-open]').last().click();
      await page.click('[data-v="play"]');
      await expect(page.locator('.al-v-move')).toContainText(/Pronto/, { timeout: 30_000 });
      await page.keyboard.press('Escape');
    }
    await page.click('[data-tab="train"]');
    await page.click('[data-treveal]');
    await expect(page.locator('.al-train-side h3')).not.toBeEmpty();
  }
  check();
});

test('voltar à página de algoritmos não duplica os cliques', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'um basta');
  const check = trackErrors(page);
  await page.goto('/algoritmos');
  await page.click('a[data-nav="timer"]');
  await expect(page.locator('.tm-scr-text')).not.toBeEmpty();
  await page.click('a[data-nav="algs"]');
  await page.click('a[data-nav="home"]');
  await page.click('a[data-nav="algs"]');
  await page.click('[data-learn="oll-sune"]');
  await expect(page.locator('[data-learn="oll-sune"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.al-count')).toContainText('OLL em 2 etapas 1/10');
  check();
});
