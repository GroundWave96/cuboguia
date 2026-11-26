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

/** nomes curtos para a prévia do link (a função do servidor não carrega o registro dos puzzles) */
export const PREVIEW_NAMES: Record<string, string> = {
  cube2: '2x2',
  cube3: '3x3',
  cube4: '4x4',
  cube5: '5x5',
  cube6: '6x6',
  cube7: '7x7',
  pyraminx: 'Pyraminx',
  skewb: 'Skewb',
  megaminx: 'Megaminx',
  kilominx: 'Kilominx',
  mastermorphix: 'Mastermorphix',
};

/** "12.34" ou "1:02.35" (igual ao cronômetro) */
function previewTime(ms: number): string {
  const cs = Math.floor(ms / 10);
  const m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${m ? `${m}:${String(s).padStart(2, '0')}` : s}.${String(c).padStart(2, '0')}`;
}

/**
 * Título e descrição da prévia do link de desafio (WhatsApp, Telegram, redes sociais).
 * Esses aplicativos não rodam o JavaScript da página: o servidor coloca o texto no HTML.
 */
export function challengePreview(c: Challenge, lang: 'pt' | 'en' | 'es'): { title: string; description: string } {
  const pz = PREVIEW_NAMES[c.puzzle] ?? c.puzzle;
  const t = c.ms === null ? null : previewTime(c.ms);
  let scr = c.scramble.join(' ');
  if (scr.length > 70) scr = scr.slice(0, 70).replace(/\s+\S*$/, '') + ' …';
  if (lang === 'en') {
    const title = c.name
      ? t
        ? `${c.name} challenged you: ${t} on the ${pz}`
        : `${c.name} challenged you on the ${pz}`
      : t
        ? `${pz} challenge: ${t} — can you beat it?`
        : `${pz} challenge — can you finish it?`;
    return { title, description: `Same scramble: ${scr}. Open the link, scramble yours the same way and race the clock on CuboGuia.` };
  }
  if (lang === 'es') {
    const title = c.name
      ? t
        ? `${c.name} te retó: ${t} en el ${pz}`
        : `${c.name} te retó en el ${pz}`
      : t
        ? `Reto en el ${pz}: ${t}, ¿puedes superarlo?`
        : `Reto en el ${pz}, ¿puedes terminarlo?`;
    return { title, description: `Misma mezcla: ${scr}. Abre el enlace, mezcla el tuyo igual e intenta superar el tiempo en CuboGuia.` };
  }
  const title = c.name
    ? t
      ? `${c.name} te desafiou: ${t} no ${pz}`
      : `${c.name} te desafiou no ${pz}`
    : t
      ? `Desafio no ${pz}: ${t} — consegue bater?`
      : `Desafio no ${pz} — consegue terminar?`;
  return { title, description: `Mesmo embaralho: ${scr}. Abra o link, embaralhe o seu igual e tente bater o tempo no CuboGuia.` };
}
