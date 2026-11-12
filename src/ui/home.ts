import { PUZZLES, loadPuzzle } from '../core/registry';
import type { PuzzleView } from '../core/types';

export function renderHome(app: HTMLElement) {
  app.innerHTML = `
  <section class="page hero">
    <div class="hero-text">
      <span class="eyebrow">Tutorial interativo em 3D</span>
      <h1>Resolva o <em>seu</em> cubo mágico, passo a passo.</h1>
      <p class="lead">Mostre como o seu cubo está — pintando as cores no modelo 3D ou apontando a câmera — e receba um tutorial animado,
      do jeito que se aprende: camada por camada.</p>
      <div class="hero-cta">
        <a class="btn primary big" href="#/p/cube3">Resolver meu 3x3</a>
        <a class="btn ghost big" href="#como-funciona">Como funciona</a>
      </div>
    </div>
    <div class="hero-cube" id="hero-cube"></div>
  </section>

  <section class="page" id="como-funciona">
    <h2 class="section-title">Como funciona</h2>
    <div class="how">
      <div class="how-card"><b>1</b><h3>Informe as cores</h3><p>Pinte os adesivos clicando no cubo 3D ou na planificação — ou use a câmera do celular/computador para ler cada face.</p></div>
      <div class="how-card"><b>2</b><h3>Validamos o cubo</h3><p>Conferimos se a combinação existe num cubo real e apontamos onde pode estar o erro.</p></div>
      <div class="how-card"><b>3</b><h3>Siga o tutorial</h3><p>Cada passo tem explicação, os movimentos e a animação. Avance, volte e repita no seu ritmo.</p></div>
    </div>
  </section>

  <section class="page">
    <h2 class="section-title">Escolha o puzzle</h2>
    <div class="puzzles">
      ${PUZZLES.map(
        (p) => `
        <${p.available ? `a href="#/p/${p.id}"` : 'div'} class="pz-card ${p.available ? '' : 'soon'}">
          ${p.icon}
          <div><h3>${p.name}</h3><p>${p.subtitle}</p></div>
          ${p.available ? '<span class="tag ok">Disponível</span>' : '<span class="tag">Em breve</span>'}
        </${p.available ? 'a' : 'div'}>`,
      ).join('')}
    </div>
  </section>`;

  let view: PuzzleView | null = null;
  let alive = true;
  let timer = 0;
  loadPuzzle('cube3').then((impl) => {
    if (!alive) return;
    const host = document.getElementById('hero-cube')!;
    view = impl.createView(host);
    view.setAutoRotate?.(true);
    let moves = impl.scramble(18);
    let forward = true;
    const tick = async () => {
      if (!alive || !view) return;
      // embaralha e desfaz em loop, como uma demonstração
      const seq = forward ? moves : [...moves].reverse().map(impl.invertMove);
      for (const m of seq) {
        if (!alive) return;
        await view.animateMove(m, 230);
      }
      forward = !forward;
      if (forward) moves = impl.scramble(18);
      timer = window.setTimeout(tick, forward ? 1600 : 900);
    };
    timer = window.setTimeout(tick, 800);
  });

  return () => {
    alive = false;
    clearTimeout(timer);
    view?.dispose();
  };
}
