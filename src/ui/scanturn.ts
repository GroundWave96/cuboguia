/**
 * Giro da câmera entre uma face e a próxima: que movimento o puzzle inteiro faz (na tela) para
 * a próxima face vir para a frente. Usado na animação do "cubinho" entre as capturas.
 *
 * Cada face do molde tem uma pose: as direções do puzzle (no referencial dele) que aparecem
 * à direita, para cima e para a câmera. A pose vira uma matriz (puzzle → tela) e o giro vira
 * 1 ou 2 rotações simples, na ordem que uma pessoa faria: girar para o lado em volta do "eixo
 * de cima" do puzzle (o que fica parado: o topo do cubo, a face cinza do Megaminx, a ponta de
 * cima do Pyraminx) e depois inclinar (eixo horizontal da tela).
 */
export type V3 = [number, number, number];
export interface Pose {
  right: V3;
  up: V3;
  out: V3;
  /** eixo que fica parado ao girar para o lado (no referencial do puzzle); padrão: +y */
  spin?: V3;
}
/** matriz 3x3 linha a linha */
export type M3 = number[];
export interface TurnStep {
  /** eixo na tela (x para a direita, y para cima, z para a câmera), unitário */
  axis: V3;
  /** radianos, regra da mão direita */
  angle: number;
}

/** puzzle → tela: as linhas são as direções da pose */
export const poseMatrix = (p: Pose): M3 => [...p.right, ...p.up, ...p.out];

export function mul(a: M3, b: M3): M3 {
  const o = new Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
}
export const transpose = (a: M3): M3 => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
export const apply = (m: M3, p: V3): V3 => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const same = (a: M3, b: M3) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** rotação em volta de um eixo unitário qualquer (Rodrigues) */
export function rot(axis: V3, angle: number): M3 {
  const [x, y, z] = axis;
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}

/** eixo e ângulo (0..π) de uma rotação */
function axisAngle(m: M3): { axis: V3; angle: number } {
  const angle = Math.acos(Math.max(-1, Math.min(1, (m[0] + m[4] + m[8] - 1) / 2)));
  if (angle < 1e-9) return { axis: [0, 1, 0], angle: 0 };
  if (Math.PI - angle > 1e-4) {
    const s = 2 * Math.sin(angle);
    return { axis: norm([(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s]), angle };
  }
  // meia volta: o eixo sai da diagonal de (M + I)/2
  const d = [(m[0] + 1) / 2, (m[4] + 1) / 2, (m[8] + 1) / 2].map((v) => Math.sqrt(Math.max(0, v)));
  const k = d.indexOf(Math.max(...d));
  const axis: V3 = [0, 0, 0];
  axis[k] = d[k];
  for (let j = 0; j < 3; j++) if (j !== k) axis[j] = (m[k * 3 + j] + m[j * 3 + k]) / (4 * d[k]);
  return { axis: norm(axis), angle };
}

/**
 * Ângulos α e β com rot(b, β) · rot(a, α) = E (primeiro em volta de a, depois de b), ou null
 * quando não dá com esses dois eixos.
 */
function twoAxes(E: M3, a: V3, b: V3): [number, number] | null {
  const ea = apply(E, a);
  if (Math.abs(dot(a, b) - dot(ea, b)) > 1e-6) return null;
  const pa: V3 = norm(a.map((v, i) => v - dot(a, b) * b[i]) as V3), pe: V3 = norm(ea.map((v, i) => v - dot(ea, b) * b[i]) as V3);
  if (Math.hypot(...a.map((v, i) => v - dot(a, b) * b[i])) < 1e-6) return null;
  const beta = Math.atan2(dot(cross(pa, pe), b), dot(pa, pe));
  // o que sobra é uma rotação em volta de a
  const M = mul(rot(b, -beta), E);
  const p = norm(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const mp = apply(M, p);
  const alpha = Math.atan2(dot(cross(p, mp), a), dot(p, mp));
  return same(mul(rot(b, beta), rot(a, alpha)), E) ? [alpha, beta] : null;
}

const X: V3 = [1, 0, 0], Y: V3 = [0, 1, 0];
const near = (u: V3, v: V3) => Math.abs(dot(u, v)) > Math.cos((10 * Math.PI) / 180);
/** π vira −π quando o outro sentido é o mesmo giro: escolhe o que deixa o sinal estável */
const wrap = (a: number) => (a > Math.PI + 1e-9 ? a - 2 * Math.PI : a < -Math.PI - 1e-9 ? a + 2 * Math.PI : a);

/** os passos (1 ou 2) que levam a pose `from` à pose `to` */
export function turnSteps(from: Pose, to: Pose): TurnStep[] | null {
  const A = poseMatrix(from), B = poseMatrix(to);
  // B = E · A  →  E = B · Aᵀ (rotação na tela)
  const E = mul(B, transpose(A));
  if (same(E, I3)) return [];
  // o "eixo de cima" do puzzle, visto da face de origem
  const T = norm(apply(A, from.spin ?? [0, 1, 0]));
  const natural = [T, Y, X];
  const { axis, angle } = axisAngle(E);
  // um passo só: em volta de um eixo natural (girar para o lado, ou inclinar)
  for (const n of natural)
    if (near(axis, n)) {
      const sgn = dot(axis, n) > 0 ? 1 : -1;
      if (same(rot(n, sgn * angle), E)) return [{ axis: n, angle: sgn * angle }];
    }
  // dois passos: girar em volta do eixo de cima (ou do vertical da tela) e depois inclinar
  let best: { steps: TurnStep[]; cost: number } | null = null;
  for (const [a, b, extra] of [
    [T, X, 0],
    [Y, X, 0.05],
    [T, Y, 0.2],
    [X, Y, 0.3],
  ] as [V3, V3, number][]) {
    if (near(a, b)) continue;
    const r = twoAxes(E, a, b);
    if (!r) continue;
    const [al, be] = r.map(wrap);
    const steps = [{ axis: a, angle: al }, { axis: b, angle: be }].filter((s) => Math.abs(s.angle) > 1e-6);
    const cost = Math.abs(al) + Math.abs(be) + extra;
    if (!best || cost < best.cost - 1e-6) best = { steps, cost };
  }
  if (best) return (best as { steps: TurnStep[] }).steps;
  // último recurso: o giro direto, em volta do eixo que for
  return [{ axis, angle }];
}

/** duração de cada passo (ms): ¼ de volta = 0,8 s; maiores demoram um pouco mais */
export const stepMs = (s: TurnStep) => Math.min(1150, 300 + 500 * (Math.abs(s.angle) / (Math.PI / 2)));
export const STEP_PAUSE = 160;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** a matriz (puzzle → tela) no instante `ms` do giro (0 = pose de origem) */
export function turnMatrix(from: Pose, steps: TurnStep[], ms: number): M3 {
  let m = poseMatrix(from);
  let t = ms;
  for (const s of steps) {
    const d = stepMs(s);
    if (t <= 0) break;
    const k = Math.min(1, t / d);
    m = mul(rot(s.axis, s.angle * ease(k)), m);
    t -= d + STEP_PAUSE;
  }
  return m;
}
export const turnDuration = (steps: TurnStep[]) => steps.reduce((a, s) => a + stepMs(s), 0) + Math.max(0, steps.length - 1) * STEP_PAUSE;
/** quanto do giro já passou (0..1), para acompanhar tamanho e posição entre as faces */
export const turnProgress = (steps: TurnStep[], ms: number) => Math.max(0, Math.min(1, ms / Math.max(1, turnDuration(steps))));
