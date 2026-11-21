/**
 * Versão em inglês: nenhum texto que o usuário vê pode sair em português.
 * Resolve embaralhados de todos os puzzles em todos os métodos (as explicações dos passos
 * são montadas pelos solucionadores) e confere também textos fixos, notação e avisos.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/core/i18n';
import { PUZZLES } from '../src/core/registry';
import type { PuzzleImpl } from '../src/core/types';

/** acentos e palavras que só existem em português */
const PT = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔ]|\b(não|nao|com|para|uma|dos|das|nas|nos|pelo|pela|cima|baixo|frente|trás|tras|direita|esquerda|canto|cantos|aresta|arestas|centro|centros|passo|passos|giro|giros|cor|cores|embaixo|horário|camada|camadas|ponta|pontas|faça|segure|gire|até|então|também|só|mesmo|vez|vezes|já|ainda|peça|peças|movimento|movimentos|lado|outra|outro|deixe|leve|monte)\b/i;
const strip = (s: string) => s.replace(/<[^>]+>/g, ' ');

/** português que sobrou no espanhol: só o que não existe em espanhol */
const PT_IN_ES = /[ãõçÃÕÇ]|(não|você|uma|com|faça|então|também|peça|peças|canto|cantos|camada|camadas|embaixo|vezes|aresta|arestas|segure|gire)/i;
/** inglês que sobrou no espanhol */
const EN_IN_ES = /(the|and|with|turn|turns|step|steps|edge|edges|corner|corners|layer|layers|face|faces|move|moves|white|yellow|green|top|bottom|left|right|front|back)/i;

let BAD: RegExp[] = [PT];
function check(where: string, text: string | undefined, bad: string[]) {
  if (!text) return;
  const m = BAD.map((re) => strip(text).match(re)).find(Boolean);
  if (m) bad.push(`${where}: «${m[0]}» em "${strip(text).slice(0, 140)}"`);
}

async function leftovers(def: (typeof PUZZLES)[number], lang: 'en' | 'es') {
      setLang(lang);
      const impl: PuzzleImpl = await def.load!();
      const bad: string[] = [];
      check('nome', def.name, bad);
      check('subtítulo', def.subtitle, bad);
      check('holdHint', impl.holdHint, bad);
      check('scanHint', impl.scanHint, bad);
      check('notationIntro', impl.notationIntro, bad);
      check('notationNote', impl.notationNote, bad);
      for (const c of impl.colors) check('cor', c.name, bad);
      for (const h of impl.notationHelp) check('notação', h.text, bad);
      for (const m of impl.methods) {
        check('método', m.name, bad);
        check('método', m.tagline, bad);
        check('método', m.description, bad);
      }
      for (const f of impl.scan) {
        check('câmera', f.title, bad);
        check('câmera', f.hint, bad);
        check('câmera', f.upLabel, bad);
      }
      for (const f of impl.net) check('planificação', f.label, bad);
      // avisos: falta pintar, cor a mais e uma peça trocada
      const solved = impl.solvedState();
      const missing = [...solved];
      missing[missing.findIndex((_, i) => !impl.fixedStickers.includes(i))] = '?';
      for (const e of impl.validate(missing).errors) check('validação', e, bad);
      const extra = [...solved];
      const free = solved.map((_, i) => i).filter((i) => !impl.fixedStickers.includes(i));
      extra[free[0]] = solved[free[free.length - 1]];
      for (const e of impl.validate(extra).errors) check('validação', e, bad);
      // soluções de vários embaralhados, em todos os métodos
      for (let t = 0; t < 3; t++) {
        const s = impl.scramble().reduce((st, m) => impl.applyMove(st, m), impl.solvedState());
        for (const m of impl.methods) {
          const sol = impl.solve(s, m.id);
          check('método da solução', sol.method, bad);
          for (const st of sol.stages) {
            check('etapa', st.name, bad);
            check('etapa', st.goal, bad);
          }
          for (const st of sol.steps) {
            check('passo', st.title, bad);
            check('passo', st.description, bad);
            for (const sg of st.segments) {
              check('trecho', sg.label, bad);
              for (const mv of sg.moves) check(`movimento ${mv}`, impl.describeMove?.(mv), bad);
            }
          }
        }
      }
      return [...new Set(bad)].slice(0, 40);
}

describe('versão em inglês', () => {
  afterAll(() => setLang('pt'));

  for (const def of PUZZLES.filter((p) => p.available))
    it(`${def.id}: tudo em inglês`, async () => {
      BAD = [PT];
      expect(await leftovers(def, 'en')).toEqual([]);
    }, 120000);

  it('em português continua em português', async () => {
    setLang('pt');
    const impl: PuzzleImpl = await PUZZLES.find((p) => p.id === 'cube3')!.load!();
    const s = impl.scramble().reduce((st, m) => impl.applyMove(st, m), impl.solvedState());
    const sol = impl.solve(s, 'beginner');
    expect(sol.steps.some((st) => PT.test(strip(st.description)))).toBe(true);
    expect(impl.colors.map((c) => c.name)).toContain('amarelo');
  });
});

describe('versão em espanhol', () => {
  afterAll(() => {
    setLang('pt');
    BAD = [PT];
  });
  for (const def of PUZZLES.filter((p) => p.available))
    it(`${def.id}: tudo em espanhol`, async () => {
      BAD = [PT_IN_ES, EN_IN_ES];
      expect(await leftovers(def, 'es')).toEqual([]);
    }, 120000);
});
