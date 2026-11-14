/**
 * Tipos centrais que todo puzzle precisa implementar.
 *
 * Para adicionar um novo puzzle (2x2, 5x5, Pyraminx, Megaminx...):
 *  1. Crie uma pasta em src/puzzles/<id>/ exportando um `PuzzleImpl`.
 *  2. Registre-o em src/core/registry.ts com `available: true` e um `load()`.
 * A interface do site (pintura, câmera, tutorial) só conversa com estas interfaces.
 */

/** Um estado é a lista de cores (chaves de cor) de cada adesivo, em ordem fixa do puzzle. */
export type PuzzleState = string[];

/** Chave usada para adesivo ainda não pintado. */
export const UNKNOWN = '?';

export interface ColorInfo {
  key: string;
  name: string; // nome em português ("verde")
  hex: string;
  /** como a cor costuma aparecer numa câmera com boa luz (RGB), se diferente do padrão */
  camera?: [number, number, number];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface StepSegment {
  label: string; // "Ajuste", "Algoritmo"...
  moves: string[];
}

export interface SolutionStep {
  stageId: string;
  title: string;
  description: string;
  segments: StepSegment[];
  /** Adesivos a destacar no estado do INÍCIO do passo. */
  focus: number[];
}

export interface SolutionStage {
  id: string;
  name: string;
  goal: string; // explicação do objetivo da etapa
}

export interface Solution {
  method: string;
  stages: SolutionStage[];
  steps: SolutionStep[];
}

/** Layout de uma face na rede 2D (editor de pintura). */
export interface NetFace {
  face: string; // id da face
  label: string;
  col: number; // posição na grade da rede (em unidades de face)
  row: number;
  /** índices dos adesivos, linha a linha, como vistos de frente */
  grid: number[][];
}

export interface ScanFace {
  face: string;
  /** índices dos adesivos linha a linha, como a câmera vê a face */
  grid: number[][];
  title: string;
  /** cor do miolo da face quando resolvida (para o pontinho do título) */
  faceColor: string;
  /** dica curta mostrada no cabeçalho (HTML) */
  hint: string;
  /** rótulo do lado de cima na grade, ex.: "AMARELO EM CIMA" */
  upLabel: string;
  /** cor (chave) do rótulo/barra de cima, quando existe uma cor fixa ali */
  upColor?: string;
  /** cor fixa (centro ou canto de referência) de cada lado — só em cubos com centro */
  neighbors?: { up: string; down: string; left: string; right: string };
  /** adesivos das faces vizinhas encostados em cada borda, na ordem em que aparecem */
  edges: { up: number[]; down: number[]; left: number[]; right: number[] };
  /** células da grade com cor conhecida (centro no 3x3, canto de referência no 2x2) */
  fixedCells: { cell: number; color: string }[];
  /**
   * Para faces que não são grades quadradas (ex.: pentágonos do Megaminx):
   * polígono de cada célula em coordenadas 0..1 do quadro da câmera, na mesma
   * ordem de grid.flat().
   */
  cells?: { poly: [number, number][]; center: [number, number] }[];
  /** marcas coloridas por fora das bordas (cor da face vizinha), em coordenadas 0..1 */
  marks?: { a: [number, number]; b: [number, number]; color: string; primary?: boolean }[];
  /**
   * Adesivos das faces vizinhas encostados em cada borda (faces poligonais): quando a
   * face vizinha já foi capturada, a cor dela aparece ali — mostra para onde girar.
   */
  neighborMarks?: { sticker: number; edge: number; a: [number, number]; b: [number, number] }[];
  /** seta do rótulo de orientação (padrão ▲) */
  arrow?: string;
}

export interface PuzzleView {
  readonly element: HTMLElement;
  setState(state: PuzzleState): void;
  getState(): PuzzleState;
  animateMove(move: string, durationMs: number): Promise<void>;
  setHighlight(stickers: number[]): void;
  onStickerClick(cb: ((index: number) => void) | null): void;
  setInteractive(paint: boolean): void;
  resetCamera(): void;
  setAutoRotate?(on: boolean): void;
  focusCamera?(stickers: number[]): void;
  dispose(): void;
}

export interface SolveMethod {
  id: string;
  name: string;
  /** frase curta: nível e média de movimentos */
  tagline: string;
  description: string;
}

export interface PuzzleImpl {
  colors: ColorInfo[];
  /** como segurar o cubo (HTML), mostrado na pintura e no tutorial */
  holdHint: string;
  stickerCount: number;
  solvedState(): PuzzleState;
  /** Adesivos que não podem ser pintados (ex.: centros do 3x3). */
  fixedStickers: number[];
  applyMove(state: PuzzleState, move: string): PuzzleState;
  invertMove(move: string): string;
  /** Para onde vai cada adesivo após o movimento: dest = map[orig]. */
  locationMap(move: string): Int32Array;
  scramble(length?: number): string[];
  validate(state: PuzzleState): ValidationResult;
  methods: SolveMethod[];
  solve(state: PuzzleState, methodId?: string): Solution;
  createView(container: HTMLElement): PuzzleView;
  net: NetFace[];
  /** rede 2D desenhada com polígonos (puzzles que não são grades quadradas) */
  netSvg?: { viewBox: string; stickers: { index: number; points: string }[]; labels?: { x: number; y: number; text: string }[] };
  scan: ScanFace[];
  /** texto da tela da câmera, se diferente do holdHint */
  scanHint?: string;
  /**
   * Puzzles sem cor fixa por posição (2x2, pyraminx): o usuário pode pintar ou ler pela
   * câmera segurando de qualquer jeito; aqui o estado é girado (o puzzle inteiro) até a
   * posição de referência que o solucionador usa. Devolve o mesmo estado se não der.
   */
  normalize?: (state: PuzzleState) => PuzzleState;
  /**
   * Só na câmera: se a leitura não formar um puzzle possível, tenta as outras formas
   * como as faces podem ter sido mostradas (ordem trocada, face girada) e fica com a
   * que forma um puzzle de verdade.
   */
  repairScan?: (state: PuzzleState) => PuzzleState;
  /** como classificar as cores da câmera: pelo matiz (6 cores do cubo) ou pela cor mais próxima */
  scanColorModel?: 'hue6' | 'nearest';
  /** explicação da notação (HTML) mostrada no tutorial, se diferente da do cubo */
  notationNote?: string;
  /** texto explicando um movimento (ex.: "Direita · horário") */
  describeMove?: (move: string) => string;
  notationHelp: { move: string; text: string }[];
}

export interface PuzzleDefinition {
  id: string;
  name: string;
  subtitle: string;
  available: boolean;
  /** SVG decorativo do card */
  icon: string;
  load?: () => Promise<PuzzleImpl>;
}
