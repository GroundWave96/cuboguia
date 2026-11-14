import type { PuzzleImpl } from '../../core/types';
import { PolyView } from '../poly/PolyView';
import { LAYER_CUT, TIP_CUT, VERTS, invertPyraMove, normalizePyra, pyraGeo as geo, type V3 } from './geometry';
import { PYRA_COLORS, PYRA_COLOR_HEX } from './colors';
import { buildPyraNet, buildPyraScan, pyraPieces } from './layout';
import { solvePyraBeginner, solvePyraOptimal } from './solver';
import { validatePyraminx } from './validate';

const VERT_TEXT: Record<string, string> = { U: 'Cima', L: 'Esquerda', R: 'Direita', B: 'Trás' };

const SCAN = buildPyraScan(PYRA_COLORS);

/**
 * A câmera lê 4 imagens de face. Se o resultado não for um pyraminx possível, o usuário
 * provavelmente girou para o outro lado ou mostrou alguma face girada: tenta colocar as
 * imagens 2, 3 e 4 em outras posições e giradas (a 1ª fica fixa — a posição do puzzle
 * inteiro é ajustada depois) e fica com a primeira montagem válida.
 */
function repairScan(state: string[]): string[] {
  const ok = (s: string[]) => validatePyraminx(normalizePyra(s)).ok;
  if (ok(state)) return state;
  const centroid = (slot: number) => {
    const cs = SCAN[slot].cells!;
    return [cs.reduce((a, c) => a + c.center[0], 0) / 9, cs.reduce((a, c) => a + c.center[1], 0) / 9];
  };
  /** para cada célula do lugar `to`, a célula do lugar `from` que cai nela girando θ */
  const mapping = (from: number, to: number, theta: number): number[] | null => {
    const [fx, fy] = centroid(from), [tx, ty] = centroid(to);
    const c = Math.cos(theta), s = Math.sin(theta);
    const out: number[] = [];
    for (const cell of SCAN[to].cells!) {
      const dx = cell.center[0] - tx, dy = cell.center[1] - ty;
      const px = fx + dx * c - dy * s, py = fy + dx * s + dy * c;
      const k = SCAN[from].cells!.findIndex((q) => Math.hypot(q.center[0] - px, q.center[1] - py) < 0.02);
      if (k < 0) return null;
      out.push(k);
    }
    return out;
  };
  const image = (slot: number) => SCAN[slot].grid.flat().map((i) => state[i]);
  const perms = [[1, 2, 3], [2, 1, 3], [1, 3, 2], [3, 2, 1], [2, 3, 1], [3, 1, 2]];
  const angles = [0, 1, 2, 3, 4, 5].map((k) => (k * Math.PI) / 3);
  for (const perm of perms)
    // tenta primeiro as combinações com menos faces giradas
    for (const rots of angles.flatMap((a) => angles.flatMap((b) => angles.map((c) => [a, b, c]))).sort(
      (x, y) => x.filter(Boolean).length - y.filter(Boolean).length,
    )) {
      const s = [...state];
      let fine = true;
      for (let t = 0; t < 3 && fine; t++) {
        const to = t + 1, from = perm[t];
        const m = mapping(from, to, rots[t]);
        if (!m) {
          fine = false;
          break;
        }
        const img = image(from);
        SCAN[to].grid.flat().forEach((idx, k) => (s[idx] = img[m[k]]));
      }
      if (fine && ok(s)) return s;
    }
  return state;
}

const pyraminx: PuzzleImpl = {
  colors: PYRA_COLORS,
  holdHint:
    'Segure o pyraminx igual ao desenho 3D: em cima, a <b>ponta sem amarelo</b>; atrás, a <b>ponta sem verde</b> (cada ponta tem 3 cores). Assim a face da frente é a verde e a base, a amarela.',
  scanHint:
    'Pode começar com <b>qualquer face</b> de frente para a câmera e <b>qualquer ponta</b> para cima — no fim o site descobre sozinho como o pyraminx estava. Depois é só girar como as setas mandam.',
  normalize: normalizePyra,
  repairScan,
  stickerCount: 36,
  solvedState: () => geo.solved(),
  fixedStickers: [],
  applyMove: (s, m) => geo.apply(s, m),
  invertMove: invertPyraMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 11) => geo.randomScramble(len),
  validate: validatePyraminx,
  methods: [
    {
      id: 'beginner',
      name: 'Iniciante (camadas)',
      tagline: 'Para aprender · ~20 movimentos',
      description: 'Pontas, centros, a base amarela e por fim o topo com poucos algoritmos.',
    },
    {
      id: 'optimal',
      name: 'Avançado (ótimo)',
      tagline: 'A menor solução · ≤ 11 + pontas',
      description: 'O computador calcula o caminho mais curto possível. Ótimo para comparar e descobrir atalhos.',
    },
  ],
  solve: (state, methodId) => (methodId === 'optimal' ? solvePyraOptimal(state) : solvePyraBeginner(state)),
  createView: (container) =>
    new PolyView(container, {
      ...pyraPieces(),
      bodyFaces: geo.faceVerts.map((f) => f.map((v) => geo.vertices[v])),
      palette: PYRA_COLOR_HEX,
      solved: geo.solved(),
      apply: (s, m) => geo.apply(s, m),
      locationMap: (m) => geo.locationMap(m),
      moveInfo: (m) => {
        const { vert, tip } = geo.parse(m);
        return { axis: geo.axis(vert), angle: geo.moveAngle(m), layer: geo.layer(m), cut: tip ? TIP_CUT : LAYER_CUT };
      },
      // diagonal entre a frente e a face de trás-direita (mostra duas faces)
      defaultDir: [0.75, 0.7, 0.62],
      // vistas candidatas: normais das faces, meios das arestas e vértices
      viewDirs: [
        ...geo.normals,
        ...geo.vertices,
        ...[0, 1, 2, 3].flatMap((a) => [0, 1, 2, 3].filter((b) => b > a).map((b) => geo.vertices[a].map((x, i) => x + geo.vertices[b][i]) as V3)),
      ],
      radius: 0.66,
    }),
  net: [],
  netSvg: buildPyraNet(),
  scan: SCAN,
  describeMove: (m) => {
    const { vert, tip } = geo.parse(m);
    const dir = m.endsWith("'") ? 'anti-horário ↺' : 'horário ↻';
    return `${tip ? 'Só a ponta' : 'Camada'} ${VERT_TEXT[VERTS[vert]].toLowerCase()} · ${dir} (120°)`;
  },
  notationNote:
    '<p><code>U L R B</code> = camada grande do vértice (ponta + centro + 3 arestas) · <code>u l r b</code> = só a ponta · <code>\'</code> = anti-horário. Cada giro é ⅓ de volta (120°), olhando o vértice de fora.</p>',
  notationHelp: [
    { move: 'U', text: 'vértice de cima' },
    { move: 'L', text: 'vértice da frente-esquerda' },
    { move: 'R', text: 'vértice da frente-direita' },
    { move: 'B', text: 'vértice de trás' },
  ],
};

export default pyraminx;
