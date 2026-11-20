import { i18nMap } from '../../core/i18n';
import type { ColorInfo } from '../../core/types';
import { color } from '../cube3/colors';

/** Esquema padrão: verde de frente, amarelo embaixo, vermelho atrás-esquerda, azul atrás-direita. */
export const PYRA_COLORS: ColorInfo[] = [
  color('F', 'verde', 'green', '#00a651'),
  color('D', 'amarelo', 'yellow', '#ffd500'),
  color('L', 'vermelho', 'red', '#d0192d'),
  color('R', 'azul', 'blue', '#0a5bd6'),
];
export const PYRA_COLOR_NAME: Record<string, string> = i18nMap({ F: ['verde', 'green'], D: ['amarelo', 'yellow'], L: ['vermelho', 'red'], R: ['azul', 'blue'] });
export const PYRA_COLOR_HEX: Record<string, string> = Object.fromEntries(PYRA_COLORS.map((c) => [c.key, c.hex]));
