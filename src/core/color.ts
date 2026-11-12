export type RGB = [number, number, number];
export type Lab = [number, number, number];

function srgbToLinear(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToLab([r, g, b]: RGB): Lab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * Distância entre cores dando mais peso ao matiz/saturação do que ao brilho,
 * porque a iluminação da câmera muda muito o brilho (sombra, reflexo).
 */
export function colorDist(a: Lab, b: Lab): number {
  const dL = (a[0] - b[0]) * 0.55;
  return Math.hypot(dL, a[1] - b[1], a[2] - b[2]);
}

export function hexToRgb(hex: string): RGB {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export const rgbCss = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;

/**
 * Atribui uma cor a cada amostra garantindo que cada cor seja usada exatamente
 * `perColor` vezes (guloso pelas menores distâncias), refinando com as médias.
 */
export function balancedAssign(
  samples: Lab[],
  refs: { key: string; lab: Lab }[],
  perColor: number,
  fixed: Map<number, string> = new Map(),
): string[] {
  let centers = refs.map((r) => ({ ...r }));
  let result: string[] = [];
  for (let iter = 0; iter < 3; iter++) {
    const out = new Array<string>(samples.length).fill('');
    const count = new Map(centers.map((c) => [c.key, 0]));
    for (const [i, k] of fixed) {
      out[i] = k;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    const pairs: { i: number; k: string; d: number }[] = [];
    samples.forEach((s, i) => {
      if (fixed.has(i)) return;
      for (const c of centers) pairs.push({ i, k: c.key, d: colorDist(s, c.lab) });
    });
    pairs.sort((a, b) => a.d - b.d);
    for (const p of pairs) {
      if (out[p.i] || (count.get(p.k) ?? 0) >= perColor) continue;
      out[p.i] = p.k;
      count.set(p.k, (count.get(p.k) ?? 0) + 1);
    }
    result = out;
    // recalcula o centro de cada cor como a média das amostras atribuídas
    centers = centers.map((c) => {
      const members = samples.filter((_, i) => out[i] === c.key);
      if (!members.length) return c;
      const m = members.reduce((acc, l) => [acc[0] + l[0], acc[1] + l[1], acc[2] + l[2]] as Lab, [0, 0, 0] as Lab);
      return { key: c.key, lab: [m[0] / members.length, m[1] / members.length, m[2] / members.length] as Lab };
    });
  }
  return result;
}

export function nearest(sample: Lab, refs: { key: string; lab: Lab }[]): string {
  let best = refs[0].key;
  let bd = Infinity;
  for (const r of refs) {
    const d = colorDist(sample, r.lab);
    if (d < bd) {
      bd = d;
      best = r.key;
    }
  }
  return best;
}
