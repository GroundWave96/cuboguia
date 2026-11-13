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
/** um caractere por adesivo: o índice da cor na lista do puzzle (0-9, a-z) */
export const encodeState = (s: string[], keys: string[]) => s.map((k) => (keys.includes(k) ? keys.indexOf(k).toString(36) : '_')).join('');
export function decodeState(s: string, len: number, keys: string[]): string[] | null {
  if (!s || s.length !== len) return null;
  const out = s.split('').map((c) => (c === '_' ? '?' : keys[parseInt(c, 36)]));
  return out.every((k) => k !== undefined) ? out : null;
}

/** Método de solução preferido (conveniência por navegador). */
export function loadMethod(valid: string[]): string {
  try {
    const m = localStorage.getItem('cubo:method');
    if (m && valid.includes(m)) return m;
  } catch {
    /* ignore */
  }
  return valid[0];
}

export function saveMethod(id: string) {
  try {
    localStorage.setItem('cubo:method', id);
  } catch {
    /* ignore */
  }
}
