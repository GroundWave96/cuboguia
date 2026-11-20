import { PUZZLES, loadPuzzle } from '../core/registry';
import { puzzlePath } from '../core/router';
import type { PuzzleImpl, PuzzleView } from '../core/types';
import { icon } from './icons';

const short = (name: string) => name.replace('Cubo ', '');

/** quantos movimentos de embaralho e a velocidade da vitrine para cada puzzle */
const SHOW: Record<string, { scramble: number; ms: number }> = {
  cube2: { scramble: 10, ms: 190 },
  cube3: { scramble: 16, ms: 170 },
  cube4: { scramble: 18, ms: 160 },
  cube5: { scramble: 18, ms: 150 },
  pyraminx: { scramble: 9, ms: 220 },
  skewb: { scramble: 9, ms: 230 },
  megaminx: { scramble: 14, ms: 200 },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      <div class="hero-text">
        <span class="eyebrow">Tutorial interativo em 3D</span>
        <h1>Resolva o <em>seu</em> cubo mágico, passo a passo.</h1>
        <p class="lead">Mostre como o seu puzzle está — pintando as cores no modelo 3D ou apontando a câmera — e receba um tutorial animado,
        no seu ritmo: do método de iniciante até o CFOP dos speedcubers.</p>
        <div class="hero-cta">
          <a class="btn primary big" id="hero-go" href="/3x3">Resolver meu <span id="hero-go-name">3x3</span></a>
          <a class="btn ghost big" href="/" data-scroll="como-funciona">Como funciona</a>
        </div>
        <ul class="hero-badges">
          <li>${icon('palette')}Pinte ou use a câmera</li>
          <li>${icon('levels')}Iniciante e avançado</li>
          <li>${icon('heart')}100% grátis</li>
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
    <div class="stat"><b data-count="" id="stat-methods">0</b><span>métodos de solução</span></div>
    <div class="stat"><b data-count="2">0</b><span>jeitos de informar as cores</span></div>
    <div class="stat"><b data-count="100" data-suffix="%">0</b><span>grátis, direto no navegador</span></div>
  </section>

  <section class="page" id="como-funciona">
    <h2 class="section-title reveal">Como funciona</h2>
    <div class="how">
      <div class="how-card reveal">
        <div class="how-art art-paint" aria-hidden="true">
          <div class="mini-face">${Array.from({ length: 9 }, (_, i) => `<i style="--d:${i}"></i>`).join('')}</div>
          <div class="brush">${icon('brush')}</div>
        </div>
        <b>1</b><h3>Informe as cores</h3>
        <p>Pinte os adesivos no modelo 3D ou na planificação — ou aponte a câmera do celular/computador para ler cada face.</p>
      </div>
      <div class="how-card reveal">
        <div class="how-art art-scan" aria-hidden="true">
          <div class="phone"><div class="grid3">${'<i></i>'.repeat(9)}</div><div class="scanline"></div></div>
        </div>
        <b>2</b><h3>Validamos o puzzle</h3>
        <p>Conferimos se a combinação existe num puzzle real e apontamos onde pode estar o erro — antes de montar a solução.</p>
      </div>
      <div class="how-card reveal">
        <div class="how-art art-steps" aria-hidden="true">
          <div class="play">${icon('play')}</div>
          <div class="steps">${'<i></i>'.repeat(6)}</div>
        </div>
        <b>3</b><h3>Siga o tutorial</h3>
        <p>Cada passo tem explicação, os movimentos e a animação. Avance, volte e repita no seu ritmo, no iniciante ou no avançado.</p>
      </div>
    </div>
  </section>

  <section class="page" id="puzzles">
    <h2 class="section-title reveal">Escolha o puzzle</h2>
    <div class="puzzles">
      ${[...available, ...PUZZLES.filter((p) => !p.available)].map(
        (p) => `
        <${p.available ? `a href="${puzzlePath(p.id)}"` : 'div'} class="pz-card reveal ${p.available ? '' : 'soon'}">
          ${p.icon}
          <div><h3>${p.name}</h3><p>${p.subtitle}</p></div>
          ${p.available ? '<span class="tag ok">Disponível</span>' : '<span class="tag">Em breve</span>'}
        </${p.available ? 'a' : 'div'}>`,
      ).join('')}
    </div>
  </section>

  <section class="page final-cta reveal">
    <div class="final-card">
      <h2>Pronto para resolver o seu?</h2>
      <p>Escolha o puzzle e comece agora — leva menos de um minuto para informar as cores.</p>
      <div class="final-buttons">
        ${available.map((p) => `<a class="btn ${p.id === 'cube3' ? 'primary' : 'ghost'} big" href="${puzzlePath(p.id)}">${short(p.name)}</a>`).join('')}
      </div>
    </div>
  </section>`;

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
  // total de métodos (carrega os puzzles em segundo plano)
  Promise.all(available.map((p) => loadPuzzle(p.id))).then((impls) => {
    const el = app.querySelector<HTMLElement>('#stat-methods');
    if (!el) return;
    el.dataset.count = String(impls.reduce((a, im) => a + im.methods.length, 0));
    if (el.closest('.in')) countUp(el);
  });

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

  /** sorteio sem repetir o anterior */
  let last = '';
  const nextId = () => {
    const ids = available.map((p) => p.id).filter((id) => id !== last);
    return (last = ids[Math.floor(Math.random() * ids.length)]);
  };

  async function show(id: string): Promise<PuzzleImpl | null> {
    const def = available.find((p) => p.id === id)!;
    const im = await loadPuzzle(id);
    if (!alive) return null;
    view?.dispose();
    view = im.createView(stage);
    view.setAutoRotate?.(true);
    caption.textContent = def.name;
    goName.textContent = short(def.name);
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

  if (reduceMotion) show(nextId());
  else loop();

  return () => {
    alive = false;
    io.disconnect();
    seen.disconnect();
    view?.dispose();
  };
}
