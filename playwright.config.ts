import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de navegador (e2e): abrem o site de verdade, como no Cloudflare Pages.
 *
 *   npm run build      (gera a pasta dist; também roda os testes de unidade)
 *   npm run e2e        (sobe o site com o wrangler e roda os testes em e2e/)
 *
 * No computador usa o Chrome instalado; no GitHub (CI) usa o Chromium do Playwright.
 */
const PORT = 8788;
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'computador', use: { viewport: { width: 1366, height: 800 } } },
    { name: 'celular', use: { ...devices['Pixel 7'], locale: 'pt-BR', channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: `npx wrangler pages dev dist --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
