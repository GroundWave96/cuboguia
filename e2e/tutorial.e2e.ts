/** Tutorial de todos os puzzles, do primeiro passo até o "resolvido", e continuar de onde parou. */
import { expect, test } from '@playwright/test';
import { openRandomTutorial, trackErrors } from './helpers';

const SLUGS = ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7', 'pyraminx', 'skewb', 'megaminx'];
/** tutoriais longos (40 a 60 passos): no GitHub o 3D é desenhado sem placa de vídeo e demora */
const LONG = ['4x4', '5x5', '6x6', '7x7', 'megaminx'];

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
    // nos cubos com padrões, o convite para desenhar um no cubo resolvido
    await expect(page.locator('.done-patterns')).toHaveCount(['3x3', '4x4', '5x5'].includes(slug) ? 1 : 0);
    check();
  });

/** troca a voz do navegador por uma que só anota o que seria falado */
async function fakeVoice(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const said: { text: string; lang: string }[] = [];
    (window as unknown as { __said: typeof said }).__said = said;
    const synth = {
      speak: (u: SpeechSynthesisUtterance) => said.push({ text: u.text, lang: u.lang }),
      cancel: () => {},
      getVoices: () => [],
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  });
  return () => page.evaluate(() => (window as unknown as { __said: { text: string; lang: string }[] }).__said);
}

test('mãos livres: fala o próximo movimento e um toque no cubo avança', async ({ page }) => {
  const check = trackErrors(page);
  const said = await fakeVoice(page);
  await openRandomTutorial(page, '3x3');
  const toggle = page.locator('[data-act="handsfree"]');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.hf-hint')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.hf-hint')).toBeVisible();
  await expect(page.locator('.hf-note')).toBeVisible();
  await expect.poll(async () => (await said()).at(-1)?.text).toMatch(/^Passo 1 de \d+: .+\. Primeiro movimento: .+(horário|meia volta)/);
  expect((await said()).at(-1)!.lang).toBe('pt-BR');
  expect((await said()).at(-1)!.text, 'sem setas nem "·"').not.toMatch(/[↻↺·]/);

  // um toque no cubo faz o movimento e fala o seguinte
  const box = (await page.locator('#view-host').boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height * 0.55];
  const before = (await said()).length;
  await page.mouse.click(x, y);
  await expect(page.locator('.chip.done')).toHaveCount(1);
  await expect.poll(async () => (await said()).length).toBeGreaterThan(before);
  // o movimento seguinte (ou "Passo concluído", se o passo tinha um movimento só) — nunca o passo de novo
  expect((await said()).at(-1)!.text).not.toMatch(/^Passo \d+ de/);
  if ((await page.locator('.chip').count()) === 1) expect((await said()).at(-1)!.text).toMatch(/^Passo concluído/);

  // arrastar gira a vista, não avança
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 20, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  await expect(page.locator('.chip.done')).toHaveCount(1);

  // a escolha fica lembrada; desligar para de falar e esconde a dica
  await page.reload();
  await page.waitForSelector('.step-panel .chip');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.hf-hint')).toBeHidden();
  const count = (await said()).length;
  await page.click('[data-act="nextMove"]');
  await page.waitForTimeout(900);
  expect((await said()).length, 'desligado não fala').toBe(count);
  check();
});

test('mãos livres em inglês fala em inglês', async ({ page }) => {
  const said = await fakeVoice(page);
  await openRandomTutorial(page, '2x2', '/en');
  await page.click('[data-act="handsfree"]');
  await expect.poll(async () => (await said()).at(-1)?.text).toMatch(/^Step 1 of \d+: .+\. First move: /);
  const last = (await said()).at(-1)!;
  expect(last.lang).toBe('en-US');
  expect(last.text).not.toMatch(/Passo|horário|movimento/);
});

test('compartilhar o tutorial: pelo menu do aparelho ou copiando o link', async ({ page, context }) => {
  const check = trackErrors(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', { value: async (d: unknown) => void w.__shared.push(d), configurable: true });
  });
  await openRandomTutorial(page, '3x3');
  await page.click('.share-tut');
  const shared = await page.evaluate(() => (window as unknown as { __shared: { url: string; text: string }[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].url).toBe(page.url());
  expect(shared[0].text).toContain('3x3');

  // sem o menu de compartilhar (ex.: computador): copia o link
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.click('.share-tut');
  await expect(page.locator('.toasts')).toContainText('Link copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(page.url());

  // "Como ler os movimentos?" leva para a página com cada movimento animado
  await page.click('details.notation summary');
  await page.click('.nt-link a');
  await expect(page).toHaveURL(/\/notacao$/);
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
