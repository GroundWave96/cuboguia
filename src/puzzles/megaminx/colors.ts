import type { ColorInfo } from '../../core/types';

/**
 * Esquema padrão de 12 cores: branco oposto ao cinza; em volta do branco
 * amarelo, azul-escuro, vermelho, verde-escuro e roxo; cada um oposto à sua
 * versão clara (bege, azul-claro, laranja, verde-claro, rosa).
 *
 * Segurando com o CINZA em cima, BRANCO embaixo e VERDE-CLARO de frente.
 * Se o seu megaminx tiver o sentido das cores invertido (espelhado), troque
 * MIRROR para true.
 */
const MIRROR = false;

const NORMAL: Record<string, { name: string; hex: string }> = {
  U: { name: 'cinza', hex: '#8b919c' },
  F: { name: 'verde-claro', hex: '#8ee05a' },
  R: { name: 'rosa', hex: '#ff8ad8' },
  BR: { name: 'bege', hex: '#f1dca0' },
  BL: { name: 'azul-claro', hex: '#6ec6f5' },
  L: { name: 'laranja', hex: '#ff7a1a' },
  DR: { name: 'azul-escuro', hex: '#1d4fc4' },
  DBR: { name: 'vermelho', hex: '#d0192d' },
  B: { name: 'verde-escuro', hex: '#0f8a3c' },
  DBL: { name: 'roxo', hex: '#7b3fe4' },
  DL: { name: 'amarelo', hex: '#f2c400' },
  D: { name: 'branco', hex: '#f4f6f8' },
};
/** versão espelhada: troca direita ↔ esquerda mantendo a frente */
const SWAP: Record<string, string> = { R: 'L', L: 'R', BR: 'BL', BL: 'BR', DR: 'DL', DL: 'DR', DBR: 'DBL', DBL: 'DBR' };
const SCHEME = MIRROR ? Object.fromEntries(Object.keys(NORMAL).map((k) => [k, NORMAL[SWAP[k] ?? k]])) : NORMAL;

export const MEGA_COLORS: ColorInfo[] = ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'D'].map((key) => ({
  key,
  name: SCHEME[key].name,
  hex: SCHEME[key].hex,
}));
export const MEGA_COLOR_NAME: Record<string, string> = Object.fromEntries(MEGA_COLORS.map((c) => [c.key, c.name]));
export const MEGA_COLOR_HEX: Record<string, string> = Object.fromEntries(MEGA_COLORS.map((c) => [c.key, c.hex]));
