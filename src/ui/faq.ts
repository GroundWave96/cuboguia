/**
 * Perguntas frequentes (/perguntas, /en/faq): as dúvidas que as pessoas digitam no Google,
 * respondidas com o que o site faz de verdade.
 */
import { tr } from '../core/i18n';
import { algsPath, homePath, notationPath, puzzlePath, timerPath } from '../core/router';
import { FEEDBACK_EMAIL } from './feedback';
import { icon } from './icons';

export interface Faq {
  id: string;
  q: () => string;
  /** HTML (só links e negrito) */
  a: () => string;
}

const link = (href: string, text: string) => `<a href="${href}">${text}</a>`;

export const FAQS: Faq[] = [
  {
    id: 'impossivel',
    q: () => tr('O site diz que meu cubo é impossível. E agora?', 'The site says my cube is impossible. What now?', 'La web dice que mi cubo es imposible. ¿Y ahora?'),
    a: () =>
      tr(
        `Quase sempre é uma cor informada errada: dois adesivos trocados, uma face lida de lado ou uma cor confundida pela câmera (laranja e vermelho, branco e amarelo). Confira face por face, com o <b>amarelo em cima</b> e o <b>verde de frente</b>, e corrija pintando. A mensagem dá uma pista do que está errado. Se o cubo já foi desmontado ou um canto foi girado com a mão, ele pode ter sido montado de um jeito que não tem solução: aí é preciso tirar a peça e encaixar de novo do jeito certo.`,
        `It’s almost always a color entered wrong: two stickers swapped, a face read sideways, or a color the camera mixed up (orange and red, white and yellow). Check face by face, with <b>yellow on top</b> and <b>green in front</b>, and fix it by painting. The message gives you a hint about what’s wrong. If the cube was taken apart or a corner was twisted by hand, it may have been put back in a way that can’t be solved: then you need to pop that piece out and put it back correctly.`, `Casi siempre es un color mal indicado: dos pegatinas intercambiadas, una cara leída de lado o un color que la cámara confundió (naranja y rojo, blanco y amarillo). Revisa cara por cara, con el <b>amarillo arriba</b> y el <b>verde al frente</b>, y corrige pintando. El mensaje da una pista de lo que está mal. Si el cubo se desarmó o se giró una esquina con la mano, puede haberse armado de una forma que no tiene solución: entonces hay que sacar esa pieza y volver a encajarla bien.`,
      ),
  },
  {
    id: 'comecar',
    q: () => tr('Preciso saber alguma coisa antes de começar?', 'Do I need to know anything before starting?', '¿Necesito saber algo antes de empezar?'),
    a: () =>
      tr(
        `Não. Escolha o método <b>para iniciantes</b>, informe as cores e siga o tutorial: cada movimento aparece animado no 3D, com uma seta mostrando o giro. Se as letras (R, U', F2…) parecerem estranhas, a página de ${link(notationPath('pt'), 'notação')} mostra cada uma acontecendo.`,
        `No. Pick the <b>beginner</b> method, enter the colors and follow the tutorial: every move is animated in 3D, with an arrow showing the turn. If the letters (R, U', F2…) look strange, the ${link(notationPath('en'), 'notation')} page shows each one happening.`, `No. Elige el método <b>para principiantes</b>, indica los colores y sigue el tutorial: cada movimiento aparece animado en 3D, con una flecha que muestra el giro. Si las letras (R, U', F2…) te parecen raras, la página de ${link(notationPath('es'), 'notación')} muestra cada una en acción.`,
      ),
  },
  {
    id: 'tempo',
    q: () => tr('Quanto tempo leva para aprender a resolver o cubo?', 'How long does it take to learn to solve the cube?', '¿Cuánto se tarda en aprender a resolver el cubo?'),
    a: () =>
      tr(
        'Seguindo o tutorial, a primeira resolução sai no mesmo dia, em menos de uma hora. Para resolver <b>sem ajuda</b>, a maioria das pessoas leva de alguns dias a algumas semanas praticando o método para iniciantes: são poucas etapas e poucos algoritmos, que vão ficando automáticos.',
        'Following the tutorial, your first solve happens the same day, in under an hour. To solve it <b>on your own</b>, most people need a few days to a few weeks of practice with the beginner method: it has few stages and few algorithms, and they become automatic.', 'Siguiendo el tutorial, la primera resolución sale el mismo día, en menos de una hora. Para resolverlo <b>sin ayuda</b>, la mayoría de la gente tarda de unos días a unas semanas practicando el método para principiantes: tiene pocas etapas y pocos algoritmos, que se vuelven automáticos.',
      ),
  },
  {
    id: 'metodo',
    q: () => tr('Qual método escolher: iniciante ou CFOP?', 'Which method should I pick: beginner or CFOP?', '¿Qué método elijo: principiante o CFOP?'),
    a: () =>
      tr(
        `Comece pelo <b>iniciante</b>: é mais fácil de entender e de decorar. O <b>CFOP</b> é o que os speedcubers usam para ficar rápidos; vale a pena quando você já resolve sozinho. Os algoritmos do CFOP estão na página de ${link(algsPath('pt'), 'algoritmos OLL e PLL')}, com modo treino.`,
        `Start with <b>beginner</b>: it’s easier to understand and memorize. <b>CFOP</b> is what speedcubers use to get fast; it’s worth it once you can solve on your own. The CFOP algorithms are on the ${link(algsPath('en'), 'OLL and PLL algorithms')} page, with a practice mode.`, `Empieza por el de <b>principiantes</b>: es más fácil de entender y memorizar. El <b>CFOP</b> es el que usan los speedcubers para ser rápidos; vale la pena cuando ya lo resuelves solo. Los algoritmos del CFOP están en la página de ${link(algsPath('es'), 'algoritmos OLL y PLL')}, con modo de práctica.`,
      ),
  },
  {
    id: 'camera',
    q: () => tr('Como usar a câmera para informar as cores?', 'How do I use the camera to enter the colors?', '¿Cómo uso la cámara para indicar los colores?'),
    a: () =>
      tr(
        'Procure um lugar bem iluminado, sem luz batendo direto no cubo (o reflexo apaga as cores). Segure a face dentro do quadro, reta e perto, e siga a ordem que aparece na tela. No fim, confira a revisão: se alguma cor saiu errada, refaça só aquela face ou corrija pintando.',
        'Find a well-lit spot without light shining straight on the cube (glare washes out the colors). Hold the face inside the frame, straight and close, and follow the order on the screen. At the end, check the review: if a color came out wrong, rescan just that face or fix it by painting.', 'Busca un lugar bien iluminado, sin luz directa sobre el cubo (el reflejo apaga los colores). Pon la cara dentro del recuadro, recta y cerca, y sigue el orden que aparece en la pantalla. Al final, revisa el resumen: si algún color salió mal, vuelve a escanear solo esa cara o corrígelo pintando.',
      ),
  },
  {
    id: 'errei',
    q: () => tr('Errei um movimento no meio do tutorial. Perdi tudo?', 'I made a wrong move in the middle of the tutorial. Is it all lost?', 'Me equivoqué en un movimiento en medio del tutorial. ¿Lo perdí todo?'),
    a: () =>
      tr(
        'Não. Se você sabe qual giro fez errado, desfaça girando ao contrário. Se não sabe, informe as cores de novo (pintando ou pela câmera) e o site calcula uma solução nova a partir de onde o cubo está agora. O site também lembra o passo em que você parou, mesmo fechando a página.',
        'No. If you know which turn was wrong, undo it by turning the other way. If you don’t, enter the colors again (painting or with the camera) and the site works out a new solution from where the cube is now. The site also remembers the step you stopped at, even if you close the page.', 'No. Si sabes qué giro hiciste mal, deshazlo girando al revés. Si no lo sabes, indica los colores de nuevo (pintando o con la cámara) y la web calcula una solución nueva desde donde está el cubo ahora. La web también recuerda el paso en el que te quedaste, aunque cierres la página.',
      ),
  },
  {
    id: 'comprar',
    q: () => tr('Qual cubo comprar para começar?', 'Which cube should I buy to start?', '¿Qué cubo compro para empezar?'),
    a: () =>
      tr(
        'Um <b>3x3 magnético de entrada</b>, das marcas de speedcube. Custam pouco mais que um cubo comum e giram muito mais leve, sem travar, o que ajuda bastante no começo. Prefira adesivos coloridos direto no plástico (sem adesivo), que não descascam.',
        'An <b>entry-level magnetic 3x3</b> from one of the speedcube brands. They cost a little more than a regular cube and turn much more smoothly, without locking up, which helps a lot at the start. Stickerless ones (colored plastic) are a good pick since nothing peels off.', 'Un <b>3x3 magnético de iniciación</b> de alguna de las marcas de speedcube. Cuestan poco más que un cubo normal y giran mucho más suave, sin trabarse, lo que ayuda mucho al principio. Los que no llevan pegatinas (plástico de colores) son buena opción porque no se despegan.',
      ),
  },
  {
    id: 'rapido',
    q: () => tr('Como ficar mais rápido?', 'How do I get faster?', '¿Cómo puedo ser más rápido?'),
    a: () =>
      tr(
        `Use o ${link(timerPath('pt'), 'cronômetro')} para acompanhar as suas médias e passe para o CFOP. Aprenda primeiro a OLL em 2 etapas e a PLL completa, e treine os casos na página de ${link(algsPath('pt'), 'algoritmos')}. Olhar a próxima peça enquanto gira a atual vale mais do que girar mais depressa.`,
        `Use the ${link(timerPath('en'), 'timer')} to follow your averages and move on to CFOP. Learn 2-look OLL and full PLL first, and practice the cases on the ${link(algsPath('en'), 'algorithms')} page. Looking for the next piece while you turn the current one matters more than turning faster.`, `Usa el ${link(timerPath('es'), 'cronómetro')} para seguir tus medias y pasa al CFOP. Aprende primero la OLL en 2 pasos y la PLL completa, y practica los casos en la página de ${link(algsPath('es'), 'algoritmos')}. Buscar la siguiente pieza mientras giras la actual importa más que girar más rápido.`,
      ),
  },
  {
    id: 'puzzles',
    q: () => tr('Quais puzzles o CuboGuia resolve?', 'Which puzzles does CuboGuia solve?', '¿Qué puzzles resuelve CuboGuia?'),
    a: () =>
      tr(
        `Os cubos ${link(puzzlePath('cube2', 'pt'), '2x2')}, ${link(puzzlePath('cube3', 'pt'), '3x3')}, ${link(puzzlePath('cube4', 'pt'), '4x4')}, ${link(puzzlePath('cube5', 'pt'), '5x5')}, ${link(puzzlePath('cube6', 'pt'), '6x6')} e ${link(puzzlePath('cube7', 'pt'), '7x7')}, o ${link(puzzlePath('pyraminx', 'pt'), 'Pyraminx')}, o ${link(puzzlePath('skewb', 'pt'), 'Skewb')} e o ${link(puzzlePath('megaminx', 'pt'), 'Megaminx')}. Em todos dá para pintar as cores ou usar a câmera.`,
        `The ${link(puzzlePath('cube2', 'en'), '2x2')}, ${link(puzzlePath('cube3', 'en'), '3x3')}, ${link(puzzlePath('cube4', 'en'), '4x4')}, ${link(puzzlePath('cube5', 'en'), '5x5')}, ${link(puzzlePath('cube6', 'en'), '6x6')} and ${link(puzzlePath('cube7', 'en'), '7x7')} cubes, the ${link(puzzlePath('pyraminx', 'en'), 'Pyraminx')}, the ${link(puzzlePath('skewb', 'en'), 'Skewb')} and the ${link(puzzlePath('megaminx', 'en'), 'Megaminx')}. On all of them you can paint the colors or use the camera.`, `Los cubos ${link(puzzlePath('cube2', 'es'), '2x2')}, ${link(puzzlePath('cube3', 'es'), '3x3')}, ${link(puzzlePath('cube4', 'es'), '4x4')}, ${link(puzzlePath('cube5', 'es'), '5x5')}, ${link(puzzlePath('cube6', 'es'), '6x6')} y ${link(puzzlePath('cube7', 'es'), '7x7')}, el ${link(puzzlePath('pyraminx', 'es'), 'Pyraminx')}, el ${link(puzzlePath('skewb', 'es'), 'Skewb')} y el ${link(puzzlePath('megaminx', 'es'), 'Megaminx')}. En todos puedes pintar los colores o usar la cámara.`,
      ),
  },
  {
    id: 'gratis',
    q: () => tr('É grátis? Precisa de cadastro? O site guarda meus dados?', 'Is it free? Do I need an account? Does the site keep my data?', '¿Es gratis? ¿Necesito una cuenta? ¿La web guarda mis datos?'),
    a: () =>
      tr(
        'É grátis e sem cadastro. Os seus tempos, sessões e o progresso dos tutoriais ficam guardados <b>só no seu aparelho</b>; nada disso vai para um servidor. O site conta as visitas de forma anônima, sem cookies, só para saber quais páginas são mais usadas.',
        'It’s free and there’s no account. Your times, sessions and tutorial progress are stored <b>only on your device</b>; none of it goes to a server. The site counts visits anonymously, without cookies, just to know which pages are used most.', 'Es gratis y no hay cuenta. Tus tiempos, sesiones y el progreso de los tutoriales se guardan <b>solo en tu dispositivo</b>; nada de eso va a un servidor. La web cuenta las visitas de forma anónima, sin cookies, solo para saber qué páginas se usan más.',
      ),
  },
  {
    id: 'offline',
    q: () => tr('Funciona sem internet?', 'Does it work offline?', '¿Funciona sin internet?'),
    a: () =>
      tr(
        'Sim. Depois da primeira visita, instale o CuboGuia como app (botão "Instalar app" no menu, ou "Adicionar à tela de início" no iPhone) e ele abre mesmo sem internet.',
        'Yes. After the first visit, install CuboGuia as an app ("Install app" button in the menu, or "Add to Home Screen" on iPhone) and it opens even without internet.', 'Sí. Después de la primera visita, instala CuboGuia como app (botón "Instalar app" en el menú, o "Añadir a pantalla de inicio" en el iPhone) y se abre incluso sin internet.',
      ),
  },
  {
    id: 'contato',
    q: () => tr('Como mando uma sugestão ou aviso de um erro?', 'How do I send a suggestion or report a bug?', '¿Cómo envío una sugerencia o aviso de un error?'),
    a: () =>
      tr(
        `Pelo link "Mandar sugestão ou avisar erro", no fim de qualquer página, ou <a data-feedback href="mailto:${FEEDBACK_EMAIL}">mandando um e-mail</a>. O endereço da página em que você estava já vai junto.`,
        `Through the "Send a suggestion or report a bug" link at the bottom of any page, or by <a data-feedback href="mailto:${FEEDBACK_EMAIL}">sending an email</a>. The address of the page you were on goes along.`, `Con el enlace "Enviar una sugerencia o avisar de un error", al final de cualquier página, o <a data-feedback href="mailto:${FEEDBACK_EMAIL}">enviando un correo</a>. La dirección de la página en la que estabas va incluida.`,
      ),
  },
];

export function renderFaq(app: HTMLElement) {
  app.innerHTML = `
  <section class="page narrow faq">
    <span class="eyebrow">${tr('Ajuda', 'Help', 'Ayuda')}</span>
    <h1>${tr('Perguntas frequentes', 'Frequently asked questions', 'Preguntas frecuentes')}</h1>
    <p class="lead">${tr('As dúvidas mais comuns de quem está aprendendo a resolver o cubo mágico.', 'The most common questions from people learning to solve the Rubik’s cube.', 'Las dudas más comunes de quien está aprendiendo a resolver el cubo de Rubik.')}</p>
    <div class="faq-list">
      ${FAQS.map(
        (f, i) => `
        <details class="faq-item card" id="${f.id}" ${i === 0 || location.hash === `#${f.id}` ? 'open' : ''}>
          <summary><span>${f.q()}</span>${icon('chevronDown')}</summary>
          <div class="faq-a"><p>${f.a()}</p></div>
        </details>`,
      ).join('')}
    </div>
    <div class="faq-end card">
      <p>${tr('Pronto para tentar?', 'Ready to try?', '¿Listo para intentarlo?')}</p>
      <a class="btn primary" href="${puzzlePath('cube3')}">${icon('play')}${tr('Resolver meu 3x3', 'Solve my 3x3', 'Resolver mi 3x3')}</a>
      <a class="btn ghost" href="${homePath()}">${tr('Ver todos os puzzles', 'See all puzzles', 'Ver todos los puzzles')}</a>
    </div>
  </section>`;
}
