/**
 * Sessões do cronômetro: tempos separados dentro do mesmo puzzle (ex.: "Uma mão", "Treino de F2L"),
 * como no csTimer. Cada puzzle tem a sessão principal (a de sempre, guardada em
 * `cubo:timer:<puzzle>`, então quem já usava o site não perde nada) e as que a pessoa criar
 * (`cubo:timer:<puzzle>:<id>`). A lista fica em `cubo:timer:sessions`.
 */
export interface Session {
  id: string;
  /** vazio = a principal (o nome aparece traduzido) */
  name: string;
}
export interface PuzzleSessions {
  list: Session[];
  cur: string;
}

export const MAIN = 'main';
const KEY = 'cubo:timer:sessions';
export const MAX_SESSIONS = 12;
export const MAX_SESSION_NAME = 24;

export const solvesKey = (puzzle: string, session: string) => (session === MAIN ? `cubo:timer:${puzzle}` : `cubo:timer:${puzzle}:${session}`);

/** nome limpo: sem marcação, sem espaços sobrando, no máximo 24 letras */
export const cleanSessionName = (s: string) =>
  s
    .replace(/[\u0000-\u001f<>"'`&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SESSION_NAME);

function readAll(): Record<string, PuzzleSessions> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** sessões de um puzzle (sempre com a principal, e a atual sempre existe) */
export function loadSessions(puzzle: string): PuzzleSessions {
  const raw = readAll()[puzzle];
  const list: Session[] = [{ id: MAIN, name: '' }];
  if (raw && Array.isArray(raw.list))
    for (const s of raw.list)
      if (s && typeof s.id === 'string' && /^s\d{1,4}$/.test(s.id) && typeof s.name === 'string' && !list.some((x) => x.id === s.id))
        list.push({ id: s.id, name: cleanSessionName(s.name) || s.id });
  const cur = raw && list.some((s) => s.id === raw.cur) ? raw.cur : MAIN;
  return { list: list.slice(0, MAX_SESSIONS + 1), cur };
}

export function saveSessions(puzzle: string, data: PuzzleSessions) {
  try {
    const all = readAll();
    all[puzzle] = { list: data.list.filter((s) => s.id !== MAIN), cur: data.cur } as PuzzleSessions;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

/** cria uma sessão (ou devolve a que já tem esse nome) */
export function addSession(data: PuzzleSessions, name: string): Session | null {
  const clean = cleanSessionName(name);
  if (!clean) return null;
  const same = data.list.find((s) => s.id !== MAIN && s.name.toLowerCase() === clean.toLowerCase());
  if (same) return same;
  if (data.list.length > MAX_SESSIONS) return null;
  const n = Math.max(0, ...data.list.map((s) => (s.id === MAIN ? 0 : Number(s.id.slice(1))))) + 1;
  const s = { id: `s${n}`, name: clean };
  data.list.push(s);
  return s;
}
