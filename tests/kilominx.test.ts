/** Kilominx: o modelo (cantos do Megaminx), a validação, a solução e a câmera. */
import { describe, expect, it } from 'vitest';
import samples from './fixtures/camera-samples.json';
import { ColorModel } from '../src/core/scancolor';
import type { RGB } from '../src/core/color';
import { KILO_COLORS } from '../src/puzzles/kilominx/colors';
import { buildKiloNet, buildKiloScan } from '../src/puzzles/kilominx/layout';
import { CORNERS, FACES, ROTATIONS, STICKERS, applyMove, faceOf, layerOf, parity, readCorners, rotateState, solvedState } from '../src/puzzles/kilominx/model';
import { isSolvedKilo, solveKilominx } from '../src/puzzles/kilominx/solver';
import { validateKilominx } from '../src/puzzles/kilominx/validate';
import kilominx from '../src/puzzles/kilominx';

/** embaralho reproduzível */
const rnd = (n: number, seed: number) => {
  let x = seed;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    let f = FACES[x % 12] as string;
    if (out.length && out[out.length - 1].replace(/[2']/g, '') === f) f = FACES[(x + 1) % 12];
    out.push(f + ['', "'", '2', "2'"][(x >> 8) % 4]);
  }
  return out;
};
const run = (s: string[], moves: string[]) => moves.reduce((st, m) => applyMove(st, m), s);
const movesOf = (sol: ReturnType<typeof solveKilominx>) => sol.steps.flatMap((st) => st.segments.flatMap((g) => g.moves));

describe('Kilominx — modelo', () => {
  it('60 adesivos, 20 cantos e cada giro mexe nos 5 cantos da face', () => {
    expect(STICKERS).toBe(60);
    expect(CORNERS).toHaveLength(20);
    expect(new Set(CORNERS.flat()).size).toBe(60);
    for (const [f, face] of FACES.entries()) {
      expect(layerOf(f)).toHaveLength(15);
      const s = applyMove(solvedState(), face);
      const moved = s.map((c, i) => (c !== solvedState()[i] ? i : -1)).filter((i) => i >= 0);
      expect(moved.every((i) => layerOf(f).includes(i)), face).toBe(true);
      expect(run(solvedState(), [face, face, face, face, face])).toEqual(solvedState());
      expect(run(solvedState(), [face + '2', face + "2'"])).toEqual(solvedState());
    }
  });

  it('as 60 rotações do puzzle inteiro são diferentes e não mudam paridade nem giro dos cantos', () => {
    expect(new Set(ROTATIONS.map((r) => r.face.join(','))).size).toBe(60);
    for (const r of ROTATIONS) {
      const st = rotateState(solvedState(), r);
      expect(isSolvedKilo(st)).toBe(true);
      const c = readCorners(st);
      if ('error' in c) throw new Error('rotação quebrou uma peça');
      expect(parity(c.piece)).toBe(0);
      expect(c.twist.reduce((a, b) => a + b, 0) % 3).toBe(0);
    }
  });
});

describe('Kilominx — validação', () => {
  it('aceita embaralhados (em qualquer rotação) e recusa cantos trocados, girados ou repetidos', () => {
    for (let k = 0; k < 10; k++) {
      const s = rotateState(run(solvedState(), rnd(30, k + 1)), ROTATIONS[(k * 7) % 60]);
      expect(validateKilominx(s).ok).toBe(true);
    }
    const s = run(solvedState(), rnd(30, 99));
    // gira um canto sozinho
    const tw = [...s];
    const [a, b, c] = CORNERS[3];
    [tw[a], tw[b], tw[c]] = [s[b], s[c], s[a]];
    expect(validateKilominx(tw).ok).toBe(false);
    // troca dois cantos (mesmo giro)
    const sw = [...s];
    CORNERS[0].forEach((i, k) => {
      sw[i] = s[CORNERS[5][k]];
      sw[CORNERS[5][k]] = s[i];
    });
    const r = validateKilominx(sw);
    expect(r.ok).toBe(false);
    // cor sobrando
    const extra = [...s];
    extra[0] = extra[0] === 'U' ? 'F' : 'U';
    expect(validateKilominx(extra).ok).toBe(false);
  });
});

describe('Kilominx — solução', () => {
  for (const method of ['beginner', 'advanced'] as const)
    it(`${method}: resolve embaralhos em qualquer rotação, com o branco embaixo`, () => {
      let total = 0;
      for (let k = 0; k < 12; k++) {
        const s = rotateState(run(solvedState(), rnd(35, 1000 + k)), ROTATIONS[(k * 11) % 60]);
        const sol = solveKilominx(s, method);
        const end = run(s, movesOf(sol));
        expect(isSolvedKilo(end), `${method} #${k}`).toBe(true);
        // a face de baixo (D) termina branca
        expect(end.slice(55)).toEqual(['D', 'D', 'D', 'D', 'D']);
        for (const st of sol.steps) expect(sol.stages.some((g) => g.id === st.stageId)).toBe(true);
        total += movesOf(sol).length;
      }
      console.log(`kilominx ${method}: média ${(total / 12).toFixed(1)} movimentos`);
      expect(total / 12).toBeLessThan(method === 'advanced' ? 80 : 100);
    });

  it('já montado em outra rotação (ex.: branco em cima): nenhum passo', () => {
    const r = ROTATIONS.find((x) => x.face[11] === 0)!;
    expect(solveKilominx(rotateState(solvedState(), r)).steps).toHaveLength(0);
  });

  it('um giro de cada lado: solução curta', () => {
    for (const m of ['U', "R'", 'DBL2', 'F']) {
      const sol = solveKilominx(applyMove(solvedState(), m), 'advanced');
      expect(movesOf(sol).length, m).toBeLessThanOrEqual(6);
    }
  });

  it('o último passo do iniciante gira os cantos com R′ D′ R D', () => {
    const sol = solveKilominx(run(solvedState(), rnd(30, 7)));
    const tw = sol.steps.filter((s) => s.stageId === 'utwist');
    expect(tw.length).toBeGreaterThan(0);
    expect(tw.some((s) => s.segments.some((g) => g.label.startsWith("R' D' R D")))).toBe(true);
  });
});

describe('Kilominx — desenho e câmera', () => {
  it('planificação com os 60 adesivos e 12 moldes de 5 pipas', () => {
    const net = buildKiloNet();
    expect(net.stickers.map((s) => s.index).sort((a, b) => a - b)).toEqual(Array.from({ length: 60 }, (_, i) => i));
    const scan = buildKiloScan();
    expect(scan).toHaveLength(12);
    expect(new Set(scan.flatMap((f) => f.grid.flat())).size).toBe(60);
    for (const f of scan) {
      expect(f.cells).toHaveLength(5);
      // a marca da face vizinha: 2 cantos por borda, de outra face
      expect(f.neighborMarks).toHaveLength(10);
      expect(f.neighborMarks!.every((m) => faceOf(m.sticker) !== faceOf(f.grid[0][0]))).toBe(true);
    }
  });

  it('a câmera conserta uma face lida girada', () => {
    const s = run(solvedState(), rnd(30, 5));
    const bad = [...s];
    for (let k = 0; k < 5; k++) bad[20 + k] = s[20 + ((k + 2) % 5)];
    expect(validateKilominx(bad).ok).toBe(false);
    expect(kilominx.repairScan!(bad)).toEqual(s);
  });

  it('fotos reais (nov/2026): as 12 cores lidas sem erro', () => {
    const cells = (samples as unknown as { puzzle: string; cells: { rgb: RGB; truth: string }[] }[]).filter((p) => p.puzzle === 'kilominx').flatMap((p) => p.cells);
    expect(cells).toHaveLength(40);
    expect(new Set(cells.map((c) => c.truth)).size).toBe(12);
    const model = new ColorModel(KILO_COLORS, 'nearest');
    const errs = cells.filter((c) => model.classify(c.rgb) !== c.truth).map((c) => `${c.truth}→${model.classify(c.rgb)}`);
    console.log(`kilominx: ${cells.length - errs.length}/${cells.length}`, errs.join(', '));
    expect(errs).toEqual([]);
  });
});
