import { describe, expect, it } from 'vitest';
import pyraminx from '../src/puzzles/pyraminx';
import megaminx from '../src/puzzles/megaminx';
import { pyraGeo } from '../src/puzzles/pyraminx/geometry';
import { megaGeo } from '../src/puzzles/megaminx/geometry';
import type { PuzzleImpl } from '../src/core/types';

type V3 = [number, number, number];
const d3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** cada marca fica ao lado do adesivo (da face lida) que encosta nela de verdade, no 3D */
function check(impl: PuzzleImpl, centroid: (i: number) => V3, perFace: number) {
  let n = 0;
  for (const face of impl.scan) {
    const ids = face.grid.flat();
    expect(face.neighborMarks?.length).toBeGreaterThan(0);
    for (const m of face.neighborMarks!) {
      n++;
      expect(ids).not.toContain(m.sticker);
      const mid = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2];
      // célula da tela mais perto da marca
      let k2 = 0, bd = Infinity;
      face.cells!.forEach((c, k) => {
        const d = Math.hypot(c.center[0] - mid[0], c.center[1] - mid[1]);
        if (d < bd) { bd = d; k2 = k; }
      });
      // adesivo da face lida mais perto, no 3D, do adesivo vizinho
      let k3 = 0, bd3 = Infinity;
      ids.forEach((id, k) => {
        const d = d3(centroid(id), centroid(m.sticker));
        if (d < bd3) { bd3 = d; k3 = k; }
      });
      expect(k2).toBe(k3);
    }
  }
  expect(n).toBe(impl.scan.length * perFace);
}

describe('câmera — cores da face vizinha nas bordas', () => {
  it('pyraminx: 3 por borda, cada uma ao lado da peça certa', () => check(pyraminx, (i) => pyraGeo.stickers[i].centroid, 9));
  it('megaminx: 3 por borda, cada uma ao lado da peça certa', () => check(megaminx, (i) => megaGeo.stickers[i].centroid as V3, 15));
});
