/**
 * Marcas da câmera com as cores JÁ CAPTURADAS da face vizinha, encostadas em cada borda
 * da face que está sendo lida — como no 2x2: ao girar o puzzle, a borda da nova face
 * mostra o que você acabou de ver ao lado, então fica claro para onde girar.
 */
type V3 = [number, number, number];
type P = [number, number];

export interface NeighborMark {
  /** adesivo (da face vizinha) cuja cor capturada é desenhada */
  sticker: number;
  /** índice da borda da face (para esconder a marca fixa daquela borda) */
  edge: number;
  a: P;
  b: P;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * @param verts3   vértices 3D da face, na mesma ordem de `verts2`
 * @param verts2   os mesmos vértices no quadro da câmera (0..1)
 * @param neighborStickers para a borda i (verts[i] → verts[i+1]): adesivos da face vizinha
 * @param perEdge  quantos adesivos encostam em cada borda
 * @param offset   distância da marca para fora da borda (fração do quadro)
 */
export function neighborMarks(
  verts3: V3[],
  verts2: P[],
  neighborStickers: (edge: number) => { index: number; centroid: V3 }[],
  perEdge = 3,
  offset = 0.045,
): NeighborMark[] {
  const n = verts2.length;
  const cx = verts2.reduce((a, p) => a + p[0], 0) / n, cy = verts2.reduce((a, p) => a + p[1], 0) / n;
  const out: NeighborMark[] = [];
  for (let i = 0; i < n; i++) {
    const A = verts3[i], B = verts3[(i + 1) % n];
    const AB = sub(B, A);
    const L2 = dot(AB, AB);
    // os adesivos da vizinha mais perto desta borda, com a posição ao longo dela
    const cand = neighborStickers(i)
      .map((s) => {
        const t = dot(sub(s.centroid, A), AB) / L2;
        const foot: V3 = [A[0] + AB[0] * t, A[1] + AB[1] * t, A[2] + AB[2] * t];
        const d = Math.hypot(...sub(s.centroid, foot)) + (t < 0 || t > 1 ? 10 : 0);
        return { index: s.index, t, d };
      })
      .sort((x, y) => x.d - y.d)
      .slice(0, perEdge)
      .sort((x, y) => x.t - y.t);
    const a2 = verts2[i], b2 = verts2[(i + 1) % n];
    const mx = (a2[0] + b2[0]) / 2 - cx, my = (a2[1] + b2[1]) / 2 - cy;
    const ml = Math.hypot(mx, my) || 1;
    const push = (p: P): P => [p[0] + (mx / ml) * offset, p[1] + (my / ml) * offset];
    // cada adesivo ganha um trecho da borda, centrado na posição dele
    const half = 0.5 / perEdge - 0.06;
    for (const c of cand) out.push({ sticker: c.index, edge: i, a: push(lerp(a2, b2, Math.max(0.02, c.t - half))), b: push(lerp(a2, b2, Math.min(0.98, c.t + half))) });
  }
  return out;
}
