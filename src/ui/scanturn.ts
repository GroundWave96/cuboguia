/**
 * Giro da câmera entre uma face e a próxima: que movimento o puzzle inteiro faz (na tela) para
 * a próxima face vir para a frente. Usado na animação do "cubinho" entre as capturas.
 *
 * Cada face do molde tem uma pose: as direções do puzzle (no referencial dele) que aparecem
 * à direita, para cima e para a câmera. A pose vira uma matriz (puzzle → tela) e o giro é
 * decomposto em 1 ou 2 rotações simples em volta dos eixos da tela, na ordem que uma pessoa
 * faria: primeiro girar para o lado (eixo vertical), depois inclinar (eixo horizontal).
 */
export type V3 = [number, number, number];
export interface Pose {
  right: V3;
  up: V3;
  out: V3;
}
/** matriz 3x3 linha a linha */
export type M3 = number[];
export interface TurnStep {
  /** eixo da tela: x = horizontal (inclinar), y = vertical (girar para o lado), z = para a câmera */
  axis: 'x' | 'y' | 'z';
  /** radianos, regra da mão direita (y positivo: a frente vai para a direita) */
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

export function rot(axis: TurnStep['axis'], angle: number): M3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export const apply = (m: M3, p: V3): V3 => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
const same = (a: M3, b: M3) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

const CANDIDATES: TurnStep[] = (['y', 'x', 'z'] as const).flatMap((axis) => [-Math.PI / 2, Math.PI / 2, Math.PI].map((angle) => ({ axis, angle })));
/** quanto "custa" para a pessoa: girar para o lado é o mais natural; rolar na tela, o menos */
const stepCost = (s: TurnStep) => ({ y: 1, x: 1.2, z: 3 })[s.axis] * (Math.abs(s.angle) > 2 ? 1.6 : 1);

/** os passos (no máximo 2) que levam a pose `from` à pose `to` */
export function turnSteps(from: Pose, to: Pose): TurnStep[] | null {
  const A = poseMatrix(from), B = poseMatrix(to);
  // B = E · A  →  E = B · Aᵀ (rotação na tela)
  const E = mul(B, transpose(A));
  if (same(E, [1, 0, 0, 0, 1, 0, 0, 0, 1])) return [];
  let best: { steps: TurnStep[]; cost: number } | null = null;
  const consider = (steps: TurnStep[]) => {
    // o primeiro passo vertical antes do horizontal (girar, depois inclinar) desempata
    const cost = steps.reduce((a, s) => a + stepCost(s), 0) + (steps.length === 2 && steps[0].axis !== 'y' ? 0.1 : 0);
    if (!best || cost < best.cost) best = { steps, cost };
  };
  for (const s of CANDIDATES) if (same(rot(s.axis, s.angle), E)) consider([s]);
  if (!best)
    for (const s1 of CANDIDATES)
      for (const s2 of CANDIDATES) if (s1.axis !== s2.axis && same(mul(rot(s2.axis, s2.angle), rot(s1.axis, s1.angle)), E)) consider([s1, s2]);
  return best ? (best as { steps: TurnStep[] }).steps : null;
}

/** duração de cada passo (ms): ¼ de volta e meia volta */
export const stepMs = (s: TurnStep) => (Math.abs(s.angle) > 2 ? 1050 : 800);
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
