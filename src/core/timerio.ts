/**
 * Exportar e importar os tempos do cronômetro (um arquivo .json).
 *
 * Formato do CuboGuia: { app: 'cuboguia', version: 1, exportedAt, solves: { cube3: [Solve...] } }.
 * Também lê o arquivo de exportação do csTimer (o cronômetro mais usado pelos speedcubers):
 * { session1: [[[pen, ms], scramble, comment, timestamp], ...], properties: { sessionData } }.
 */
import type { Penalty, Solve } from './timerstats';

export const EXPORT_APP = 'cuboguia';
const MAX_MS = 24 * 3600 * 1000;
const MAX_SCRAMBLE = 2000;

export interface ImportResult {
  source: 'cuboguia' | 'cstimer';
  byPuzzle: Record<string, Solve[]>;
  /** tempos de puzzles que o site não tem (ou inválidos), deixados de fora */
  skipped: number;
}

export class ImportError extends Error {
  constructor(public readonly reason: 'json' | 'format' | 'empty') {
    super(reason);
  }
}

export function exportJson(byPuzzle: Record<string, Solve[]>, now = Date.now()): string {
  const solves = Object.fromEntries(Object.entries(byPuzzle).filter(([, s]) => s.length));
  return JSON.stringify({ app: EXPORT_APP, version: 1, exportedAt: new Date(now).toISOString(), solves });
}

function cleanSolve(o: unknown): Solve | null {
  const s = o as Solve;
  if (!s || typeof s !== 'object') return null;
  const pen: Penalty | null = s.pen === 0 || s.pen === 2 || s.pen === 'dnf' ? s.pen : null;
  if (pen === null || !Number.isFinite(s.ms) || s.ms <= 0 || s.ms > MAX_MS || !Number.isFinite(s.at) || s.at <= 0) return null;
  if (typeof s.scramble !== 'string' || s.scramble.length > MAX_SCRAMBLE) return null;
  return { ms: Math.round(s.ms), pen, scramble: s.scramble, at: Math.round(s.at) };
}

/** tipo de embaralho do csTimer → puzzle do site */
function csPuzzle(scrType: string | undefined): string | null {
  const t = (scrType ?? '333').toLowerCase();
  if (t.startsWith('222')) return 'cube2';
  if (t.startsWith('333')) return 'cube3';
  if (t.startsWith('444')) return 'cube4';
  if (t.startsWith('555')) return 'cube5';
  if (t.startsWith('pyr')) return 'pyraminx';
  if (t.startsWith('skb')) return 'skewb';
  if (t.startsWith('mgm')) return 'megaminx';
  return null;
}

function readCsTimer(data: Record<string, unknown>, puzzles: string[]): ImportResult {
  let meta: Record<string, { opt?: { scrType?: string } }> = {};
  try {
    const raw = (data.properties as { sessionData?: unknown } | undefined)?.sessionData;
    meta = typeof raw === 'string' ? JSON.parse(raw) : raw && typeof raw === 'object' ? (raw as typeof meta) : {};
  } catch {
    meta = {};
  }
  const byPuzzle: Record<string, Solve[]> = {};
  let skipped = 0;
  for (const [key, list] of Object.entries(data)) {
    const m = /^session(\d+)$/.exec(key);
    if (!m || !Array.isArray(list)) continue;
    const puzzle = csPuzzle(meta[m[1]]?.opt?.scrType);
    for (const row of list) {
      if (!puzzle || !puzzles.includes(puzzle) || !Array.isArray(row) || !Array.isArray(row[0])) {
        skipped++;
        continue;
      }
      const [penRaw, ms] = row[0] as number[];
      const s = cleanSolve({
        ms,
        pen: penRaw === -1 ? 'dnf' : penRaw === 2000 ? 2 : penRaw === 0 ? 0 : null,
        scramble: typeof row[1] === 'string' ? row[1] : '',
        at: Number(row[3]) * 1000,
      });
      if (!s) {
        skipped++;
        continue;
      }
      (byPuzzle[puzzle] ??= []).push(s);
    }
  }
  return { source: 'cstimer', byPuzzle, skipped };
}

/** lê um arquivo exportado (do CuboGuia ou do csTimer) */
export function parseImport(text: string, puzzles: string[]): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('json');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ImportError('format');
  const d = data as Record<string, unknown>;
  let res: ImportResult;
  if (d.app === EXPORT_APP && d.solves && typeof d.solves === 'object') {
    const byPuzzle: Record<string, Solve[]> = {};
    let skipped = 0;
    for (const [puzzle, list] of Object.entries(d.solves as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      for (const o of list) {
        const s = puzzles.includes(puzzle) ? cleanSolve(o) : null;
        if (s) (byPuzzle[puzzle] ??= []).push(s);
        else skipped++;
      }
    }
    res = { source: 'cuboguia', byPuzzle, skipped };
  } else if (Object.keys(d).some((k) => /^session\d+$/.test(k))) res = readCsTimer(d, puzzles);
  else throw new ImportError('format');
  if (!Object.values(res.byPuzzle).some((l) => l.length)) throw new ImportError('empty');
  return res;
}

/** junta os tempos sem repetir (mesmo momento e mesmo tempo = a mesma resolução), em ordem */
export function mergeSolves(a: Solve[], b: Solve[]): { merged: Solve[]; added: number } {
  const key = (s: Solve) => `${s.at}:${s.ms}`;
  const seen = new Set(a.map(key));
  const fresh = b.filter((s) => {
    const k = key(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { merged: [...a, ...fresh].sort((x, y) => x.at - y.at), added: fresh.length };
}
