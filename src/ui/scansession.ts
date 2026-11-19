/**
 * Sessão de leitura pela câmera, guardada fora do scanner (só na memória da aba):
 * sobrevive à troca Pintar/Câmera e à ida e volta do tutorial, para dar para
 * escanear de novo só uma face sem perder as outras.
 *
 * Posições "da leitura": o índice do adesivo como a câmera viu (impl.scan). No 2x2 e no
 * Pyraminx o resultado é girado depois (scanOrder), então o editor usa outras posições.
 */
import type { RGB } from '../core/color';
import { ColorModel, assignAll } from '../core/scancolor';
import { UNKNOWN, type PuzzleImpl, type PuzzleState } from '../core/types';

export interface ScanSession {
  /** cores lidas em cada face (mediana dos últimos quadros), na ordem de impl.scan */
  captured: (RGB[] | null)[];
  /** pixels dos adesivos de cor conhecida (centros) de cada face — vão nas amostras de treino */
  fixedPx: (Record<number, RGB[]> | null)[];
  /** cores aprendidas com os centros capturados (recapturar uma face substitui o que ela ensinou) */
  model: ColorModel;
  /** correções feitas à mão depois da leitura, na posição da leitura */
  edits: Map<number, string>;
  /** último resultado entregue ao editor; se o editor mudar por outro caminho, a sessão perde a validade */
  result: PuzzleState | null;
  /** resultado[j] = leitura[order[j]] */
  order: number[] | null;
}

const sessions = new Map<string, ScanSession>();

function fresh(impl: PuzzleImpl): ScanSession {
  return {
    captured: impl.scan.map(() => null),
    fixedPx: impl.scan.map(() => null),
    model: new ColorModel(impl.colors, impl.scanColorModel === 'nearest' ? 'nearest' : 'hue6'),
    edits: new Map(),
    result: null,
    order: null,
  };
}

/** sessão do puzzle (cria uma vazia se não existir) */
export function getSession(puzzleId: string, impl: PuzzleImpl): ScanSession {
  let s = sessions.get(puzzleId);
  if (!s || s.captured.length !== impl.scan.length) sessions.set(puzzleId, (s = fresh(impl)));
  return s;
}

/** começa a leitura do zero (mesmo objeto, para quem já tem a referência) */
export function resetSession(s: ScanSession, impl: PuzzleImpl) {
  Object.assign(s, fresh(impl));
}

export function dropSession(puzzleId: string) {
  sessions.delete(puzzleId);
}

export const isComplete = (s: ScanSession) => s.captured.every(Boolean);

/** a sessão ainda descreve o que está no editor? (lida inteira e o editor não mudou por outro caminho) */
export const isActive = (s: ScanSession | undefined, state: PuzzleState): s is ScanSession =>
  !!s && isComplete(s) && !!s.result && !!s.order && s.result.join() === state.join();

export const peekSession = (puzzleId: string) => sessions.get(puzzleId);

/** cor de cada adesivo na posição da leitura: cada cor exatamente N vezes, já com as correções à mão */
function readKeys(impl: PuzzleImpl, s: ScanSession): string[] {
  const rgbs: RGB[] = new Array(impl.stickerCount);
  const fixed = new Map<number, string>();
  impl.scan.forEach((face, fi) => {
    face.grid.flat().forEach((idx, k) => (rgbs[idx] = s.captured[fi]![k]));
    for (const fc of face.fixedCells) fixed.set(face.grid.flat()[fc.cell], fc.color);
  });
  const keys = assignAll(s.model, rgbs, Math.round(impl.stickerCount / impl.colors.length), fixed).map((k) => k || UNKNOWN);
  for (const [i, c] of s.edits) keys[i] = c;
  return keys;
}

/** monta o puzzle a partir da leitura (precisa de todas as faces) */
export function compose(impl: PuzzleImpl, s: ScanSession): { state: PuzzleState; order: number[]; keys: string[] } {
  const keys = readKeys(impl, s);
  const ids = keys.map((_, i) => i);
  if (impl.scanOrder) {
    const order = impl.scanOrder(keys);
    return { state: order.map((i) => keys[i]), order, keys };
  }
  // puzzle que gira a leitura sem dizer de onde veio cada adesivo: as posições se perdem
  let state = keys;
  if (impl.repairScan) state = impl.repairScan(state);
  if (impl.normalize) state = impl.normalize(state);
  return { state, order: ids, keys };
}

/** estado do editor → cor de cada adesivo na posição da leitura */
export function toReadPositions(state: PuzzleState, order: number[]): string[] {
  const out = new Array<string>(state.length);
  order.forEach((src, j) => (out[src] = state[j]));
  return out;
}

/** o usuário pintou o adesivo `index` do editor: guarda a correção na posição da leitura */
export function recordEdit(s: ScanSession, index: number, color: string) {
  if (s.order) s.edits.set(s.order[index], color);
}

/** a face foi lida de novo: as correções feitas à mão nela não valem mais */
export function clearFaceEdits(s: ScanSession, impl: PuzzleImpl, face: number) {
  for (const st of impl.scan[face].grid.flat()) s.edits.delete(st);
}

// ---------------------------------------------------------------------------
// Amostras de treino (modo debug): o que a câmera leu + a cor certa de cada adesivo

const hex = (rgbs: RGB[]) => rgbs.map((c) => c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')).join('');

function device(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'outro';
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'outro';
  return `${os} ${br}`;
}

export const SAMPLE_PREFIX = 'CUBOGUIA-AMOSTRA-1';

/**
 * Código de uma linha com a leitura de cada face e a cor certa de cada adesivo (as cores
 * do editor, depois das correções). Formato lido por tools/import-app-samples.mjs.
 */
export function sampleCode(impl: PuzzleImpl, puzzleId: string, s: ScanSession, state: PuzzleState, light: string): string {
  const truth = toReadPositions(state, s.order!);
  const data = {
    p: puzzleId,
    luz: light,
    t: new Date().toISOString().slice(0, 19),
    disp: device(),
    faces: impl.scan.map((face, fi) => ({
      rgb: hex(s.captured[fi]!),
      cor: face.grid.flat().map((idx) => truth[idx]),
      px: Object.fromEntries(Object.entries(s.fixedPx[fi] ?? {}).map(([cell, px]) => [cell, hex(px)])),
    })),
  };
  return `${SAMPLE_PREFIX} ${JSON.stringify(data)}`;
}
