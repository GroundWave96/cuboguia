/** Corte de poliedros convexos por planos (para montar as peças de puzzles poligonais). */
export type V3 = [number, number, number];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** corta um polígono convexo, mantendo o lado sign*(dot(p,n) - c) >= 0 */
function clipPolygon(poly: V3[], n: V3, c: number, sign: number): V3[] {
  const out: V3[] = [];
  const side = (p: V3) => (dot(p, n) - c) * sign;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = side(a), sb = side(b);
    if (sa >= -1e-9) out.push(a);
    if ((sa > 1e-9 && sb < -1e-9) || (sa < -1e-9 && sb > 1e-9)) out.push(lerp(a, b, sa / (sa - sb)));
  }
  return out;
}

/**
 * Corta um poliedro convexo (lista de faces) pelo semiespaço
 * sign*(dot(p,n) - c) >= 0 e fecha o buraco com a "tampa" do corte.
 */
export function clipPolyhedron(faces: V3[][], n: V3, c: number, sign: 1 | -1): V3[][] {
  const out = faces.map((f) => clipPolygon(f, n, c, sign)).filter((f) => f.length >= 3);
  const onPlane: V3[] = [];
  for (const f of out) for (const p of f) if (Math.abs(dot(p, n) - c) < 1e-7 && !onPlane.some((q) => Math.hypot(...sub(p, q)) < 1e-7)) onPlane.push(p);
  if (onPlane.length >= 3) {
    const ctr = onPlane.reduce((a, p) => [a[0] + p[0] / onPlane.length, a[1] + p[1] / onPlane.length, a[2] + p[2] / onPlane.length] as V3, [0, 0, 0] as V3);
    const u = norm(sub(onPlane[0], ctr));
    const outward: V3 = [n[0] * -sign, n[1] * -sign, n[2] * -sign]; // a tampa aponta para fora da peça
    const w = cross(outward, u);
    onPlane.sort((a, b) => Math.atan2(dot(sub(a, ctr), w), dot(sub(a, ctr), u)) - Math.atan2(dot(sub(b, ctr), w), dot(sub(b, ctr), u)));
    out.push(onPlane);
  }
  return out;
}

/** encolhe um poliedro em direção ao seu centro (abre a fresta entre as peças) */
export function shrinkPolyhedron(faces: V3[][], k: number): V3[][] {
  const pts = faces.flat();
  const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length] as V3, [0, 0, 0] as V3);
  return faces.map((f) => f.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k] as V3));
}
