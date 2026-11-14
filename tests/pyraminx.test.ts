import { describe, expect, it } from 'vitest';
import { pyraGeo as geo, invertPyraMove } from '../src/puzzles/pyraminx/geometry';

const solved = geo.solved();
const applyAll = (s: string[], moves: string[]) => moves.reduce((acc, m) => geo.apply(acc, m), s);

describe('geometria do pyraminx', () => {
  it('36 adesivos: 4 pontas, 4 centros, 6 arestas', () => {
    expect(geo.stickers.length).toBe(36);
    expect(geo.tips.every((t) => t.length === 3)).toBe(true);
    expect(geo.centers.every((t) => t.length === 3)).toBe(true);
    expect(geo.edges.length).toBe(6);
    expect(geo.edges.every((e) => e.length === 2)).toBe(true);
  });
  it('camada grande tem 12 adesivos e a ponta 3', () => {
    expect(geo.layer('U').length).toBe(12);
    expect(geo.layer('u').length).toBe(3);
  });
  it('cada giro 3 vezes volta ao início e o inverso desfaz', () => {
    for (const m of ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b']) {
      expect(applyAll(solved, [m, m, m])).toEqual(solved);
      expect(applyAll(solved, [m, invertPyraMove(m)])).toEqual(solved);
    }
  });
  it('peças continuam inteiras depois de embaralhar', () => {
    const s = applyAll(solved, ['U', "L'", 'R', 'B', "U'", 'L', 'b', "r'"]);
    for (const c of [...geo.tips, ...geo.centers]) expect(new Set(c.map((i) => s[i])).size).toBe(3);
    for (const e of geo.edges) expect(new Set(e.map((i) => s[i])).size).toBe(2);
  });
});

import { solvePyraBeginner, solvePyraOptimal } from '../src/puzzles/pyraminx/solver';

/** embaralha com os 4 eixos e reorienta o puzzle inteiro para o centro de referência (B) ficar no lugar */
function realScramble(): string[] {
  const moves = ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'];
  let s = solved;
  for (let i = 0; i < 25; i++) s = geo.apply(s, moves[Math.floor(Math.random() * 8)] + (Math.random() < 0.5 ? '' : "'"));
  // gera as 12 rotações do tetraedro
  const rots: Int32Array[] = [Int32Array.from({ length: 36 }, (_, i) => i)];
  const gens = [0, 1, 2, 3].map((v) => geo.wholeRotation(v));
  for (let k = 0; k < rots.length; k++)
    for (const g of gens) {
      const c = new Int32Array(36);
      for (let i = 0; i < 36; i++) c[i] = rots[k][g[i]];
      if (!rots.some((r) => r.every((x, i) => x === c[i]))) rots.push(c);
    }
  expect(rots.length).toBe(12);
  // a única rotação que deixa cada centro no seu vértice (como a pessoa segura o puzzle)
  for (const r of rots) {
    const t = Array.from({ length: 36 }, (_, i) => s[r[i]]);
    if (geo.centers.every((c) => c.map((i) => t[i]).sort().join() === c.map((i) => solved[i]).sort().join())) return t;
  }
  throw new Error('não reorientou');
}

describe('solucionadores do pyraminx', () => {
  it('resolvido não gera passos', () => {
    expect(solvePyraBeginner(solved).steps.length).toBe(0);
    expect(solvePyraOptimal(solved).steps.length).toBe(0);
  });
  it('resolvem 200 estados aleatórios reais (com giros de B e reorientação)', () => {
    let nb = 0, no = 0, maxO = 0;
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      const start = realScramble();
      const mb = solvePyraBeginner(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, mb)).toEqual(solved);
      const mo = solvePyraOptimal(start).steps.flatMap((s) => s.segments.flatMap((g) => g.moves));
      expect(applyAll(start, mo)).toEqual(solved);
      nb += mb.length;
      no += mo.length;
      maxO = Math.max(maxO, mo.filter((m) => m[0] === m[0].toUpperCase()).length);
    }
    console.log(`pyraminx: iniciante ${(nb / 200).toFixed(1)}, ótimo ${(no / 200).toFixed(1)} (máx ${maxO} sem pontas), ${((performance.now() - t0) / 200).toFixed(1)} ms/estado`);
  }, 300_000);
});

import { validatePyraminx } from '../src/puzzles/pyraminx/validate';
import { pyraPieces } from '../src/puzzles/pyraminx/layout';
import { LAYER_CUT, TIP_CUT } from '../src/puzzles/pyraminx/geometry';

describe('validação e visual do pyraminx', () => {
  it('aceita resolvido e embaralhado; rejeita aresta virada e cores trocadas', () => {
    expect(validatePyraminx(solved).ok).toBe(true);
    expect(validatePyraminx(realScramble()).ok).toBe(true);
    const flip = [...solved];
    const [a, b] = geo.edges[0];
    [flip[a], flip[b]] = [flip[b], flip[a]];
    expect(validatePyraminx(flip).ok).toBe(false);
    const wrong = [...solved];
    wrong[0] = wrong[9];
    expect(validatePyraminx(wrong).ok).toBe(false);
  });
  it('núcleo abaixo de todos os cortes e peças de cada camada acima do corte', () => {
    const { core, pieces } = pyraPieces();
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (let v = 0; v < 4; v++) {
      const ax = geo.axis(v);
      for (const p of core.flat()) expect(dot(p, ax)).toBeLessThan(LAYER_CUT);
      for (const [mv, cut] of [['ULRB'[v], LAYER_CUT], ['ulrb'[v], TIP_CUT]] as const) {
        const layer = new Set(geo.layer(mv));
        for (const pc of pieces) if (pc.stickers.some((i) => layer.has(i))) for (const p of pc.faces.flat()) expect(dot(p, ax)).toBeGreaterThan(cut);
      }
    }
  });
});

describe('pyraminx — pintado ou lido em qualquer posição', () => {
  // padrão das fotos tests/cube images/pyraminx (IMG_6191..6197), já na posição de referência
  const USER = 'LLFFDDLRLLFDLRRFFLRRFLDDRDRFFLRDRFDD'.split('');
  it('o padrão das fotos é válido e tem solução', async () => {
    const impl = (await import('../src/puzzles/pyraminx')).default;
    expect(impl.validate(USER)).toEqual({ ok: true, errors: [] });
    const sol = impl.solve(USER, 'beginner');
    const end = sol.steps.flatMap((s) => s.segments.flatMap((g) => g.moves)).reduce((s, m) => impl.applyMove(s, m), USER);
    expect(end.join('')).toBe(impl.solvedState().join(''));
  });
  it('em qualquer uma das 12 posições, volta para a posição de referência', async () => {
    const impl = (await import('../src/puzzles/pyraminx')).default;
    const { PYRA_ROTATIONS } = await import('../src/puzzles/pyraminx/geometry');
    expect(PYRA_ROTATIONS.length).toBe(12);
    let rejectedBefore = 0;
    for (const p of PYRA_ROTATIONS) {
      const painted = Array.from(p, (j) => USER[j]); // como o usuário pintou, segurando de outro jeito
      if (!impl.validate(painted).ok) rejectedBefore++;
      const fixed = impl.normalize!(painted);
      expect(fixed.join('')).toBe(USER.join(''));
      expect(impl.validate(fixed).ok).toBe(true);
    }
    expect(rejectedBefore).toBe(11); // antes, só a posição de referência era aceita
  });
  it('embaralhados em posições aleatórias também', async () => {
    const impl = (await import('../src/puzzles/pyraminx')).default;
    const { PYRA_ROTATIONS } = await import('../src/puzzles/pyraminx/geometry');
    for (let t = 0; t < 50; t++) {
      const s = impl.scramble().reduce((x, m) => impl.applyMove(x, m), impl.solvedState());
      const p = PYRA_ROTATIONS[Math.floor(Math.random() * 12)];
      const fixed = impl.normalize!(Array.from(p, (j) => s[j]));
      expect(impl.validate(fixed).ok).toBe(true);
    }
  });
});

describe('pyraminx — câmera com faces mostradas fora de ordem ou giradas', () => {
  const USER = 'LLFFDDLRLLFDLRRFFLRRFLDDRDRFFLRDRFDD'.split('');
  /** coloca a imagem do lugar `from` no lugar `to`, girada θ (como se o usuário errasse) */
  async function misplace(state: string[], moves: { from: number; to: number; theta: number }[]) {
    const impl = (await import('../src/puzzles/pyraminx')).default;
    const S = impl.scan;
    const cen = (i: number) => [S[i].cells!.reduce((a, c) => a + c.center[0], 0) / 9, S[i].cells!.reduce((a, c) => a + c.center[1], 0) / 9];
    const out = [...state];
    for (const { from, to, theta } of moves) {
      const [fx, fy] = cen(from), [tx, ty] = cen(to);
      const img = S[from].grid.flat().map((i) => state[i]);
      S[to].grid.flat().forEach((idx, k) => {
        const c = S[to].cells![k].center;
        const dx = c[0] - tx, dy = c[1] - ty;
        const px = fx + dx * Math.cos(theta) - dy * Math.sin(theta), py = fy + dx * Math.sin(theta) + dy * Math.cos(theta);
        const j = S[from].cells!.findIndex((q) => Math.hypot(q.center[0] - px, q.center[1] - py) < 0.02);
        expect(j).toBeGreaterThanOrEqual(0);
        out[idx] = img[j];
      });
    }
    return out;
  }
  const T = (2 * Math.PI) / 3;
  const cases: [string, { from: number; to: number; theta: number }[]][] = [
    ['girou para a direita (2ª e 3ª trocadas)', [{ from: 1, to: 2, theta: 0 }, { from: 2, to: 1, theta: 0 }]],
    ['base mostrada girada ⅓', [{ from: 3, to: 3, theta: T }]],
    ['base girada ⅔ e 2ª face girada', [{ from: 3, to: 3, theta: 2 * T }, { from: 1, to: 1, theta: T }]],
    // a base é um triângulo de ponta para baixo na tela: trocar com ela gira 60°
    ['ordem toda trocada', [{ from: 1, to: 3, theta: Math.PI / 3 }, { from: 3, to: 1, theta: Math.PI / 3 + T }, { from: 2, to: 2, theta: 2 * T }]],
  ];
  for (const [name, moves] of cases)
    it(`${name}: recupera o padrão certo`, async () => {
      const impl = (await import('../src/puzzles/pyraminx')).default;
      const wrong = await misplace(USER, moves);
      expect(impl.validate(impl.normalize!(wrong)).ok).toBe(false); // antes: "não existe esse padrão"
      const fixed = impl.normalize!(impl.repairScan!(wrong));
      expect(fixed.join('')).toBe(USER.join(''));
    });
});
