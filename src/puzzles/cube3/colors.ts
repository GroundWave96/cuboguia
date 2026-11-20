import { i18nMap, tr } from '../../core/i18n';
import type { ColorInfo } from '../../core/types';

/**
 * Esquema de cores padrão, segurando o cubo com AMARELO em cima e VERDE na frente
 * (assim o branco fica embaixo, que é onde o método de iniciante monta a cruz).
 * A chave de cada cor é a face onde fica o centro dessa cor.
 */
/** cor com nome nos dois idiomas (o português também é a referência da câmera) */
export const color = (key: string, pt: string, en: string, hex: string): ColorInfo => ({
  key,
  ref: pt,
  hex,
  get name() {
    return tr(pt, en);
  },
});

export const CUBE3_COLORS: ColorInfo[] = [
  color('U', 'amarelo', 'yellow', '#ffd500'),
  color('R', 'laranja', 'orange', '#ff6a13'),
  color('F', 'verde', 'green', '#00a651'),
  color('D', 'branco', 'white', '#f4f6f8'),
  color('L', 'vermelho', 'red', '#d0192d'),
  color('B', 'azul', 'blue', '#0a5bd6'),
];

/** nome da cor por chave, no idioma atual */
export const COLOR_NAME: Record<string, string> = i18nMap({
  U: ['amarelo', 'yellow'],
  R: ['laranja', 'orange'],
  F: ['verde', 'green'],
  D: ['branco', 'white'],
  L: ['vermelho', 'red'],
  B: ['azul', 'blue'],
});
export const COLOR_HEX: Record<string, string> = Object.fromEntries(CUBE3_COLORS.map((c) => [c.key, c.hex]));

export const FACE_NAME: Record<string, string> = i18nMap({
  U: ['Cima', 'Up'],
  D: ['Baixo', 'Down'],
  F: ['Frente', 'Front'],
  B: ['Trás', 'Back'],
  R: ['Direita', 'Right'],
  L: ['Esquerda', 'Left'],
});
