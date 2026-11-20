import { expect, type Page } from '@playwright/test';

/** falha o teste se a página tiver qualquer erro de JavaScript */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('console: ' + m.text());
  });
  return () => expect(errors, 'erros na página').toEqual([]);
}

/** embaralha o puzzle pelo botão "Aleatório" e abre o tutorial */
export async function openRandomTutorial(page: Page, slug: string, prefix = '') {
  await page.goto(`${prefix}/${slug}`);
  await page.click('[data-act="random"]');
  await page.click('[data-act="solve"]');
  await page.waitForSelector('.step-panel .chip', { timeout: 45_000 });
}

/** câmera de mentira: um canvas desenhando uma face de 3x3 (o navegador sem câmera não abre a de verdade) */
export async function fakeCamera(page: Page) {
  await page.addInitScript(() => {
    const cols = ['#d7dc37', '#f57332', '#46af46', '#c8c8be', '#af2823', '#1e69af'];
    navigator.mediaDevices.getUserMedia = async () => {
      const cv = document.createElement('canvas');
      cv.width = 640;
      cv.height = 480;
      const g = cv.getContext('2d')!;
      let t = 0;
      setInterval(() => {
        t++;
        g.fillStyle = '#111';
        g.fillRect(0, 0, 640, 480);
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++) {
            g.fillStyle = cols[(r * 3 + c + Math.floor(t / 20)) % 6];
            g.fillRect(170 + c * 102, 90 + r * 102, 94, 94);
          }
      }, 50);
      return cv.captureStream(20);
    };
  });
}

/** texto em português que não pode aparecer na versão em inglês */
export const PT =
  /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔ]|\b(não|com|para|uma|dos|das|nas|nos|pelo|pela|cima|baixo|frente|trás|direita|esquerda|canto|cantos|aresta|arestas|centro|centros|passo|passos|giro|cor|cores|embaixo|horário|camada|ponta|pontas|faça|segure|gire|até|então|também|só|mesmo|vez|vezes|já|ainda|peça|peças|movimento|movimentos|lado|outra|outro|deixe|leve|monte|resolver|início|cronômetro|embaralho|tempos|melhor|média|apagar|desafiar|câmera|pintar|limpar|resolvido|continuar|recorde)\b/i;

/** todo texto visível (e title/aria-label/placeholder) da página que ainda está em português */
export async function portugueseLeft(page: Page, where: string): Promise<string[]> {
  const texts: string[] = await page.evaluate(() => {
    const out = [document.title, (document.querySelector('meta[name=description]') as HTMLMetaElement).content];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!el || el.closest('script,style,[lang="pt-BR"],[hidden],.footer-credit a')) continue;
      const t = walker.currentNode.textContent!.trim();
      if (t) out.push(t);
    }
    document.querySelectorAll('[title],[aria-label],[placeholder]').forEach((el) => {
      if (el.closest('[lang="pt-BR"]')) return;
      for (const a of ['title', 'aria-label', 'placeholder']) if (el.getAttribute(a)) out.push(el.getAttribute(a)!);
    });
    return out;
  });
  return texts.filter((t) => PT.test(t)).map((t) => `${where}: «${t.match(PT)![0]}» em "${t.slice(0, 100)}"`);
}
