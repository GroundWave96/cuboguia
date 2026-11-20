/**
 * Onde a pessoa parou em cada tutorial (só neste navegador).
 *
 * A chave é o puzzle + método + estado inicial: o mesmo cubo sempre gera a mesma solução,
 * então guardar o passo e o movimento basta para continuar depois. A assinatura dos
 * movimentos confere isso: se a solução mudar (versão nova do site), o progresso antigo é ignorado.
 */
export interface Progress {
  puzzle: string;
  method: string;
  /** estado inicial codificado (o mesmo do endereço do tutorial) */
  state: string;
  /** passo exibido e movimentos já feitos */
  step: number;
  pos: number;
  steps: number;
  total: number;
  /** assinatura da sequência de movimentos */
  sig: string;
  /** quando foi salvo (ms) */
  t: number;
}

const KEY = 'cubo:progress';
/** quantos tutoriais lembrar e por quanto tempo */
const MAX = 12;
const MAX_AGE = 60 * 24 * 3600 * 1000;

export function movesSignature(moves: string[]): string {
  // FNV-1a de 32 bits sobre os movimentos + o total
  let h = 0x811c9dc5;
  const s = moves.join(' ');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + '.' + moves.length.toString(36);
}

function isProgress(p: unknown): p is Progress {
  const o = p as Progress;
  return (
    !!o &&
    typeof o.puzzle === 'string' &&
    typeof o.method === 'string' &&
    typeof o.state === 'string' &&
    typeof o.sig === 'string' &&
    [o.step, o.pos, o.steps, o.total, o.t].every((n) => Number.isFinite(n) && n >= 0)
  );
}

function readAll(now = Date.now()): Progress[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(isProgress).filter((p) => now - p.t < MAX_AGE) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Progress[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage indisponível */
  }
}

const same = (a: Pick<Progress, 'puzzle' | 'method' | 'state'>, b: Pick<Progress, 'puzzle' | 'method' | 'state'>) =>
  a.puzzle === b.puzzle && a.method === b.method && a.state === b.state;

/** progresso salvo deste tutorial (só se a solução for a mesma) */
export function loadProgress(puzzle: string, method: string, state: string, sig: string): Progress | null {
  return readAll().find((p) => same(p, { puzzle, method, state }) && p.sig === sig) ?? null;
}

/** salva (o mais recente fica primeiro); no início ou no fim do tutorial, apaga */
export function saveProgress(p: Progress) {
  const rest = readAll(p.t).filter((q) => !same(q, p));
  writeAll(p.pos > 0 && p.pos < p.total ? [p, ...rest] : rest);
}

export function clearProgress(puzzle: string, method: string, state: string) {
  writeAll(readAll().filter((q) => !same(q, { puzzle, method, state })));
}

/** tutoriais em andamento, do mais recente para o mais antigo */
export function listProgress(): Progress[] {
  return readAll().sort((a, b) => b.t - a.t);
}
