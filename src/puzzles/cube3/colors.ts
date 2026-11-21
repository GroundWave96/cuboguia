import { i18nMap, tr } from '../../core/i18n';
import type { ColorInfo } from '../../core/types';

/**
 * Esquema de cores padrão, segurando o cubo com AMARELO em cima e VERDE na frente
 * (assim o branco fica embaixo, que é onde o método de iniciante monta a cruz).
 * A chave de cada cor é a face onde fica o centro dessa cor.
 */
/** cor com nome nos dois idiomas (o português também é a referência da câmera) */
export const color = (key: string, pt: string, en: string, es: string, hex: string): ColorInfo => ({
  key,
  ref: pt,
  hex,
  get name() {
    return tr(pt, en, es);
  },
});

export const CUBE3_COLORS: ColorInfo[] = [
  color('U', 'amarelo', 'yellow', 'amarillo', '#ffd500'),
  color('R', 'laranja', 'orange', 'naranja', '#ff6a13'),
  color('F', 'verde', 'green', 'verde', '#00a651'),
  color('D', 'branco', 'white', 'blanco', '#f4f6f8'),
  color('L', 'vermelho', 'red', 'rojo', '#d0192d'),
  color('B', 'azul', 'blue', 'azul', '#0a5bd6'),
];

/** nome da cor por chave, no idioma atual */
export const COLOR_NAME: Record<string, string> = i18nMap({
  U: ['amarelo', 'yellow', 'amarillo'],
  R: ['laranja', 'orange', 'naranja'],
  F: ['verde', 'green', 'verde'],
  D: ['branco', 'white', 'blanco'],
  L: ['vermelho', 'red', 'rojo'],
  B: ['azul', 'blue', 'azul'],
});
export const COLOR_HEX: Record<string, string> = Object.fromEntries(CUBE3_COLORS.map((c) => [c.key, c.hex]));

export const FACE_NAME: Record<string, string> = i18nMap({
  U: ['Cima', 'Up', 'Arriba'],
  D: ['Baixo', 'Down', 'Abajo'],
  F: ['Frente', 'Front', 'Frente'],
  B: ['Trás', 'Back', 'Atrás'],
  R: ['Direita', 'Right', 'Derecha'],
  L: ['Esquerda', 'Left', 'Izquierda'],
});
