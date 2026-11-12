import type { ColorInfo } from '../../core/types';

/**
 * Esquema de cores padrão, segurando o cubo com AMARELO em cima e VERDE na frente
 * (assim o branco fica embaixo, que é onde o método de iniciante monta a cruz).
 * A chave de cada cor é a face onde fica o centro dessa cor.
 */
export const CUBE3_COLORS: ColorInfo[] = [
  { key: 'U', name: 'amarelo', hex: '#ffd500' },
  { key: 'R', name: 'laranja', hex: '#ff6a13' },
  { key: 'F', name: 'verde', hex: '#00a651' },
  { key: 'D', name: 'branco', hex: '#f4f6f8' },
  { key: 'L', name: 'vermelho', hex: '#d0192d' },
  { key: 'B', name: 'azul', hex: '#0a5bd6' },
];

export const COLOR_NAME: Record<string, string> = Object.fromEntries(CUBE3_COLORS.map((c) => [c.key, c.name]));
export const COLOR_HEX: Record<string, string> = Object.fromEntries(CUBE3_COLORS.map((c) => [c.key, c.hex]));

export const FACE_NAME: Record<string, string> = {
  U: 'Cima',
  D: 'Baixo',
  F: 'Frente',
  B: 'Trás',
  R: 'Direita',
  L: 'Esquerda',
};
