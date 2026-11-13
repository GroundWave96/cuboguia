import type { ColorInfo } from '../../core/types';

/** Esquema padrão: verde de frente, amarelo embaixo, vermelho atrás-esquerda, azul atrás-direita. */
export const PYRA_COLORS: ColorInfo[] = [
  { key: 'F', name: 'verde', hex: '#00a651' },
  { key: 'D', name: 'amarelo', hex: '#ffd500' },
  { key: 'L', name: 'vermelho', hex: '#d0192d' },
  { key: 'R', name: 'azul', hex: '#0a5bd6' },
];
export const PYRA_COLOR_NAME: Record<string, string> = Object.fromEntries(PYRA_COLORS.map((c) => [c.key, c.name]));
export const PYRA_COLOR_HEX: Record<string, string> = Object.fromEntries(PYRA_COLORS.map((c) => [c.key, c.hex]));
