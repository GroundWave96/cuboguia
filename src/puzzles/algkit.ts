/**
 * Peças comuns da página de algoritmos (3x3, 2x2 e Pyraminx).
 *
 * O caso de cada algoritmo nunca é desenhado à mão: é o algoritmo feito ao contrário num puzzle
 * resolvido. Os testes de cada puzzle conferem que o algoritmo mexe só no que deve e que o nome
 * combina com o caso.
 */
import { NxNGeometry, invertMove } from './nxn/geometry';

export type AlgStyle = 'oll' | 'pll' | 'pbl' | 'net';

export interface AlgSetDef {
  id: string;
  name: () => string;
  /** desenho do caso: só a cor de cima (oll), cores e setas (pll), as duas camadas (pbl) ou a planificação (net) */
  style: AlgStyle;
}

export interface AlgGroup {
  id: string;
  set: string;
  name: () => string;
  about: () => string;
}

export interface AlgCase {
  id: string;
  set: string;
  group: string;
  /** nome internacional (ou [pt, en] quando tem tradução) */
  name: string | [string, string];
  alg: string;
  /** outro algoritmo comum para o mesmo caso (conferido nos testes) */
  alt?: string;
}

export const splitAlg = (alg: string) =>
  alg
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // "U2'" e "R2'" são o mesmo que U2 e R2
    .map((m) => m.replace(/2'$/, '2'));
export const invertAlg = (moves: string[], inv: (m: string) => string = invertMove) => [...moves].reverse().map(inv);

/** cubos NxN: o caso de um algoritmo, com o cubo de volta na posição de referência */
export function nxnKit(n: number) {
  const geo = new NxNGeometry(n);
  const solved = geo.solved();
  const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);
  const h = n - 1;
  // referência: os centros (cubos ímpares) ou o canto de baixo-esquerda-trás (cubos pares)
  const anchors =
    n % 2
      ? geo.stickers.filter((s) => s.row === h / 2 && s.col === h / 2).map((s) => s.index)
      : geo.stickers.filter((s) => s.cubie2[0] === -h && s.cubie2[1] === -h && s.cubie2[2] === -h).map((s) => s.index);
  const rotations: string[][] = [];
  for (const a of [[], ['x'], ['x2'], ["x'"], ['z'], ["z'"]]) for (const b of [[], ['y'], ['y2'], ["y'"]]) rotations.push([...a, ...b]);

  /** desfaz uma rotação do cubo inteiro que sobrou do algoritmo */
  function upright(s: string[]): string[] {
    for (const r of rotations) {
      const t = applyAll(s, r);
      if (anchors.every((i) => t[i] === solved[i])) return t;
    }
    return s;
  }
  const caseState = (alg: string) => upright(applyAll(solved, invertAlg(splitAlg(alg))));

  /** adesivos de uma camada (y = +h em cima, -h embaixo) numa grade (n+2)×(n+2) vista de cima */
  const layerCells = (y: number) =>
    geo.stickers
      .filter((s) => s.cubie2[1] === y)
      .map((s) => ({
        index: s.index,
        col: (s.cubie2[0] + h) / 2 + 1 + s.normal[0],
        row: (s.cubie2[2] + h) / 2 + 1 + s.normal[2],
        side: s.normal[1] === 0,
        piece: s.cubie2.join(','),
      }));

  /** para onde vai cada peça de uma camada: [posição atual, posição de origem] */
  function pieceMoves(state: string[], y: number): [string, string][] {
    const byPiece = new Map<string, number[]>();
    for (const c of layerCells(y)) byPiece.set(c.piece, [...(byPiece.get(c.piece) ?? []), c.index]);
    const colors = (s: string[], idx: number[]) => idx.map((i) => s[i]).sort().join('');
    const home = new Map([...byPiece].map(([k, idx]) => [colors(solved, idx), k]));
    const out: [string, string][] = [];
    for (const [k, idx] of byPiece) {
      const to = home.get(colors(state, idx));
      if (to && to !== k) out.push([k, to]);
    }
    return out;
  }

  return { n, geo, solved, applyAll, upright, caseState, layerCells, pieceMoves };
}
export type NxNKit = ReturnType<typeof nxnKit>;
