/**
 * Peças 3D do Kilominx, cortando o dodecaedro pelos planos dos giros — que passam pelo meio
 * das arestas (no Megaminx, a 32%). Os 20 cantos são de plástico colorido, sem adesivo: cada
 * um é arredondado e pintado com as suas 3 cores até a borda (as paredes também). O resto
 * (o centro de cada face e as cunhas entre os cantos) é o miolo preto, que gira junto com a
 * camada e fica um pouco afundado, como no puzzle de verdade.
 */
import { clipPolyhedron, shrinkPolyhedron, type V3 } from '../poly/clip';
import { roundedPolyhedron } from '../poly/rounded';
import { megaGeo as geo } from '../megaminx/geometry';
import { CORNERS, faceOf } from './model';
import { kites3 } from './layout';

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * A placa colorida de cada face: meia-largura da fresta entre pipas, o recuo nas arestas do
 * dodecaedro (a placa some dentro da quina arredondada da peça), a altura (um tiquinho abaixo
 * do topo da peça: onde as duas se sobrepõem, vale a peça, sem emenda), quanto desce (até o
 * miolo preto) e o arredondamento das bordas.
 */
const SLIT = 0.011, PLATE_EDGE = 0.026, PLATE_UP = -0.002, PLATE_DOWN = 0.03, PLATE_ROUND = 0.01;

/** recua cada lado de um polígono convexo (no plano de normal n) pela distância dele */
function insetPolygon(poly: V3[], n: V3, dists: number[]): V3[] {
  const c = centroid(poly);
  const k = poly.length;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % k];
    const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    // normal para dentro, no plano
    let inn: V3 = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
    if (dot(inn, [c[0] - a[0], c[1] - a[1], c[2] - a[2]]) < 0) inn = [-inn[0], -inn[1], -inn[2]];
    inn = norm(inn);
    return { p: [a[0] + inn[0] * dists[i], a[1] + inn[1] * dists[i], a[2] + inn[2] * dists[i]] as V3, d };
  });
  // cada vértice novo = cruzamento das retas recuadas vizinhas
  return lines.map((L, i) => {
    const M = lines[(i + k - 1) % k];
    // M.p + s·M.d = L.p + t·L.d  (resolve no plano com mínimos quadrados 2x2)
    const r: V3 = [L.p[0] - M.p[0], L.p[1] - M.p[1], L.p[2] - M.p[2]];
    const a11 = dot(M.d, M.d), a12 = -dot(M.d, L.d), a22 = dot(L.d, L.d);
    const b1 = dot(r, M.d), b2 = -dot(r, L.d);
    const det = a11 * a22 - a12 * a12;
    const sP = (b1 * a22 - a12 * b2) / det;
    return [M.p[0] + M.d[0] * sP, M.p[1] + M.d[1] * sP, M.p[2] + M.d[2] * sP] as V3;
  });
}

/** fresta entre as peças (fator de encolhimento de cada canto) */
const GAP = 0.978;
/** arredondamento das quinas dos cantos */
export const KILO_ROUND = 0.035;

/** distância do plano de corte da camada de uma face: passa pelo meio das arestas que saem dela */
export function kiloCut(face: number): number {
  const vs = geo.faceVerts[face];
  const a = vs[0];
  const g = geo.neighbors[face].find((x) => geo.faceVerts[x].includes(a))!;
  const gv = geo.faceVerts[g];
  const ia = gv.indexOf(a);
  const w = [gv[(ia + 1) % 5], gv[(ia + 4) % 5]].find((x) => !vs.includes(x))!;
  return dot(lerp(geo.vertices[a], geo.vertices[w], 0.5), geo.normals[face]);
}

/** corta um polígono convexo (com normais) mantendo dot(p, n) >= 0 */
function clipHalf(poly: { p: V3; n: V3 }[], n: V3): { p: V3; n: V3 }[] {
  const out: { p: V3; n: V3 }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = dot(a.p, n), sb = dot(b.p, n);
    if (sa >= -1e-9) out.push(a);
    if ((sa > 1e-9 && sb < -1e-9) || (sa < -1e-9 && sb > 1e-9)) {
      const t = sa / (sa - sb);
      out.push({ p: lerp(a.p, b.p, t), n: norm(lerp(a.n, b.n, t)) });
    }
  }
  return out;
}

const centroid = (pts: V3[]): V3 => [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length) as V3;
const scaleAbout = (p: V3, c: V3, k: number): V3 => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k];

export function kiloPieces() {
  const dodeca: V3[][] = geo.faceVerts.map((vs) => vs.map((v) => geo.vertices[v]));
  const above = (faces: V3[][], f: number) => clipPolyhedron(faces, geo.normals[f], kiloCut(f), 1);
  const below = (faces: V3[][], f: number) => clipPolyhedron(faces, geo.normals[f], kiloCut(f), -1);

  const pieces: { faces: V3[][]; stickers: number[] }[] = [];
  const stickers: { index: number; poly: V3[]; normal: V3; facets: V3[][]; normals: V3[][] }[] = [];

  // cantos: além dos 3 planos das suas faces
  CORNERS.forEach((c) => {
    const fs = c.map(faceOf);
    const raw = fs.reduce(above, dodeca);
    const ctr = centroid(raw.flat());
    const faces = shrinkPolyhedron(raw, GAP);
    pieces.push({ faces, stickers: c });
    // superfície arredondada da peça, dividida entre as 3 cores pelos planos bissetores
    const geom = roundedPolyhedron(faces, KILO_ROUND)!;
    const pos = geom.getAttribute('position'), nrm = geom.getAttribute('normal');
    const tris: { p: V3; n: V3 }[][] = [];
    for (let i = 0; i < pos.count; i += 3)
      tris.push([0, 1, 2].map((k) => ({ p: [pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)] as V3, n: [nrm.getX(i + k), nrm.getY(i + k), nrm.getZ(i + k)] as V3 })));
    geom.dispose();
    c.forEach((idx, k) => {
      const f = fs[k];
      const nf = geo.normals[f];
      const others = fs.filter((g) => g !== f).map((g) => geo.normals[g]);
      const facets: V3[][] = [];
      const normals: V3[][] = [];
      for (const t of tris) {
        let poly = t;
        for (const ng of others) poly = clipHalf(poly, [nf[0] - ng[0], nf[1] - ng[1], nf[2] - ng[2]]);
        if (poly.length < 3) continue;
        facets.push(poly.map((q) => q.p));
        normals.push(poly.map((q) => q.n));
      }
      // a placa da face: a pipa inteira (cobre o losango da peça e avança sobre o miolo preto,
      // deixando só frestas finas), um pouco acima da peça e descendo até o miolo
      const kite = kites3(geo.faceVerts[f].map((v) => geo.vertices[v]))[idx % 5].map((p) => scaleAbout(p, ctr, GAP));
      const flat = insetPolygon(kite, nf, [PLATE_EDGE, SLIT, SLIT, PLATE_EDGE]);
      const up = (p: V3, h: number): V3 => [p[0] + nf[0] * h, p[1] + nf[1] * h, p[2] + nf[2] * h];
      const top = flat.map((p) => up(p, PLATE_UP)), bottom = flat.map((p) => up(p, -PLATE_DOWN));
      const prism: V3[][] = [top, [...bottom].reverse(), ...flat.map((_, i) => [top[i], bottom[i], bottom[(i + 1) % 4], top[(i + 1) % 4]])];
      const plate = roundedPolyhedron(prism, PLATE_ROUND);
      if (plate) {
        const pp = plate.getAttribute('position'), pn = plate.getAttribute('normal');
        for (let i = 0; i < pp.count; i += 3) {
          facets.push([0, 1, 2].map((q) => [pp.getX(i + q), pp.getY(i + q), pp.getZ(i + q)] as V3));
          normals.push([0, 1, 2].map((q) => [pn.getX(i + q), pn.getY(i + q), pn.getZ(i + q)] as V3));
        }
        plate.dispose();
      }
      stickers.push({ index: idx, poly: kite, normal: nf, facets, normals });
    });
  });

  // miolo preto: cunhas entre os cantos (uma por aresta) e o centro de cada face. Ficam
  // afundados (encolhidos em direção ao centro do puzzle, sem frestas entre elas), então os
  // cantos ficam saltados, com as paredes coloridas aparecendo — como no puzzle de verdade
  const sink = (faces: V3[][]) => faces.map((f) => f.map((p) => [p[0] * 0.965, p[1] * 0.965, p[2] * 0.965] as V3));
  const black: { faces: V3[][]; faces2: number[] }[] = [];
  const seen = new Set<string>();
  geo.faceVerts.forEach((vs, a) => {
    for (const b of geo.neighbors[a]) {
      const key = [a, b].sort((x, y) => x - y).join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      const ends = geo.neighbors[a].filter((g) => g !== b && geo.neighbors[b].includes(g));
      let faces = above(above(dodeca, a), b);
      for (const g of ends) faces = below(faces, g);
      black.push({ faces: sink(faces), faces2: [a, b] });
    }
    void vs;
  });
  geo.normals.forEach((_, f) => {
    let faces = above(dodeca, f);
    for (const g of geo.neighbors[f]) faces = below(faces, g);
    black.push({ faces: sink(faces), faces2: [f] });
    // o "botão" preto do meio da face, um pouco mais alto que o resto do miolo
    const n = geo.normals[f];
    const V = geo.faceVerts[f].map((v) => geo.vertices[v]);
    const C = centroid(V);
    const ring = V.map((v, i) => {
      const w = V[(i + 1) % 5];
      const mid: V3 = [(v[0] + w[0]) / 2 - C[0], (v[1] + w[1]) / 2 - C[1], (v[2] + w[2]) / 2 - C[2]];
      const k = (0.15 * Math.hypot(v[0] - C[0], v[1] - C[1], v[2] - C[2])) / Math.hypot(...mid);
      return [C[0] + mid[0] * k, C[1] + mid[1] * k, C[2] + mid[2] * k] as V3;
    });
    const at = (p: V3, h: number): V3 => [p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h];
    const top = ring.map((p) => at(p, -0.007)), bot = ring.map((p) => at(p, -0.035));
    black.push({ faces: [top, [...bot].reverse(), ...ring.map((_, i) => [top[i], bot[i], bot[(i + 1) % 5], top[(i + 1) % 5]])], faces2: [f] });
  });
  const firstBlack = pieces.length;
  for (const b of black) pieces.push({ faces: b.faces, stickers: [] });
  /** peças pretas que giram com cada face */
  const blackOf = geo.normals.map((_, f) => black.map((b, i) => (b.faces2.includes(f) ? firstBlack + i : -1)).filter((i) => i >= 0));

  stickers.sort((a, b) => a.index - b.index);
  // núcleo: só a região que nenhum giro alcança (abaixo de todos os planos de corte)
  const core = geo.normals.reduce((faces, _, f) => below(faces, f), dodeca);
  return { pieces, stickers, blackOf, core: shrinkPolyhedron(core, 0.99) };
}
