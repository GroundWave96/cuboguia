/**
 * Ícones dos puzzles (SVG gerado), todos no mesmo estilo do logo: corpo escuro,
 * adesivos arredondados e sombreado nas faces laterais, em vista 3D.
 */
type P = [number, number];

const BODY = '#0d1018';
const fmt = (pts: P[]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/** adesivo arredondado: polígono com contorno da mesma cor e cantos redondos */
const sticker = (pts: P[], fill: string, round: number) =>
  `<polygon points="${fmt(pts)}" fill="${fill}" stroke="${fill}" stroke-width="${round}" stroke-linejoin="round"/>`;
const shade = (pts: P[], fill: string, opacity: number) => `<polygon points="${fmt(pts)}" fill="${fill}" opacity="${opacity}"/>`;
const body = (pts: P[], w: number) => `<polygon points="${fmt(pts)}" fill="${BODY}" stroke="${BODY}" stroke-width="${w}" stroke-linejoin="round"/>`;

/** encolhe um polígono em direção ao seu centro (abre o vão entre adesivos) */
function shrink(pts: P[], k: number): P[] {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

const wrap = (content: string) => `<svg viewBox="-4 -4 128 133" class="pz-icon" aria-hidden="true">${content}</svg>`;

// ---------------------------------------------------------------------------
// Cubo NxN isométrico
export function cubeIcon(n: number): string {
  const proj = (x: number, y: number, z: number): P => [60 + (x - y) * 47, 8 + (x + y) * 27 + (1 - z) * 54];
  const out: string[] = [];
  out.push(body([proj(0, 0, 1), proj(1, 0, 1), proj(1, 0, 0), proj(1, 1, 0), proj(0, 1, 0), proj(0, 1, 1)], 7));
  const d = 1 / n;
  const gap = n >= 4 ? 0.06 : 0.05;
  const round = n >= 5 ? 1.6 : n >= 4 ? 2.2 : 3;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a0 = i * d + gap * d * 2, a1 = (i + 1) * d - gap * d * 2;
      const b0 = j * d + gap * d * 2, b1 = (j + 1) * d - gap * d * 2;
      out.push(sticker([proj(a0, b0, 1), proj(a1, b0, 1), proj(a1, b1, 1), proj(a0, b1, 1)], '#ffd500', round));
      out.push(sticker([proj(a0, 1, 1 - b0), proj(a1, 1, 1 - b0), proj(a1, 1, 1 - b1), proj(a0, 1, 1 - b1)], '#00a651', round));
      out.push(sticker([proj(1, 1 - a0, 1 - b0), proj(1, 1 - a1, 1 - b0), proj(1, 1 - a1, 1 - b1), proj(1, 1 - a0, 1 - b1)], '#ff6a13', round));
    }
  out.push(shade([proj(0, 1, 1), proj(1, 1, 1), proj(1, 1, 0), proj(0, 1, 0)], '#003d1f', 0.16));
  out.push(shade([proj(1, 1, 1), proj(1, 0, 1), proj(1, 0, 0), proj(1, 1, 0)], '#5a1f00', 0.22));
  out.push(shade([proj(0, 0, 1), proj(1, 0, 1), proj(1, 1, 1), proj(0, 1, 1)], '#ffffff', 0.1));
  return wrap(out.join(''));
}

// ---------------------------------------------------------------------------
// Pyraminx: pirâmide vista pela aresta da frente (duas faces visíveis)
export function pyraminxIcon(): string {
  const apex: P = [60, 4];
  const left: P = [6, 98];
  const right: P = [114, 98];
  const front: P = [60, 124];
  const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  /** divide o triângulo (a, b, c) em 9 triângulos — a grade de uma face do Pyraminx */
  function face(a: P, b: P, c: P, color: string): string[] {
    // ponto da grade: linha r (0..3, a partir do ápice a), posição k (0..r)
    const pt = (r: number, k: number): P => {
      if (r === 0) return a;
      const l = lerp(a, b, r / 3);
      const rr = lerp(a, c, r / 3);
      return lerp(l, rr, k / r);
    };
    const tris: P[][] = [];
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k <= r; k++) tris.push([pt(r, k), pt(r + 1, k), pt(r + 1, k + 1)]);
      for (let k = 0; k < r; k++) tris.push([pt(r, k), pt(r + 1, k + 1), pt(r, k + 1)]);
    }
    return tris.map((t) => sticker(shrink(t, 0.78), color, 2.4));
  }
  const out: string[] = [];
  out.push(body([apex, left, front, right], 7));
  out.push(...face(apex, left, front, '#00a651'));
  out.push(...face(apex, front, right, '#d0192d'));
  out.push(shade([apex, front, right], '#2a0006', 0.22));
  out.push(shade([apex, left, front], '#ffffff', 0.05));
  return wrap(out.join(''));
}

// ---------------------------------------------------------------------------
// Megaminx: dodecaedro de verdade, rotacionado e projetado
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function megaminxIcon(): string {
  const phi = (1 + Math.sqrt(5)) / 2;
  const ip = 1 / phi;
  const verts: V3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push([x, y, z]);
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      verts.push([0, s1 * ip, s2 * phi]);
      verts.push([s1 * ip, s2 * phi, 0]);
      verts.push([s1 * phi, 0, s2 * ip]);
    }
  // normais das faces = vértices do icosaedro
  const normals: V3[] = [];
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      normals.push(norm([s1, 0, s2 * phi]));
      normals.push(norm([0, s1 * phi, s2]));
      normals.push(norm([s1 * phi, s2, 0]));
    }
  // base de visão: uma face de frente, depois inclinada para parecer 3D
  const z0 = norm([0, phi, 1]);
  const x0 = norm(cross([0, 1, 0], z0));
  const y0 = cross(z0, x0);
  const rot = (p: V3): V3 => {
    let q: V3 = [dot(p, x0), dot(p, y0), dot(p, z0)];
    const a = (-14 * Math.PI) / 180; // inclina um pouco para mostrar o topo
    q = [q[0], q[1] * Math.cos(a) - q[2] * Math.sin(a), q[1] * Math.sin(a) + q[2] * Math.cos(a)];
    const b = (12 * Math.PI) / 180; // gira um pouco de lado (vista diagonal)
    return [q[0] * Math.cos(b) + q[2] * Math.sin(b), q[1], -q[0] * Math.sin(b) + q[2] * Math.cos(b)];
  };
  const colors = ['#f4f6f8', '#d0192d', '#00a651', '#ffd500', '#7b3fe4', '#0a5bd6', '#ff6a13', '#7ed957', '#ff8ad8', '#e8c27a', '#20c3d0', '#9aa0a6'];
  const faces = normals.map((n, fi) => {
    // os 5 vértices mais alinhados com a normal, em ordem angular
    const vs = [...verts].sort((a, b) => dot(b, n) - dot(a, n)).slice(0, 5);
    const c: V3 = [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / 5) as V3;
    const u = norm([vs[0][0] - c[0], vs[0][1] - c[1], vs[0][2] - c[2]]);
    const w = cross(n, u);
    vs.sort((a, b) => {
      const da: V3 = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
      const db: V3 = [b[0] - c[0], b[1] - c[1], b[2] - c[2]];
      return Math.atan2(dot(da, w), dot(da, u)) - Math.atan2(dot(db, w), dot(db, u));
    });
    return { vs: vs.map(rot), c: rot(c), n: rot(n), color: colors[fi] };
  });
  const visible = faces.filter((f) => f.n[2] > 0.02).sort((a, b) => a.c[2] - b.c[2]);
  // a face mais de frente fica branca; as outras recebem as cores em ordem ao redor dela
  const front = visible[visible.length - 1];
  front.color = '#f4f6f8';
  const ring = ['#d0192d', '#00a651', '#ffd500', '#7b3fe4', '#0a5bd6', '#ff6a13'];
  visible
    .filter((f) => f !== front)
    .sort((a, b) => Math.atan2(a.c[1] - front.c[1], a.c[0] - front.c[0]) - Math.atan2(b.c[1] - front.c[1], b.c[0] - front.c[0]))
    .forEach((f, i) => (f.color = ring[i % ring.length]));
  // encaixa no quadro do ícone
  const all = visible.flatMap((f) => f.vs);
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => -p[1])), maxY = Math.max(...all.map((p) => -p[1]));
  const scale = Math.min(112 / (maxX - minX), 117 / (maxY - minY));
  const to2 = (p: V3): P => [4 + (p[0] - minX) * scale, 4 + (-p[1] - minY) * scale];

  const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const out: string[] = [];
  // contorno escuro do corpo
  for (const f of visible) out.push(body(f.vs.map(to2), 6));
  for (const f of visible) {
    const V = f.vs.map(to2);
    const C = to2(f.c);
    const inner = V.map((v) => lerp(C, v, 0.47));
    const e = (i: number, j: number) => lerp(V[i], V[j], 0.31); // ponto na aresta i→j
    const lit = Math.max(0, f.n[2]); // faces de lado ficam mais escuras
    const stickers: P[][] = [inner];
    for (let i = 0; i < 5; i++) {
      const j = (i + 1) % 5, k = (i + 4) % 5;
      stickers.push([V[i], e(i, j), inner[i], e(i, k)]); // canto
      stickers.push([e(i, j), e(j, i), inner[j], inner[i]]); // aresta
    }
    for (const st of stickers) out.push(sticker(shrink(st, 0.84), f.color, 1.6));
    if (lit < 0.85) out.push(shade(V, '#000000', Math.min(0.45, (0.9 - lit) * 0.5)));
  }
  return wrap(out.join(''));
}
