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
interface Photo { photo: string; puzzle: string; light: string; cells: Cell[] }
const photos = samples as unknown as Photo[];
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
    const learnRgb = model.classify(c.rgb) === expected ? c.rgb : model.logoPart(c.pixels, expected);
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
        model.learn(q.photo, c.truth, model.classify(c.rgb) === c.truth ? c.rgb : model.logoPart(c.pixels, c.truth));
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
    for (const p of photos.filter((x) => x.puzzle !== 'cube2')) {
      const colors = p.puzzle === 'megaminx' ? MEGA_COLORS : CUBE3_COLORS;
      const model = new ColorModel(colors, p.puzzle === 'megaminx' ? 'nearest' : 'hue6');
      for (const q of photos.filter((x) => x.puzzle === p.puzzle && x.light === p.light && x !== p)) {
        const c = centerOf(q);
        model.learn(q.photo, c.truth, model.classify(c.rgb) === c.truth ? c.rgb : model.logoPart(c.pixels, c.truth));
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
