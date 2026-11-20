/**
 * Tempos do cronômetro e as médias no padrão das competições (WCA).
 *
 *  - penalidade: +2 (2 s a mais) ou DNF (não terminou / passou de 17 s na inspeção)
 *  - média de N (ao5, ao12): tira o melhor e o pior dos últimos N e faz a média do resto;
 *    um DNF conta como o pior; com 2 ou mais DNF a média é DNF
 */
export type Penalty = 0 | 2 | 'dnf';

export interface Solve {
  /** tempo medido, em ms (sem a penalidade) */
  ms: number;
  pen: Penalty;
  scramble: string;
  /** quando foi feito (Date.now()) */
  at: number;
}

/** tempo que vale (com o +2), ou Infinity se DNF */
export const value = (s: Solve) => (s.pen === 'dnf' ? Infinity : s.ms + (s.pen === 2 ? 2000 : 0));

/** melhor tempo (sem os DNF), ou null */
export function best(solves: Solve[]): number | null {
  const v = solves.map(value).filter(Number.isFinite);
  return v.length ? Math.min(...v) : null;
}

/**
 * Média dos últimos n (solves do mais antigo para o mais novo), no padrão WCA.
 * null = ainda não tem n tempos; Infinity = DNF.
 */
export function averageOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const v = solves.slice(-n).map(value).sort((a, b) => a - b);
  const trim = Math.max(1, Math.ceil(n * 0.05)); // ao5 e ao12: tira 1 de cada lado
  const mid = v.slice(trim, n - trim);
  if (mid.some((x) => !Number.isFinite(x))) return Infinity;
  return mid.reduce((a, b) => a + b, 0) / mid.length;
}

/** média simples de todos os tempos que terminaram */
export function mean(solves: Solve[]): number | null {
  const v = solves.map(value).filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** melhor média de n ao longo da sessão */
export function bestAverage(solves: Solve[], n: number): number | null {
  let out: number | null = null;
  for (let i = n; i <= solves.length; i++) {
    const a = averageOf(solves.slice(0, i), n);
    if (a !== null && (out === null || a < out)) out = a;
  }
  return out;
}

/** "1:02.35", "9.81", "DNF", "—" */
export function fmt(ms: number | null): string {
  if (ms === null) return '—';
  if (!Number.isFinite(ms)) return 'DNF';
  const cs = Math.floor(ms / 10);
  const m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${m ? `${m}:${String(s).padStart(2, '0')}` : s}.${String(c).padStart(2, '0')}`;
}

/** tempo de uma resolução como aparece na lista: "12.34", "14.34+", "DNF(12.34)" */
export function fmtSolve(s: Solve): string {
  if (s.pen === 'dnf') return `DNF(${fmt(s.ms)})`;
  return s.pen === 2 ? `${fmt(s.ms + 2000)}+` : fmt(s.ms);
}

/** penalidade da inspeção (WCA): até 15 s nada, até 17 s +2, depois DNF */
export function inspectionPenalty(inspectMs: number): Penalty {
  return inspectMs <= 15000 ? 0 : inspectMs <= 17000 ? 2 : 'dnf';
}

export type RecordKind = 'single' | 'ao5' | 'ao12';

/**
 * Recordes batidos pela última resolução da lista (comparando com a lista sem ela).
 * Só conta como recorde se já havia um antes: o primeiro tempo (ou a primeira média) não comemora.
 */
export function newRecords(solves: Solve[]): RecordKind[] {
  if (solves.length < 2) return [];
  const prev = solves.slice(0, -1);
  const out: RecordKind[] = [];
  const v = value(solves[solves.length - 1]);
  const b = best(prev);
  if (Number.isFinite(v) && b !== null && v < b) out.push('single');
  for (const [n, kind] of [[5, 'ao5'], [12, 'ao12']] as const) {
    const now = averageOf(solves, n);
    const before = bestAverage(prev, n);
    if (now !== null && Number.isFinite(now) && before !== null && now < before) out.push(kind);
  }
  return out;
}

/** média de n terminando em cada resolução (null antes de ter n tempos; Infinity = DNF) */
export function rollingAverage(solves: Solve[], n: number): (number | null)[] {
  return solves.map((_, i) => (i + 1 < n ? null : averageOf(solves.slice(i + 1 - n, i + 1), n)));
}
