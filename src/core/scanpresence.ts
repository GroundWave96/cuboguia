/**
 * Tem um puzzle na grade da câmera? (para a captura automática não contar à toa)
 *
 * Dois sinais baratos, calibrados com fotos reais (tests/cube images):
 *  1. Entre duas células vizinhas existe uma faixa mais escura (o plástico preto
 *     entre os adesivos, a fresta entre as peças) OU, nos puzzles sem adesivo, a cor
 *     muda de uma vez (degrau brusco), e não aos poucos como num rosto ou parede.
 *  2. Cada célula tem cor lisa por dentro (adesivo/plástico); tecido, cabelo,
 *     madeira e pele têm textura.
 * Nas fotos: 29 de 29 faces de puzzle aceitas e 0 de 24 pedaços de fundo
 * (parede, chão, mão, cobertor xadrez).
 */
type Pt = [number, number];
type Rgb = [number, number, number];
type RgbAt = (x: number, y: number) => Rgb;
const lumOf = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/** limites calibrados nas fotos */
const GAP_RATIO = 0.9; // a faixa é pelo menos 10% mais escura que a célula mais escura do par
const GAP_DIFF = 3; // ...e pelo menos 3 níveis (0–255) mais escura
const GAP_NEED = 0.67; // fração das fronteiras com faixa escura
const FLAT_ABS = 10; // espalhamento (quartis) máximo dentro de uma célula lisa
const FLAT_REL = 0.15;
const FLAT_NEED = 0.7; // fração das células lisas
const STEP_MIN = 15; // degrau mínimo entre as duas cores (puzzles sem adesivo)
const STEP_SHARP = 0.6; // fração do degrau que acontece em poucos pixels

/**
 * Puzzles sem adesivo (peças inteiras coloridas) quase não têm fresta escura entre
 * cores diferentes: a cor muda de uma vez. Rosto, parede e sombra mudam aos poucos.
 */
function sharpStep(ax: number, ay: number, bx: number, by: number, steps: number, rgbAt: RgbAt): boolean {
  // pela COR, não só pelo brilho: vermelho e azul, por exemplo, têm brilho parecido
  const p: Rgb[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = 0.2 + (0.6 * k) / steps;
    p.push(rgbAt(ax + (bx - ax) * t, ay + (by - ay) * t));
  }
  const dist = (u: Rgb, v: Rgb) => (Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) + Math.abs(u[2] - v[2])) / 2;
  const q = Math.max(2, Math.floor(p.length / 4));
  const med = (a: Rgb[]): Rgb => [0, 1, 2].map((c) => [...a].map((x) => x[c]).sort((x, y) => x - y)[a.length >> 1]) as Rgb;
  const jump = dist(med(p.slice(0, q)), med(p.slice(-q)));
  if (jump < STEP_MIN) return false;
  let sharp = 0;
  for (let k = 0; k + 3 < p.length; k++) sharp = Math.max(sharp, dist(p[k + 3], p[k]));
  return sharp >= STEP_SHARP * jump;
}

/** pares de células vizinhas (pelos centros: as mais próximas entre si) */
export function cellNeighbors(centers: Pt[]): [number, number][] {
  const n = centers.length;
  const dist = (i: number, j: number) => Math.hypot(centers[i][0] - centers[j][0], centers[i][1] - centers[j][1]);
  const nn = centers.map((_, i) => Math.min(...centers.map((__, j) => (j === i ? Infinity : dist(i, j)))));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (dist(i, j) < 1.3 * nn[i] && dist(i, j) < 1.3 * nn[j]) out.push([i, j]);
  return out;
}

/** a célula é lisa? (pelos brilhos dos pixels amostrados nela) */
export function isFlat(lums: number[]): boolean {
  const v = [...lums].sort((a, b) => a - b);
  const q1 = v[v.length >> 2], q2 = v[v.length >> 1], q3 = v[(3 * v.length) >> 2];
  return q3 - q1 <= Math.max(FLAT_ABS, FLAT_REL * q2);
}

/**
 * @param centers   centro de cada célula, em pixels
 * @param flat      se cada célula é lisa
 * @param rgbAt     cor de um pixel
 */
export function puzzleInView(
  centers: Pt[],
  pairs: [number, number][],
  flat: boolean[],
  rgbAt: RgbAt,
): boolean {
  const lumAt = (x: number, y: number) => lumOf(rgbAt(x, y));
  if (!pairs.length) return true;
  if (flat.filter(Boolean).length < FLAT_NEED * flat.length) return false;
  let dark = 0;
  for (const [i, j] of pairs) {
    const [ax, ay] = centers[i], [bx, by] = centers[j];
    // percorre o trecho do meio entre os dois centros, pixel a pixel, em 3 linhas
    // paralelas (a fresta dos puzzles sem adesivo tem 1–2 px e pode estar torta)
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(8, Math.round(len * 0.6));
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    // fresta: um vale estreito no meio do caminho, mais escuro que o que está logo
    // ao lado dele (vale também quando uma das peças está na sombra)
    let seam = false;
    for (const off of [-2, 0, 2]) {
      const p: number[] = [];
      for (let k = 0; k <= steps; k++) {
        const t = 0.2 + (0.6 * k) / steps;
        p.push(lumAt(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off));
      }
      let km = 0;
      for (let k = 1; k < p.length; k++) if (p[k] < p[km]) km = k;
      const side = (from: number, to: number) => Math.max(...p.slice(Math.max(0, from), Math.max(0, Math.min(p.length, to))), -Infinity);
      const around = Math.min(side(km - 8, km - 1), side(km + 2, km + 9));
      if (Number.isFinite(around) && p[km] <= GAP_RATIO * around && around - p[km] >= GAP_DIFF) seam = true;
    }
    if (seam || sharpStep(ax, ay, bx, by, steps, rgbAt)) dark++;
  }
  // com poucas fronteiras (2x2: só 4), uma só "de sorte" já faria passar: exige todas
  return pairs.length <= 4 ? dark === pairs.length : dark >= GAP_NEED * pairs.length;
}
