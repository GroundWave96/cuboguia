import { getLang, tr } from '../core/i18n';
import { clearProgress, listProgress, type Progress } from '../core/progress';
import { PUZZLES, loadPuzzle } from '../core/registry';
import { algsPath, faqPath, homePath, notationPath, puzzlePath, solvePath, timerPath } from '../core/router';
import type { PuzzleImpl, PuzzleView } from '../core/types';
import { icon, type IconName } from './icons';

/** quantos movimentos de embaralho e a velocidade da vitrine para cada puzzle */
const SHOW: Record<string, { scramble: number; ms: number }> = {
  cube2: { scramble: 10, ms: 190 },
  cube3: { scramble: 16, ms: 170 },
  cube4: { scramble: 18, ms: 160 },
  cube5: { scramble: 18, ms: 150 },
  cube6: { scramble: 20, ms: 140 },
  cube7: { scramble: 22, ms: 130 },
  pyraminx: { scramble: 9, ms: 220 },
  skewb: { scramble: 9, ms: 230 },
  megaminx: { scramble: 14, ms: 200 },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** os mais pesados de montar em 3D: ficam fora da vitrine em aparelho fraco */
const HEAVY = new Set(['cube6', 'cube7', 'megaminx']);

/** aparelho com pouco processador ou memória */
export function weakDevice(nav: { hardwareConcurrency?: number; deviceMemory?: number } = navigator): boolean {
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}

/**
 * Ordem da vitrine: começa sempre pelo 3x3 (o mais conhecido e leve) e depois sorteia sem
 * repetir o anterior. Em aparelho fraco, pula os puzzles pesados.
 */
export function showcaseOrder(ids: string[], weak: boolean, rand: () => number = Math.random) {
  const pool = weak ? ids.filter((id) => !HEAVY.has(id)) : ids;
  let last = '';
  return () => {
    if (!last && pool.includes('cube3')) return (last = 'cube3');
    const opts = pool.filter((id) => id !== last);
    return (last = opts[Math.floor(rand() * opts.length)] ?? pool[0]);
  };
}

/** renderizadores que desenham o 3D no processador */
export const isSoftwareRenderer = (name: string) => /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(name);

/**
 * Sem placa de vídeo (o navegador desenha o 3D no processador), a vitrine animada deixa
 * tudo lento: aí ela vira um desenho parado.
 */
function slowGraphics(): boolean {
  try {
    const c = document.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: true };
    const gl = (c.getContext('webgl2', opts) ?? c.getContext('webgl', opts)) as WebGLRenderingContext | null;
    if (!gl) return true;
    // o nome da placa de vídeo entrega o desenho por software (SwiftShader, llvmpipe…)
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoftwareRenderer(name);
  } catch {
    return true;
  }
}

/** os cartões "Depois de resolver": o resto do site, para quem já resolveu o primeiro */
function afterCards(): { href: string; icon: IconName; title: string; text: string; go: string }[] {
  return [
    {
      href: notationPath(),
      icon: 'info',
      title: tr('Aprenda a notação', 'Learn the notation'),
      text: tr("O que significam R, U', F2 e as outras letras, cada movimento animado no 3D.", "What R, U', F2 and the other letters mean, each move animated in 3D."),
      go: tr('Ver os movimentos', 'See the moves'),
    },
    {
      href: timerPath(),
      icon: 'history',
      title: tr('Cronômetro', 'Timer'),
      text: tr('Estilo competição, com embaralho, médias, recordes e gráfico da sua evolução.', 'Competition style, with scrambles, averages, records and a progress chart.'),
      go: tr('Cronometrar', 'Start timing'),
    },
    {
      href: algsPath(),
      icon: 'sparkles',
      title: tr('Algoritmos OLL e PLL', 'OLL and PLL algorithms'),
      text: tr('Os algoritmos do CFOP para ficar rápido, com animação e modo treino.', 'The CFOP algorithms to get fast, with animation and a practice mode.'),
      go: tr('Ver os algoritmos', 'See the algorithms'),
    },
    {
      href: timerPath(),
      icon: 'trophy',
      title: tr('Desafie um amigo', 'Challenge a friend'),
      text: tr('Resolva no cronômetro e mande o link: o amigo recebe o mesmo embaralho para tentar bater o seu tempo.', 'Solve on the timer and send the link: your friend gets the same scramble to try to beat your time.'),
      go: tr('Criar um desafio', 'Create a challenge'),
    },
  ];
}

/** "há 2 horas" / "2 hours ago" */
function ago(t: number): string {
  const s = (t - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(getLang() === 'en' ? 'en' : 'pt-BR', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return tr('agora há pouco', 'just now');
}

/** a tela inicial mostra o mais recente; os outros (até 3, o que fica guardado) ficam em "+ N outros" */
const RESUME_MAX = 4;
const resumeKey = (p: Progress) => `${p.puzzle}|${p.method}|${p.state}`;

function resumeRow(p: Progress): string {
  const def = PUZZLES.find((d) => d.id === p.puzzle)!;
  return `<div class="resume-row" data-key="${resumeKey(p)}">
    <a class="resume-item" href="${solvePath(p.puzzle, p.method, p.state)}">
      <span class="resume-icon" aria-hidden="true">${def.icon}</span>
      <span class="resume-text"><b>${def.name}</b><small>${tr(`Passo ${p.step + 1} de ${p.steps}`, `Step ${p.step + 1} of ${p.steps}`)} · ${ago(p.t)}</small>
        <span class="resume-bar"><span style="width:${Math.round((p.pos / p.total) * 100)}%"></span></span></span>
      <span class="resume-go">${icon('play')}</span>
    </a>
    <button type="button" class="resume-x" data-forget="${resumeKey(p)}" aria-label="${tr(`Esquecer o tutorial do ${def.short}`, `Forget the ${def.short} tutorial`)}" title="${tr('Esquecer este tutorial', 'Forget this tutorial')}">${icon('close')}</button>
  </div>`;
}

/** tutoriais em andamento neste aparelho: o mais recente à vista, os outros guardados num "+ N outros" */
function resumeHtml(cls = '', open = false): string {
  const list = listProgress()
    .filter((p) => PUZZLES.some((d) => d.id === p.puzzle && d.available))
    .slice(0, RESUME_MAX);
  if (!list.length) return '';
  const [first, ...rest] = list;
  return `<div class="resume-home ${cls}">
    <span class="resume-home-title">${icon('history')}${tr('Continue de onde parou', 'Pick up where you left off')}</span>
    ${resumeRow(first)}
    ${
      rest.length
        ? `<details class="resume-more" ${open ? 'open' : ''}><summary>${icon('chevronDown')}<span>${tr(`+ ${rest.length} ${rest.length > 1 ? 'outros' : 'outro'}`, `+ ${rest.length} more`)}</span></summary>${rest.map(resumeRow).join('')}</details>`
        : ''
    }
  </div>`;
}

export function renderHome(app: HTMLElement) {
  const available = PUZZLES.filter((p) => p.available);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  app.innerHTML = `
  <section class="hero-wrap">
    <div class="hero-bg" aria-hidden="true">
      ${PUZZLES.concat(PUZZLES)
        .slice(0, 10)
        .map((p, i) => `<div class="floater f${i}">${p.icon}</div>`)
        .join('')}
    </div>
    <div class="page hero">
      ${resumeHtml('resume-top')}
      <div class="hero-text">
        <span class="eyebrow">${tr('Tutorial interativo em 3D', 'Interactive 3D tutorial')}</span>
        <h1>${tr('Resolva o <em>seu</em> cubo mágico, passo a passo.', 'Solve <em>your</em> Rubik’s cube, step by step.')}</h1>
        <p class="lead">${tr(
          'Mostre como o seu puzzle está — pintando as cores no modelo 3D ou apontando a câmera — e receba um tutorial animado, no seu ritmo: do método de iniciante até o CFOP dos speedcubers.',
          'Show how your puzzle looks — by painting the colors on the 3D model or pointing your camera at it — and get an animated tutorial at your own pace: from the beginner method to the speedcubers’ CFOP.',
        )}</p>
        <div class="hero-cta">
          <a class="btn primary big" id="hero-go" href="${puzzlePath('cube3')}">${tr('Resolver meu', 'Solve my')} <span id="hero-go-name">3x3</span></a>
          <a class="btn ghost big" href="${homePath()}" data-scroll="como-funciona">${tr('Como funciona', 'How it works')}</a>
        </div>
        ${resumeHtml('resume-side')}
        <ul class="hero-badges">
          <li>${icon('palette')}${tr('Pinte ou use a câmera', 'Paint or use the camera')}</li>
          <li>${icon('levels')}${tr('Iniciante e avançado', 'Beginner and advanced')}</li>
          <li>${icon('heart')}${tr('100% grátis', '100% free')}</li>
        </ul>
      </div>
      <div class="showcase">
        <div class="showcase-stage" id="hero-cube">
          <div class="burst" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
        </div>
        <div class="showcase-caption" id="hud-name" aria-hidden="true"></div>
      </div>
    </div>
  </section>

  <section class="page stats reveal">
    <div class="stat"><b data-count="${available.length}">0</b><span>puzzles</span></div>
    <div class="stat"><b data-count="" id="stat-methods">0</b><span>${tr('métodos de solução', 'solving methods')}</span></div>
    <div class="stat"><b data-count="2">0</b><span>${tr('jeitos de informar as cores', 'ways to enter the colors')}</span></div>
    <div class="stat"><b data-count="100" data-suffix="%">0</b><span>${tr('grátis, direto no navegador', 'free, right in your browser')}</span></div>
  </section>

  <section class="page" id="como-funciona">
    <h2 class="section-title reveal">${tr('Como funciona', 'How it works')}</h2>
    <div class="how">
      <div class="how-card reveal">
        <div class="how-art art-paint" aria-hidden="true">
          <div class="mini-face">${Array.from({ length: 9 }, (_, i) => `<i style="--d:${i}"></i>`).join('')}</div>
          <div class="brush">${icon('brush')}</div>
        </div>
        <b>1</b><h3>${tr('Informe as cores', 'Enter the colors')}</h3>
        <p>${tr(
          'Pinte os adesivos no modelo 3D ou na planificação — ou aponte a câmera do celular/computador para ler cada face.',
          'Paint the stickers on the 3D model or on the flat layout — or point your phone/computer camera to read each face.',
        )}</p>
      </div>
      <div class="how-card reveal">
        <div class="how-art art-scan" aria-hidden="true">
          <div class="phone"><div class="grid3">${'<i></i>'.repeat(9)}</div><div class="scanline"></div></div>
        </div>
        <b>2</b><h3>${tr('Validamos o puzzle', 'We check the puzzle')}</h3>
        <p>${tr(
          'Conferimos se a combinação existe num puzzle real e apontamos onde pode estar o erro — antes de montar a solução.',
          'We check that the combination can exist on a real puzzle and point out where a mistake may be — before building the solution.',
        )}</p>
      </div>
      <div class="how-card reveal">
        <div class="how-art art-steps" aria-hidden="true">
          <div class="play">${icon('play')}</div>
          <div class="steps">${'<i></i>'.repeat(6)}</div>
        </div>
        <b>3</b><h3>${tr('Siga o tutorial', 'Follow the tutorial')}</h3>
        <p>${tr(
          'Cada passo tem explicação, os movimentos e a animação. Avance, volte e repita no seu ritmo, no iniciante ou no avançado.',
          'Every step has an explanation, the moves and an animation. Go forward, back and repeat at your own pace, beginner or advanced.',
        )}</p>
      </div>
    </div>
  </section>

  <section class="page" id="puzzles">
    <h2 class="section-title reveal">${tr('Escolha o puzzle', 'Choose your puzzle')}</h2>
    <div class="puzzles">
      ${[...available, ...PUZZLES.filter((p) => !p.available)].map(
        (p) => `
        <${p.available ? `a href="${puzzlePath(p.id)}"` : 'div'} class="pz-card reveal ${p.available ? '' : 'soon'}">
          ${p.icon}
          <div><h3>${p.name}</h3><p>${p.subtitle}</p></div>
          ${p.available ? `<span class="tag ok">${tr('Disponível', 'Available')}</span>` : `<span class="tag">${tr('Em breve', 'Coming soon')}</span>`}
        </${p.available ? 'a' : 'div'}>`,
      ).join('')}
    </div>
  </section>

  <section class="page after" id="depois">
    <h2 class="section-title reveal">${tr('Depois de resolver', 'After you solve it')}</h2>
    <p class="after-sub reveal">${tr('Resolveu o primeiro? Agora dá para aprender a ler os movimentos, ficar mais rápido e desafiar os amigos.', 'Solved your first one? Now you can learn to read the moves, get faster and challenge your friends.')}</p>
    <div class="after-grid">
      ${afterCards()
        .map(
          (c) => `<a class="after-card card reveal" href="${c.href}">
            <span class="after-ico">${icon(c.icon)}</span>
            <h3>${c.title}</h3>
            <p>${c.text}</p>
            <span class="after-go">${c.go} →</span>
          </a>`,
        )
        .join('')}
    </div>
    <p class="after-faq reveal">${tr('Ficou com alguma dúvida?', 'Got a question?')} <a href="${faqPath()}">${tr('Veja as perguntas frequentes', 'See the FAQ')} →</a></p>
  </section>`;

  // ---------------------------------------------------------------- esquecer um tutorial em andamento (o X)
  const hero = app.querySelector<HTMLElement>('.hero')!;
  hero.addEventListener('click', (e) => {
    const x = (e.target as HTMLElement).closest<HTMLElement>('[data-forget]');
    if (!x) return;
    const [puzzle, method, state] = x.dataset.forget!.split('|');
    clearProgress(puzzle, method, state);
    // remonta as duas listas (a do celular e a do computador), mantendo o "+ N outros" aberto se estava
    for (const cls of ['resume-top', 'resume-side']) {
      const old = hero.querySelector<HTMLElement>(`.resume-home.${cls}`);
      if (!old) continue;
      const open = !!old.querySelector('details[open]');
      const html = resumeHtml(cls, open);
      if (html) old.outerHTML = html;
      else old.remove();
    }
    // o foco não se perde: vai para o próximo X (ou o botão principal)
    const visible = [...hero.querySelectorAll<HTMLElement>('.resume-x')].find((b) => b.offsetParent !== null);
    (visible ?? hero.querySelector<HTMLElement>('#hero-go'))?.focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------- aparecer ao rolar + contadores
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        en.target.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
        io.unobserve(en.target);
      }),
    { threshold: 0.15 },
  );
  app.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  function countUp(el: HTMLElement) {
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix ?? '';
    if (reduceMotion || !target) {
      el.textContent = target + suffix;
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1100);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  }
  // total de métodos (o número fica no registro: não precisa carregar os puzzles)
  {
    const el = app.querySelector<HTMLElement>('#stat-methods')!;
    el.dataset.count = String(available.reduce((a, p) => a + p.methods, 0));
    if (el.closest('.in')) countUp(el);
  }

  // ---------------------------------------------------------------- vitrine
  // só um enfeite: puzzles em ordem aleatória aparecem, embaralham, se resolvem e dão lugar ao próximo
  const stage = app.querySelector<HTMLElement>('#hero-cube')!;
  const caption = app.querySelector<HTMLElement>('#hud-name')!;
  const goBtn = app.querySelector<HTMLAnchorElement>('#hero-go')!;
  const goName = app.querySelector<HTMLElement>('#hero-go-name')!;
  let alive = true;
  let view: PuzzleView | null = null;
  let onScreen = true;

  // pausa quando a vitrine sai da tela ou a aba fica escondida (economiza bateria)
  const seen = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
  seen.observe(stage);
  const waitVisible = async () => {
    while (alive && (document.hidden || !onScreen)) await sleep(400);
    return alive;
  };

  const nextId = showcaseOrder(
    available.map((p) => p.id),
    weakDevice(navigator as Navigator & { deviceMemory?: number }),
  );

  async function show(id: string): Promise<PuzzleImpl | null> {
    const def = available.find((p) => p.id === id)!;
    const im = await loadPuzzle(id);
    if (!alive) return null;
    view?.dispose();
    view = im.createView(stage);
    view.setAutoRotate?.(true);
    caption.textContent = def.name;
    goName.textContent = def.short;
    goBtn.href = puzzlePath(id);
    stage.classList.remove('fading', 'celebrate');
    return im;
  }

  async function play(moves: string[], ms: number) {
    for (const m of moves) {
      if (!(await waitVisible()) || !view) return false;
      await view.animateMove(m, ms);
    }
    return alive;
  }

  async function loop() {
    while (alive) {
      const id = nextId();
      const impl = await show(id);
      if (!impl) return;
      const cfg = SHOW[id] ?? { scramble: 12, ms: 180 };
      await sleep(900);
      const moves = impl.scramble(cfg.scramble);
      if (!(await play(moves, cfg.ms))) return;
      await sleep(800);
      if (!(await play([...moves].reverse().map(impl.invertMove), cfg.ms * 0.8))) return;
      // comemoração leve, um tempo para olhar e some suave
      stage.classList.remove('celebrate');
      void stage.offsetWidth;
      stage.classList.add('celebrate');
      await sleep(1800);
      if (!(await waitVisible())) return;
      stage.classList.add('fading');
      await sleep(520);
    }
  }

  // o 3D é o arquivo mais pesado do site: só começa depois que a página terminou de carregar,
  // e com economia de dados (ou 2G) a vitrine fica num desenho parado
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const lightMode = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
  const start = () => {
    if (!alive) return;
    if (lightMode || slowGraphics()) {
      const def = available.find((p) => p.id === 'cube3') ?? available[0];
      stage.insertAdjacentHTML('beforeend', `<div class="showcase-static" aria-hidden="true">${def.icon}</div>`);
      caption.textContent = def.name;
    } else if (reduceMotion) show(nextId());
    else loop();
  };
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 150));
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });

  return () => {
    alive = false;
    io.disconnect();
    seen.disconnect();
    view?.dispose();
  };
}
