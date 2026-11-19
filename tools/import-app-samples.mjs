/**
 * Junta as amostras de treino geradas pelo site (modo debug) em
 * tests/fixtures/app-samples.json, no mesmo formato de camera-samples.json
 * (uma entrada por face lida, com a cor certa de cada adesivo).
 *
 * Como gerar uma amostra: abra o site com ?debug no fim do endereço
 * (ex.: https://cuboguia.pages.dev/#/p/cube3?debug), leia o cubo pela câmera,
 * corrija as cores erradas pintando e use "Copiar código" no cartão "Leitura da câmera".
 *
 * Uso: node tools/import-app-samples.mjs amostras.txt [mais.txt ...]
 *      (o texto pode ter vários códigos misturados com outras coisas — conversa do chat etc.)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = 'CUBOGUIA-AMOSTRA-1';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'app-samples.json');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node tools/import-app-samples.mjs amostras.txt [mais.txt ...]');
  process.exit(1);
}

/** acha cada código no texto (aplicativos de chat às vezes quebram linhas no meio) */
function findCodes(text) {
  const out = [];
  let at = text.indexOf(PREFIX);
  while (at >= 0) {
    const start = text.indexOf('{', at);
    let depth = 0, inStr = false, end = -1;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (start < 0 || end < 0) break;
    out.push(text.slice(start, end + 1).replace(/[\r\n]+/g, ''));
    at = text.indexOf(PREFIX, end);
  }
  return out;
}

const rgbList = (hex) => {
  const out = [];
  for (let i = 0; i + 6 <= hex.length; i += 6) out.push([0, 2, 4].map((k) => parseInt(hex.slice(i + k, i + k + 2), 16)));
  return out;
};

const samples = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const known = new Set(samples.map((s) => s.photo));
let added = 0, skipped = 0, bad = 0;

for (const file of files) {
  for (const raw of findCodes(readFileSync(file, 'utf8'))) {
    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      bad++;
      continue;
    }
    d.faces.forEach((face, fi) => {
      const photo = `app/${d.p}/${d.t}/face${fi + 1}`;
      if (known.has(photo)) return void skipped++;
      const rgbs = rgbList(face.rgb);
      if (rgbs.length !== face.cor.length) return void bad++;
      samples.push({
        photo,
        puzzle: d.p,
        light: d.luz,
        device: d.disp,
        cells: rgbs.map((rgb, k) => {
          const cell = { rgb, truth: face.cor[k] };
          if (face.px?.[k] !== undefined) {
            cell.center = true;
            cell.pixels = rgbList(face.px[k]);
          }
          return cell;
        }),
      });
      known.add(photo);
      added++;
    });
  }
}

writeFileSync(OUT, JSON.stringify(samples, null, 1) + '\n');
console.log(`${added} faces novas, ${skipped} já existiam, ${bad} com problema → ${OUT} (${samples.length} faces no total)`);
