/** Guarda o estado pintado por puzzle (memória + localStorage como conveniência). */
const mem = new Map<string, string[]>();

export function saveState(puzzleId: string, state: string[]) {
  mem.set(puzzleId, [...state]);
  try {
    localStorage.setItem(`cubo:${puzzleId}`, JSON.stringify(state));
  } catch {
    /* storage indisponível */
  }
}

export function loadState(puzzleId: string): string[] | null {
  if (mem.has(puzzleId)) return [...mem.get(puzzleId)!];
  try {
    const raw = localStorage.getItem(`cubo:${puzzleId}`);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Estado compacto para a URL (permite recarregar/compartilhar o tutorial). */
export const encodeState = (s: string[]) => s.join('');
export const decodeState = (s: string, len: number) => (s && s.length === len ? s.split('') : null);
