/**
 * Desenho 2D de uma face do Mastermorphix (molde da câmera, rede e ícone), com as proporções
 * do puzzle de verdade: as arestas da face "incham" para fora e as pontas são arredondadas.
 * Sem dependências (o ícone usa isto no carregamento da página).
 */
type P = [number, number];
type B = [number, number, number];

const E = 0.33; // onde a ponta termina na aresta
const K = 0.76; // onde a ponta encontra a pipa, no meio
const T = 0.42; // vértices do triângulo do centro
const R = 0.06; // arredondamento das pontas (fração do lado)
/** quanto o meio de cada aresta incha para fora (fração do lado), como nas fotos */
export const BULGE = 0.075;

/** as 10 regiões em coordenadas baricêntricas (mesma ordem dos adesivos) */
function baryRegions(): { poly: B[]; sample: B }[] {
  const tipCorner = (i: number): B[] => {
    // a quina da ponta vira um arco curto (dois pontos perto do vértice e um no meio)
    const v = (x: number, y: number, z: number): B => {
      const r: B = [0, 0, 0];
      r[i] = x;
      r[(i + 1) % 3] = y;
      r[(i + 2) % 3] = z;
      return r;
    };
    return [v(1 - R, R, 0), v(1 - R * 0.55, R * 0.225, R * 0.225), v(1 - R, 0, R)];
  };
  const abA: B = [1 - E, E, 0], abB: B = [E, 1 - E, 0];
  const bcB: B = [0, 1 - E, E], bcC: B = [0, E, 1 - E];
  const caC: B = [E, 0, 1 - E], caA: B = [1 - E, 0, E];
  const kA: B = [K, (1 - K) / 2, (1 - K) / 2], kB: B = [(1 - K) / 2, K, (1 - K) / 2], kC: B = [(1 - K) / 2, (1 - K) / 2, K];
  const tAB: B = [T, T, 1 - 2 * T], tBC: B = [1 - 2 * T, T, T], tCA: B = [T, 1 - 2 * T, T];
  const [cA, cB, cC] = [tipCorner(0), tipCorner(1), tipCorner(2)];
  const tip = (i: number): B => {
    const r: B = [0.08, 0.08, 0.08];
    r[i] = 0.84;
    return r;
  };
  const kite = (i: number): B => {
    const r: B = [0.19, 0.19, 0.19];
    r[i] = 0.62;
    return r;
  };
  return [
    // ponta A: da quina (arco) até a aresta AB, a pipa e a aresta CA
    { poly: [cA[0], abA, kA, caA, cA[2], cA[1]], sample: tip(0) },
    { poly: [kA, abA, tAB, tCA, caA], sample: kite(0) },
    { poly: [abA, abB, tAB], sample: [0.45, 0.45, 0.1] },
    { poly: [caC, caA, tCA], sample: [0.45, 0.1, 0.45] },
    { poly: [tAB, tBC, tCA], sample: [1 / 3, 1 / 3, 1 / 3] },
    { poly: [kB, bcB, tBC, tAB, abB], sample: kite(1) },
    { poly: [kC, caC, tCA, tBC, bcC], sample: kite(2) },
    { poly: [cB[0], bcB, kB, abB, cB[2], cB[1]], sample: tip(1) },
    { poly: [bcB, bcC, tBC], sample: [0.1, 0.45, 0.45] },
    { poly: [cC[0], caC, kC, bcC, cC[2], cC[1]], sample: tip(2) },
  ];
}

/**
 * Leva um ponto baricêntrico para o plano, inchando as arestas: o deslocamento é máximo no
 * meio de cada aresta e zero nos vértices. `bulge[i]` vale para a aresta oposta ao vértice i
 * (0 = reta, ex.: a aresta do meio do ícone, onde duas faces se encontram).
 */
export function faceWarp(A: P, Bv: P, C: P, bulge: [number, number, number] = [BULGE, BULGE, BULGE]) {
  const V = [A, Bv, C];
  const cx = (A[0] + Bv[0] + C[0]) / 3, cy = (A[1] + Bv[1] + C[1]) / 3;
  // normal para fora de cada aresta (oposta ao vértice i), já com o tamanho do lado
  const out = [0, 1, 2].map((i) => {
    const p = V[(i + 1) % 3], q = V[(i + 2) % 3];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const mx = (p[0] + q[0]) / 2 - cx, my = (p[1] + q[1]) / 2 - cy;
    if (nx * mx + ny * my < 0) [nx, ny] = [-nx, -ny];
    return [nx, ny];
  });
  return (b: B): P => {
    let x = b[0] * A[0] + b[1] * Bv[0] + b[2] * C[0];
    let y = b[0] * A[1] + b[1] * Bv[1] + b[2] * C[1];
    for (let i = 0; i < 3; i++) {
      // produto das outras duas coordenadas: 0 nos vértices, 1/4 no meio da aresta
      const w = 4 * bulge[i] * b[(i + 1) % 3] * b[(i + 2) % 3];
      x += w * out[i][0];
      y += w * out[i][1];
    }
    return [x, y];
  };
}

/** divide cada lado do polígono (em baricêntricas) para a curva aparecer depois de inchar */
function subdivide(poly: B[], n: number): B[] {
  const out: B[] = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n]);
  });
  return out;
}

/**
 * As 10 regiões de uma face (mesma ordem dos adesivos) com os vértices A, B, C no plano:
 * polígono (com as bordas curvas) e o ponto onde a câmera lê a cor.
 */
export function faceRegions(A: P, Bv: P, C: P, opts: { bulge?: [number, number, number]; shrink?: number } = {}): { poly: P[]; sample: P }[] {
  const warp = faceWarp(A, Bv, C, opts.bulge);
  return baryRegions().map((r) => {
    let poly = subdivide(r.poly, 6);
    if (opts.shrink) {
      const c = r.poly.reduce((s, p) => [s[0] + p[0] / r.poly.length, s[1] + p[1] / r.poly.length, s[2] + p[2] / r.poly.length] as B, [0, 0, 0] as B);
      poly = poly.map((p) => [c[0] + (p[0] - c[0]) * opts.shrink!, c[1] + (p[1] - c[1]) * opts.shrink!, c[2] + (p[2] - c[2]) * opts.shrink!] as B);
    }
    return { poly: poly.map(warp), sample: warp(r.sample) };
  });
}

/** contorno da face (bordas curvas e pontas arredondadas), para o corpo escuro do ícone */
export function faceOutline(A: P, Bv: P, C: P, bulge?: [number, number, number]): P[] {
  const warp = faceWarp(A, Bv, C, bulge);
  const corner = (i: number): B[] => {
    const v = (x: number, y: number, z: number): B => {
      const r: B = [0, 0, 0];
      r[i] = x;
      r[(i + 1) % 3] = y;
      r[(i + 2) % 3] = z;
      return r;
    };
    return [v(1 - R, 0, R), v(1 - R * 0.55, R * 0.225, R * 0.225), v(1 - R, R, 0)];
  };
  // A → B → C: cada quina arredondada e a aresta até a próxima
  const pts: B[] = [...corner(0), ...corner(1), ...corner(2)];
  return subdivide(pts, 6).map(warp);
}
