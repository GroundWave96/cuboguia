# CuboGuia

Site para aprender a resolver o cubo mágico: você informa como o seu cubo está
(pintando no modelo 3D ou lendo as faces com a câmera) e recebe um tutorial
animado, passo a passo.

| Puzzle | Métodos |
|---|---|
| 3x3 | Iniciante (camadas) · CFOP (Cross, F2L, OLL/PLL em 2 etapas) |
| 2x2 | Iniciante (camadas) · Solução ótima (≤ 11 movimentos) |
| 4x4 | Redução (centros, arestas, paridades OLL/PLL) + iniciante ou CFOP |
| Pyraminx | Iniciante (pontas, centros, base, topo) · Solução ótima (≤ 11 + pontas) |
| Skewb | Iniciante (face branca, cantos de cima, centros) · Solução ótima (≤ 11 movimentos) |
| Megaminx | Iniciante (camadas, ~300 mov.) · Avançado (F2L/S2L em pares, última face em 2 olhares, ~250 mov.) |

No 2x2 (sem centros) a referência é o canto branco-azul-vermelho, sempre
atrás-embaixo-esquerda; os solucionadores só usam U, R e F para não movê-lo.

No Pyraminx a referência é a posição dos centros (eles só giram no lugar):
centro sem amarelo em cima e centro sem verde atrás; os solucionadores usam os 4 eixos.

No 4x4 nenhum centro é fixo: o solucionador monta o branco embaixo e o amarelo em
cima na posição em que o cubo está (a câmera, como no 2x2, começa por qualquer face).
Depois de juntar as arestas, as paridades do 4x4 (aresta virada sozinha e duas arestas
trocadas) são corrigidas com um algoritmo cada, e o resto é a solução do 3x3.

No Skewb a referência é o canto amarelo-verde-laranja, sempre em cima-frente-direita:
os giros R, U, L e B (notação WCA) nunca mexem nele. Cada peça é única, então os
solucionadores usam tabelas de distância por conjunto de peças (os cantos e os centros
são independentes: 8.748 × 360 = 3.149.280 posições) — as mesmas tabelas validam o puzzle.

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
    cube4/         4x4: redução (centros, arestas, paridades) e fim como 3x3
    pyraminx/      Pyraminx: tetraedro, peças 3D, rede triangular e solucionadores
    skewb/         Skewb: cubo cortado pelos cantos, rede em cruz e solucionadores
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

## Treino da câmera

As cores da câmera são testadas com amostras reais (`tests/fixtures/`):

- **Fotos marcadas à mão** — ficam em `tests/cube images/` (fora do Git);
  `python tools/extract-camera-samples.py` gera `camera-samples.json`
  (`--check pasta` desenha cada ponto marcado com a cor anotada, para conferir).
  Lote 1: as fotos originais. Lote 2 (nov/2026): 3x3 no escuro, as 6 faces de um 5x5
  no escuro e com luz, Pyraminx e um segundo Megaminx (de outra fábrica, com cores
  bem diferentes). Os testes simulam o site: cada lote só aprende com os próprios centros.
- **Leituras feitas no próprio site (modo debug)** — abra o site com `?debug` no fim
  do endereço (ex.: `https://cuboguia.pages.dev/3x3?debug`), leia o cubo pela
  câmera, corrija as cores erradas pintando e, no cartão "Leitura da câmera", abra
  **Amostra para treino**: escolha a luz do ambiente e use **Copiar código** (ou
  **Baixar .txt**). Cole os códigos num arquivo de texto (pode ter outras coisas no meio,
  como a conversa do chat) e rode `node tools/import-app-samples.mjs arquivo.txt` —
  as faces vão para `app-samples.json`, no mesmo formato das fotos.

Nada é coletado dos usuários: o código só existe no modo debug e só sai do
aparelho se você copiar.

## Endereços

Sem `#` (bons para o Google e para a contagem de visitas) — `src/core/router.ts`:

| Endereço | Página |
|---|---|
| `/` | início |
| `/3x3`, `/2x2`, `/4x4`, `/5x5`, `/pyraminx`, `/skewb`, `/megaminx` | informar as cores |
| `/3x3/tutorial?m=método&s=estado` | tutorial |
| `/cronometro?p=&e=&t=&n=` | cronômetro (com desafio opcional) |

Os links antigos (`#/p/cube3`, `#/cronometro?...`) viram o endereço novo sozinhos.
O Cloudflare Pages entrega o `index.html` em qualquer endereço (o projeto não tem
`404.html`, então ele trata o site como SPA). `public/sitemap.xml` e `robots.txt`
apontam as páginas para o Google.

## Contagem de visitas

Cloudflare Web Analytics, ligado no painel do Cloudflare Pages (sem código no
site, sem cookies, sem pedir permissão ao usuário). Mostra visitas por endereço —
por isso cada puzzle e o cronômetro têm o próprio endereço.

## Publicação (Cloudflare Pages)

O site está em **https://cuboguia.pages.dev** e é publicado **automaticamente**:
o projeto do Cloudflare Pages está ligado a este repositório do GitHub.

- Todo commit na branch `main` → publica em produção.
- Commits em outras branches → geram um link de pré-visualização.

Configuração no Cloudflare: comando de build `npm run build`, pasta `dist`,
Node definido pelo arquivo `.nvmrc`.

Publicação manual (só se precisar): `npm run deploy:manual`.

A câmera só funciona em HTTPS (o Cloudflare Pages já entrega HTTPS).
