# CuboGuia

Site para aprender a resolver o cubo mágico: você informa como o seu cubo está
(pintando no modelo 3D ou lendo as faces com a câmera) e recebe um tutorial
animado, passo a passo.

| Puzzle | Métodos |
|---|---|
| 3x3 | Iniciante (camadas) · CFOP (Cross, F2L, OLL/PLL em 2 etapas) |
| 2x2 | Iniciante (camadas) · Solução ótima (≤ 11 movimentos) |
| Megaminx | Iniciante (camadas: estrela, face branca, 2ª–4ª camadas, face cinza) |

No 2x2 (sem centros) a referência é o canto branco-azul-vermelho, sempre
atrás-embaixo-esquerda; os solucionadores só usam U, R e F para não movê-lo.

No Megaminx o esquema de cores fica em `src/puzzles/megaminx/colors.ts`
(`MIRROR = true` espelha o sentido das cores, para puzzles com o esquema invertido).

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do solucionador e da leitura de cores
npm run build    # gera dist/
```

## Estrutura

```
src/
  core/            tipos, registro de puzzles, cores, armazenamento
  puzzles/
    nxn/           geometria + visual 3D genéricos para cubos NxN (2x2, 3x3, 4x4, 5x5...)
    cube3/         3x3: peças, validação e solucionadores (iniciante e CFOP)
    cube2/         2x2: validação e solucionadores (iniciante e ótimo)
    megaminx/      Megaminx: geometria do dodecaedro, rede em duas flores, câmera e solucionador
    poly/          visual 3D genérico de poliedros (corta o corpo na animação do giro)
  ui/              páginas: início, entrada de cores (pintura/câmera), tutorial
tests/             testes (vitest)
```

### Adicionar um novo puzzle

1. Crie `src/puzzles/<id>/index.ts` exportando um `PuzzleImpl` (veja `src/core/types.ts`).
   - Cubos NxN reaproveitam `NxNGeometry`, `NxNView`, `buildNet` e `buildScan` — só falta o solucionador.
   - Puzzles de outro formato (Pyraminx, Megaminx) implementam a própria geometria e o próprio `PuzzleView`.
2. Em `src/core/registry.ts`, marque o puzzle com `available: true` e adicione o `load()`.

A interface (pintura, câmera e tutorial) funciona com qualquer puzzle que implemente essas interfaces.

## Publicação (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`

A câmera só funciona em HTTPS (o Cloudflare Pages já entrega HTTPS).
