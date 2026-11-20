/** Explicação da notação de um puzzle (o que cada letra quer dizer): tutorial e cronômetro. */
import { tr } from '../core/i18n';
import type { PuzzleImpl } from '../core/types';

export function notationHtml(impl: PuzzleImpl): string {
  return `<p>${impl.notationIntro ?? tr('Cada letra é uma face. Gire-a olhando <b>de frente para ela</b>:', 'Each letter is a face. Turn it while <b>looking straight at it</b>:')}</p>
    <ul class="notation-list">${impl.notationHelp.map((h) => `<li><code>${h.move}</code> ${h.text}</li>`).join('')}</ul>
    ${
      impl.notationNote ??
      tr(
        `<p><code>R</code> = sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = meia volta.</p>
    <p>Letra minúscula (<code>r</code>) = a face <b>e</b> a camada do meio juntas (duas camadas).</p>`,
        `<p><code>R</code> = clockwise · <code>R'</code> = counterclockwise · <code>R2</code> = half turn.</p>
    <p>Lowercase letter (<code>r</code>) = the face <b>and</b> the middle layer together (two layers).</p>`,
      )
    }`;
}
