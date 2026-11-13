/**
 * Sólidos das 62 peças do Megaminx (20 cantos, 30 arestas, 12 centros), obtidos
 * cortando o dodecaedro pelos planos dos giros — como as peças reais.
 */
import { clipPolyhedron, shrinkPolyhedron, type V3 } from '../poly/clip';
import { megaGeo as geo } from './geometry';

/** fresta entre as peças (fator de encolhimento de cada peça) */
const GAP = 0.972;

export function megaPieces() {
  const dodeca: V3[][] = geo.faceVerts.map((vs) => vs.map((v) => geo.vertices[v]));
  const cut = (f: number) => geo.cutOf(f);
  const above = (faces: V3[][], f: number) => clipPolyhedron(faces, geo.normals[f], cut(f), 1);
  const below = (faces: V3[][], f: number) => clipPolyhedron(faces, geo.normals[f], cut(f), -1);
  const faceOf = (i: number) => Math.floor(i / 11);

  const pieces: { faces: V3[][]; stickers: number[] }[] = [];
  // cantos: além dos 3 planos das suas faces
  for (const c of geo.corners) pieces.push({ faces: c.map(faceOf).reduce(above, dodeca), stickers: c });
  // arestas: além dos 2 planos das suas faces, aquém dos planos das faces das pontas
  for (const e of geo.edges) {
    const [a, b] = e.map(faceOf);
    const ends = geo.neighbors[a].filter((g) => g !== b && geo.neighbors[b].includes(g));
    let faces = above(above(dodeca, a), b);
    for (const g of ends) faces = below(faces, g);
    pieces.push({ faces, stickers: e });
  }
  // centros: além do próprio plano, aquém dos planos das 5 vizinhas
  geo.normals.forEach((_, f) => {
    let faces = above(dodeca, f);
    for (const g of geo.neighbors[f]) faces = below(faces, g);
    pieces.push({ faces, stickers: [f * 11] });
  });

  // encolhe cada peça e leva os adesivos junto (ficam colados na peça)
  const stickers: { index: number; poly: V3[]; normal: V3 }[] = [];
  const shrunk = pieces.map((pc) => {
    const pts = pc.faces.flat();
    const ctr = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length] as V3, [0, 0, 0] as V3);
    for (const i of pc.stickers) {
      const st = geo.stickers[i];
      stickers.push({
        index: i,
        poly: st.poly.map((p) => [ctr[0] + (p[0] - ctr[0]) * GAP, ctr[1] + (p[1] - ctr[1]) * GAP, ctr[2] + (p[2] - ctr[2]) * GAP] as V3),
        normal: geo.normals[st.face],
      });
    }
    return { faces: shrinkPolyhedron(pc.faces, GAP), stickers: pc.stickers };
  });
  stickers.sort((a, b) => a.index - b.index);
  // núcleo: só a região que nenhum giro alcança (abaixo de todos os planos de corte),
  // assim ele nunca aparece por fora no meio de uma animação
  const core = geo.normals.reduce((faces, _, f) => below(faces, f), dodeca);
  return { pieces: shrunk, stickers, stickerRound: 0.28, pieceRound: 0.022, core: shrinkPolyhedron(core, 0.995) };
}
