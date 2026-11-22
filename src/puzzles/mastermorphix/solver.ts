/**
 * Solução do Mastermorphix: as cores viram um 3x3 "por dentro" (model.ts), que é resolvido
 * pelo método de camadas ou pelo CFOP do 3x3. Os textos dos passos são do Mastermorphix
 * (as cores e nomes do 3x3 não fazem sentido para quem segura a pirâmide).
 *
 * No fim, os meios das arestas (os centros do 3x3) podem ter ficado girados: ½ volta troca as
 * duas cores; ¼ de volta deixa a forma torta. Algoritmos que só giram centros acertam isso.
 */
import { tr } from '../../core/i18n';
import type { PuzzleState, Solution, SolutionStage, SolutionStep } from '../../core/types';
import { NxNGeometry } from '../nxn/geometry';
import { solveBeginner } from '../cube3/solver/beginner';
import { solveCFOP } from '../cube3/solver/cfop';
import { composePerm } from '../cube3/solver/common';
import { ROTS, applyPieces, centerTurns, cubeFacelets, isPieces, readPyramid, type MorphState, type V3 } from './model';

const geo3 = new NxNGeometry(3);
const STICKER_OF = new Map(geo3.stickers.map((s) => [`${s.cubie2.join(',')}|${s.normal.join(',')}`, s.index]));
const stickerOf = (c2: V3, n: V3) => STICKER_OF.get(`${c2.join(',')}|${n.join(',')}`)!;

/** estado no formato "peças" (lê as cores se vier no formato "pirâmide") */
export function toPieces(state: PuzzleState): MorphState {
  if (isPieces(state)) return state;
  const r = readPyramid(state);
  if (!r.pieces) throw new Error('Mastermorphix inválido');
  return r.pieces;
}

// ---------------------------------------------------------------------------
// Algoritmos que só giram centros (cantos e arestas voltam ao lugar)
const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_N: Record<string, V3> = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
const letterOf = (n: V3) => FACES.find((f) => FACE_N[f].every((x, i) => x === n[i]))!;
const split = (a: string) => a.split(' ').filter(Boolean);
const inv = (m: string) => (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : m + "'");
const turnsOf = (m: string) => (m.endsWith("'") ? 3 : m.endsWith('2') ? 2 : 1);

interface Macro {
  /** os movimentos, em partes (a repetição aparece como "× 9") */
  parts: { moves: string[]; times: number }[];
  effect: number[];
  length: number;
}
/** base: ½ volta no centro de cima, e U + L ¼ (com B ½) */
const BASE: { moves: string; times: number }[] = [
  { moves: "U R L U2 R' L'", times: 2 },
  { moves: 'U L B2', times: 9 },
];
function effectOf(parts: { moves: string[]; times: number }[]): number[] {
  const e = [0, 0, 0, 0, 0, 0];
  for (const p of parts) for (const m of p.moves) e[FACES.indexOf(m[0])] = (e[FACES.indexOf(m[0])] + turnsOf(m) * p.times) % 4;
  return e;
}
let MACROS: Macro[] | null = null;
function macros(): Macro[] {
  if (MACROS) return MACROS;
  const best = new Map<string, Macro>();
  for (const b of BASE)
    for (const inverse of [false, true])
      for (const R of ROTS) {
        const map = (m: string) => {
          const n = FACE_N[m[0]];
          const r: V3 = [R[0] * n[0] + R[1] * n[1] + R[2] * n[2], R[3] * n[0] + R[4] * n[1] + R[5] * n[2], R[6] * n[0] + R[7] * n[1] + R[8] * n[2]];
          return letterOf(r) + m.slice(1);
        };
        let moves = split(b.moves).map(map);
        if (inverse) moves = moves.reverse().map(inv);
        const parts = [{ moves, times: b.times }];
        const mac = { parts, effect: effectOf(parts), length: moves.length * b.times };
        const k = mac.effect.join('');
        if (!best.has(k) || best.get(k)!.length > mac.length) best.set(k, mac);
      }
  MACROS = [...best.values()];
  return MACROS;
}

/** a menor combinação de algoritmos que leva os centros de `start` para 0 */
export function centerFix(start: number[]): Macro[] {
  const key = (v: number[]) => v.join('');
  const goal = '000000';
  if (key(start) === goal) return [];
  const prev = new Map<string, { from: string; mac: Macro; cost: number }>();
  const dist = new Map<string, number>([[key(start), 0]]);
  // Dijkstra pelo número de movimentos (poucos estados: 4^6)
  const open: { k: string; v: number[]; c: number }[] = [{ k: key(start), v: start, c: 0 }];
  while (open.length) {
    open.sort((a, b) => a.c - b.c);
    const { k, v, c } = open.shift()!;
    if (k === goal) break;
    if (c > (dist.get(k) ?? Infinity)) continue;
    for (const mac of macros()) {
      const nv = v.map((x, i) => (x + mac.effect[i]) % 4);
      const nk = key(nv);
      const nc = c + mac.length;
      if (nc < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nc);
        prev.set(nk, { from: k, mac, cost: nc });
        open.push({ k: nk, v: nv, c: nc });
      }
    }
  }
  if (!prev.has(goal)) throw new Error('Não achei como acertar os centros.');
  const out: Macro[] = [];
  for (let k = goal; k !== key(start); k = prev.get(k)!.from) out.unshift(prev.get(k)!.mac);
  return out;
}
/** confere (nos testes) que um algoritmo de centros não mexe em cantos nem arestas */
export const macroKeepsPieces = (mac: Macro) => composePerm(mac.parts.flatMap((p) => Array.from({ length: p.times }, () => p.moves).flat())).every((v, i) => v === i);
export const allMacros = () => macros();

// ---------------------------------------------------------------------------
export const MORPH_STAGES = (): SolutionStage[] => [
  {
    id: 'base',
    name: tr('Base', 'Base', 'Base'),
    goal: tr(
      'Montar a parte de baixo do 3x3 que existe dentro do Mastermorphix. No caminho ele perde a forma de pirâmide — é normal: siga os giros e a forma volta no fim.',
      'Build the bottom part of the 3x3 hidden inside the Mastermorphix. Along the way it loses its pyramid shape — that’s normal: follow the turns and the shape comes back at the end.',
      'Armar la parte de abajo del 3x3 que hay dentro del Mastermorphix. Por el camino pierde la forma de pirámide; es normal: sigue los giros y la forma vuelve al final.',
    ),
  },
  {
    id: 'top',
    name: tr('Topo', 'Top', 'Arriba'),
    goal: tr(
      'Resolver a camada de cima com algoritmos do 3x3. Quando ela fica pronta, a pirâmide volta inteira.',
      'Solve the top layer with 3x3 algorithms. When it’s done, the pyramid comes back whole.',
      'Resolver la capa de arriba con algoritmos del 3x3. Cuando queda lista, la pirámide vuelve entera.',
    ),
  },
  {
    id: 'mids',
    name: tr('Meios das arestas', 'Edge middles', 'Medios de las aristas'),
    goal: tr(
      'Os triângulos do meio das arestas só giram no lugar. Se algum ficou com as duas cores trocadas (ou torto), estes algoritmos o giram sem mexer no resto.',
      'The triangles in the middle of the edges only turn in place. If one ended up with its two colors swapped (or crooked), these algorithms turn it without moving anything else.',
      'Los triángulos del medio de las aristas solo giran en su sitio. Si alguno quedó con los dos colores cambiados (o torcido), estos algoritmos lo giran sin mover nada más.',
    ),
  },
];

const BASE_STAGES = new Set(['cross', 'f2l', 'corners', 'middle']);

export function solveMorph(state: PuzzleState, methodId: string): Solution {
  const start = toPieces(state);
  const cube = cubeFacelets(start, stickerOf);
  const sol = methodId === 'cfop' ? solveCFOP(cube) : solveBeginner(cube);
  let s = start;
  const steps: SolutionStep[] = [];
  let base = 0, top = 0;
  const baseCount = sol.steps.filter((st) => BASE_STAGES.has(st.stageId)).length;
  const topCount = sol.steps.length - baseCount;
  for (const st of sol.steps) {
    const isBase = BASE_STAGES.has(st.stageId);
    const n = isBase ? ++base : ++top;
    const total = isBase ? baseCount : topCount;
    const moves = st.segments.flatMap((g) => g.moves);
    steps.push({
      stageId: isBase ? 'base' : 'top',
      title: isBase ? tr(`Base · parte ${n} de ${total}`, `Base · part ${n} of ${total}`, `Base · parte ${n} de ${total}`) : tr(`Topo · parte ${n} de ${total}`, `Top · part ${n} of ${total}`, `Arriba · parte ${n} de ${total}`),
      description: isBase
        ? tr(
            'Siga os giros com calma, sempre segurando o Mastermorphix na mesma posição (como no desenho 3D). As peças da parte de baixo vão para o lugar — a forma pode ficar estranha no meio do caminho, isso é normal.',
            'Follow the turns calmly, always holding the Mastermorphix in the same position (like the 3D drawing). The bottom pieces go into place — the shape may look odd along the way, that’s normal.',
            'Sigue los giros con calma, sujetando siempre el Mastermorphix en la misma posición (como en el dibujo 3D). Las piezas de la parte de abajo van a su sitio; la forma puede verse rara por el camino, es normal.',
          )
        : tr(
            'Agora a camada de cima, com um algoritmo do 3x3. Mantenha a mesma posição; no fim desta etapa a pirâmide volta a ficar inteira.',
            'Now the top layer, with a 3x3 algorithm. Keep the same position; at the end of this stage the pyramid is whole again.',
            'Ahora la capa de arriba, con un algoritmo del 3x3. Mantén la misma posición; al final de esta etapa la pirámide vuelve a quedar entera.',
          ),
      segments: st.segments,
      focus: [],
    });
    for (const m of moves) s = applyPieces(s, m);
  }
  // meios das arestas
  const ct = centerTurns(s);
  const fix = centerFix(FACES.map((f) => ct[f] ?? 0));
  fix.forEach((mac, i) => {
    const swapped = mac.effect.some((x) => x % 2);
    steps.push({
      stageId: 'mids',
      title: tr(`Meios das arestas · ${i + 1} de ${fix.length}`, `Edge middles · ${i + 1} of ${fix.length}`, `Medios de las aristas · ${i + 1} de ${fix.length}`),
      description: swapped
        ? tr(
            'Dois meios de aresta estão tortos (¼ de volta). Faça a sequência quantas vezes está indicado: no meio a forma muda, mas cantos e pipas voltam todos ao lugar e só esses meios giram.',
            'Two edge middles are crooked (¼ turn). Repeat the sequence as many times as shown: the shape changes along the way, but corners and kites all come back and only those middles turn.',
            'Dos medios de arista están torcidos (¼ de vuelta). Repite la secuencia las veces indicadas: por el camino la forma cambia, pero esquinas y cometas vuelven a su sitio y solo giran esos medios.',
          )
        : tr(
            'Um meio de aresta está com as duas cores trocadas. Este algoritmo o gira ½ volta e devolve todo o resto ao lugar.',
            'An edge middle has its two colors swapped. This algorithm turns it ½ and puts everything else back.',
            'Un medio de arista tiene los dos colores cambiados. Este algoritmo lo gira media vuelta y devuelve todo lo demás a su sitio.',
          ),
      segments: mac.parts.map((p) => ({
        label: p.times > 1 ? tr(`Repita ${p.times} vezes`, `Repeat ${p.times} times`, `Repite ${p.times} veces`) : tr('Algoritmo', 'Algorithm', 'Algoritmo'),
        moves: Array.from({ length: p.times }, () => p.moves).flat(),
      })),
      focus: [],
    });
  });
  return {
    method: methodId === 'cfop' ? tr('Como um 3x3: CFOP', 'Like a 3x3: CFOP', 'Como un 3x3: CFOP') : tr('Como um 3x3: camadas', 'Like a 3x3: layers', 'Como un 3x3: capas'),
    stages: MORPH_STAGES().filter((stg) => steps.some((st) => st.stageId === stg.id)),
    steps,
  };
}
