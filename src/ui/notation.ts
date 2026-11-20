/** Explicação da notação de um puzzle (o que cada letra quer dizer): tutorial e cronômetro. */
import type { PuzzleImpl } from '../core/types';

export function notationHtml(impl: PuzzleImpl): string {
  return `<p>${impl.notationIntro ?? 'Cada letra é uma face. Gire-a olhando <b>de frente para ela</b>:'}</p>
    <ul class="notation-list">${impl.notationHelp.map((h) => `<li><code>${h.move}</code> ${h.text}</li>`).join('')}</ul>
    ${
      impl.notationNote ??
      `<p><code>R</code> = sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = meia volta.</p>
    <p>Letra minúscula (<code>r</code>) = a face <b>e</b> a camada do meio juntas (duas camadas).</p>`
    }`;
}
