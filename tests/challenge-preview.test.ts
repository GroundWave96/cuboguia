/** Prévia do link de desafio (o texto que aparece no WhatsApp). */
import { describe, expect, it } from 'vitest';
import { PREVIEW_NAMES, challengePreview, readChallenge } from '../src/core/challenge';
import { PUZZLES } from '../src/core/registry';

const read = (q: string) => readChallenge(new URLSearchParams(q), Object.keys(PREVIEW_NAMES))!;

describe('prévia do desafio', () => {
  it('nome, tempo e puzzle no título', () => {
    expect(challengePreview(read('p=cube3&e=R U&t=12345&n=Ana'), 'pt').title).toBe('Ana te desafiou: 12.34 no 3x3');
    expect(challengePreview(read('p=megaminx&e=R2 U&t=83456'), 'pt').title).toBe('Desafio no Megaminx: 1:23.45 — consegue bater?');
    expect(challengePreview(read('p=cube2&e=R&t=dnf&n=Bia'), 'pt').title).toBe('Bia te desafiou no 2x2');
    expect(challengePreview(read('p=skewb&e=R&t=4560&n=Sam'), 'en').title).toBe('Sam challenged you: 4.56 on the Skewb');
    expect(challengePreview(read('p=pyraminx&e=R&t=dnf'), 'en').title).toBe('Pyraminx challenge — can you finish it?');
  });

  it('embaralho longo é cortado numa palavra inteira', () => {
    const e = Array.from({ length: 60 }, (_, i) => (i % 2 ? "R'" : 'U2')).join(' ');
    const d = challengePreview(read(`p=cube5&e=${encodeURIComponent(e)}&t=90000`), 'pt').description;
    expect(d).toMatch(/^Mesmo embaralho: (U2 R' )+.*…\. Abra o link/);
    expect(d.length).toBeLessThan(200);
  });

  it('os nomes da prévia são os mesmos do site', () => {
    for (const p of PUZZLES.filter((d) => d.available)) expect(PREVIEW_NAMES[p.id], p.id).toBe(p.short);
  });
});
