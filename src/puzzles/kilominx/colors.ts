import { tr } from '../../core/i18n';
import type { ColorInfo } from '../../core/types';

/**
 * As 12 cores do Kilominx: o mesmo esquema do Megaminx (branco oposto ao cinza e cada cor
 * oposta à sua versão clara), conferido nas fotos (as cores vizinhas e o sentido delas).
 * As chaves são as faces onde cada cor fica quando o puzzle está montado com o CINZA em cima,
 * o BRANCO embaixo e o VERDE-CLARO de frente.
 *
 * hex = cor desenhada (plástico colorido, sem adesivo); camera = como aparece nas fotos de
 * nov/2026 (média das pipas de cada cor, luz de casa; tests/cube images/kibiminx).
 */
type RGB3 = [number, number, number];
const SCHEME: Record<string, { name: string; en: string; es: string; hex: string; camera: RGB3 }> = {
  U: { name: 'cinza', en: 'gray', es: 'gris', hex: '#a4a8b0', camera: [149, 148, 150] },
  F: { name: 'verde-claro', en: 'light green', es: 'verde claro', hex: '#b5dd2a', camera: [171, 213, 42] },
  R: { name: 'rosa', en: 'pink', es: 'rosa', hex: '#f27cba', camera: [238, 120, 178] },
  BR: { name: 'bege', en: 'beige', es: 'beige', hex: '#f2e4a8', camera: [233, 221, 157] },
  BL: { name: 'azul-claro', en: 'light blue', es: 'azul claro', hex: '#6cb6ec', camera: [104, 170, 222] },
  L: { name: 'laranja', en: 'orange', es: 'naranja', hex: '#ff9431', camera: [249, 145, 48] },
  DR: { name: 'azul', en: 'blue', es: 'azul', hex: '#2677d6', camera: [33, 114, 198] },
  DBR: { name: 'vermelho', en: 'red', es: 'rojo', hex: '#e8413a', camera: [230, 62, 51] },
  B: { name: 'verde', en: 'green', es: 'verde', hex: '#5fd166', camera: [110, 210, 99] },
  DBL: { name: 'roxo', en: 'purple', es: 'morado', hex: '#7444b6', camera: [100, 61, 127] },
  DL: { name: 'amarelo', en: 'yellow', es: 'amarillo', hex: '#f6dc3a', camera: [239, 221, 68] },
  D: { name: 'branco', en: 'white', es: 'blanco', hex: '#f3f3ee', camera: [232, 230, 219] },
};

export const KILO_COLORS: ColorInfo[] = ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'D'].map((key) => ({
  key,
  ref: SCHEME[key].name,
  get name() {
    return tr(SCHEME[key].name, SCHEME[key].en, SCHEME[key].es);
  },
  hex: SCHEME[key].hex,
  camera: SCHEME[key].camera,
}));
/** nome da cor por chave, no idioma atual */
export const KILO_COLOR_NAME: Record<string, string> = Object.fromEntries(KILO_COLORS.map((c) => [c.key, '']));
for (const c of KILO_COLORS) Object.defineProperty(KILO_COLOR_NAME, c.key, { enumerable: true, get: () => c.name });
export const KILO_COLOR_HEX: Record<string, string> = Object.fromEntries(KILO_COLORS.map((c) => [c.key, c.hex]));
