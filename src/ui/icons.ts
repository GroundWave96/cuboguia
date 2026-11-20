/**
 * Ícones da interface (SVG em linha, 24×24, na cor do texto).
 * Uso: `${icon('play')}` dentro do HTML. Tamanho = 1.25em (ajuste com CSS em `.ico`).
 */
const PATHS = {
  // ---- tutorial
  play: '<path d="M8 5.6v12.8a1.1 1.1 0 0 0 1.66.95l10.3-6.4a1.1 1.1 0 0 0 0-1.9L9.66 4.65A1.1 1.1 0 0 0 8 5.6z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" fill="currentColor" stroke="none"/>',
  /** próximo movimento: um triângulo e a barra */
  moveNext: '<path d="M5.5 6.3v11.4a1 1 0 0 0 1.55.83l8.3-5.7a1 1 0 0 0 0-1.66l-8.3-5.7A1 1 0 0 0 5.5 6.3z" fill="currentColor" stroke="none"/><path d="M18.5 5.5v13" stroke-width="2.6"/>',
  movePrev: '<g transform="matrix(-1 0 0 1 24 0)"><path d="M5.5 6.3v11.4a1 1 0 0 0 1.55.83l8.3-5.7a1 1 0 0 0 0-1.66l-8.3-5.7A1 1 0 0 0 5.5 6.3z" fill="currentColor" stroke="none"/><path d="M18.5 5.5v13" stroke-width="2.6"/></g>',
  /** próximo passo: dois triângulos e a barra */
  stepNext: '<path d="M2.8 7.2v9.6a.9.9 0 0 0 1.4.75L10.6 13a.9.9 0 0 0 0-1.5L4.2 6.45a.9.9 0 0 0-1.4.75zM10.8 7.2v9.6a.9.9 0 0 0 1.4.75L18.6 13a.9.9 0 0 0 0-1.5l-6.4-5.05a.9.9 0 0 0-1.4.75z" fill="currentColor" stroke="none"/><path d="M21 6v12" stroke-width="2.4"/>',
  stepPrev: '<g transform="matrix(-1 0 0 1 24 0)"><path d="M2.8 7.2v9.6a.9.9 0 0 0 1.4.75L10.6 13a.9.9 0 0 0 0-1.5L4.2 6.45a.9.9 0 0 0-1.4.75zM10.8 7.2v9.6a.9.9 0 0 0 1.4.75L18.6 13a.9.9 0 0 0 0-1.5l-6.4-5.05a.9.9 0 0 0-1.4.75z" fill="currentColor" stroke="none"/><path d="M21 6v12" stroke-width="2.4"/></g>',
  /** voltar a câmera 3D para a vista inicial */
  resetView: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.2 9.7"/>',
  warning: '<path d="M10.3 4 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/><path d="M12 9.2v4.3"/><circle cx="12" cy="16.8" r="0.6" fill="currentColor"/>',
  trophy:
    '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M16.5 5.5h3v1.2a3.8 3.8 0 0 1-3.4 3.8"/><path d="M7.5 5.5h-3v1.2a3.8 3.8 0 0 0 3.4 3.8"/><path d="M12 14v3.5"/><path d="M8 20.5h8"/><path d="M9.5 17.5h5l.5 3h-6z"/>',
  /** relógio com seta: continuar de onde parou */
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor"/>',
  download: '<path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/>',
  upload: '<path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/>',
  /** o ícone de compartilhar do iPhone (quadrado com seta para cima) */
  shareIos: '<path d="M12 3.5v11"/><path d="M8 7.5 12 3.5l4 4"/><path d="M8.5 10.5h-2a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-2"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 12.5h9L17.5 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
  // ---- entrada de cores
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.9a4.8 4.8 0 0 0 4.8-4.8C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="7.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.3" cy="7.3" r="1.3" fill="currentColor" stroke="none"/><circle cx="17.2" cy="10.6" r="1.3" fill="currentColor" stroke="none"/>',
  camera:
    '<path d="M4 7.5h3l1.6-2.2A1.6 1.6 0 0 1 9.9 4.6h4.2a1.6 1.6 0 0 1 1.3.7L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5z"/><circle cx="12" cy="13.2" r="3.6"/>',
  switchCamera: '<path d="M19.5 11A7.5 7.5 0 0 0 6.2 6.6L4.5 8.3"/><path d="M4.5 4v4.3h4.3"/><path d="M4.5 13a7.5 7.5 0 0 0 13.3 4.4l1.7-1.7"/><path d="M19.5 20v-4.3h-4.3"/>',
  brush:
    '<path d="M20.5 3.5 12.7 11.3"/><path d="M11.2 9.8l3 3"/><path d="M11 12.6c-1.6-1.2-4-.6-4.8 1.3-.8 1.9-.6 3.8-2.7 5.1 3.3 1.4 7.3.6 8.6-1.8.8-1.4.4-3.5-1.1-4.6z" fill="currentColor"/>',
  // ---- início
  shuffle:
    '<path d="M3 7h3.2c2 0 3.2 1 4.2 2.8l2.6 4.6c1 1.8 2.2 2.6 4.2 2.6H21"/><path d="M3 17h3.2c1.4 0 2.4-.5 3.2-1.4"/><path d="M14.4 8.4c.8-.9 1.8-1.4 3.2-1.4H21"/><path d="M18.5 4.5 21 7l-2.5 2.5"/><path d="M18.5 14.5 21 17l-2.5 2.5"/>',
  sparkles: '<path d="M10 3.5l1.7 4.8 4.8 1.7-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7z"/><path d="M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"/>',
  levels: '<path d="M5 20v-5"/><path d="M12 20V10"/><path d="M19 20V4"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, cls = ''): string {
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
}
