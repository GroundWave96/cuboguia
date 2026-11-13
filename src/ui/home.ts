import { PUZZLES, loadPuzzle } from '../core/registry';
import type { PuzzleImpl, PuzzleView } from '../core/types';

const short = (name: string) => name.replace('Cubo ', '');

/** quantos movimentos de embaralho e a velocidade da vitrine para cada puzzle */
const SHOW: Record<string, { scramble: number; ms: number }> = {
  cube3: { scramble: 18, ms: 170 },
  cube2: { scramble: 10, ms: 190 },
  pyraminx: { scramble: 9, ms: 220 },
  megaminx: { scramble: 14, ms: 200 },
  cube5: { scramble: 20, ms: 150 },
};

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
          <a class="btn primary big" id="hero-go" href="#/p/cube3">Resolver meu <span id="hero-go-name">3x3</span></a>
          <a class="btn ghost big" href="#/" data-scroll="como-funciona">Como funciona</a>
        </div>
        <ul class="hero-badges">
          <li>🎨 Pinte ou use a câmera</li>
          <li>🧠 Iniciante e avançado</li>
          <li>💸 100% grátis</li>
        </ul>
      </div>
      <div class="showcase">
        <div class="showcase-stage" id="hero-cube">
          <div class="burst" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
        </div>
        <div class="showcase-hud" aria-live="polite">
          <span class="hud-name" id="hud-name">Cubo 3x3</span>
          <span class="hud-status" id="hud-status">Demonstração</span>
        </div>
        <div class="showcase-chips" role="tablist" aria-label="Puzzle da vitrine">
          ${available
            .map((p) => `<button role="tab" class="chip-pz" data-pz="${p.id}" aria-selected="false">${p.icon}<span>${short(p.name)}</span></button>`)
            .join('')}
        </div>
        <div class="showcase-actions">
          <button class="btn ghost sm" data-act="scramble">🔀 Embaralhar</button>
          <button class="btn primary sm" data-act="solve">✨ Resolver</button>
          <button class="btn ghost sm icon-only-sm" data-act="auto" title="Pausar a demonstração" aria-label="Demonstração automática">⏸</button>
        </div>
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
          <div class="brush">🖌️</div>
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
          <div class="play">▶</div>
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
        <${p.available ? `a href="#/p/${p.id}"` : 'div'} class="pz-card reveal ${p.available ? '' : 'soon'}">
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
        ${available.map((p) => `<a class="btn ${p.id === 'cube3' ? 'primary' : 'ghost'} big" href="#/p/${p.id}">${short(p.name)}</a>`).join('')}
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
  const stage = app.querySelector<HTMLElement>('#hero-cube')!;
  const hudName = app.querySelector<HTMLElement>('#hud-name')!;
  const hudStatus = app.querySelector<HTMLElement>('#hud-status')!;
  const goBtn = app.querySelector<HTMLAnchorElement>('#hero-go')!;
  const goName = app.querySelector<HTMLElement>('#hero-go-name')!;
  const autoBtn = app.querySelector<HTMLButtonElement>('[data-act="auto"]')!;
  let alive = true;
  let token = 0; // muda a cada troca de puzzle/ação: cancela animações antigas
  let view: PuzzleView | null = null;
  let impl: PuzzleImpl | null = null;
  let current = '';
  let history: string[] = [];
  let busy = false;
  let auto = !reduceMotion;
  let autoTimer = 0;

  const status = (t: string) => (hudStatus.textContent = t);
  const setAuto = (on: boolean) => {
    auto = on;
    autoBtn.textContent = on ? '⏸' : '▶';
    autoBtn.title = on ? 'Pausar a demonstração' : 'Retomar a demonstração';
    clearTimeout(autoTimer);
    if (on && !busy) autoTimer = window.setTimeout(autoStep, 900);
  };

  async function show(id: string) {
    if (id === current && view) return;
    const my = ++token;
    current = id;
    history = [];
    busy = false;
    const def = available.find((p) => p.id === id)!;
    app.querySelectorAll<HTMLButtonElement>('.chip-pz').forEach((b) => {
      const on = b.dataset.pz === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    hudName.textContent = def.name;
    goName.textContent = short(def.name);
    goBtn.href = `#/p/${id}`;
    stage.classList.add('fading');
    const im = await loadPuzzle(id);
    await new Promise((r) => setTimeout(r, 220));
    if (!alive || my !== token) return;
    view?.dispose();
    impl = im;
    view = im.createView(stage);
    view.setAutoRotate?.(true);
    stage.classList.remove('fading');
    status('Resolvido');
  }

  async function play(moves: string[], ms: number, label: (i: number) => string) {
    const my = token;
    for (let i = 0; i < moves.length; i++) {
      if (!alive || my !== token || !view) return false;
      status(label(i + 1));
      await view.animateMove(moves[i], ms);
    }
    return alive && my === token;
  }

  async function scramble() {
    if (!impl || busy) return false;
    busy = true;
    const cfg = SHOW[current] ?? { scramble: 12, ms: 180 };
    const moves = impl.scramble(cfg.scramble);
    history.push(...moves);
    const ok = await play(moves, cfg.ms, (i) => `Embaralhando… ${i}/${moves.length}`);
    busy = false;
    if (ok) status(`Embaralhado · ${history.length} movimentos`);
    return ok;
  }

  async function solve() {
    if (!impl || busy || !history.length) return false;
    busy = true;
    const cfg = SHOW[current] ?? { scramble: 12, ms: 180 };
    const moves = [...history].reverse().map(impl.invertMove);
    const ok = await play(moves, cfg.ms * 0.75, (i) => `Resolvendo… ${i}/${moves.length}`);
    busy = false;
    if (ok) {
      history = [];
      status('Resolvido! ✨');
      if (!reduceMotion) {
        stage.classList.remove('celebrate');
        void stage.offsetWidth;
        stage.classList.add('celebrate');
      }
    }
    return ok;
  }

  /** demonstração: embaralha, resolve e passa para o próximo puzzle */
  async function autoStep() {
    if (!alive || !auto) return;
    const my = token;
    if (history.length) await solve();
    else {
      if (!(await scramble())) return;
      await new Promise((r) => setTimeout(r, 900));
      if (!alive || !auto || my !== token) return;
      if (!(await solve())) return;
      await new Promise((r) => setTimeout(r, 1600));
      if (!alive || !auto || my !== token) return;
      const ids = available.map((p) => p.id);
      await show(ids[(ids.indexOf(current) + 1) % ids.length]);
    }
    if (alive && auto) autoTimer = window.setTimeout(autoStep, 700);
  }

  // controles: qualquer interação pausa a demonstração automática
  app.querySelectorAll<HTMLButtonElement>('.chip-pz').forEach((b) =>
    b.addEventListener('click', async () => {
      setAuto(false);
      await show(b.dataset.pz!);
    }),
  );
  app.querySelector('[data-act="scramble"]')!.addEventListener('click', () => {
    setAuto(false);
    scramble();
  });
  app.querySelector('[data-act="solve"]')!.addEventListener('click', () => {
    setAuto(false);
    solve();
  });
  autoBtn.addEventListener('click', () => setAuto(!auto));

  show('cube3').then(() => setAuto(auto));

  return () => {
    alive = false;
    token++;
    clearTimeout(autoTimer);
    io.disconnect();
    view?.dispose();
  };
}
