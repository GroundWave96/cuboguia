/**
 * Gráfico de evolução do cronômetro: cada resolução é um ponto e a média de 5 é a linha.
 * Passe o mouse (ou o dedo, ou as setas do teclado) para ver o tempo de cada resolução.
 * A lista de tempos logo abaixo é a "tabela" do gráfico (tudo que ele mostra está lá também).
 */
import { tr } from '../core/i18n';
import { fmt, rollingAverage, value, type Solve } from '../core/timerstats';

/** cores validadas para o fundo escuro dos cartões (daltonismo e contraste) */
const C_SOLVE = '#6f7ff0';
const C_AVG = '#28a19c';
const RANGE = 50;

const NICE = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];

function ticks(lo: number, hi: number): number[] {
  const step = NICE.find((s) => (hi - lo) / s <= 4.5) ?? NICE[NICE.length - 1];
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

/** "12s", "1:30" para o eixo (sem centésimos) */
const axisLabel = (ms: number) => {
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
};

const median = (v: number[]) => {
  const a = [...v].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};

export interface TimeChart {
  update(solves: Solve[]): void;
  dispose(): void;
}

export function createTimeChart(host: HTMLElement): TimeChart {
  let solves: Solve[] = [];
  let showAll = false;
  let cursor = -1;
  host.innerHTML = `
    <div class="tc-head">
      <span class="tm-label">${tr('Evolução', 'Progress', 'Evolución')}</span>
      <span class="tc-legend">
        <span><i class="tc-key-dot" style="background:${C_SOLVE}"></i>${tr('Tempo', 'Time', 'Tiempo')}</span>
        <span><i class="tc-key-line" style="background:${C_AVG}"></i>${tr('Média de 5', 'Ao5', 'Ao5')}</span>
      </span>
      <span class="tc-range" role="group" aria-label="${tr('Período', 'Range', 'Rango')}">
        <button data-range="last" class="on">${tr(`Últimos ${RANGE}`, `Last ${RANGE}`, `Últimos ${RANGE}`)}</button>
        <button data-range="all">${tr('Todos', 'All', 'Todos')}</button>
      </span>
    </div>
    <div class="tc-plot">
      <svg class="tc-svg" tabindex="0" role="img"></svg>
      <div class="tc-tip" hidden></div>
    </div>`;
  const svg = host.querySelector<SVGSVGElement>('.tc-svg')!;
  const tip = host.querySelector<HTMLElement>('.tc-tip')!;
  const rangeEl = host.querySelector<HTMLElement>('.tc-range')!;

  // geometria do último desenho (para o mouse)
  let geo: { x0: number; dx: number; first: number; n: number; xs: number[]; ys: (number | null)[]; avg: (number | null)[]; top: number; bottom: number } | null = null;

  function draw() {
    const W = Math.max(260, host.clientWidth - 2);
    const H = W < 520 ? 170 : 210;
    const M = { l: 42, r: 14, t: 14, b: 24 };
    const first = showAll ? 0 : Math.max(0, solves.length - RANGE);
    const list = solves.slice(first);
    const n = list.length;
    rangeEl.hidden = solves.length <= RANGE;
    const avgAll = rollingAverage(solves, 5).slice(first);
    const vals = list.map(value);
    const finite = vals.filter(Number.isFinite);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    svg.setAttribute(
      'aria-label',
      tr(`Gráfico dos últimos ${n} tempos e da média de 5`, `Chart of the last ${n} times and the average of 5`, `Gráfico de los últimos ${n} tiempos y la media de 5`),
    );
    if (!finite.length) {
      svg.innerHTML = '';
      geo = null;
      return;
    }
    // um tempo muito fora (ex.: esqueceu de parar) não achata o resto: o eixo corta em 2,5× a mediana
    const cap = median(finite) * 2.5;
    let lo = Math.min(...finite);
    let hi = Math.min(Math.max(...finite), cap);
    if (hi - lo < 1000) {
      lo -= 500;
      hi += 500;
    }
    const pad = (hi - lo) * 0.08;
    lo = Math.max(0, lo - pad);
    hi += pad;
    const top = M.t, bottom = H - M.b;
    const y = (v: number) => bottom - ((Math.min(v, hi) - lo) / (hi - lo)) * (bottom - top);
    const x0 = M.l + 8;
    const dx = n > 1 ? (W - M.r - 8 - x0) / (n - 1) : 0;
    const xs = list.map((_, i) => (n > 1 ? x0 + i * dx : (x0 + W - M.r) / 2));

    const grid = ticks(lo, hi)
      .map((v) => `<line class="tc-grid" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tc-ax" x="${M.l - 6}" y="${y(v) + 4}" text-anchor="end">${axisLabel(v)}</text>`)
      .join('');
    // eixo x: número da resolução no começo, no meio e no fim
    const xl = [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
      .filter((i) => i >= 0)
      .map((i) => `<text class="tc-ax" x="${xs[i]}" y="${H - 6}" text-anchor="middle">${first + i + 1}</text>`)
      .join('');
    // linha da média de 5 (com buracos onde não há média ou é DNF)
    let path = '';
    let pen = false;
    avgAll.forEach((a, i) => {
      if (a === null || !Number.isFinite(a)) {
        pen = false;
        return;
      }
      path += `${pen ? 'L' : 'M'}${xs[i].toFixed(1)} ${y(a).toFixed(1)}`;
      pen = true;
    });
    const r = n <= 25 ? 4.5 : n <= 60 ? 3.5 : 2.6;
    const bestV = Math.min(...finite);
    const bestI = vals.indexOf(bestV);
    const dots = vals
      .map((v, i) => {
        if (!Number.isFinite(v)) return `<text class="tc-dnf" x="${xs[i]}" y="${top + 4}" text-anchor="middle">×</text>`;
        const clipped = v > hi;
        return `<circle cx="${xs[i].toFixed(1)}" cy="${y(v).toFixed(1)}" r="${r}" fill="${C_SOLVE}" class="${clipped ? 'tc-clip' : ''}"/>`;
      })
      .join('');
    const bx = xs[bestI], by = y(bestV);
    const labelLeft = bx > W - 110;
    svg.innerHTML = `
      ${grid}${xl}
      <path d="${path}" fill="none" stroke="${C_AVG}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <g class="tc-dots">${dots}</g>
      <circle cx="${bx}" cy="${by}" r="${r + 3.5}" fill="none" stroke="var(--text)" stroke-width="1.5"/>
      <text class="tc-best" x="${bx + (labelLeft ? -(r + 7) : r + 7)}" y="${by + 4}" text-anchor="${labelLeft ? 'end' : 'start'}">${tr('Recorde', 'Best', 'Mejor')} ${fmt(bestV)}</text>
      <line class="tc-cross" x1="0" x2="0" y1="${top}" y2="${bottom}" visibility="hidden"/>
      <circle class="tc-hl" r="${r + 2}" fill="${C_SOLVE}" visibility="hidden"/>`;
    geo = { x0, dx, first, n, xs, ys: vals.map((v) => (Number.isFinite(v) ? y(v) : null)), avg: avgAll, top, bottom };
    if (cursor >= n) cursor = -1;
    showCursor();
  }

  function showCursor() {
    const cross = svg.querySelector<SVGLineElement>('.tc-cross');
    const hl = svg.querySelector<SVGCircleElement>('.tc-hl');
    if (!geo || !cross || !hl || cursor < 0) {
      cross?.setAttribute('visibility', 'hidden');
      hl?.setAttribute('visibility', 'hidden');
      tip.hidden = true;
      return;
    }
    const i = cursor;
    const s = solves[geo.first + i];
    const x = geo.xs[i];
    cross.setAttribute('x1', String(x));
    cross.setAttribute('x2', String(x));
    cross.setAttribute('visibility', 'visible');
    const yy = geo.ys[i];
    if (yy !== null) {
      hl.setAttribute('cx', String(x));
      hl.setAttribute('cy', String(yy));
      hl.setAttribute('visibility', 'visible');
    } else hl.setAttribute('visibility', 'hidden');
    const avg = geo.avg[i];
    const when = new Date(s.at).toLocaleString(tr('pt-BR', 'en-US', 'es-ES'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    tip.replaceChildren();
    const row = (val: string, label: string, color: string) => {
      const d = document.createElement('div');
      d.className = 'tc-tip-row';
      const k = document.createElement('i');
      k.style.background = color;
      const b = document.createElement('b');
      b.textContent = val;
      const sp = document.createElement('span');
      sp.textContent = label;
      d.append(k, b, sp);
      return d;
    };
    const head = document.createElement('div');
    head.className = 'tc-tip-head';
    head.textContent = `#${geo.first + i + 1} · ${when}`;
    tip.append(head, row(fmt(value(s)) + (s.pen === 2 ? '+' : ''), tr('tempo', 'time', 'tiempo'), C_SOLVE));
    if (avg !== null) tip.append(row(fmt(avg), tr('média de 5', 'ao5', 'ao5'), C_AVG));
    tip.hidden = false;
    // tooltip ao lado do ponto, sem sair do gráfico
    const box = svg.getBoundingClientRect();
    const scale = box.width / (svg.viewBox.baseVal.width || box.width);
    const px = x * scale;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(4, px > box.width / 2 ? px - w - 12 : px + 12), box.width - w - 4)}px`;
    tip.style.top = `${Math.max(4, (yy ?? geo.top) * scale - tip.offsetHeight / 2)}px`;
  }

  function nearest(clientX: number) {
    if (!geo) return -1;
    const box = svg.getBoundingClientRect();
    const scale = box.width / (svg.viewBox.baseVal.width || box.width);
    const vx = (clientX - box.left) / scale;
    if (geo.n <= 1) return 0;
    return Math.max(0, Math.min(geo.n - 1, Math.round((vx - geo.x0) / geo.dx)));
  }
  svg.addEventListener('pointermove', (e) => {
    cursor = nearest(e.clientX);
    showCursor();
  });
  svg.addEventListener('pointerdown', (e) => {
    cursor = nearest(e.clientX);
    showCursor();
  });
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    cursor = -1;
    showCursor();
  });
  svg.addEventListener('keydown', (e) => {
    if (!geo) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      cursor = cursor < 0 ? geo.n - 1 : Math.max(0, Math.min(geo.n - 1, cursor + (e.key === 'ArrowRight' ? 1 : -1)));
      showCursor();
    }
  });
  svg.addEventListener('blur', () => {
    cursor = -1;
    showCursor();
  });
  rangeEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-range]');
    if (!b) return;
    showAll = b.dataset.range === 'all';
    rangeEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    cursor = -1;
    draw();
  });
  const ro = new ResizeObserver(() => draw());
  ro.observe(host);

  return {
    update(list) {
      solves = list;
      host.hidden = list.filter((s) => Number.isFinite(value(s))).length < 3;
      if (!host.hidden) draw();
    },
    dispose() {
      ro.disconnect();
    },
  };
}
