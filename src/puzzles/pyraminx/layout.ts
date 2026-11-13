/** Peças 3D, rede 2D (triângulo dividido em 4) e moldes da câmera do Pyraminx. */
import type { ColorInfo, PuzzleImpl, ScanFace } from '../../core/types';
import { clipPolyhedron, shrinkPolyhedron } from '../poly/clip';
import { FACE_KEYS, LAYER_CUT, TIP_CUT, pyraGeo as geo, type V3 } from './geometry';

type P = [number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const GAP = 0.965;

// ---------------------------------------------------------------------------
// Peças: cortes do tetraedro pelos planos das pontas e das camadas
export function pyraPieces() {
  const tetra: V3[][] = geo.faceVerts.map((f) => f.map((v) => geo.vertices[v]));
  const ax = (v: number) => geo.axis(v);
  const above = (fs: V3[][], v: number, c: number) => clipPolyhedron(fs, ax(v), c, 1);
  const below = (fs: V3[][], v: number, c: number) => clipPolyhedron(fs, ax(v), c, -1);
  const pieces: { faces: V3[][]; stickers: number[] }[] = [];
  for (let v = 0; v < 4; v++) pieces.push({ faces: above(tetra, v, TIP_CUT), stickers: geo.tips[v] });
  for (let v = 0; v < 4; v++) {
    let fs = below(above(tetra, v, LAYER_CUT), v, TIP_CUT);
    for (let w = 0; w < 4; w++) if (w !== v) fs = below(fs, w, LAYER_CUT);
    pieces.push({ faces: fs, stickers: geo.centers[v] });
  }
  geo.edges.forEach((e) => {
    const [a, b] = geo.stickers[e[0]].verts;
    pieces.push({ faces: above(above(tetra, a, LAYER_CUT), b, LAYER_CUT), stickers: e });
  });
  const stickers: { index: number; poly: V3[]; normal: V3 }[] = [];
  const shrunk = pieces.map((pc) => {
    const pts = pc.faces.flat();
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length] as V3, [0, 0, 0] as V3);
    for (const i of pc.stickers) {
      const st = geo.stickers[i];
      stickers.push({ index: i, poly: st.poly.map((p) => [c[0] + (p[0] - c[0]) * GAP, c[1] + (p[1] - c[1]) * GAP, c[2] + (p[2] - c[2]) * GAP] as V3), normal: geo.normals[st.face] });
    }
    return { faces: shrinkPolyhedron(pc.faces, GAP), stickers: pc.stickers };
  });
  stickers.sort((a, b) => a.index - b.index);
  // núcleo: abaixo de todos os cortes das camadas (nunca aparece no giro)
  let core = tetra;
  for (let v = 0; v < 4; v++) core = below(core, v, LAYER_CUT);
  return { pieces: shrunk, stickers, stickerRound: 0.3, core: shrinkPolyhedron(core, 0.99) };
}

// ---------------------------------------------------------------------------
/** os 9 triângulos de uma face a partir dos 3 vértices 2D (mesma ordem do 3D) */
function stickerTris(A: P, B: P, C: P): P[][] {
  const pt = (i: number, j: number): P => [A[0] + ((B[0] - A[0]) * i) / 3 + ((C[0] - A[0]) * j) / 3, A[1] + ((B[1] - A[1]) * i) / 3 + ((C[1] - A[1]) * j) / 3];
  const out: P[][] = [];
  for (let i = 0; i <= 2; i++) for (let j = 0; i + j <= 2; j++) out.push([pt(i, j), pt(i + 1, j), pt(i, j + 1)]);
  for (let i = 0; i <= 1; i++) for (let j = 0; i + j <= 1; j++) out.push([pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]);
  return out;
}

/** vista de uma face "de frente" com uma direção para cima */
function faceFrame(f: number, upHint: V3) {
  const n = geo.normals[f];
  const up = norm(sub(upHint, [n[0] * dot(upHint, n), n[1] * dot(upHint, n), n[2] * dot(upHint, n)]));
  const right = cross([-n[0], -n[1], -n[2]], up);
  return (p: V3): P => [dot(p, right), dot(p, up)];
}

const reflect = (p: P, a: P, b: P): P => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
};

export function buildPyraNet(): NonNullable<PuzzleImpl['netSvg']> {
  // face da frente no meio (U em cima) e as outras 3 desdobradas pelas arestas
  const F = 0;
  const to2 = faceFrame(F, [0, 1, 0]);
  const pos = new Map<number, P>(geo.faceVerts[F].map((v) => [v, to2(geo.vertices[v])]));
  const faces = new Map<number, P[]>([[F, geo.faceVerts[F].map((v) => pos.get(v)!)]]);
  for (let g = 1; g < 4; g++) {
    const gv = geo.faceVerts[g];
    const shared = gv.filter((v) => geo.faceVerts[F].includes(v));
    const other = gv.find((v) => !shared.includes(v))!;
    const opp = geo.faceVerts[F].find((v) => !shared.includes(v))!;
    const p = reflect(pos.get(opp)!, pos.get(shared[0])!, pos.get(shared[1])!);
    faces.set(g, gv.map((v) => (v === other ? p : pos.get(v)!)));
  }
  const pts = [...faces.values()].flat();
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => -p[1])), maxY = Math.max(...pts.map((p) => -p[1]));
  const S = 160;
  const tx = (p: P): P => [(p[0] - minX) * S + 4, (-p[1] - minY) * S + 4];
  const stickers: { index: number; points: string }[] = [];
  faces.forEach((V, f) => {
    stickerTris(tx(V[0]), tx(V[1]), tx(V[2])).forEach((poly, k) => stickers.push({ index: f * 9 + k, points: poly.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }));
  });
  return { viewBox: `0 0 ${((maxX - minX) * S + 8).toFixed(0)} ${((maxY - minY) * S + 8).toFixed(0)}`, stickers };
}

// ---------------------------------------------------------------------------
export function buildPyraScan(colors: ColorInfo[]): ScanFace[] {
  const name = (k: string) => colors.find((c) => c.key === k)!.name;
  const order = ['F', 'R', 'L', 'D'];
  return order.map((fk, i) => {
    const f = FACE_KEYS.indexOf(fk as never);
    const upHint: V3 = fk === 'D' ? [0, 0, 1] : [0, 1, 0];
    const to2 = faceFrame(f, upHint);
    const V = geo.faceVerts[f].map((v) => to2(geo.vertices[v]));
    const cx = (V[0][0] + V[1][0] + V[2][0]) / 3, cy = (V[0][1] + V[1][1] + V[2][1]) / 3;
    const R = Math.hypot(V[0][0] - cx, V[0][1] - cy);
    const k = 0.4 / R;
    const toBox = (p: P): [number, number] => [0.5 + (p[0] - cx) * k, 0.56 - (p[1] - cy) * k];
    const cells = stickerTris(toBox(V[0]), toBox(V[1]), toBox(V[2])).map((poly) => ({
      poly,
      center: [(poly[0][0] + poly[1][0] + poly[2][0]) / 3, (poly[0][1] + poly[1][1] + poly[2][1]) / 3] as [number, number],
    }));
    const hints = [
      'Centro <b>sem amarelo</b> em cima, <b>sem verde</b> atrás',
      'Gire ⅓ de volta para a esquerda',
      'Mais ⅓ de volta para a esquerda',
      'Volte e mostre a base, frente para cima',
    ];
    return {
      face: fk,
      grid: [Array.from({ length: 9 }, (_, s) => f * 9 + s)],
      title: ['Frente', 'Trás-direita', 'Trás-esquerda', 'Base'][i],
      faceColor: '',
      hint: hints[i],
      upLabel: fk === 'D' ? 'FRENTE PARA CIMA' : `PONTA DE CIMA (SEM ${name('D').toUpperCase()})`,
      edges: { up: [], down: [], left: [], right: [] },
      fixedCells: [],
      cells,
      marks: [],
    };
  });
}
