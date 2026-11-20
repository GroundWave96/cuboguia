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
/**
 * hex = cor desenhada no site; camera = como aparece na câmera (boa luz). As cores da câmera
 * são a média de dois Megaminx de fábricas diferentes (fotos de 2026, lotes 1 e 2): cada
 * puzzle tem um tom, e a média serve para os dois até os centros serem aprendidos.
 */
const NORMAL: Record<string, { name: string; hex: string; camera: RGB3 }> = {
  U: { name: 'cinza', hex: '#8b919c', camera: [132, 137, 143] },
  F: { name: 'verde-claro', hex: '#8ee05a', camera: [127, 202, 6] },
  R: { name: 'rosa', hex: '#ff8ad8', camera: [245, 76, 154] },
  BR: { name: 'bege', hex: '#f1dca0', camera: [221, 212, 139] },
  BL: { name: 'azul-claro', hex: '#6ec6f5', camera: [82, 156, 218] },
  L: { name: 'laranja', hex: '#ff7a1a', camera: [245, 105, 18] },
  DR: { name: 'azul-escuro', hex: '#1d4fc4', camera: [7, 107, 215] },
  DBR: { name: 'vermelho', hex: '#d0192d', camera: [218, 16, 30] },
  B: { name: 'verde-escuro', hex: '#0f8a3c', camera: [42, 204, 45] },
  DBL: { name: 'roxo', hex: '#7b3fe4', camera: [85, 15, 95] },
  DL: { name: 'amarelo', hex: '#f2c400', camera: [239, 216, 20] },
  D: { name: 'branco', hex: '#f4f6f8', camera: [204, 209, 215] },
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
