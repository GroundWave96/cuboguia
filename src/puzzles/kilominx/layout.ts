import { tr } from '../../core/i18n';
/**
 * Desenho 2D do Kilominx: a planificação (duas "flores" de pentágonos, como no Megaminx) e os
 * moldes da câmera. Em cada face, os 5 cantos são pipas que vão do vértice até o meio das
 * arestas; no meio fica uma estrelinha preta (o miolo do puzzle).
 */
import type { PuzzleImpl, ScanFace } from '../../core/types';
import { neighborMarks } from '../../core/scanmarks';
import { FACES, megaGeo as geo, type V3 } from '../megaminx/geometry';
import { STICKERS } from './model';

type P = [number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp2 = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/**
 * Cada canto mostra, em cada face, uma "pipa": do vértice até o meio das duas arestas e, por
 * dentro, até perto do centro — sobra só uma estrelinha preta no meio, como no puzzle de
 * verdade. KITE_TIP é onde fica a ponta de dentro (fração do centro até o vértice).
 */
export const KITE_TIP = 0.2;

/** as 5 pipas de uma face a partir dos 5 vértices (2D) */
export function kites(V: P[]): P[][] {
  const C: P = [V.reduce((a, v) => a + v[0], 0) / 5, V.reduce((a, v) => a + v[1], 0) / 5];
  return V.map((v, i) => [v, lerp2(v, V[(i + 1) % 5], 0.5), lerp2(C, v, KITE_TIP), lerp2(v, V[(i + 4) % 5], 0.5)]);
}
/** o mesmo em 3D */
export function kites3(V: V3[]): V3[][] {
  const C: V3 = [0, 1, 2].map((k) => V.reduce((a, v) => a + v[k], 0) / 5) as V3;
  const l = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return V.map((v, i) => [v, l(v, V[(i + 1) % 5], 0.5), l(C, v, KITE_TIP), l(v, V[(i + 4) % 5], 0.5)]);
}
const centroid3 = (ps: V3[]): V3 => [0, 1, 2].map((k) => ps.reduce((a, p) => a + p[k], 0) / ps.length) as V3;

/** centro 3D de cada adesivo (para as marcas da câmera) */
export const STICKER_CENTROIDS: V3[] = Array.from({ length: STICKERS }, (_, i) => {
  const f = Math.floor(i / 5);
  return centroid3(kites3(geo.faceVerts[f].map((v) => geo.vertices[v]))[i % 5]);
});

function shrink(poly: P[], k: number): P[] {
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
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
  const pos = new Map<number, P>();
  const cv = geo.faceVerts[center];
  cv.forEach((v) => pos.set(v, toPlane(geo.vertices[v])));
  const faces = new Map<number, P[]>();
  faces.set(center, cv.map((v) => pos.get(v)!));
  for (const g of geo.neighbors[center]) {
    const gv = geo.faceVerts[g];
    const shared = gv.filter((v) => cv.includes(v));
    const [a, b] = shared;
    const local = new Map<number, P>();
    const step = (x: number, y: number, vs: number[]) => Math.min((vs.indexOf(x) - vs.indexOf(y) + 5) % 5, (vs.indexOf(y) - vs.indexOf(x) + 5) % 5);
    for (const v of gv) {
      if (shared.includes(v)) {
        local.set(v, pos.get(v)!);
        continue;
      }
      const da = step(v, a, gv), db = step(v, b, gv);
      const twin = cv.find((w) => w !== a && w !== b && step(w, a, cv) === da && step(w, b, cv) === db)!;
      local.set(v, reflect(pos.get(twin)!, pos.get(a)!, pos.get(b)!));
    }
    faces.set(g, gv.map((v) => local.get(v)!));
  }
  return faces;
}

export function buildKiloNet(): NonNullable<PuzzleImpl['netSvg']> {
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
  const tx = (p: P): P => [(p[0] - minX) * S + 6, (-p[1] - minY) * S + 6];
  const fmt = (poly: P[]) => poly.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const stickers: { index: number; points: string }[] = [];
  const decor: string[] = [];
  all.forEach((V, f) => {
    const V2 = V.map(tx);
    // o corpo preto da face (aparece na estrela do meio e nas frestas)
    decor.push(`<polygon points="${fmt(V2)}" fill="#14171f" stroke="#14171f" stroke-width="5" stroke-linejoin="round"/>`);
    kites(V2).forEach((poly, k) => stickers.push({ index: f * 5 + k, points: fmt(shrink(poly, 0.9)) }));
  });
  return { viewBox: `0 0 ${((maxX - minX) * S + 12).toFixed(0)} ${((maxY - minY) * S + 12).toFixed(0)}`, stickers, decor: decor.join('') };
}

// ---------------------------------------------------------------------------
// Moldes da câmera: a mesma ordem do Megaminx, mas sem centros as dicas falam de movimentos
const ORDER = ['F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'U', 'D'];
const UPPER = ['F', 'R', 'BR', 'BL', 'L'];
const LOWER = ['DR', 'DBR', 'B', 'DBL', 'DL'];

const TITLES: Record<string, [string, string, string]> = {
  F: ['1ª face (frente)', '1st face (front)', '1.ª cara (frente)'],
  R: ['Direita', 'Right', 'Derecha'],
  BR: ['Trás-direita', 'Back-right', 'Atrás a la derecha'],
  BL: ['Trás-esquerda', 'Back-left', 'Atrás a la izquierda'],
  L: ['Esquerda', 'Left', 'Izquierda'],
  DR: ['Baixo-direita', 'Bottom-right', 'Abajo a la derecha'],
  DBR: ['Baixo-trás-direita', 'Bottom-back-right', 'Abajo, atrás a la derecha'],
  B: ['Trás (embaixo)', 'Back (lower)', 'Atrás (abajo)'],
  DBL: ['Baixo-trás-esquerda', 'Bottom-back-left', 'Abajo, atrás a la izquierda'],
  DL: ['Baixo-esquerda', 'Bottom-left', 'Abajo a la izquierda'],
  U: ['Topo', 'Top', 'Arriba'],
  D: ['Base', 'Bottom', 'Base'],
};

function hint(fk: string): [string, string, string] {
  if (fk === 'F')
    return [
      'Segure com <b>qualquer face</b> para a câmera e uma <b>aresta reta em cima</b>. A face de cima é o “topo” até o fim.',
      'Hold <b>any face</b> toward the camera with a <b>flat edge on top</b>. The face on top is the “top” until the end.',
      'Sujeta <b>cualquier cara</b> hacia la cámara con una <b>arista recta arriba</b>. La cara de arriba es la “de arriba” hasta el final.',
    ];
  if (UPPER.includes(fk))
    return [
      'Gire um passo para a <b>esquerda</b> (o topo continua em cima): a face da direita vem para a frente',
      'Turn one step to the <b>left</b> (the top stays on top): the right face comes to the front',
      'Gira un paso hacia la <b>izquierda</b> (la de arriba sigue arriba): la cara de la derecha pasa al frente',
    ];
  if (fk === 'DR')
    return [
      'Volte a 1ª face para a frente e <b>incline o topo para trás</b>: a face de baixo, à direita da 1ª, fica de frente',
      'Bring the 1st face back to the front and <b>tilt the top backward</b>: the lower face to the right of the 1st one faces you',
      'Vuelve a poner la 1.ª cara al frente e <b>inclina la parte de arriba hacia atrás</b>: la cara de abajo, a la derecha de la 1.ª, queda al frente',
    ];
  if (LOWER.includes(fk))
    return [
      'Gire um passo para a <b>esquerda</b>, do mesmo jeito (a base continua embaixo)',
      'Turn one step to the <b>left</b>, the same way (the bottom stays at the bottom)',
      'Gira un paso hacia la <b>izquierda</b>, de la misma forma (la base sigue abajo)',
    ];
  if (fk === 'U')
    return ['O <b>topo</b> para a câmera, com a 1ª face embaixo', 'The <b>top</b> toward the camera, with the 1st face at the bottom', 'La cara de <b>arriba</b> hacia la cámara, con la 1.ª cara abajo'];
  return [
    'A <b>base</b> (a face oposta ao topo) para a câmera, com a 1ª face em cima',
    'The <b>bottom</b> (the face opposite the top) toward the camera, with the 1st face on top',
    'La <b>base</b> (la cara opuesta a la de arriba) hacia la cámara, con la 1.ª cara arriba',
  ];
}

export function buildKiloScan(): ScanFace[] {
  return ORDER.map((fk) => {
    const f = FACES.indexOf(fk as never);
    const n = geo.normals[f];
    // "para cima" na imagem da câmera (igual ao Megaminx)
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
    const to2 = (p: V3): P => [0.5 + dot(sub(p, c), right) * scale, 0.54 - dot(sub(p, c), up) * scale];
    const V2 = vs.map(to2);
    const cells = kites(V2).map((poly) => {
      const pp = shrink(poly, 0.9);
      // a cor é lida no meio da pipa, um pouco para o lado do vértice (longe das frestas)
      const ctr = lerp2(lerp2(poly[2], poly[0], 0.5), poly[0], 0.1);
      return { poly: pp, center: ctr };
    });
    const isUpper = UPPER.includes(fk);
    return {
      face: fk,
      // para o giro animado entre as faces (o eixo que fica parado é o do topo, +y)
      pose: { right, up, out: n, center: [0.5, 0.54] as [number, number], scale, origin: c },
      grid: [Array.from({ length: 5 }, (_, k) => f * 5 + k)],
      get title() {
        return tr(...TITLES[fk]);
      },
      faceColor: '',
      get hint() {
        return tr(...hint(fk));
      },
      get upLabel() {
        return fk === 'U'
          ? tr('1ª FACE EMBAIXO', '1ST FACE AT THE BOTTOM', '1.ª CARA ABAJO')
          : fk === 'D'
            ? tr('1ª FACE EM CIMA', '1ST FACE ON TOP', '1.ª CARA ARRIBA')
            : isUpper
              ? tr('TOPO EM CIMA', 'TOP UP', 'ARRIBA')
              : tr('BASE EMBAIXO', 'BOTTOM DOWN', 'BASE ABAJO');
      },
      arrow: fk === 'U' || LOWER.includes(fk) ? '▼' : '▲',
      edges: { up: [], down: [], left: [], right: [] },
      fixedCells: [],
      cells,
      marks: [],
      // depois que a face vizinha é capturada, os 2 cantos dela encostados nesta borda
      // aparecem do lado de fora — mostra para onde girar
      neighborMarks: neighborMarks(
        vs,
        V2,
        (e) => {
          const fv = geo.faceVerts[f];
          const g = geo.neighbors[f].find((x) => geo.faceVerts[x].includes(fv[e]) && geo.faceVerts[x].includes(fv[(e + 1) % 5]))!;
          return Array.from({ length: 5 }, (_, k) => ({ index: g * 5 + k, centroid: STICKER_CENTROIDS[g * 5 + k] }));
        },
        2,
        0.03,
      ),
    };
  });
}
