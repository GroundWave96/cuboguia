/** Rede 2D (duas "flores") e moldes da câmera do Megaminx. */
import type { ColorInfo, PuzzleImpl, ScanFace } from '../../core/types';
import { EDGE_T, FACES, INNER, megaGeo as geo, type V3 } from './geometry';

type P = [number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp2 = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** os 11 adesivos de uma face a partir dos 5 vértices 2D (mesma construção do 3D) */
function stickerPolys(V: P[]): P[][] {
  const C: P = [V.reduce((a, v) => a + v[0], 0) / 5, V.reduce((a, v) => a + v[1], 0) / 5];
  const Pi = V.map((v) => lerp2(C, v, INNER));
  const e = (i: number, j: number) => lerp2(V[i], V[j], EDGE_T);
  const out: P[][] = [Pi];
  for (let i = 0; i < 5; i++) out.push([V[i], e(i, (i + 1) % 5), Pi[i], e(i, (i + 4) % 5)]);
  for (let i = 0; i < 5; i++) out.push([e(i, (i + 1) % 5), e((i + 1) % 5, i), Pi[(i + 1) % 5], Pi[i]]);
  return out;
}

/** reflete o ponto p na reta ab */
function reflect(p: P, a: P, b: P): P {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const fx = a[0] + t * dx, fy = a[1] + t * dy;
  return [2 * fx - p[0], 2 * fy - p[1]];
}

/** flor: face central + 5 vizinhas "desdobradas" sobre as arestas */
function flower(center: number, toPlane: (v: V3) => P): Map<number, P[]> {
  const pos = new Map<number, P>(); // vértice 3D → 2D (da face central)
  const cv = geo.faceVerts[center];
  cv.forEach((v) => pos.set(v, toPlane(geo.vertices[v])));
  const faces = new Map<number, P[]>();
  faces.set(center, cv.map((v) => pos.get(v)!));
  for (const g of geo.neighbors[center]) {
    const gv = geo.faceVerts[g];
    const local = new Map<number, P>();
    const shared = gv.filter((v) => cv.includes(v));
    const [a, b] = shared;
    for (const v of gv) {
      if (shared.includes(v)) {
        local.set(v, pos.get(v)!);
        continue;
      }
      // vértice correspondente na face central = refletido pela aresta compartilhada
      const ia = gv.indexOf(a), ib = gv.indexOf(b);
      const iv = gv.indexOf(v);
      // distância (em passos) até a e até b na face g
      const da = Math.min((iv - ia + 5) % 5, (ia - iv + 5) % 5);
      const db = Math.min((iv - ib + 5) % 5, (ib - iv + 5) % 5);
      const ca = cv.indexOf(a), cb = cv.indexOf(b);
      const twin = cv.find((w) => {
        const iw = cv.indexOf(w);
        return w !== a && w !== b && Math.min((iw - ca + 5) % 5, (ca - iw + 5) % 5) === da && Math.min((iw - cb + 5) % 5, (cb - iw + 5) % 5) === db;
      })!;
      local.set(v, reflect(pos.get(twin)!, pos.get(a)!, pos.get(b)!));
    }
    faces.set(g, gv.map((v) => local.get(v)!));
  }
  return faces;
}

export function buildMegaNet(): NonNullable<PuzzleImpl['netSvg']> {
  // U visto de cima com a frente embaixo; D visto de baixo com a frente em cima
  const up = flower(0, (v) => [v[0], -v[2]]);
  const down = flower(11, (v) => [v[0], v[2]]);
  const all = new Map<number, P[]>();
  const shift = (m: Map<number, P[]>, dx: number) => m.forEach((ps, f) => all.set(f, ps.map(([x, y]) => [x + dx, y])));
  const width = (m: Map<number, P[]>) => {
    const xs = [...m.values()].flat().map((p) => p[0]);
    return [Math.min(...xs), Math.max(...xs)];
  };
  const [u0, u1] = width(up);
  const [d0] = width(down);
  shift(up, -u0);
  shift(down, u1 - u0 - d0 + 0.25);
  const pts = [...all.values()].flat();
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => -p[1])), maxY = Math.max(...pts.map((p) => -p[1]));
  const S = 100;
  const tx = (p: P): P => [(p[0] - minX) * S + 4, (-p[1] - minY) * S + 4];
  const stickers: { index: number; points: string }[] = [];
  all.forEach((V, f) => {
    stickerPolys(V.map(tx)).forEach((poly, s) => stickers.push({ index: f * 11 + s, points: poly.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }));
  });
  return { viewBox: `0 0 ${((maxX - minX) * S + 8).toFixed(0)} ${((maxY - minY) * S + 8).toFixed(0)}`, stickers };
}

// ---------------------------------------------------------------------------
// Moldes da câmera
const NAMES = (colors: ColorInfo[]) => (k: string) => colors.find((c) => c.key === k)!.name;

export function buildMegaScan(colors: ColorInfo[]): ScanFace[] {
  const name = NAMES(colors);
  const order = ['F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'U', 'D'];
  return order.map((fk) => {
    const f = FACES.indexOf(fk as never);
    const n = geo.normals[f];
    // "para cima" na imagem da câmera
    let up: V3;
    if (fk === 'U') up = [0, 0, -1];
    else if (fk === 'D') up = [0, 0, 1];
    else {
      const k = n[1];
      const raw: V3 = [-n[0] * k, 1 - n[1] * k, -n[2] * k];
      const l = Math.hypot(...raw);
      up = [raw[0] / l, raw[1] / l, raw[2] / l];
    }
    const right = cross([-n[0], -n[1], -n[2]], up);
    const vs = geo.faceVerts[f].map((v) => geo.vertices[v]);
    const c: V3 = [0, 1, 2].map((i) => vs.reduce((a, v) => a + v[i], 0) / 5) as V3;
    const R = Math.hypot(...sub(vs[0], c));
    const scale = 0.37 / R; // circunraio do pentágono = 37% do quadro
    const to2 = (p: V3): [number, number] => {
      const d = sub(p, c);
      return [0.5 + dot(d, right) * scale, 0.54 - dot(d, up) * scale];
    };
    const V2 = vs.map(to2);
    const polys = stickerPolys(V2);
    const cells = polys.map((poly) => ({
      poly,
      center: [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length] as [number, number],
    }));
    // marcas por fora de cada aresta com a cor do centro vizinho
    const marks = V2.map((a, i) => {
      const b = V2[(i + 1) % 5];
      const fv = geo.faceVerts[f];
      const g = geo.neighbors[f].find((x) => geo.faceVerts[x].includes(fv[i]) && geo.faceVerts[x].includes(fv[(i + 1) % 5]))!;
      const mx = (a[0] + b[0]) / 2 - 0.5, my = (a[1] + b[1]) / 2 - 0.54;
      const l = Math.hypot(mx, my);
      const off = 0.03;
      const o = (p: [number, number]): [number, number] => [p[0] + (mx / l) * off, p[1] + (my / l) * off];
      const a2 = lerp2(a, b, 0.18), b2 = lerp2(a, b, 0.82);
      return { a: o(a2), b: o(b2), color: FACES[g], primary: FACES[g] === 'U' };
    });
    const isUpper = ['F', 'R', 'BR', 'BL', 'L'].includes(fk);
    const isLower = ['DR', 'DBR', 'B', 'DBL', 'DL'].includes(fk);
    const prev = order[order.indexOf(fk) - 1];
    const hint =
      fk === 'F'
        ? `Cinza em cima, <b>${name('F')}</b> de frente`
        : isUpper || (isLower && prev && !['L'].includes(prev))
          ? 'Gire o megaminx um passo para a esquerda'
          : fk === 'DR'
            ? `Volte o ${name('F')} para a frente e incline para baixo: face <b>${name('DR')}</b>`
            : fk === 'U'
              ? `Cinza para a câmera, ${name('F')} embaixo`
              : `Branco para a câmera, ${name('F')} em cima`;
    return {
      face: fk,
      grid: [Array.from({ length: 11 }, (_, s) => f * 11 + s)],
      title: `Face ${name(fk)}`,
      faceColor: fk,
      hint,
      upLabel: fk === 'U' ? `${name('F').toUpperCase()} EMBAIXO` : fk === 'D' ? `${name('F').toUpperCase()} PARA CIMA` : isUpper ? `${name('U').toUpperCase()} EM CIMA` : `${name('D').toUpperCase()} EMBAIXO`,
      upColor: fk === 'U' || fk === 'D' ? 'F' : isUpper ? 'U' : 'D',
      arrow: fk === 'U' || isLower ? '▼' : '▲',
      edges: { up: [], down: [], left: [], right: [] },
      fixedCells: [{ cell: 0, color: fk }],
      cells,
      marks,
    };
  });
}
