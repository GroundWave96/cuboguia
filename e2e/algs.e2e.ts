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
