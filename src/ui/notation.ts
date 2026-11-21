/** Explicação da notação de um puzzle (o que cada letra quer dizer): tutorial e cronômetro. */
import { tr } from '../core/i18n';
import type { PuzzleImpl } from '../core/types';
import { notationIdFor, notationPath } from '../core/router';

/** explicação curta + link para a página com cada movimento animado (sem o link na própria página de notação) */
export function notationHtml(impl: PuzzleImpl, puzzleId?: string): string {
  return `<p>${impl.notationIntro ?? tr('Cada letra é uma face. Gire-a olhando <b>de frente para ela</b>:', 'Each letter is a face. Turn it while <b>looking straight at it</b>:', 'Cada letra es una cara. Gírala <b>mirándola de frente</b>:')}</p>
    <ul class="notation-list">${impl.notationHelp.map((h) => `<li><code>${h.move}</code> ${h.text}</li>`).join('')}</ul>
    ${
      impl.notationNote ??
      tr(
        `<p><code>R</code> = sentido horário · <code>R'</code> = anti-horário · <code>R2</code> = meia volta.</p>
    <p>Letra minúscula (<code>r</code>) = a face <b>e</b> a camada do meio juntas (duas camadas).</p>`,
        `<p><code>R</code> = clockwise · <code>R'</code> = counterclockwise · <code>R2</code> = half turn.</p>
    <p>Lowercase letter (<code>r</code>) = the face <b>and</b> the middle layer together (two layers).</p>`, `<p><code>R</code> = horario · <code>R'</code> = antihorario · <code>R2</code> = media vuelta.</p>
    <p>Letra minúscula (<code>r</code>) = la cara <b>y</b> la capa del medio juntas (dos capas).</p>`,
      )
    }${puzzleId ? `<p class="nt-link"><a href="${notationPath(undefined, notationIdFor(puzzleId))}">${tr('Ver cada movimento animado em 3D →', 'See each move animated in 3D →', 'Ver cada movimiento animado en 3D →')}</a></p>` : ''}`;
}
