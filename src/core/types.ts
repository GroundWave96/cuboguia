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
  instruction: string;
  centerColor: string; // chave de cor
  upColor: string; // cor que deve ficar para cima
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
  scan: ScanFace[];
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
