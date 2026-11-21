/** Modo mãos livres (texto falado) e link de sugestão. */
import { afterAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/core/i18n';
import { speechText } from '../src/ui/handsfree';
import { describeNxNMove } from '../src/puzzles/nxn/text';
import { FEEDBACK_EMAIL, feedbackHref } from '../src/ui/feedback';

describe('mãos livres: texto falado', () => {
  afterAll(() => setLang('pt'));
  it('tira setas, "·", parênteses e HTML', () => {
    expect(speechText('Direita (vermelho) · horário ↻')).toBe('Direita, vermelho, horário');
    expect(speechText('Cima · meia volta (180°)')).toBe('Cima, meia volta');
    expect(speechText('Passo 2: <b>Cruz</b> branca. Primeiro movimento: Frente (verde) · anti-horário ↺')).toBe('Passo 2: Cruz branca. Primeiro movimento: Frente, verde, anti-horário');
  });
  it('fatias dos cubos grandes', () => {
    setLang('pt');
    expect(speechText(describeNxNMove('3R', false))).toBe('3ª camada da direita, fatia de dentro, horário');
    setLang('en');
    expect(speechText(describeNxNMove("2U'", false))).toBe('2nd layer from the top, inner slice, counterclockwise');
  });
});

describe('link de sugestão', () => {
  it('e-mail com assunto e o endereço da página', () => {
    setLang('pt');
    const href = feedbackHref('https://cuboguia.pages.dev/3x3/tutorial?m=beginner&s=abc');
    expect(href.startsWith(`mailto:${FEEDBACK_EMAIL}?subject=`)).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body).toContain('Página: https://cuboguia.pages.dev/3x3/tutorial?m=beginner&s=abc');
    // o "&" do endereço da página não pode quebrar o mailto
    expect(href.split('&').length).toBe(2);
  });
});
