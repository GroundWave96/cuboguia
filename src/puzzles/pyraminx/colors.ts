import { i18nMap } from '../../core/i18n';
import type { ColorInfo } from '../../core/types';
import { color } from '../cube3/colors';

/** Esquema padrão: verde de frente, amarelo embaixo, vermelho atrás-esquerda, azul atrás-direita. */
export const PYRA_COLORS: ColorInfo[] = [
  color('F', 'verde', 'green', 'verde', '#00a651'),
  color('D', 'amarelo', 'yellow', 'amarillo', '#ffd500'),
  color('L', 'vermelho', 'red', 'rojo', '#d0192d'),
  color('R', 'azul', 'blue', 'azul', '#0a5bd6'),
];
export const PYRA_COLOR_NAME: Record<string, string> = i18nMap({ F: ['verde', 'green', 'verde'], D: ['amarelo', 'yellow', 'amarillo'], L: ['vermelho', 'red', 'rojo'], R: ['azul', 'blue', 'azul'] });
export const PYRA_COLOR_HEX: Record<string, string> = Object.fromEntries(PYRA_COLORS.map((c) => [c.key, c.hex]));
