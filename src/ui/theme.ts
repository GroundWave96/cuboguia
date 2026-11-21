/**
 * Tema claro ou escuro. Sem escolha, segue o aparelho; a escolha no menu fica guardada
 * (`cubo:theme`). O index.html já aplica o tema antes de desenhar a página (sem piscar),
 * aqui ficam o botão e a cor da barra do navegador.
 */
export type Theme = 'light' | 'dark';
const KEY = 'cubo:theme';
const BAR: Record<Theme, string> = { dark: '#0b0e17', light: '#f3f5fa' };

/** a escolha guardada (null = seguir o aparelho) */
export function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const systemTheme = (): Theme => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t]);
  document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  apply(t);
}

export const toggleTheme = () => setTheme(currentTheme() === 'light' ? 'dark' : 'light');

/** liga a cor da barra e acompanha o aparelho (enquanto a pessoa não escolheu) */
export function initTheme() {
  apply(savedTheme() ?? systemTheme());
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (!savedTheme()) apply(systemTheme());
  });
}
