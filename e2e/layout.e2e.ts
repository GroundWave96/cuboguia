/**
 * Layout: nada sai da caixa onde está (cartão, botão, pílula) nem encosta na borda dela,
 * e a página não rola para o lado. Roda no computador (1366 px) e no celular (Pixel 7).
 */
import { expect, test, type Page } from '@playwright/test';

/** o que (elemento ou linha de texto) passa da borda de cada caixa `sel`, e quanto */
async function escapes(page: Page, sel: string) {
  return page.evaluate((sel) => {
    const out: string[] = [];
    const range = document.createRange();
    for (const box of document.querySelectorAll<HTMLElement>(sel)) {
      const R = box.getBoundingClientRect();
      if (!R.width) continue;
      const over = (r: DOMRect) => Math.max(r.right - R.right, R.left - r.left, r.bottom - R.bottom, R.top - r.top);
      for (const el of box.querySelectorAll<HTMLElement>('*')) {
        const r = el.getBoundingClientRect();
        if (r.width && over(r) > 1) out.push(`${el.tagName.toLowerCase()}.${el.className} passa ${Math.round(over(r))}px de ${sel}`);
      }
      const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.textContent?.trim()) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width && over(r) > 1) out.push(`"${n.textContent.trim()}" passa ${Math.round(over(r))}px de ${sel}`);
      }
    }
    return out;
  }, sel);
}

/** no projeto celular, o aparelho mais estreito comum (360 px), onde o aperto aparece primeiro */
const narrow = async (page: Page, project: string) => {
  if (project === 'celular') await page.setViewportSize({ width: 360, height: 760 });
};

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('cronômetro: cada tempo cabe inteiro na sua caixa (com os 4 botões)', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now();
    const solves = [
      { ms: 510, pen: 0, at: now - 30000, scramble: "R U R' U'" },
      { ms: 83450, pen: 2, at: now - 20000, scramble: "R U R' U'" },
      { ms: 9300, pen: 'dnf', at: now - 10000, scramble: "R U R' U'" },
      { ms: 1300, pen: 0, at: now, scramble: "R U R' U'" },
    ];
    localStorage.setItem('cubo:timer:cube3', JSON.stringify(solves));
  });
  await page.goto('/cronometro');
  await expect(page.locator('.tm-times li')).toHaveCount(4);
  expect(await escapes(page, '.tm-times li')).toEqual([]);
});

test('notação: os cartões têm respiro e o texto dos botões não sai deles (pt e en)', async ({ page }, info) => {
  await narrow(page, info.project.name);
  for (const path of ['/notacao', '/en/notation', '/en/notation/5x5']) {
    await page.goto(path);
    await expect(page.locator('.nt-move').first()).toBeVisible();
    expect(await escapes(page, '.nt-move'), path).toEqual([]);
    expect(await escapes(page, '.nt-group'), path).toEqual([]);
    // o título não encosta na borda do cartão
    const gap = await page.locator('.nt-group').first().evaluate((g) => g.querySelector('h2')!.getBoundingClientRect().left - g.getBoundingClientRect().left);
    expect(gap, path).toBeGreaterThanOrEqual(10);
    expect(await noSideScroll(page), path).toBeLessThanOrEqual(0);
  }
});

test('paleta do Megaminx: os 12 nomes aparecem inteiros, sem sair da tela', async ({ page }, info) => {
  await narrow(page, info.project.name);
  for (const path of ['/megaminx', '/es/megaminx', '/kilominx']) {
    await page.goto(path);
    await expect(page.locator('.swatch')).toHaveCount(12);
    const cut = await page.locator('.swatch span').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    expect(cut, path).toEqual([]);
    expect(await escapes(page, '.swatch'), path).toEqual([]);
    expect(await escapes(page, '.ws-panel'), path).toEqual([]);
    expect(await noSideScroll(page), path).toBeLessThanOrEqual(0);
  }
});

test('treino de algoritmos: o embaralho de preparação quebra a linha em vez de sair da caixinha', async ({ page }, info) => {
  await narrow(page, info.project.name);
  await page.goto('/en/algorithms');
  await page.click('[data-tab="train"]');
  for (let i = 0; i < 12; i++) {
    await expect(page.locator('.al-setup code')).toBeVisible();
    expect(await escapes(page, '.al-setup code')).toEqual([]);
    await page.click('[data-tnext]');
  }
});

test('títulos compridos dos algoritmos (inglês) ficam dentro do cartão', async ({ page }, info) => {
  await narrow(page, info.project.name);
  await page.goto('/en/algorithms/pyraminx');
  await expect(page.locator('.al-card').first()).toBeVisible();
  expect(await escapes(page, '.al-card')).toEqual([]);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});

test('câmera desligada: o texto e o botão "Ativar câmera" aparecem inteiros', async ({ page }, info) => {
  await narrow(page, info.project.name);
  await page.goto('/mastermorphix');
  await page.click('[data-tab="camera"]');
  await expect(page.locator('[data-act="start"]')).toBeVisible();
  expect(await escapes(page, '.scan-stage')).toEqual([]);
});
