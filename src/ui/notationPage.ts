/**
 * Página "Aprenda a notação" (/notacao, /en/notation): o que quer dizer cada letra dos tutoriais
 * e algoritmos. Cada movimento é um cartão; tocar no cartão mostra a seta e anima o giro no 3D.
 */
import { tr } from '../core/i18n';
import { PUZZLES, loadPuzzle } from '../core/registry';
import { NOTATION_PUZZLES, algsPath, notationPath, puzzlePath } from '../core/router';
import type { PuzzleImpl, PuzzleView } from '../core/types';
import { describeNxNMove } from '../puzzles/nxn/text';
import { icon } from './icons';
import { notationHtml } from './notation';

interface Group {
  title: string;
  about: string;
  moves: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** nome da aba de cada puzzle */
const tabName = (id: string) => (id === 'cube5' ? tr('Cubos grandes', 'Big cubes', 'Cubos grandes') : PUZZLES.find((p) => p.id === id)!.short);

function groupsFor(id: string, impl: PuzzleImpl): Group[] {
  if (id === 'cube3')
    return [
      {
        title: tr('As 6 faces', 'The 6 faces', 'Las 6 caras'),
        about: tr(
          'Cada letra é uma face, pela inicial em inglês: <b>R</b> (Right) direita, <b>L</b> (Left) esquerda, <b>U</b> (Up) cima, <b>D</b> (Down) baixo, <b>F</b> (Front) frente e <b>B</b> (Back) trás. Só a letra = ¼ de volta no sentido <b>horário, olhando de frente para aquela face</b>.',
          'Each letter is a face: <b>R</b> right, <b>L</b> left, <b>U</b> up, <b>D</b> down, <b>F</b> front and <b>B</b> back. The letter alone = a ¼ turn <b>clockwise, as seen looking straight at that face</b>.', 'Cada letra es una cara, por su inicial en inglés: <b>R</b> (Right) derecha, <b>L</b> (Left) izquierda, <b>U</b> (Up) arriba, <b>D</b> (Down) abajo, <b>F</b> (Front) frente y <b>B</b> (Back) atrás. La letra sola = ¼ de vuelta en sentido <b>horario, mirando esa cara de frente</b>.',
        ),
        moves: ['R', 'L', 'U', 'D', 'F', 'B'],
      },
      {
        title: tr("O sentido: ' e 2", "The direction: ' and 2", "El sentido: ' y 2"),
        about: tr(
          "Com apóstrofo (<b>R'</b>, fala-se “R linha”) o giro é <b>anti-horário</b>. Com 2 (<b>R2</b>) é <b>meia volta</b> — tanto faz para que lado.",
          "With an apostrophe (<b>R'</b>, said “R prime”) the turn is <b>counterclockwise</b>. With a 2 (<b>R2</b>) it’s a <b>half turn</b> — either way works.", "Con apóstrofo (<b>R'</b>, se dice “R prima”) el giro es <b>antihorario</b>. Con 2 (<b>R2</b>) es <b>media vuelta</b>: da igual hacia qué lado.",
        ),
        moves: ['R', "R'", 'R2', 'U', "U'", 'U2'],
      },
      {
        title: tr('Duas camadas: letra minúscula ou w', 'Two layers: lowercase or w', 'Dos capas: minúscula o w'),
        about: tr(
          '<b>r</b> (também escrito <b>Rw</b>) gira a face da direita <b>junto com a camada do meio</b>. A mesma ideia vale para u, f, l, d e b.',
          '<b>r</b> (also written <b>Rw</b>) turns the right face <b>together with the middle layer</b>. Same idea for u, f, l, d and b.', '<b>r</b> (también escrito <b>Rw</b>) gira la cara derecha <b>junto con la capa del medio</b>. La misma idea vale para u, f, l, d y b.',
        ),
        moves: ['r', "r'", 'u', 'f'],
      },
      {
        title: tr('Fatias do meio: M, E e S', 'Middle slices: M, E and S', 'Capas del medio: M, E y S'),
        about: tr(
          '<b>M</b> é a fatia entre a direita e a esquerda, no sentido do L. <b>E</b> fica entre cima e baixo, no sentido do D. <b>S</b> fica entre a frente e trás, no sentido do F.',
          '<b>M</b> is the slice between right and left, turning like L. <b>E</b> sits between up and down, turning like D. <b>S</b> sits between front and back, turning like F.', '<b>M</b> es la capa entre la derecha y la izquierda, en el sentido de L. <b>E</b> está entre arriba y abajo, en el sentido de D. <b>S</b> está entre el frente y atrás, en el sentido de F.',
        ),
        moves: ['M', "M'", 'E', 'S'],
      },
      {
        title: tr('Girar o cubo inteiro: x, y e z', 'Turning the whole cube: x, y and z', 'Girar el cubo entero: x, y y z'),
        about: tr(
          'Não mexem em nenhuma peça: você só vira o cubo na mão. <b>x</b> como o R, <b>y</b> como o U e <b>z</b> como o F.',
          'They don’t move any piece: you just turn the cube in your hands. <b>x</b> like R, <b>y</b> like U and <b>z</b> like F.', 'No mueven ninguna pieza: solo giras el cubo en las manos. <b>x</b> como R, <b>y</b> como U y <b>z</b> como F.',
        ),
        moves: ['x', 'y', 'z'],
      },
    ];
  if (id === 'cube5')
    return [
      {
        title: tr('Só uma camada de dentro: 2R', 'A single inner layer: 2R', 'Una sola capa interna: 2R'),
        about: tr(
          'O número antes da letra diz <b>qual camada</b>, contando a partir da face: <b>2R</b> é só a 2ª camada a partir da direita, sem a face. No 6x6 e no 7x7 também aparece <b>3R</b> (só a 3ª).',
          'The number before the letter says <b>which layer</b>, counting from the face: <b>2R</b> is just the 2nd layer from the right, without the face. On the 6x6 and 7x7 you’ll also see <b>3R</b> (just the 3rd).', 'El número antes de la letra dice <b>qué capa</b>, contando desde la cara: <b>2R</b> es solo la 2.ª capa desde la derecha, sin la cara. En el 6x6 y el 7x7 también verás <b>3R</b> (solo la 3.ª).',
        ),
        moves: ['2R', "2R'", '2U', '2F'],
      },
      {
        title: tr('Várias camadas juntas: Rw e 3Rw', 'Several layers together: Rw and 3Rw', 'Varias capas juntas: Rw y 3Rw'),
        about: tr(
          'Com <b>w</b>, a face gira <b>junto</b> com as camadas de dentro: <b>Rw</b> = 2 camadas, <b>3Rw</b> = 3 camadas (a face e mais duas).',
          'With <b>w</b>, the face turns <b>together</b> with the inner layers: <b>Rw</b> = 2 layers, <b>3Rw</b> = 3 layers (the face plus two).', 'Con <b>w</b>, la cara gira <b>junto con</b> las capas internas: <b>Rw</b> = 2 capas, <b>3Rw</b> = 3 capas (la cara y dos más).',
        ),
        moves: ['Rw', '3Rw', 'Uw', "3Uw'"],
      },
      {
        title: tr('A face e o meio', 'The face and the middle', 'La cara y el medio'),
        about: tr(
          '<b>R</b> continua sendo só a face. Nos cubos ímpares (5x5 e 7x7), <b>M</b> é a fatia bem do meio, no sentido do L.',
          '<b>R</b> is still just the face. On odd cubes (5x5 and 7x7), <b>M</b> is the very middle slice, turning like L.', '<b>R</b> sigue siendo solo la cara. En los cubos impares (5x5 y 7x7), <b>M</b> es la capa justo del medio, en el sentido de L.',
        ),
        moves: ['R', "R'", 'M'],
      },
    ];
  // Pyraminx, Skewb e Megaminx: os movimentos da ajuda de notação do próprio puzzle
  const works = (m: string) => {
    try {
      impl.applyMove(impl.solvedState(), m);
      return true;
    } catch {
      return false;
    }
  };
  const base = impl.notationHelp.map((h) => h.move).filter(works);
  const groups: Group[] = [
    {
      title: tr('Os giros', 'The turns', 'Los giros'),
      about:
        impl.notationIntro ??
        tr('Cada letra é uma parte do puzzle. Só a letra = giro no sentido <b>horário</b>, olhando de frente para aquela parte.', 'Each letter is a part of the puzzle. The letter alone = a <b>clockwise</b> turn, looking straight at that part.', 'Cada letra es una parte del puzzle. La letra sola = un giro <b>horario</b>, mirando esa parte de frente.'),
      moves: base,
    },
    {
      title: tr("O sentido: '", "The direction: '", "El sentido: '"),
      about: tr("Com apóstrofo (<b>R'</b>) o giro é <b>anti-horário</b>.", "With an apostrophe (<b>R'</b>) the turn is <b>counterclockwise</b>.", "Con apóstrofo (<b>R'</b>) el giro es <b>antihorario</b>."),
      moves: base.slice(0, 2).flatMap((m) => [m, impl.invertMove(m)]),
    },
  ];
  const tips = ['u', 'l', 'r', 'b'];
  if (id === 'pyraminx' && tips.every(works))
    groups.push({
      title: tr('As pontas: letra minúscula', 'The tips: lowercase', 'Las puntas: minúscula'),
      about: tr('Letra minúscula gira <b>só a pontinha</b> daquele vértice. As pontas não atrapalham o resto: dá para acertá-las no começo ou no fim.', 'A lowercase letter turns <b>just the little tip</b> of that corner. Tips don’t affect the rest: you can fix them at the start or at the end.', 'Una letra minúscula gira <b>solo la puntita</b> de esa esquina. Las puntas no afectan al resto: puedes arreglarlas al principio o al final.'),
      moves: tips,
    });
  return groups;
}

export async function renderNotation(app: HTMLElement, puzzleId = 'cube3') {
  const id = NOTATION_PUZZLES.includes(puzzleId) ? puzzleId : 'cube3';
  const impl = await loadPuzzle(id);
  const def = PUZZLES.find((p) => p.id === id)!;
  const cube = id === 'cube3' || id === 'cube5';
  const describe = (m: string) => (cube ? describeNxNMove(m, true) : (impl.describeMove?.(m) ?? m));
  const groups = groupsFor(id, impl);
  let alive = true;
  let busy = false;
  let token = 0;

  app.innerHTML = `
  <section class="page workspace notation-page">
    <div class="ws-header nt-head">
      <span class="eyebrow">${tr('Notação', 'Notation', 'Notación')}</span>
      <h1>${tr('Aprenda a notação', 'Learn the notation', 'Aprende la notación')}</h1>
      <nav class="al-puzzles" aria-label="Puzzle">
        ${NOTATION_PUZZLES.map((p) => `<a href="${notationPath(undefined, p)}" class="${p === id ? 'on' : ''}" ${p === id ? 'aria-current="page"' : ''}>${tabName(p)}</a>`).join('')}
      </nav>
      <p class="lead">${tr(
        'As letras dos tutoriais e algoritmos dizem <b>o que girar e para que lado</b>. Toque num movimento para ver ele acontecer no 3D.',
        'The letters in tutorials and algorithms say <b>what to turn and which way</b>. Tap a move to watch it happen in 3D.', 'Las letras de los tutoriales y algoritmos dicen <b>qué girar y hacia qué lado</b>. Toca un movimiento para verlo en 3D.',
      )}</p>
    </div>
    <div class="ws-grid">
      <div class="ws-view card">
        <div class="view-host" id="nt-view"></div>
        <div class="move-badge" aria-live="polite"><strong></strong><span></span></div>
        <button class="icon-btn view-reset" title="${tr('Voltar à vista inicial', 'Reset the view', 'Volver a la vista inicial')}" aria-label="${tr('Voltar à vista inicial', 'Reset the view', 'Volver a la vista inicial')}">${icon('resetView')}</button>
      </div>
      <div class="nt-groups">
        ${groups
          .map(
            (g) => `<div class="card nt-group">
              <h2>${g.title}</h2>
              <p>${g.about}</p>
              <div class="nt-moves">${g.moves.map((m) => `<button type="button" class="nt-move" data-m="${m}"><code>${m}</code><span>${describe(m)}</span></button>`).join('')}</div>
            </div>`,
          )
          .join('')}
        <details class="card notation nt-summary">
          <summary>${tr(`Resumo da notação do ${def.short}`, `${def.short} notation summary`, `Resumen de la notación del ${def.short}`)}</summary>
          ${notationHtml(impl)}
        </details>
        <div class="row-actions">
          <a class="btn primary" href="${puzzlePath(id)}">${tr('Resolver meu puzzle', 'Solve my puzzle', 'Resolver mi puzzle')}</a>
          ${['cube3', 'pyraminx'].includes(id) ? `<a class="btn ghost" href="${algsPath(undefined, id)}">${tr('Ver os algoritmos', 'See the algorithms', 'Ver los algoritmos')}</a>` : ''}
        </div>
      </div>
    </div>
  </section>`;

  const root = app.querySelector<HTMLElement>('.notation-page')!;
  const view: PuzzleView = impl.createView(root.querySelector('#nt-view')!);
  const solved = impl.solvedState();
  view.setState(solved);
  root.querySelector('.view-reset')!.addEventListener('click', () => view.resetCamera());
  const badge = root.querySelector<HTMLElement>('.move-badge')!;

  /** mostra a seta, anima o giro, deixa um tempo para olhar e volta ao puzzle arrumado */
  async function demo(m: string, btn: HTMLElement) {
    if (busy) return;
    busy = true;
    const my = ++token;
    root.querySelectorAll('.nt-move.on').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    badge.querySelector('strong')!.textContent = m;
    badge.querySelector('span')!.textContent = describe(m);
    badge.classList.add('show');
    badge.classList.remove('active');
    view.setState(solved);
    view.showMoveHint?.(m);
    await sleep(650);
    if (!alive) return;
    view.showMoveHint?.(null);
    badge.classList.add('active');
    await view.animateMove(m, m.endsWith('2') && !/^\d[URFDLB]w?$/.test(m) ? 1100 : 800);
    if (!alive) return;
    busy = false;
    await sleep(1400);
    if (!alive || my !== token) return;
    view.setState(solved);
    badge.classList.remove('active');
    btn.classList.remove('on');
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.nt-move');
    if (b) demo(b.dataset.m!, b);
  });

  return () => {
    alive = false;
    view.dispose();
  };
}
