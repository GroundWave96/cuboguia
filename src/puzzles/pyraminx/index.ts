import { i18nMap, tr } from '../../core/i18n';
import type { PuzzleImpl } from '../../core/types';
import { PolyView } from '../poly/PolyView';
import { LAYER_CUT, TIP_CUT, VERTS, invertPyraMove, normalizePyra, normalizePyraOrder, pyraGeo as geo, type V3 } from './geometry';
import { PYRA_COLORS, PYRA_COLOR_HEX } from './colors';
import { buildPyraNet, buildPyraScan, pyraPieces } from './layout';
import { solvePyraBeginner, solvePyraOptimal } from './solver';
import { validatePyraminx } from './validate';

const VERT_TEXT = i18nMap({ U: ['Cima', 'Top', 'Arriba'], L: ['Esquerda', 'Left', 'Izquierda'], R: ['Direita', 'Right', 'Derecha'], B: ['Trás', 'Back', 'Atrás'] });

const SCAN = buildPyraScan(PYRA_COLORS);

/**
 * A câmera lê 4 imagens de face. Se o resultado não for um pyraminx possível, o usuário
 * provavelmente girou para o outro lado ou mostrou alguma face girada: tenta colocar as
 * imagens 2, 3 e 4 em outras posições e giradas (a 1ª fica fixa — a posição do puzzle
 * inteiro é ajustada depois) e fica com a primeira montagem válida.
 */
function repairOrder(state: string[]): number[] {
  const ids = state.map((_, i) => i);
  const ok = (s: string[]) => validatePyraminx(normalizePyra(s)).ok;
  if (ok(state)) return ids;
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
  /** adesivos lidos numa face (a cor sai do estado) */
  const image = (slot: number) => SCAN[slot].grid.flat();
  const perms = [[1, 2, 3], [2, 1, 3], [1, 3, 2], [3, 2, 1], [2, 3, 1], [3, 1, 2]];
  const angles = [0, 1, 2, 3, 4, 5].map((k) => (k * Math.PI) / 3);
  for (const perm of perms)
    // tenta primeiro as combinações com menos faces giradas
    for (const rots of angles.flatMap((a) => angles.flatMap((b) => angles.map((c) => [a, b, c]))).sort(
      (x, y) => x.filter(Boolean).length - y.filter(Boolean).length,
    )) {
      const order = [...ids];
      let fine = true;
      for (let t = 0; t < 3 && fine; t++) {
        const to = t + 1, from = perm[t];
        const m = mapping(from, to, rots[t]);
        if (!m) {
          fine = false;
          break;
        }
        const img = image(from);
        SCAN[to].grid.flat().forEach((idx, k) => (order[idx] = img[m[k]]));
      }
      if (fine && ok(order.map((i) => state[i]))) return order;
    }
  return ids;
}
const repairScan = (state: string[]) => repairOrder(state).map((i) => state[i]);

/** leitura da câmera → posição de referência, dizendo de onde veio cada adesivo */
function scanOrder(state: string[]): number[] {
  const first = repairOrder(state);
  return normalizePyraOrder(first.map((i) => state[i])).map((j) => first[j]);
}

const pyraminx: PuzzleImpl = {
  colors: PYRA_COLORS,
  get holdHint() {
    return tr(
      'Segure o pyraminx igual ao desenho 3D: em cima, a <b>ponta sem amarelo</b>; atrás, a <b>ponta sem verde</b> (cada ponta tem 3 cores). Assim a face da frente é a verde e a base, a amarela.',
      'Hold the Pyraminx like the 3D drawing: on top, the <b>tip without yellow</b>; at the back, the <b>tip without green</b> (each tip has 3 colors). That makes the front face green and the bottom yellow.', 'Sujeta el Pyraminx como en el dibujo 3D: arriba, la <b>punta sin amarillo</b>; atrás, la <b>punta sin verde</b> (cada punta tiene 3 colores). Así la cara del frente es verde y la base es amarilla.',
    );
  },
  get scanHint() {
    return tr(
      'Pode começar com <b>qualquer face</b> de frente para a câmera e <b>qualquer ponta</b> para cima — no fim o site descobre sozinho como o pyraminx estava. Depois é só girar como as setas mandam.',
      'You can start with <b>any face</b> toward the camera and <b>any tip</b> pointing up — at the end the site works out by itself how the Pyraminx was held. Then just turn it as the arrows say.', 'Puedes empezar con <b>cualquier cara</b> hacia la cámara y <b>cualquier punta</b> hacia arriba; al final la web descubre sola cómo estaba sujeto el Pyraminx. Después solo gíralo como indican las flechas.',
    );
  },
  normalize: normalizePyra,
  repairScan,
  scanOrder,
  stickerCount: 36,
  solvedState: () => geo.solved(),
  fixedStickers: [],
  applyMove: (s, m) => geo.apply(s, m),
  invertMove: invertPyraMove,
  locationMap: (m) => geo.locationMap(m),
  scramble: (len = 11) => geo.randomScramble(len),
  validate: validatePyraminx,
  get methods() {
    return [
      {
        id: 'beginner',
        name: tr('Iniciante (camadas)', 'Beginner (layers)', 'Principiante (capas)'),
        tagline: tr('Para aprender · ~20 movimentos', 'To learn · ~20 moves', 'Para aprender · ~20 movimientos'),
        description: tr('Pontas, centros, a base amarela e por fim o topo com poucos algoritmos.', 'Tips, centers, the yellow bottom and finally the top with few algorithms.', 'Puntas, centros, la base amarilla y al final la parte de arriba con pocos algoritmos.'),
      },
      {
        id: 'optimal',
        name: tr('Avançado (ótimo)', 'Advanced (optimal)', 'Avanzado (óptimo)'),
        tagline: tr('A menor solução · ≤ 11 + pontas', 'The shortest solution · ≤ 11 + tips', 'La solución más corta · ≤ 11 + puntas'),
        description: tr('O computador calcula o caminho mais curto possível. Ótimo para comparar e descobrir atalhos.', 'The computer finds the shortest possible path. Great for comparing and discovering shortcuts.', 'El ordenador encuentra el camino más corto posible. Ideal para comparar y descubrir atajos.'),
      },
    ];
  },
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
    const dir = m.endsWith("'") ? tr('anti-horário ↺', 'counterclockwise ↺', 'antihorario ↺') : tr('horário ↻', 'clockwise ↻', 'horario ↻');
    const where = VERT_TEXT[VERTS[vert]].toLowerCase();
    return `${tip ? tr(`Só a ponta ${where}`, `Just the ${where} tip`, `Solo la punta ${where}`) : tr(`Camada ${where}`, `${VERT_TEXT[VERTS[vert]]} layer`, `Capa ${VERT_TEXT[VERTS[vert]]}`)} · ${dir} (120°)`;
  },
  get notationIntro() {
    return tr('Cada letra é um <b>vértice</b> (uma ponta). Gire olhando a ponta <b>de fora</b>:', 'Each letter is a <b>vertex</b> (a tip). Turn it while looking at the tip <b>from outside</b>:', 'Cada letra es un <b>vértice</b> (una punta). Gíralo mirando la punta <b>desde fuera</b>:');
  },
  get notationNote() {
    return tr(
      "<p><code>U L R B</code> = camada grande do vértice (ponta + centro + 3 arestas) · <code>u l r b</code> = só a ponta · <code>'</code> = anti-horário. Cada giro é ⅓ de volta (120°), olhando o vértice de fora.</p>",
      "<p><code>U L R B</code> = the vertex’s big layer (tip + center + 3 edges) · <code>u l r b</code> = just the tip · <code>'</code> = counterclockwise. Each turn is ⅓ of a rotation (120°), looking at the vertex from outside.</p>", "<p><code>U L R B</code> = la capa grande del vértice (punta + centro + 3 aristas) · <code>u l r b</code> = solo la punta · <code>'</code> = antihorario. Cada giro es ⅓ de vuelta (120°), mirando el vértice desde fuera.</p>",
    );
  },
  get notationHelp() {
    return [
      { move: 'U', text: tr('vértice de cima', 'top vertex', 'vértice de arriba') },
      { move: 'L', text: tr('vértice da frente-esquerda', 'front-left vertex', 'vértice delantero izquierdo') },
      { move: 'R', text: tr('vértice da frente-direita', 'front-right vertex', 'vértice delantero derecho') },
      { move: 'B', text: tr('vértice de trás', 'back vertex', 'vértice de atrás') },
    ];
  },
};

export default pyraminx;
