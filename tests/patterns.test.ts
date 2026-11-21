/** Padrões bonitos: cada sequência é válida e o desenho é o prometido. */
import { describe, expect, it } from 'vitest';
import { metaRoute } from '../src/core/meta';
import { loadPuzzle } from '../src/core/registry';
import { PATTERN_PUZZLES_R, parseRoute, pathInLang, patternsPath } from '../src/core/router';
import type { PuzzleState } from '../src/core/types';
import { PATTERNS, PATTERN_PUZZLES } from '../src/puzzles/patterns';
import { patternIcon, patternState } from '../src/ui/patternsPage';

/** as 6 faces, cada uma como matriz n×n de cores */
const faces = (s: PuzzleState, n: number) => Array.from({ length: 6 }, (_, f) => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => String(s[f * n * n + r * n + c]))));

describe('padrões', () => {
  it('a lista de puzzles é a mesma no roteador e no servidor', () => {
    expect(PATTERN_PUZZLES).toEqual(PATTERN_PUZZLES_R);
    for (const id of PATTERN_PUZZLES) {
      const path = patternsPath('pt', id);
      expect(parseRoute(path, '')).toEqual({ lang: 'pt', page: 'patterns', id });
      expect(metaRoute(path)!.meta).toEqual({ page: 'patterns', id });
      expect(pathInLang(path, '', 'en')).toBe(patternsPath('en', id));
    }
    expect(parseRoute('/padroes/megaminx', '').page).toBe('notfound');
    expect(metaRoute('/padroes/3x3')!.meta.page).toBe('notfound');
  });

  it('cada sequência é válida, muda o cubo e desfaz de volta', async () => {
    for (const id of PATTERN_PUZZLES) {
      const impl = await loadPuzzle(id);
      const ids = new Set<string>();
      for (const p of PATTERNS[id]) {
        expect(ids.has(p.id), `${id} ${p.id} repetido`).toBe(false);
        ids.add(p.id);
        const s = patternState(impl, p.alg);
        expect(s.join(''), `${id} ${p.id}`).not.toBe(impl.solvedState().join(''));
        const back = [...p.alg.split(' ')].reverse().reduce((st, m) => impl.applyMove(st, impl.invertMove(m)), s);
        expect(back.join(''), `${id} ${p.id} desfaz`).toBe(impl.solvedState().join(''));
        expect(p.name()).not.toBe('');
      }
    }
  });

  it('xadrez: cada face com duas cores alternadas', async () => {
    for (const id of ['cube3', 'cube5']) {
      const impl = await loadPuzzle(id);
      const n = Number(id.slice(4));
      for (const f of faces(patternState(impl, PATTERNS[id].find((p) => p.id === 'xadrez')!.alg), n)) {
        expect(new Set(f.flat()).size, id).toBe(2);
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++) {
            if (c + 1 < n) expect(f[r][c], `${id} ${r},${c}`).not.toBe(f[r][c + 1]);
            if (r + 1 < n) expect(f[r][c], `${id} ${r},${c}`).not.toBe(f[r + 1][c]);
          }
      }
    }
  });

  it('losangos do 4x4: duas cores por face, simétrico', async () => {
    const impl = await loadPuzzle('cube4');
    for (const f of faces(patternState(impl, PATTERNS.cube4.find((p) => p.id === 'losangos')!.alg), 4)) {
      expect(new Set(f.flat()).size).toBe(2);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          expect(f[r][c]).toBe(f[r][3 - c]);
          expect(f[r][c]).toBe(f[3 - r][c]);
        }
      expect(f[0][0]).not.toBe(f[0][1]);
      expect(f[0][0]).toBe(f[1][1]);
    }
  });

  it('seis pontos: a face de uma cor e o meio de outra', async () => {
    for (const [id, inner] of [['cube3', 1], ['cube5', 3]] as const) {
      const impl = await loadPuzzle(id);
      const n = Number(id.slice(4));
      const lo = (n - inner) / 2;
      for (const f of faces(patternState(impl, PATTERNS[id].find((p) => p.id === 'pontos')!.alg), n)) {
        const isMid = (r: number, c: number) => r >= lo && r < lo + inner && c >= lo && c < lo + inner;
        const out = new Set<string>(), mid = new Set<string>();
        f.forEach((row, r) => row.forEach((x, c) => (isMid(r, c) ? mid : out).add(x)));
        expect(out.size, id).toBe(1);
        expect(mid.size, id).toBe(1);
        expect([...mid][0]).not.toBe([...out][0]);
      }
    }
  });

  it('o desenho do cartão usa as cores do padrão', async () => {
    const impl = await loadPuzzle('cube3');
    const svg = patternIcon(impl, 3, 'M2 E2 S2');
    const hex = (k: string) => impl.colors.find((c) => c.key === k)!.hex;
    // xadrez: cima com amarelo e branco (U e D), frente com verde e azul (F e B)
    for (const k of ['U', 'D', 'F', 'B', 'R', 'L']) expect(svg, k).toContain(hex(k));
    expect(patternIcon(impl, 3, 'U U U U')).not.toContain(hex('D'));
  });
});
