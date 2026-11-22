/**
 * Leitura de cores com fotos reais (tests/fixtures/camera-samples.json, gerado por
 * tools/extract-camera-samples.py a partir de tests/cube images/).
 */
import { describe, expect, it } from 'vitest';
import samples from './fixtures/camera-samples.json';
import { ColorModel, assignAll } from '../src/core/scancolor';
import type { RGB } from '../src/core/color';
import { CUBE3_COLORS } from '../src/puzzles/cube3/colors';
import { MEGA_COLORS } from '../src/puzzles/megaminx/colors';

interface Cell { rgb: RGB; truth: string; center?: boolean; logo?: boolean; pixels?: RGB[] }
interface Photo { photo: string; puzzle: string; light: string; cells: Cell[]; batch?: number }
const all = samples as unknown as Photo[];
/** lote 1: as fotos originais; lote 2: fotos de nov/2026 (outro Megaminx, 5x5 e mais luzes) */
const batchOf = (p: Photo) => p.batch ?? 1;
const photos = all.filter((p) => batchOf(p) === 1);
const batch2 = all.filter((p) => batchOf(p) === 2);
const find = (name: string) => photos.find((p) => p.photo.includes(name))!;
const centerOf = (p: Photo) => p.cells.find((c) => c.center)!;

/** simula a câmera: face por face na ordem do site, aprendendo com cada centro capturado */
function scanCube3(names: string[]) {
  const model = new ColorModel(CUBE3_COLORS, 'hue6');
  let live = 0, total = 0, centersOk = 0;
  const all: RGB[] = [];
  const truth: string[] = [];
  const fixed = new Map<number, string>();
  names.forEach((n, fi) => {
    const p = find(n);
    const c = centerOf(p);
    const expected = c.truth;
    if (model.centerMatches(c.rgb, c.pixels, expected)) centersOk++;
    for (const cell of p.cells) {
      if (cell.center) continue;
      total++;
      if (model.classify(cell.rgb) === cell.truth) live++;
    }
    // captura: o centro (cor conhecida) vira referência — com logo, só a parte do fundo
    const learnRgb = model.centerSample(c.rgb, c.pixels, expected);
    model.learn(`face${fi}`, expected, learnRgb);
    p.cells.forEach((cell) => {
      if (cell.center) fixed.set(all.length, expected);
      all.push(cell.rgb);
      truth.push(cell.truth);
    });
  });
  const final = assignAll(model, all, 9, fixed);
  const finalOk = final.filter((k, i) => k === truth[i]).length;
  return { live, total, centersOk, finalOk, n: all.length };
}

describe('câmera — cubo 3x3 com fotos reais', () => {
  // ordem do site: verde, laranja, azul, vermelho, amarelo, branco (com logo)
  for (const [light, names] of [
    ['luz boa', ['6155', '6156', '6157', '6158', '6159', '6160']],
    ['pouca luz', ['6169', '6170', '6171', '6172', '6173', '6174']],
  ] as const) {
    it(`${light}: reconhece todos os centros, inclusive o branco com logo`, () => {
      expect(scanCube3([...names]).centersOk).toBe(6);
    });
    it(`${light}: resultado final 100% certo`, () => {
      const r = scanCube3([...names]);
      console.log(`${light}: ao vivo ${r.live}/${r.total}, final ${r.finalOk}/${r.n}`);
      expect(r.finalOk).toBe(r.n);
    });
  }
  it('luz média: leitura ao vivo de cada foto (com o centro dela aprendido)', () => {
    let ok = 0, n = 0;
    const errs: string[] = [];
    for (const p of photos.filter((x) => x.puzzle === 'cube3' && x.light === 'medio')) {
      const model = new ColorModel(CUBE3_COLORS, 'hue6');
      for (const q of photos.filter((x) => x.puzzle === 'cube3' && x.light === 'medio' && x !== p)) {
        const c = centerOf(q);
        model.learn(q.photo, c.truth, model.centerSample(c.rgb, c.pixels, c.truth));
      }
      for (const cell of p.cells) {
        if (cell.center) continue;
        n++;
        const got = model.classify(cell.rgb);
        if (got === cell.truth) ok++;
        else errs.push(`${p.photo} ${cell.truth}→${got}`);
      }
    }
    console.log(`luz média: ${ok}/${n}`, errs.join(', '));
    expect(ok / n).toBeGreaterThan(0.97);
  });
});

describe('câmera — 2x2 (sem centro) com fotos reais', () => {
  it('resultado final 100% certo', () => {
    const model = new ColorModel(CUBE3_COLORS, 'hue6');
    const ps = photos.filter((p) => p.puzzle === 'cube2');
    const all = ps.flatMap((p) => p.cells.map((c) => c.rgb));
    const truth = ps.flatMap((p) => p.cells.map((c) => c.truth));
    const final = assignAll(model, all, 4, new Map());
    const ok = final.filter((k, i) => k === truth[i]).length;
    console.log(`2x2 final ${ok}/${all.length}`);
    expect(ok).toBe(all.length);
  });
});

describe('câmera — megaminx com fotos reais', () => {
  it('lê as 12 cores (verdes, azuis, cinza × branco, roxo × rosa)', () => {
    const ps = photos.filter((p) => p.puzzle === 'megaminx');
    let ok = 0, n = 0;
    const errs: string[] = [];
    // cada foto: o modelo aprendeu os centros das OUTRAS fotos (como se já tivessem sido capturadas)
    for (const p of ps) {
      const model = new ColorModel(MEGA_COLORS, 'nearest');
      for (const q of ps) if (q !== p) model.learn(q.photo, centerOf(q).truth, centerOf(q).rgb);
      for (const cell of p.cells) {
        if (cell.center) continue;
        n++;
        const got = model.classify(cell.rgb);
        if (got === cell.truth) ok++;
        else errs.push(`${cell.truth}→${got}`);
      }
    }
    console.log(`megaminx: ${ok}/${n}`, errs.join(', '));
    expect(ok / n).toBeGreaterThan(0.97);
  });
  it('sem nenhum centro aprendido ainda (primeira face)', () => {
    const model = new ColorModel(MEGA_COLORS, 'nearest');
    const cells = photos.filter((p) => p.puzzle === 'megaminx').flatMap((p) => p.cells);
    const ok = cells.filter((c) => model.classify(c.rgb) === c.truth).length;
    console.log(`megaminx sem calibrar: ${ok}/${cells.length}`);
    expect(ok / cells.length).toBeGreaterThan(0.95);
  });
});

describe('câmera — conferência do centro (face certa)', () => {
  it('centro com logo nunca passa por outra cor, mesmo antes de calibrar', () => {
    for (const p of photos.filter((x) => x.cells.some((c) => c.logo))) {
      const model = new ColorModel(CUBE3_COLORS, 'hue6');
      const c = centerOf(p);
      expect(model.centerMatches(c.rgb, c.pixels, 'D')).toBe(true);
      for (const o of CUBE3_COLORS) if (o.key !== 'D') expect(model.centerMatches(c.rgb, c.pixels, o.key)).toBe(false);
    }
  });
  it('não aceita a face errada (com os outros centros da mesma luz já capturados)', () => {
    let wrong = 0;
    for (const p of photos.filter((x) => x.puzzle === 'cube3' || x.puzzle === 'megaminx')) {
      const colors = p.puzzle === 'megaminx' ? MEGA_COLORS : CUBE3_COLORS;
      const model = new ColorModel(colors, p.puzzle === 'megaminx' ? 'nearest' : 'hue6');
      for (const q of photos.filter((x) => x.puzzle === p.puzzle && x.light === p.light && x !== p)) {
        const c = centerOf(q);
        model.learn(q.photo, c.truth, model.centerSample(c.rgb, c.pixels, c.truth));
      }
      const c = centerOf(p);
      expect(model.centerMatches(c.rgb, c.pixels, c.truth)).toBe(true);
      for (const o of colors) if (o.key !== c.truth && model.centerMatches(c.rgb, c.pixels, o.key)) wrong++;
    }
    expect(wrong).toBe(0);
  });
});

describe('câmera — captura real feita pelo site (fotos escuras passadas como vídeo)', () => {
  // o que o site capturou de verdade, face por face (F, R, B, L, U, D), com as fotos 6169–6174
  const captured: RGB[][] = [[[64,65,14],[76,23,13],[74,26,17],[64,60,50],[6,38,11],[7,20,30],[27,3,0],[4,16,27],[26,3,2]],[[5,18,29],[64,60,50],[59,55,46],[62,59,49],[76,23,14],[59,59,14],[3,34,8],[59,60,11],[5,32,9]],[[11,24,34],[76,27,19],[32,10,9],[34,5,4],[10,23,34],[73,27,18],[78,23,12],[32,7,5],[10,34,12]],[[65,65,20],[7,34,11],[9,32,11],[64,60,50],[28,3,1],[27,5,3],[63,64,12],[70,19,9],[5,16,26]],[[89,90,21],[6,28,43],[48,18,15],[10,53,17],[90,91,21],[42,9,6],[98,33,18],[10,50,15],[5,23,37]],[[62,59,51],[4,18,29],[66,21,13],[3,36,10],[22,23,16],[53,55,13],[54,54,45],[53,55,10],[46,45,39]]];
  const truth = ['YOO WGB RBR', 'BWW WOY GYG', 'BOR RBO ORG', 'YGG WRR YOB', 'YBR GYR OGB', 'WBO G*Y WYW'];
  const MAP: Record<string, string> = { Y: 'U', O: 'R', G: 'F', W: 'D', R: 'L', B: 'B', '*': 'D' };
  it('resultado final 100% certo', () => {
    const model = new ColorModel(CUBE3_COLORS, 'hue6');
    const centers = ['F', 'R', 'B', 'L', 'U', 'D'];
    captured.forEach((face, fi) => {
      if (model.classify(face[4]) === centers[fi]) model.learn(String(fi), centers[fi], face[4]);
    });
    const all = captured.flat();
    const fixed = new Map(centers.map((c, fi) => [fi * 9 + 4, c]));
    const final = assignAll(model, all, 9, fixed);
    const want = truth.join('').replace(/ /g, '').split('').map((c) => MAP[c]);
    const wrong = final.map((k, i) => (k === want[i] ? '' : `${i}:${want[i]}→${k}`)).filter(Boolean);
    expect(wrong).toEqual([]);
  });
});

describe('câmera — pyraminx com fotos reais', () => {
  it('lê as 4 faces sem erro (ao vivo e no resultado final)', async () => {
    const { PYRA_COLORS } = await import('../src/puzzles/pyraminx/colors');
    const ps = photos.filter((p) => p.puzzle === 'pyraminx');
    const model = new ColorModel(PYRA_COLORS, 'hue6');
    const cells = ps.flatMap((p) => p.cells);
    const live = cells.filter((c) => model.classify(c.rgb) === c.truth).length;
    const final = assignAll(model, cells.map((c) => c.rgb), 9, new Map());
    const ok = final.filter((k, i) => k === cells[i].truth).length;
    console.log(`pyraminx: ao vivo ${live}/${cells.length}, final ${ok}/${cells.length}`);
    expect(ok).toBe(cells.length);
  });
});

// ---------------------------------------------------------------------------
// Lote 2 (nov/2026). No site, a câmera só aprende com os centros do puzzle que está sendo
// lido (mesma sessão, mesma luz) — os testes simulam isso.

/** leitura ao vivo de cada foto, tendo aprendido os centros das OUTRAS fotos do mesmo grupo */
function liveWithOthers(group: Photo[], colors: typeof CUBE3_COLORS, kind: 'hue6' | 'nearest') {
  let ok = 0, n = 0;
  const errs: string[] = [];
  for (const p of group) {
    const model = new ColorModel(colors, kind);
    for (const q of group) {
      if (q === p) continue;
      const c = q.cells.find((x) => x.center);
      if (c) model.learn(q.photo, c.truth, model.centerSample(c.rgb, c.pixels, c.truth));
    }
    for (const cell of p.cells) {
      if (cell.center) continue;
      n++;
      const got = model.classify(cell.rgb);
      if (got === cell.truth) ok++;
      else errs.push(`${p.photo.split('/')[1]} ${cell.truth}→${got}`);
    }
  }
  return { ok, n, errs };
}

/** como o site: face por face, aprendendo cada centro, e no fim cada cor exatamente N vezes */
function scanCube(group: Photo[], perColor: number) {
  const model = new ColorModel(CUBE3_COLORS, 'hue6');
  const rgbs: RGB[] = [], truth: string[] = [];
  const fixed = new Map<number, string>();
  let centersOk = 0;
  for (const p of group) {
    const c = centerOf(p);
    if (model.centerMatches(c.rgb, c.pixels, c.truth)) centersOk++;
    model.learn(p.photo, c.truth, model.centerSample(c.rgb, c.pixels, c.truth));
    for (const cell of p.cells) {
      if (cell.center) fixed.set(rgbs.length, cell.truth);
      rgbs.push(cell.rgb);
      truth.push(cell.truth);
    }
  }
  const final = assignAll(model, rgbs, perColor, fixed);
  const wrong = final.map((k, i) => (k === truth[i] ? '' : `${truth[i]}→${k}`)).filter(Boolean);
  return { centersOk, wrong, n: rgbs.length };
}

describe('câmera — lote 2 (nov/2026)', () => {
  it('3x3 no escuro: cada adesivo com os centros de todas as faces capturados', () => {
    const group = batch2.filter((p) => p.puzzle === 'cube3' && p.light === 'escuro');
    const pess = liveWithOthers(group, CUBE3_COLORS, 'hue6');
    console.log(`3x3 lote 2 (escuro), antes de capturar a própria face: ${pess.ok}/${pess.n}`, pess.errs.join(', '));
    const model = new ColorModel(CUBE3_COLORS, 'hue6');
    for (const q of group) {
      const c = centerOf(q);
      model.learn(q.photo, c.truth, model.centerSample(c.rgb, c.pixels, c.truth));
    }
    const cells = group.flatMap((p) => p.cells.filter((c) => !c.center));
    const errs = cells.filter((c) => model.classify(c.rgb) !== c.truth).map((c) => `${c.truth}→${model.classify(c.rgb)}`);
    console.log(`3x3 lote 2 (escuro), com todos os centros: ${cells.length - errs.length}/${cells.length}`, errs.join(', '));
    expect(errs.length / cells.length).toBeLessThan(0.05);
  });
  it('3x3 quase sem luz: a face lida com os centros do escuro', () => {
    // a IMG_6256 é a mesma face da IMG_6250, só que com pouquíssima luz
    const group = batch2.filter((p) => p.puzzle === 'cube3' && p.light !== 'claro');
    const r = liveWithOthers(group, CUBE3_COLORS, 'hue6');
    console.log(`3x3 lote 2 com a foto quase sem luz: ${r.ok}/${r.n}`, r.errs.join(', '));
  });
  for (const light of ['escuro', 'claro'])
    it(`5x5 com ${light === 'escuro' ? 'pouca luz' : 'luz boa'}: centros certos e resultado final 100%`, () => {
      const r = scanCube(batch2.filter((p) => p.puzzle === 'cube5' && p.light === light), 25);
      console.log(`5x5 ${light}: centros ${r.centersOk}/6, final ${r.n - r.wrong.length}/${r.n}`, r.wrong.join(', '));
      expect(r.centersOk).toBe(6);
      expect(r.wrong).toEqual([]);
    });
  it('pyraminx: leitura ao vivo sem erro', async () => {
    const { PYRA_COLORS } = await import('../src/puzzles/pyraminx/colors');
    const model = new ColorModel(PYRA_COLORS, 'hue6');
    const cells = batch2.filter((p) => p.puzzle === 'pyraminx').flatMap((p) => p.cells);
    const ok = cells.filter((c) => model.classify(c.rgb) === c.truth).length;
    console.log(`pyraminx lote 2: ${ok}/${cells.length}`);
    expect(ok).toBe(cells.length);
  });
  it('megaminx (outro cubo): lê as 12 cores com os centros da sessão', () => {
    const r = liveWithOthers(batch2.filter((p) => p.puzzle === 'megaminx'), MEGA_COLORS, 'nearest');
    console.log(`megaminx lote 2: ${r.ok}/${r.n}`, r.errs.join(', '));
    expect(r.ok / r.n).toBeGreaterThan(0.97);
  });
  it('megaminx (outro cubo): sem nenhum centro aprendido ainda (primeira face)', () => {
    const model = new ColorModel(MEGA_COLORS, 'nearest');
    const cells = batch2.filter((p) => p.puzzle === 'megaminx').flatMap((p) => p.cells);
    const errs = cells.filter((c) => model.classify(c.rgb) !== c.truth).map((c) => `${c.truth}→${model.classify(c.rgb)}`);
    console.log(`megaminx lote 2 sem calibrar: ${cells.length - errs.length}/${cells.length}`, errs.join(', '));
    expect(1 - errs.length / cells.length).toBeGreaterThan(0.9);
  });
  it('nunca recusa o centro certo; face trocada só no par vermelho × laranja', () => {
    const wrongs: string[] = [];
    const accepted: string[] = [];
    for (const p of batch2.filter((x) => x.puzzle !== 'pyraminx' && x.puzzle !== 'mastermorphix')) {
      const colors = p.puzzle === 'megaminx' ? MEGA_COLORS : CUBE3_COLORS;
      const model = new ColorModel(colors, p.puzzle === 'megaminx' ? 'nearest' : 'hue6');
      for (const q of batch2.filter((x) => x.puzzle === p.puzzle && x.light === p.light && x !== p)) {
        const c = centerOf(q);
        model.learn(q.photo, c.truth, model.centerSample(c.rgb, c.pixels, c.truth));
      }
      const c = centerOf(p);
      if (!model.centerMatches(c.rgb, c.pixels, c.truth)) wrongs.push(`${p.photo}: centro ${c.truth} recusado`);
      for (const o of colors) if (o.key !== c.truth && model.centerMatches(c.rgb, c.pixels, o.key)) accepted.push(`${p.photo}: ${c.truth} aceito como ${o.key}`);
    }
    console.log('lote 2, centro aceito como outra cor:', accepted.join(', ') || 'nenhum');
    expect(wrongs).toEqual([]);
    // a face toda vermelha (IMG_6251) saiu muito mais clara que as outras: vermelho e laranja
    // ficam ambíguos — aparece na revisão, e o resultado final (9 de cada cor) acerta
    expect(accepted.every((a) => /(L aceito como R|R aceito como L)/.test(a))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mastermorphix (nov/2026): as mesmas 4 cores do Pyraminx, 10 de cada nas 4 faces.
describe('câmera — Mastermorphix com fotos reais', () => {
  for (const light of ['escuro', 'claro'])
    it(`${light}: as 4 faces lidas sem erro no resultado final`, async () => {
      const { PYRA_COLORS } = await import('../src/puzzles/pyraminx/colors');
      const ps = all.filter((p) => p.puzzle === 'mastermorphix' && p.light === light);
      expect(ps).toHaveLength(4);
      const model = new ColorModel(PYRA_COLORS, 'hue6');
      const cells = ps.flatMap((p) => p.cells);
      const live = cells.filter((c) => model.classify(c.rgb) === c.truth).length;
      const final = assignAll(model, cells.map((c) => c.rgb), 10, new Map());
      const ok = final.filter((k, i) => k === cells[i].truth).length;
      console.log(`mastermorphix ${light}: ao vivo ${live}/${cells.length}, final ${ok}/${cells.length}`);
      expect(live).toBeGreaterThanOrEqual(cells.length - 2);
      expect(ok).toBe(cells.length);
    });
});
