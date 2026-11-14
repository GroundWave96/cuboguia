import { describe, expect, it } from 'vitest';
import { cellNeighbors, isFlat, puzzleInView } from '../src/core/scanpresence';
import pyraminx from '../src/puzzles/pyraminx';
import megaminx from '../src/puzzles/megaminx';
import cube3 from '../src/puzzles/cube3';

type Pt = [number, number];
const SIZE = 300;

/** "imagem" sintética: brilho por pixel */
function scene(paint: (x: number, y: number) => number) {
  return (x: number, y: number): [number, number, number] => {
    const v = paint(Math.round(x), Math.round(y));
    return [v, v, v];
  };
}
/** ponto dentro de polígono */
const inside = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if (poly[i][1] > p[1] !== poly[j][1] > p[1] && p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c;
  return c;
};
/** encolhe o polígono em direção ao centro (abre a fresta preta) */
const shrink = (poly: Pt[], k: number): Pt[] => {
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
};

function check(cells: { poly: Pt[]; center: Pt; r?: number }[], lumOf: (x: number, y: number) => number) {
  const centers = cells.map((c): Pt => [c.center[0] * SIZE, c.center[1] * SIZE]);
  const pairs = cellNeighbors(cells.map((c) => c.center));
  const half = 6;
  const cellPx = centers.map(([cx, cy]) => {
    const v: number[] = [];
    for (let dx = -half; dx <= half; dx++) for (let dy = -half; dy <= half; dy++) v.push(lumOf(cx + dx, cy + dy));
    return v;
  });
  return puzzleInView(centers, pairs, cellPx.map(isFlat), scene(lumOf));
}

const layouts: [string, { poly: Pt[]; center: Pt }[]][] = [
  ['3x3', (() => {
    // mesma grade da câmera do cubo
    const out: { poly: Pt[]; center: Pt }[] = [];
    const x0 = 0.17, cs = 0.22;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = x0 + c * cs, y = x0 + r * cs;
      out.push({ poly: [[x, y], [x + cs, y], [x + cs, y + cs], [x, y + cs]], center: [x + cs / 2, y + cs / 2] });
    }
    return out;
  })()],
  ['pyraminx', pyraminx.scan[0].cells as { poly: Pt[]; center: Pt }[]],
  ['megaminx', megaminx.scan[0].cells as { poly: Pt[]; center: Pt }[]],
];

describe('câmera — tem um puzzle na grade?', () => {
  for (const [name, cells] of layouts) {
    it(`${name}: peças com fresta escura → sim`, () => {
      const colors = [200, 120, 60, 170, 90, 230, 140, 75, 185, 110, 160];
      const lum = (x: number, y: number) => {
        const k = cells.findIndex((c) => inside([x / SIZE, y / SIZE], shrink(c.poly, 0.9)));
        return k < 0 ? 25 : colors[k % colors.length];
      };
      expect(check(cells, lum)).toBe(true);
    });
    it(`${name}: parede lisa → não`, () => expect(check(cells, () => 180)).toBe(false));
    it(`${name}: textura (tecido, cabelo) → não`, () => {
      const lum = (x: number, y: number) => 120 + 60 * Math.sin(x * 1.7) * Math.cos(y * 2.3);
      expect(check(cells, lum)).toBe(false);
    });
    it(`${name}: degradê suave (rosto, sombra) → não`, () => expect(check(cells, (x, y) => 60 + x * 0.4 + y * 0.2)).toBe(false));
  }
  it('o 3x3 da câmera tem 12 fronteiras entre células vizinhas', () => {
    void cube3;
    expect(cellNeighbors(layouts[0][1].map((c) => c.center)).length).toBe(12);
  });
});
