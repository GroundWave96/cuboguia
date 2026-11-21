/**
 * Cubos pares (4x4, 6x6) não têm centro fixo: a leitura pela câmera não sabe qual face é qual.
 * Se a leitura não formar um cubo possível, testa os enganos mais comuns — girou para a
 * direita (2ª e 4ª faces trocadas), mostrou o topo/a base girados ou trocados — do que muda
 * menos para o que muda mais, e fica com a primeira montagem válida.
 * Não há posição de referência: o cubo fica como foi lido (a 1ª face é a da frente).
 */
import type { ScanFace } from '../../core/types';

/** gira a imagem n×n de uma face ¼ de volta (sentido horário na tela) */
const turnImage = <T>(img: T[], n: number) => Array.from({ length: n * n }, (_, k) => img[(n - 1 - (k % n)) * n + ((k / n) | 0)]);
export const pickOrder = <T>(state: T[], order: number[]) => order.map((i) => state[i]);

export function evenScanOrder(n: number, scan: ScanFace[], ok: (s: string[]) => boolean) {
  return (state: string[]): number[] => {
    const ids = state.map((_, i) => i);
    if (ok(state)) return ids;
    const images = scan.map((f) => f.grid.flat());
    const tries: { cost: number; slots: number[][] }[] = [];
    for (const sides of [false, true])
      for (const swapUD of [false, true])
        for (let ru = 0; ru < 4; ru++)
          for (let rd = 0; rd < 4; rd++) {
            const slots = [...images];
            if (sides) [slots[1], slots[3]] = [images[3], images[1]];
            let up = swapUD ? images[5] : images[4], down = swapUD ? images[4] : images[5];
            for (let k = 0; k < ru; k++) up = turnImage(up, n);
            for (let k = 0; k < rd; k++) down = turnImage(down, n);
            slots[4] = up;
            slots[5] = down;
            tries.push({ cost: +sides + +swapUD + +(ru > 0) + +(rd > 0), slots });
          }
    for (const t of tries.sort((a, b) => a.cost - b.cost)) {
      const order = [...ids];
      scan.forEach((f, k) => f.grid.flat().forEach((i, j) => (order[i] = t.slots[k][j])));
      if (ok(pickOrder(state, order))) return order;
    }
    return ids;
  };
}
