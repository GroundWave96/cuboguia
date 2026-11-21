import { tr } from '../../core/i18n';
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
const NORMAL: Record<string, { name: string; en: string; es: string; hex: string; camera: RGB3 }> = {
  U: { name: 'cinza', en: 'gray', es: 'gris', hex: '#8b919c', camera: [132, 137, 143] },
  F: { name: 'verde-claro', en: 'light green', es: 'verde claro', hex: '#8ee05a', camera: [127, 202, 6] },
  R: { name: 'rosa', en: 'pink', es: 'rosa', hex: '#ff8ad8', camera: [245, 76, 154] },
  BR: { name: 'bege', en: 'beige', es: 'beige', hex: '#f1dca0', camera: [221, 212, 139] },
  BL: { name: 'azul-claro', en: 'light blue', es: 'azul claro', hex: '#6ec6f5', camera: [82, 156, 218] },
  L: { name: 'laranja', en: 'orange', es: 'naranja', hex: '#ff7a1a', camera: [245, 105, 18] },
  DR: { name: 'azul-escuro', en: 'dark blue', es: 'azul oscuro', hex: '#1d4fc4', camera: [7, 107, 215] },
  DBR: { name: 'vermelho', en: 'red', es: 'rojo', hex: '#d0192d', camera: [218, 16, 30] },
  B: { name: 'verde-escuro', en: 'dark green', es: 'verde oscuro', hex: '#0f8a3c', camera: [42, 204, 45] },
  DBL: { name: 'roxo', en: 'purple', es: 'morado', hex: '#7b3fe4', camera: [85, 15, 95] },
  DL: { name: 'amarelo', en: 'yellow', es: 'amarillo', hex: '#f2c400', camera: [239, 216, 20] },
  D: { name: 'branco', en: 'white', es: 'blanco', hex: '#f4f6f8', camera: [204, 209, 215] },
};
/** versão espelhada: troca direita ↔ esquerda mantendo a frente */
const SWAP: Record<string, string> = { R: 'L', L: 'R', BR: 'BL', BL: 'BR', DR: 'DL', DL: 'DR', DBR: 'DBL', DBL: 'DBR' };
const SCHEME = MIRROR ? Object.fromEntries(Object.keys(NORMAL).map((k) => [k, NORMAL[SWAP[k] ?? k]])) : NORMAL;

export const MEGA_COLORS: ColorInfo[] = ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'D'].map((key) => ({
  key,
  ref: SCHEME[key].name,
  get name() {
    return tr(SCHEME[key].name, SCHEME[key].en, SCHEME[key].es);
  },
  hex: SCHEME[key].hex,
  camera: SCHEME[key].camera,
}));
/** nome da cor por chave, no idioma atual */
export const MEGA_COLOR_NAME: Record<string, string> = Object.fromEntries(MEGA_COLORS.map((c) => [c.key, '']));
for (const c of MEGA_COLORS) Object.defineProperty(MEGA_COLOR_NAME, c.key, { enumerable: true, get: () => c.name });
export const MEGA_COLOR_HEX: Record<string, string> = Object.fromEntries(MEGA_COLORS.map((c) => [c.key, c.hex]));
