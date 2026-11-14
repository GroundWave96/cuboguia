/**
 * Leitura de cores da câmera que se adapta à luz e ao puzzle.
 *
 *  - Cada cor tem uma aparência típica na câmera (medida em fotos reais, com boa luz).
 *  - Os CENTROS capturados têm cor conhecida: viram referência da própria cor e dizem
 *    o quanto a cena está clara ou escura ("exposição"). Com isso, as cores que ainda
 *    não apareceram em nenhum centro são comparadas já na luz certa — é o que separa
 *    vermelho de laranja numa sala escura (o laranja é sempre ~2× mais claro).
 *  - Centro com logo (comum no branco): basta parte dele ter a cor esperada.
 */
import { balancedAssign, classifyCubeColor, colorDist, hexToRgb, rgbToHsv, rgbToLab, type Lab, type RGB } from './color';
import type { ColorInfo } from './types';

/** aparência típica das cores do cubo padrão numa câmera de celular com boa luz */
const CUBE_CAMERA: Record<string, RGB> = {
  amarelo: [220, 215, 55],
  laranja: [245, 115, 50],
  verde: [70, 175, 70],
  branco: [200, 200, 190],
  vermelho: [175, 40, 35],
  azul: [30, 105, 175],
};

export const baseRgb = (c: ColorInfo): RGB => (c.camera as RGB | undefined) ?? CUBE_CAMERA[c.name] ?? hexToRgb(c.hex);

/** brilho percebido (0..255) */
const lum = ([r, g, b]: RGB) => 0.299 * r + 0.587 * g + 0.114 * b;
const mean = (xs: RGB[]): RGB => {
  const s = xs.reduce((a, x) => [a[0] + x[0], a[1] + x[1], a[2] + x[2]], [0, 0, 0]);
  return [s[0] / xs.length, s[1] / xs.length, s[2] / xs.length];
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

export class ColorModel {
  private readonly base: Map<string, RGB>;
  /** amostras de cor conhecida, por origem (ex.: "face 3") — recapturar substitui */
  private readonly learned = new Map<string, { key: string; rgb: RGB }>();
  private refCache: { key: string; lab: Lab }[] | null = null;
  private expCache = 0;

  constructor(
    readonly colors: ColorInfo[],
    private readonly kind: 'hue6' | 'nearest' = 'nearest',
  ) {
    this.base = new Map(colors.map((c) => [c.key, baseRgb(c)]));
  }

  learn(source: string, key: string, rgb: RGB | null) {
    if (rgb) this.learned.set(source, { key, rgb });
    else this.learned.delete(source);
    this.refCache = null;
    this.expCache = 0;
  }

  isLearned(key: string) {
    return [...this.learned.values()].some((l) => l.key === key);
  }

  get learnedCount() {
    return new Set([...this.learned.values()].map((l) => l.key)).size;
  }

  /** quanto a cena está mais escura (<1) ou clara (>1) que a luz de referência */
  exposure(): number {
    if (this.expCache) return this.expCache;
    const ratios = [...this.learned.values()].map((l) => lum(l.rgb) / Math.max(1, lum(this.base.get(l.key)!)));
    this.expCache = ratios.length ? Math.min(2, Math.max(0.05, median(ratios))) : 1;
    return this.expCache;
  }

  /** amostra trazida para a luz de referência */
  norm(rgb: RGB): RGB {
    const e = this.exposure();
    // sem limitar em 255: numa foto escura, uma cor clara "estourada" perderia a diferença
    return [rgb[0] / e, rgb[1] / e, rgb[2] / e];
  }

  refs(): { key: string; lab: Lab }[] {
    if (this.refCache) return this.refCache;
    const byKey = new Map<string, RGB[]>();
    for (const l of this.learned.values()) byKey.set(l.key, [...(byKey.get(l.key) ?? []), this.norm(l.rgb)]);
    this.refCache = this.colors.map((c) => ({ key: c.key, lab: rgbToLab(byKey.has(c.key) ? mean(byKey.get(c.key)!) : this.base.get(c.key)!) }));
    return this.refCache;
  }

  classify(rgb: RGB): string {
    const n = this.norm(rgb);
    // sem nenhuma referência ainda, o matiz é o mais seguro para as 6 cores padrão
    if (this.kind === 'hue6' && this.learnedCount === 0) {
      const name = classifyCubeColor(n);
      const c = this.colors.find((x) => x.name === name);
      if (c) return c.key;
    }
    return nearestKey(rgbToLab(n), this.refs());
  }

  /**
   * O centro mostra a cor esperada? Aceita centro com logo: se a cor esperada é clara e
   * sem cor (branco/cinza), basta uma parte boa do centro ter essa cor.
   */
  centerMatches(median: RGB, pixels: RGB[] | undefined, expected: string): boolean {
    // centro com logo: o fundo (branco/cinza) decide, não a mistura de cores do logo
    const logo = this.logoColor(pixels);
    if (logo) return logo === expected;
    return this.classify(median) === expected;
  }

  /** cores claras e sem saturação (branco, cinza): as que costumam levar logo */
  private plainKeys() {
    return this.colors.filter((c) => rgbToHsv(this.base.get(c.key)!).s <= 0.3).map((c) => c.key);
  }

  /** pixels do "fundo" de um centro com logo, na cor `key` (só os claros contam) */
  private plainHits(pixels: RGB[], key: string): RGB[] {
    // claro em relação ao próprio centro: o preto entre os adesivos não conta
    const lums = pixels.map(lum).sort((a, b) => a - b);
    const bright = lums[Math.floor(lums.length * 0.9)] * 0.6;
    return pixels.filter((p) => lum(p) >= bright && this.classify(p) === key);
  }

  /** o centro parece ter um logo sobre fundo branco/cinza? devolve a cor do fundo */
  logoColor(pixels: RGB[] | undefined): string | null {
    if (!pixels?.length) return null;
    let best: string | null = null, bestN = 0;
    for (const k of this.plainKeys()) {
      const n = this.plainHits(pixels, k).length;
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    // fundo claro em boa parte do centro, mas com outras cores no meio (o logo)
    return best && bestN >= pixels.length * 0.3 && bestN < pixels.length * 0.92 ? best : null;
  }

  /** cor média do fundo de um centro com logo (para aprender a cor), ou null */
  logoPart(pixels: RGB[] | undefined, expected: string): RGB | null {
    if (!pixels?.length || this.logoColor(pixels) !== expected) return null;
    return mean(this.plainHits(pixels, expected));
  }
}

function nearestKey(sample: Lab, refs: { key: string; lab: Lab }[]): string {
  let best = refs[0].key, bd = Infinity;
  for (const r of refs) {
    const d = colorDist(sample, r.lab);
    if (d < bd) {
      bd = d;
      best = r.key;
    }
  }
  return best;
}

/**
 * Cor final de todos os adesivos: cada cor aparece exatamente `perColor` vezes.
 * Começa das referências aprendidas (centros) e do palpite de cada adesivo, e refina.
 */
export function assignAll(model: ColorModel, samples: RGB[], perColor: number, fixed: Map<number, string>): string[] {
  const labs = samples.map((s) => rgbToLab(model.norm(s)));
  const guess = samples.map((s) => model.classify(s));
  const refs = model.refs().map((r) => {
    const members = labs.filter((_, i) => !fixed.has(i) && guess[i] === r.key);
    if (model.isLearned(r.key)) return r;
    if (!members.length) return r;
    const m = members.reduce((a, l) => [a[0] + l[0], a[1] + l[1], a[2] + l[2]] as Lab, [0, 0, 0] as Lab);
    return { key: r.key, lab: [m[0] / members.length, m[1] / members.length, m[2] / members.length] as Lab };
  });
  return balancedAssign(labs, refs, perColor, fixed);
}
