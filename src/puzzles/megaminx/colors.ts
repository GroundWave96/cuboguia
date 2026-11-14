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

type RGB3 = [number, number, number];
/** hex = cor desenhada no site; camera = como aparece na câmera (medido em fotos, boa luz) */
const NORMAL: Record<string, { name: string; hex: string; camera: RGB3 }> = {
  U: { name: 'cinza', hex: '#8b919c', camera: [141, 144, 161] },
  F: { name: 'verde-claro', hex: '#8ee05a', camera: [120, 207, 1] },
  R: { name: 'rosa', hex: '#ff8ad8', camera: [254, 56, 154] },
  BR: { name: 'bege', hex: '#f1dca0', camera: [239, 223, 149] },
  BL: { name: 'azul-claro', hex: '#6ec6f5', camera: [63, 153, 231] },
  L: { name: 'laranja', hex: '#ff7a1a', camera: [254, 100, 3] },
  DR: { name: 'azul-escuro', hex: '#1d4fc4', camera: [0, 93, 216] },
  DBR: { name: 'vermelho', hex: '#d0192d', camera: [238, 0, 26] },
  B: { name: 'verde-escuro', hex: '#0f8a3c', camera: [0, 215, 41] },
  DBL: { name: 'roxo', hex: '#7b3fe4', camera: [71, 4, 81] },
  DL: { name: 'amarelo', hex: '#f2c400', camera: [248, 211, 4] },
  D: { name: 'branco', hex: '#f4f6f8', camera: [207, 210, 226] },
};
/** versão espelhada: troca direita ↔ esquerda mantendo a frente */
const SWAP: Record<string, string> = { R: 'L', L: 'R', BR: 'BL', BL: 'BR', DR: 'DL', DL: 'DR', DBR: 'DBL', DBL: 'DBR' };
const SCHEME = MIRROR ? Object.fromEntries(Object.keys(NORMAL).map((k) => [k, NORMAL[SWAP[k] ?? k]])) : NORMAL;

export const MEGA_COLORS: ColorInfo[] = ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'D'].map((key) => ({
  key,
  name: SCHEME[key].name,
  hex: SCHEME[key].hex,
  camera: SCHEME[key].camera,
}));
export const MEGA_COLOR_NAME: Record<string, string> = Object.fromEntries(MEGA_COLORS.map((c) => [c.key, c.name]));
export const MEGA_COLOR_HEX: Record<string, string> = Object.fromEntries(MEGA_COLORS.map((c) => [c.key, c.hex]));
