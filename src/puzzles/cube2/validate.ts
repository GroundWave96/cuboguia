import type { PuzzleState, ValidationResult } from '../../core/types';
import { UNKNOWN } from '../../core/types';
import { FACE_ORDER, type NxNGeometry } from '../nxn/geometry';
import { cornerFacelets, faceKeyOf } from '../nxn/pieces';
import { COLOR_NAME } from '../cube3/colors';

const pieceName = (cols: string[]) => cols.map((c) => COLOR_NAME[c] ?? c).join('-');

/** Validação de um 2x2: só tem cantos. A soma das torções precisa ser múltipla de 3. */
export function makeValidate2(geo: NxNGeometry) {
  const corners = cornerFacelets(geo);
  const cornerColors = corners.map((fs) => fs.map((f) => faceKeyOf(geo, f)));
  const per = geo.n * geo.n;

  return (state: PuzzleState): ValidationResult => {
    const errors: string[] = [];
    const unknown = state.filter((c) => c === UNKNOWN).length;
    if (unknown > 0) return { ok: false, errors: [`Ainda faltam ${unknown} adesivo(s) para pintar.`] };

    for (const f of FACE_ORDER) {
      const n = state.filter((c) => c === f).length;
      if (n !== per) errors.push(`A cor ${COLOR_NAME[f]} aparece ${n} vez(es) — deveria aparecer ${per}.`);
    }
    if (errors.length) return { ok: false, errors };

    let twist = 0;
    const used = new Set<number>();
    corners.forEach((fs) => {
      const cols = fs.map((f) => state[f]);
      const ori = cols.findIndex((c) => c === 'U' || c === 'D');
      const rot = ori < 0 ? null : [cols[ori], cols[(ori + 1) % 3], cols[(ori + 2) % 3]];
      const j = rot ? cornerColors.findIndex((cc) => cc.every((c, k) => c === rot[k])) : -1;
      if (j < 0) {
        errors.push(`Existe um canto com as cores ${pieceName(cols)}, que não existe num cubo real.`);
        return;
      }
      if (used.has(j)) errors.push(`O canto ${pieceName(cornerColors[j])} aparece duas vezes.`);
      used.add(j);
      twist += ori;
    });
    if (errors.length) return { ok: false, errors };
    if (twist % 3 !== 0)
      errors.push('Um canto está girado (torcido) — provavelmente uma cor foi pintada errada ou o cubo foi montado torto.');
    return { ok: errors.length === 0, errors };
  };
}
