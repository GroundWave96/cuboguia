/**
 * Mastermorphix: peças 3D (o sólido arredondado cortado pelos planos do 3x3), rede 2D para pintar
 * e moldes da câmera (10 regiões por face).
 */
import { tr } from '../../core/i18n';
import { neighborMarks } from '../../core/scanmarks';
import type { PuzzleImpl, ScanFace } from '../../core/types';
import { clipPolyhedron, shrinkPolyhedron } from '../poly/clip';
import { BULGE, faceRegions } from './face2d';
import { CUBIES, FACE_VERTS, NORMALS, STICKERS, VERTEX, type V3 } from './model';

type P = [number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: V3): V3 => scale(a, 1 / Math.hypot(...a));

/** meia largura da peça do meio (cortes do 3x3 em ±C) e distância das faces do tetraedro */
const C = 0.5;
/** C / D: largura dos meios de aresta (nas fotos, ~⅓ da aresta) */
const T = 0.3;
const D = C / T;
/** quanto o meio de cada face incha (fração do raio do círculo da face), como no puzzle de verdade */
const SAG = 0.12;
/** raio do arredondamento das pontas (uma bolinha encaixada na quina) */
const TIP_R = 0.24 * D;
/** escala para o puzzle caber numa esfera de raio 1 (a ponta, mesmo arredondada, é o mais longe) */
export const MORPH_SCALE = 1 / (D * Math.sqrt(3));
const GAP = 0.965;

/** vértices do tetraedro (escala do cubo) */
const TV: V3[] = VERTEX.map((v) => scale(v, D));
const FACE_POLY = (f: number): V3[] => FACE_VERTS[f].map((j) => TV[j]);
/** o tetraedro plano (só para o caso de o 3D precisar do corpo inteiro) */
export const tetraFaces = (): V3[][] => [0, 1, 2, 3].map((f) => FACE_POLY(f).map((p) => scale(p, MORPH_SCALE)));

/**
 * Cada face é uma calota de esfera que passa pelos 3 vértices e sobe SAG no meio; as arestas
 * viram curvas (o encontro de duas calotas). A esfera é aproximada por planos tangentes.
 */
const SPHERES = NORMALS.map((N) => {
  const n = norm(N);
  const rc = D * Math.sqrt(8 / 3); // raio do círculo que passa pelos vértices da face
  const h = SAG * rc;
  const rho = (rc * rc + h * h) / (2 * h);
  const F = scale(n, D / Math.sqrt(3)); // centro da face plana
  const O: V3 = [F[0] + n[0] * (h - rho), F[1] + n[1] * (h - rho), F[2] + n[2] * (h - rho)];
  return { n, O, rho, alpha: Math.asin(rc / rho) };
});

/** direções espalhadas numa calota (anéis em volta do eixo) */
function capDirections(axis: V3, maxAngle: number, rings: number): V3[] {
  const a = norm(axis);
  const ref: V3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(a, ref)), w = cross(a, u);
  const out: V3[] = [a];
  for (let k = 1; k <= rings; k++) {
    const th = (maxAngle * k) / rings;
    const m = 6 * k;
    for (let j = 0; j < m; j++) {
      const ph = (2 * Math.PI * (j + (k % 2) * 0.5)) / m;
      const s = Math.sin(th), c = Math.cos(th);
      out.push(norm([a[0] * c + (u[0] * Math.cos(ph) + w[0] * Math.sin(ph)) * s, a[1] * c + (u[1] * Math.cos(ph) + w[1] * Math.sin(ph)) * s, a[2] * c + (u[2] * Math.cos(ph) + w[2] * Math.sin(ph)) * s]));
    }
  }
  return out;
}

/** o sólido inteiro: 4 calotas (planos tangentes) e as pontas aparadas */
let SOLID: V3[][] | null = null;
function solid(): V3[][] {
  if (SOLID) return SOLID;
  const B = 3 * D;
  let fs: V3[][] = [
    [[B, -B, -B], [B, B, -B], [B, B, B], [B, -B, B]],
    [[-B, -B, -B], [-B, -B, B], [-B, B, B], [-B, B, -B]],
    [[-B, B, -B], [-B, B, B], [B, B, B], [B, B, -B]],
    [[-B, -B, -B], [B, -B, -B], [B, -B, B], [-B, -B, B]],
    [[-B, -B, B], [B, -B, B], [B, B, B], [-B, B, B]],
    [[-B, -B, -B], [-B, B, -B], [B, B, -B], [B, -B, -B]],
  ];
  for (const sp of SPHERES)
    for (const u of capDirections(sp.n, sp.alpha * 1.12, 6)) fs = clipPolyhedron(fs, u, dot(u, sp.O) + sp.rho, -1);
  // pontas: arredondadas por uma bolinha encaixada na quina (tocando as 3 faces), com planos
  // tangentes a ela das direções entre o eixo da ponta e as faces
  VERTEX.forEach((v, l) => {
    const vn = norm(v);
    const V = scale(v, D);
    // as 3 calotas chegam na ponta com estes planos tangentes; a bolinha encosta neles, e só
    // as direções entre eles cortam (assim o arredondamento mexe só na ponta)
    const fn = [0, 1, 2, 3].filter((i) => i !== l).map((i) => norm(sub(V, SPHERES[i].O)));
    const q = (dot(fn[0], V) - TIP_R) / dot(fn[0], vn);
    const Q = scale(vn, q);
    const inCone = (u: V3) => {
      const det = dot(fn[0], cross(fn[1], fn[2]));
      const a = dot(u, cross(fn[1], fn[2])) / det, b = dot(fn[0], cross(u, fn[2])) / det, c = dot(fn[0], cross(fn[1], u)) / det;
      return a > 1e-6 && b > 1e-6 && c > 1e-6;
    };
    for (const u of capDirections(vn, 1.24, 10)) if (inCone(u)) fs = clipPolyhedron(fs, u, dot(u, Q) + TIP_R, -1);
  });
  SOLID = fs;
  return fs;
}

/** a peça: o sólido cortado pela célula dela no 3x3 */
function pieceSolid(p: V3): V3[][] {
  let fs = solid();
  for (let a = 0; a < 3; a++) {
    const e: V3 = [a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0];
    if (p[a] < 0) fs = clipPolyhedron(fs, e, -C, -1);
    else if (p[a] > 0) fs = clipPolyhedron(fs, e, C, 1);
    else fs = clipPolyhedron(clipPolyhedron(fs, e, -C, 1), e, C, -1);
  }
  return fs;
}

/** parte de um polígono plano do lado dot(p, n) >= 0 */
function clipPolygon(poly: V3[], n: V3): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = dot(a, n), sb = dot(b, n);
    if (sa >= -1e-9) out.push(a);
    if ((sa > 1e-9 && sb < -1e-9) || (sa < -1e-9 && sb > 1e-9)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

const centroidOf = (pts: V3[]): V3 => pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length, a[2] + q[2] / pts.length] as V3, [0, 0, 0] as V3);
/** normal de um polígono (Newell) */
function polyNormal(f: V3[]): V3 {
  const n: V3 = [0, 0, 0];
  f.forEach((a, i) => {
    const b = f[(i + 1) % f.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  });
  return norm(n);
}

type MorphPieces = {
  pieces: { faces: V3[][]; stickers: number[] }[];
  stickers: { index: number; poly: V3[]; normal: V3; facets: V3[][]; walls: V3[][] }[];
  core: V3[][];
};
let PIECES: MorphPieces | null = null;

/**
 * As 26 peças com a superfície curva. Cada pedacinho de fora vira parte do adesivo da face
 * cuja calota ele toca (as pontas arredondadas vão para a face mais próxima); as faces de
 * corte (planos do 3x3) ficam escuras. O puzzle não tem adesivos: a cor vai até a borda.
 */
export function morphPieces(): MorphPieces {
  if (PIECES) return PIECES;
  const stickers: MorphPieces['stickers'] = [];
  const pieces = CUBIES.map((p, ci) => {
    const fs = pieceSolid(p);
    const mine = STICKERS.filter((s) => s.cubie === ci);
    const c = centroidOf(fs.flat());
    const shrink = (q: V3): V3 => scale([c[0] + (q[0] - c[0]) * GAP, c[1] + (q[1] - c[1]) * GAP, c[2] + (q[2] - c[2]) * GAP], MORPH_SCALE);
    const facets = new Map<number, V3[][]>(mine.map((s) => [s.face, []]));
    const walls = new Map<number, V3[][]>(mine.map((s) => [s.face, []]));
    for (const f of fs) {
      const n = polyNormal(f);
      const fc = centroidOf(f);
      // corte do 3x3: escuro
      if ([0, 1, 2].some((a) => Math.abs(Math.abs(n[a]) - 1) < 1e-6 && Math.abs(Math.abs(fc[a]) - C) < 1e-6)) {
        // parede de corte: o plástico da peça é colorido, então a parede tem a cor da peça
        // (nas de 2 ou 3 cores, dividida pelos mesmos planos que separam as cores da ponta)
        for (const i of facets.keys()) {
          let part = f;
          for (const j of facets.keys()) if (j !== i) part = clipPolygon(part, sub(SPHERES[i].n, SPHERES[j].n));
          if (part.length >= 3) walls.get(i)!.push(part.map(shrink));
        }
        continue;
      }
      // de fora: a face cuja calota o pedacinho toca
      const face = SPHERES.findIndex((sp, i) => facets.has(i) && Math.abs(dot(n, fc) - dot(n, sp.O) - sp.rho) < 1e-6);
      if (face >= 0) {
        facets.get(face)!.push(f.map(shrink));
        continue;
      }
      // ponta arredondada: dividida pelos planos que contêm as arestas curvas (onde duas
      // calotas se encontram), então as cores da ponta se juntam num ponto, como no puzzle
      for (const i of facets.keys()) {
        let part = f;
        for (const j of facets.keys()) if (j !== i) part = clipPolygon(part, sub(SPHERES[i].n, SPHERES[j].n));
        if (part.length >= 3) facets.get(i)!.push(part.map(shrink));
      }
    }
    for (const st of mine) {
      const fsx = facets.get(st.face)!;
      if (!fsx.length) throw new Error(`Mastermorphix: adesivo ${st.index} sem superfície`);
      stickers.push({ index: st.index, poly: fsx.flat(), normal: SPHERES[st.face].n, facets: fsx, walls: walls.get(st.face)! });
    }
    return { faces: shrinkPolyhedron(fs, GAP).map((f) => f.map((q) => scale(q, MORPH_SCALE))), stickers: mine.map((s) => s.index) };
  });
  stickers.sort((a, b) => a.index - b.index);
  // núcleo: a peça do meio (abaixo de todos os cortes)
  const core = shrinkPolyhedron(pieceSolid([0, 0, 0]), 0.99).map((f) => f.map((q) => scale(q, MORPH_SCALE)));
  PIECES = { pieces, stickers, core };
  return PIECES;
}

/** centro de cada adesivo em 3D (para as marcas da câmera) */
export function stickerCentroids(): V3[] {
  return morphPieces().stickers.map((s) => s.poly.reduce((a, q) => [a[0] + q[0] / s.poly.length, a[1] + q[1] / s.poly.length, a[2] + q[2] / s.poly.length] as V3, [0, 0, 0] as V3));
}

/** vista de uma face "de frente" com uma direção para cima */
function faceFrame(f: number, upHint: V3) {
  const n = norm(NORMALS[f]);
  const up = norm(sub(upHint, scale(n, dot(upHint, n))));
  const right = cross(scale(n, -1), up);
  return (p: V3): P => [dot(p, right), dot(p, up)];
}
const reflect = (p: P, a: P, b: P): P => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
};

/** rede: a face de frente da câmera no meio e as outras 3 desdobradas pelas arestas */
export function buildMorphNet(): NonNullable<PuzzleImpl['netSvg']> {
  const F = SCAN_ORDER[0];
  const to2 = faceFrame(F, VERTEX[0]);
  const pos = new Map<number, P>(FACE_VERTS[F].map((v) => [v, to2(TV[v])]));
  const faces = new Map<number, P[]>([[F, FACE_VERTS[F].map((v) => pos.get(v)!)]]);
  for (let g = 0; g < 4; g++) {
    if (g === F) continue;
    const gv = FACE_VERTS[g];
    const shared = gv.filter((v) => FACE_VERTS[F].includes(v));
    const other = gv.find((v) => !shared.includes(v))!;
    const opp = FACE_VERTS[F].find((v) => !shared.includes(v))!;
    const p = reflect(pos.get(opp)!, pos.get(shared[0])!, pos.get(shared[1])!);
    faces.set(g, gv.map((v) => (v === other ? p : pos.get(v)!)));
  }
  const pts = [...faces.values()].flat();
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => -p[1])), maxY = Math.max(...pts.map((p) => -p[1]));
  const S = 30;
  const tx = (p: P): P => [(p[0] - minX) * S + 4, (-p[1] - minY) * S + 4];
  const stickers: { index: number; points: string }[] = [];
  faces.forEach((V, f) => {
    faceRegions(tx(V[0]), tx(V[1]), tx(V[2]), { bulge: [0, 0, 0] }).forEach((r, k) => stickers.push({ index: f * 10 + k, points: r.poly.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }));
  });
  return { viewBox: `0 0 ${((maxX - minX) * S + 8).toFixed(0)} ${((maxY - minY) * S + 8).toFixed(0)}`, stickers };
}

// ---------------------------------------------------------------------------
/**
 * Câmera: como no Pyraminx — uma ponta para cima (o vértice 0), a 1ª face de frente, ⅓ de
 * volta para a esquerda duas vezes (a face da direita vem para a frente) e por fim a base,
 * tombando o puzzle para trás.
 */
const UP = norm(VERTEX[0]);
export const SCAN_ORDER: number[] = (() => {
  const sides = [1, 2, 3];
  const order = [sides[0]];
  while (order.length < 3) {
    const f = order[order.length - 1];
    const n = norm(NORMALS[f]);
    const up = norm(sub(UP, scale(n, dot(UP, n))));
    const right = cross(scale(n, -1), up);
    order.push(sides.find((g) => !order.includes(g) && dot(norm(NORMALS[g]), right) > 0)!);
  }
  return [...order, 0];
})();

export function buildMorphScan(): ScanFace[] {
  const centroids = stickerCentroids();
  return SCAN_ORDER.map((f, i) => {
    // a base é vista com a 1ª face em cima
    const upHint: V3 = i === 3 ? norm(NORMALS[SCAN_ORDER[0]]) : UP;
    const to2 = faceFrame(f, upHint);
    const V = FACE_VERTS[f].map((v) => to2(TV[v]));
    const cx = (V[0][0] + V[1][0] + V[2][0]) / 3, cy = (V[0][1] + V[1][1] + V[2][1]) / 3;
    const R = Math.hypot(V[0][0] - cx, V[0][1] - cy);
    const k = 0.4 / R;
    const toBox = (p: P): [number, number] => [0.5 + (p[0] - cx) * k, 0.56 - (p[1] - cy) * k];
    const Vb = V.map(toBox);
    // para o giro animado: as direções do faceFrame, o centro da face e a ponta de cima parada
    const nf = norm(NORMALS[f]);
    const upv = norm(sub(upHint, scale(nf, dot(upHint, nf))));
    const fv3 = FACE_VERTS[f].map((v) => TV[v]);
    const pose = {
      right: cross(scale(nf, -1), upv),
      up: upv,
      out: nf,
      spin: UP,
      center: [0.5, 0.56] as [number, number],
      scale: k,
      origin: [0, 1, 2].map((j) => (fv3[0][j] + fv3[1][j] + fv3[2][j]) / 3) as V3,
    };
    const cells = faceRegions(Vb[0], Vb[1], Vb[2]).map((r) => ({ poly: r.poly as [number, number][], center: r.sample as [number, number] }));
    // a aresta incha para fora: as marcas das faces vizinhas ficam além da curva
    const side = Math.hypot(Vb[0][0] - Vb[1][0], Vb[0][1] - Vb[1][1]);
    const hints = (): [string, string, string][] => [
      ['<b>Qualquer face</b> de frente, uma ponta para cima', '<b>Any face</b> toward you, one tip pointing up', '<b>Cualquier cara</b> hacia ti, con una punta hacia arriba'],
      ['Gire ⅓ de volta para a <b>esquerda</b> (a ponta de cima fica parada): a face da direita vem para a frente', 'Turn ⅓ to the <b>left</b> (the top tip stays put): the right face comes to the front', 'Gira ⅓ hacia la <b>izquierda</b> (la punta de arriba no se mueve): la cara de la derecha pasa al frente'],
      ['Mais ⅓ para a <b>esquerda</b>, do mesmo jeito', 'Another ⅓ to the <b>left</b>, the same way', 'Otro ⅓ hacia la <b>izquierda</b>, de la misma forma'],
      ['Volte à 1ª face e <b>tombe o Mastermorphix para trás</b>: a base fica de frente, com a 1ª face em cima', 'Go back to the 1st face and <b>tip the Mastermorphix backward</b>: the bottom faces you, with the 1st face on top', 'Vuelve a la 1.ª cara e <b>inclina el Mastermorphix hacia atrás</b>: la base queda hacia ti, con la 1.ª cara arriba'],
    ];
    return {
      face: String(f),
      pose,
      grid: [Array.from({ length: 10 }, (_, s) => f * 10 + s)],
      get title() {
        return tr(['1ª face', '2ª face', '3ª face', 'Base'][i], ['1st face', '2nd face', '3rd face', 'Bottom'][i], ['1.ª cara', '2.ª cara', '3.ª cara', 'Base'][i]);
      },
      faceColor: '',
      get hint() {
        return tr(...hints()[i]);
      },
      get upLabel() {
        return i === 3 ? tr('1ª FACE PARA CIMA', '1ST FACE UP', '1.ª CARA ARRIBA') : tr('PONTA DE CIMA', 'TOP TIP', 'PUNTA DE ARRIBA');
      },
      arrow: i === 0 || i === 3 ? '▲' : '↶',
      edges: { up: [], down: [], left: [], right: [] },
      fixedCells: [],
      cells,
      marks: [],
      neighborMarks: neighborMarks(
        FACE_VERTS[f].map((v) => TV[v]),
        Vb,
        (e) => {
          const fv = FACE_VERTS[f];
          const a = fv[e], b = fv[(e + 1) % 3];
          const g = FACE_VERTS.findIndex((w, gi) => gi !== f && w.includes(a) && w.includes(b));
          return STICKERS.filter((s) => s.face === g).map((s) => ({ index: s.index, centroid: scale(centroids[s.index], 1 / MORPH_SCALE) }));
        },
        3,
        0.035 + BULGE * side,
      ),
    };
  });
}
