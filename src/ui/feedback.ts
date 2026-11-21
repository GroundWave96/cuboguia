/**
 * "Mandar sugestão ou avisar erro": abre o e-mail da pessoa já com o assunto e o endereço da
 * página (que guarda o cubo dela). Nada é enviado sozinho: a pessoa vê o texto e decide mandar.
 */
import { tr } from '../core/i18n';

export const FEEDBACK_EMAIL = 'gabrielhfp96@gmail.com';

export function feedbackHref(page = location.href): string {
  const subject = tr('CuboGuia: sugestão ou erro', 'CuboGuia: suggestion or bug');
  const body = tr(
    `Página: ${page}\n\nConte o que aconteceu ou o que você gostaria de ver no site:\n\n`,
    `Page: ${page}\n\nTell us what happened or what you’d like to see on the site:\n\n`,
  );
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const feedbackLabel = () => tr('Mandar sugestão ou avisar erro', 'Send a suggestion or report a bug');

/** os links [data-feedback] ganham o endereço da página na hora do clique */
export function wireFeedback() {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-feedback]');
      if (a) a.href = feedbackHref();
    },
    { capture: true },
  );
}
