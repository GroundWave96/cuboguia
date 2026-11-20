import { describe, expect, it } from 'vitest';
import skewb from '../src/puzzles/skewb';
import { MOVES, REFERENCE_CORNER, SKEWB_ROTATIONS, skewbGeo as geo } from '../src/puzzles/skewb/geometry';
import { centerTable, cornerTable } from '../src/puzzles/skewb/solver';

const solved = () => skewb.solvedState();
const run = (s: string[], moves: string[]) => moves.reduce((a, m) => skewb.applyMove(a, m), s);
const scrambled = (n = 11) => run(solved(), skewb.scramble(n));

describe('Skewb — geometria', () => {
  it('30 adesivos: 8 cantos de 3 e 6 centros', () => {
    expect(geo.stickers.length).toBe(30);
    expect(geo.corners.length).toBe(8);
    expect(geo.corners.every((c) => c.stickers.length === 3)).toBe(true);
    expect(geo.centers.length).toBe(6);
    expect(new Set([...geo.corners.flatMap((c) => c.stickers), ...geo.centers]).size).toBe(30);
  });

  it('cada giro é uma permutação; 3 giros iguais voltam ao início; X e X\' se desfazem', () => {
    const ids = Array.from({ length: 30 }, (_, i) => String(i));
    for (const m of MOVES) {
      expect(new Set(geo.permutation(m)).size).toBe(30);
      expect(run(ids, [m, m, m])).toEqual(ids);
      expect(run(ids, [m, skewb.invertMove(m)])).toEqual(ids);
      // metade do puzzle: 4 cantos (12 adesivos) e 3 centros
      expect(geo.layer(m).length).toBe(15);
    }
  });

  it('nenhum giro mexe no canto de referência (cima-frente-direita)', () => {
    for (const m of MOVES) for (const i of REFERENCE_CORNER.stickers) expect(geo.permutation(m)[i]).toBe(i);
  });

  it('24 posições do puzzle inteiro', () => {
    expect(SKEWB_ROTATIONS.length).toBe(24);
  });
});

describe('Skewb — tabelas', () => {
  it('cantos × centros = 3.149.280 posições (o total do Skewb)', () => {
    const c = cornerTable().dist.size, z = centerTable().dist.size;
    console.log(`skewb: ${c} posições dos cantos × ${z} dos centros`);
    expect(c * z).toBe(3149280);
  });
});

describe('Skewb — solução', () => {
  it('resolvido não gera passos', () => {
    expect(skewb.solve(solved(), 'beginner').steps.length).toBe(0);
    expect(skewb.solve(solved(), 'optimal').steps.length).toBe(0);
  });

  for (const method of ['beginner', 'optimal'])
    it(`resolve embaralhados (${method})`, () => {
      let total = 0, worst = 0, worstMs = 0;
      const N = 150;
      for (let t = 0; t < N; t++) {
        const s = scrambled();
        expect(skewb.validate(s).ok).toBe(true);
        const t0 = performance.now();
        const sol = skewb.solve(s, method);
        worstMs = Math.max(worstMs, performance.now() - t0);
        const moves = sol.steps.flatMap((st) => st.segments.flatMap((g) => g.moves));
        expect(run(s, moves)).toEqual(solved());
        if (method === 'optimal') expect(moves.length).toBeLessThanOrEqual(11);
        total += moves.length;
        worst = Math.max(worst, moves.length);
      }
      console.log(`skewb ${method}: média ${(total / N).toFixed(1)} movimentos, máx ${worst}, pior ${worstMs.toFixed(0)} ms`);
    });

  it('a solução ótima nunca é maior que o embaralho', () => {
    for (let t = 0; t < 60; t++) {
      const scr = skewb.scramble(1 + (t % 8));
      const sol = skewb.solve(run(solved(), scr), 'optimal');
      expect(sol.steps.flatMap((st) => st.segments.flatMap((g) => g.moves)).length).toBeLessThanOrEqual(scr.length);
    }
  });

  it('iniciante: cada passo da face branca não desmonta o anterior', () => {
    for (let t = 0; t < 40; t++) {
      const s = scrambled();
      const sol = skewb.solve(s, 'beginner');
      let cur = s;
      const D = 15; // centro da face de baixo (U R F D L B → D = 3)
      for (const st of sol.steps) {
        cur = run(cur, st.segments.flatMap((g) => g.moves));
        if (st.stageId === 'face') expect(cur[D]).toBe('D');
      }
    }
  });
});

describe('Skewb — validação', () => {
  it('resolvido e embaralhado são válidos', () => {
    expect(skewb.validate(solved()).ok).toBe(true);
    expect(skewb.validate(scrambled()).ok).toBe(true);
  });

  it('canto girado no lugar é impossível', () => {
    const s = scrambled();
    const c = geo.corners.find((k) => k !== REFERENCE_CORNER)!;
    const [a, b, d] = c.stickers;
    [s[a], s[b], s[d]] = [s[b], s[d], s[a]];
    const r = skewb.validate(s);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/canto/i);
  });

  it('dois centros trocados é impossível', () => {
    const s = scrambled();
    const [x, y] = [geo.centers[0], geo.centers[2]];
    [s[x], s[y]] = [s[y], s[x]];
    const r = skewb.validate(s);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/centros/i);
  });

  it('canto espelhado (cores na ordem errada) é apontado', () => {
    const s = solved();
    const c = geo.corners.find((k) => k !== REFERENCE_CORNER)!;
    const [a, b] = c.stickers;
    [s[a], s[b]] = [s[b], s[a]];
    const r = skewb.validate(s);
    expect(r.ok).toBe(false);
  });

  it('cor sobrando ou faltando é apontada', () => {
    const s = solved();
    s[1] = s[0] === 'U' ? 'R' : 'U';
    expect(skewb.validate(s).ok).toBe(false);
  });
});

describe('Skewb — posição e câmera', () => {
  it('segurado em qualquer posição: normalize volta à referência', () => {
    for (const p of SKEWB_ROTATIONS) {
      const s = scrambled();
      const held = Array.from(p, (j) => s[j]);
      expect(skewb.normalize!(held)).toEqual(s);
    }
  });

  it('recupera a leitura nos enganos comuns da câmera', () => {
    const turn = <T>(img: T[]) => [img[0], img[4], img[1], img[2], img[3]];
    const mistakes: [string, (m: string[][]) => string[][]][] = [
      ['girou para a direita', (m) => [m[0], m[3], m[2], m[1], m[4], m[5]]],
      ['topo girado ¼', (m) => [m[0], m[1], m[2], m[3], turn(m[4]), m[5]]],
      ['topo e base trocados', (m) => [m[0], m[1], m[2], m[3], m[5], m[4]]],
    ];
    let ok = 0, n = 0;
    for (let t = 0; t < 40; t++) {
      const truth = scrambled();
      const p = SKEWB_ROTATIONS[t % 24];
      const held = Array.from(p, (j) => truth[j]);
      const imgs = skewb.scan.map((f) => f.grid.flat().map((i) => held[i]));
      for (const [, fn] of mistakes) {
        const wrongImgs = fn(imgs);
        const wrong = [...held];
        skewb.scan.forEach((f, k) => f.grid.flat().forEach((i, j) => (wrong[i] = wrongImgs[k][j])));
        if (skewb.validate(skewb.normalize!(wrong)).ok) continue; // o engano por acaso ainda forma um Skewb válido
        const fixed = skewb.normalize!(skewb.repairScan!(wrong));
        expect(skewb.scanOrder!(wrong).map((i) => wrong[i])).toEqual(fixed);
        n++;
        if (fixed.join() === truth.join()) ok++;
      }
    }
    console.log(`skewb câmera: recuperou ${ok}/${n}`);
    expect(ok / n).toBeGreaterThan(0.9);
  });
});
