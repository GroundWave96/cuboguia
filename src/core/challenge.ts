/**
 * Desafio do cronômetro: o mesmo embaralho, o tempo de quem desafiou e (opcional) o nome,
 * tudo no link. Quem abre o link vê o embaralho e tenta bater o tempo.
 *
 * Tudo que vem do link é conferido: puzzle conhecido, movimentos com formato de movimento,
 * tempo plausível e nome curto, sem caracteres de controle (e mostrado como texto).
 */
export interface Challenge {
  puzzle: string;
  scramble: string[];
  /** tempo que vale, em ms; null = DNF */
  ms: number | null;
  name: string;
}

const MOVE = /^\d?[A-Za-z]{1,4}['2]{0,2}$/;
const MAX_MOVES = 120;
const MAX_MS = 24 * 3600 * 1000;
export const MAX_NAME = 24;

export const cleanName = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, MAX_NAME);

/** parâmetros do link (sem o "?") */
export function challengeQuery(c: Challenge): string {
  const q = new URLSearchParams();
  q.set('p', c.puzzle);
  q.set('e', c.scramble.join(' '));
  q.set('t', c.ms === null ? 'dnf' : String(Math.round(c.ms)));
  const name = cleanName(c.name);
  if (name) q.set('n', name);
  return q.toString();
}

/** lê o desafio do link; null se não houver ou se algo não fizer sentido */
export function readChallenge(params: URLSearchParams, puzzles: string[]): Challenge | null {
  const puzzle = params.get('p') ?? '';
  const e = params.get('e');
  const t = params.get('t');
  if (!puzzles.includes(puzzle) || !e || !t) return null;
  const scramble = e.split(/\s+/).filter(Boolean);
  if (!scramble.length || scramble.length > MAX_MOVES || !scramble.every((m) => MOVE.test(m))) return null;
  let ms: number | null;
  if (t === 'dnf') ms = null;
  else {
    if (!/^\d{1,9}$/.test(t)) return null;
    ms = Number(t);
    if (ms <= 0 || ms > MAX_MS) return null;
  }
  return { puzzle, scramble, ms, name: cleanName(params.get('n') ?? '') };
}
