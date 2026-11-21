# CuboGuia

Site para aprender a resolver o cubo mágico: você informa como o seu cubo está
(pintando no modelo 3D ou lendo as faces com a câmera) e recebe um tutorial
animado, passo a passo.

| Puzzle | Métodos |
|---|---|
| 3x3 | Iniciante (camadas) · CFOP (Cross, F2L, OLL/PLL em 2 etapas) |
| 2x2 | Iniciante (camadas) · Solução ótima (≤ 11 movimentos) |
| 4x4 | Redução (centros, arestas, paridades OLL/PLL) + iniciante ou CFOP |
| 5x5 | Redução (centros, arestas com paridade das pontas) + iniciante ou CFOP |
| 6x6 | Redução (centros, pontas de dentro e de fora, paridades OLL/PLL) + iniciante ou CFOP · ~700 mov. |
| 7x7 | Redução (centros, pontas em volta do meio da aresta) + iniciante ou CFOP · ~1000 mov. |
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

O 6x6 e o 7x7 usam um solucionador só, para qualquer tamanho (`src/puzzles/nxn/big.ts`):
os tipos de peça (centros e pontas com a mesma distância das bordas) saem dos próprios giros,
todos os ciclos de 3 peças de cada tipo saem de alguns comutadores conjugados por giros, e cada
peça é colocada pelo caminho mais curto que não estraga o que já está pronto. Nos pares, as
pontas de dentro se juntam primeiro (como no 4x4) e servem de referência para as de fora; as
paridades OLL e PLL giram as fatias de dentro juntas. O primeiro cálculo leva ~1 s (monta os ciclos).

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
npm test         # testes de unidade (solucionadores, câmera, cronômetro, inglês...)
npm run build    # tipos + testes de unidade + gera dist/ (falha se algum teste falhar)
npm run e2e      # testes de navegador (precisa do build; usa o Chrome instalado)
npm run check    # tudo: build + testes de navegador
```

## Testes

- **Testes de unidade** (`tests/`, Vitest): rodam dentro do `npm run build`. Como o Cloudflare
  publica com `npm run build`, **um teste quebrado impede a publicação** — o site no ar continua
  na versão anterior.
- **Testes de navegador** (`e2e/`, Playwright): abrem o site de verdade (com o `wrangler pages dev`,
  igual ao Cloudflare) no computador e num celular simulado: todos os puzzles do início ao fim,
  continuar de onde parou, câmera (com uma câmera de mentira), cronômetro com dois dedos, desafio,
  sem internet e versão em inglês.
- **Antes de juntar na `main`**: `npm run check` no computador (build + testes de navegador).
- **GitHub Actions** (`.github/workflows/testes.yml`): os mesmos testes no GitHub, **só quando chamados
  à mão** (aba Actions → Testes → Run workflow). Não roda sozinho porque lá não há placa de vídeo e
  leva uns 15 minutos.

## Estrutura

```
src/
  core/            tipos, registro de puzzles, cores, armazenamento
  puzzles/
    nxn/           geometria + visual 3D genéricos para cubos NxN (2x2, 3x3, 4x4, 5x5...)
    cube3/         3x3: peças, validação e solucionadores (iniciante e CFOP)
    cube2/         2x2: validação e solucionadores (iniciante e ótimo)
    cube4/         4x4: redução (centros, arestas, paridades) e fim como 3x3
    cube5/         5x5: redução (centros, arestas com paridade das pontas) e fim como 3x3
    cube6/ cube7/  6x6 e 7x7: só a configuração; o solucionador é o genérico de nxn/big.ts
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
| `/3x3`, `/2x2`, `/4x4`, `/5x5`, `/6x6`, `/7x7`, `/pyraminx`, `/skewb`, `/megaminx` | informar as cores |
| `/3x3/tutorial?m=método&s=estado` | tutorial |
| `/cronometro?p=&e=&t=&n=` | cronômetro (com desafio opcional) |
| `/en`, `/en/3x3`, `/en/3x3/tutorial`, `/en/timer` | as mesmas páginas em inglês |

Os links antigos (`#/p/cube3`, `#/cronometro?...`) viram o endereço novo sozinhos.
O Cloudflare Pages entrega o `index.html` em qualquer endereço (o projeto não tem
`404.html`, então ele trata o site como SPA). `public/sitemap.xml` e `robots.txt`
apontam as páginas para o Google.

## Idiomas (português e inglês)

- O idioma vem do endereço: `/3x3` é português, `/en/3x3` é inglês (o cronômetro é
  `/cronometro` e `/en/timer`). O seletor **PT | EN** do menu leva para a mesma página
  no outro idioma; navegador em inglês na versão em português vê um convite discreto.
- Os textos ficam junto do código: `tr('Próximo passo', 'Next step')` (`src/core/i18n.ts`).
  Como o idioma pode mudar sem recarregar, texto nunca vai para constante no carregamento:
  use getters (`get holdHint() { return tr(...) }`), funções (`STAGES()`) ou `i18nMap`.
- Avisos de validação comuns ficam em `src/core/messages.ts`.
- `tests/i18n.test.ts` resolve embaralhados de todos os puzzles em todos os métodos em
  inglês e falha se aparecer qualquer palavra em português — rode ao adicionar textos.

## Tutorial: continuar de onde parou

O passo e o movimento de cada tutorial ficam guardados no navegador (`src/core/progress.ts`,
chave `cubo:progress`, os 4 últimos tutoriais por 60 dias). O mesmo cubo e método sempre geram a mesma
solução; uma assinatura dos movimentos garante isso (se a solução mudar numa versão nova, o
progresso antigo é ignorado). A tela inicial mostra o mais recente e, numa setinha "+ N outros", os outros 3; o X ao lado de cada um faz o site esquecer aquele tutorial.

## Tutorial: modo mãos livres

O botão "Mãos livres" (ao lado da velocidade) faz o navegador falar o título do passo e cada
próximo movimento (Web Speech API, `src/ui/handsfree.ts`: nada sai do aparelho) e um toque no
cubo 3D avança um movimento (arrastar continua girando a vista). A escolha fica lembrada
(`cubo:handsfree`). Os navegadores só falam depois do primeiro toque na página.

## Sugestões e erros

O rodapé (e o menu do celular) tem "Mandar sugestão ou avisar erro": abre o e-mail da pessoa
com o assunto e o endereço da página (que guarda o cubo dela) já preenchidos
(`src/ui/feedback.ts`). Nada é enviado sozinho.

## Algoritmos (`/algoritmos`, `/algoritmos/2x2`, `/algoritmos/pyraminx`)

- **3x3**: OLL em 2 etapas (10), OLL completa (57, números e algoritmos da folha de OLL de Feliks
  Zemdegs e Andy Klise, CubeSkills) e PLL completa (21) — `src/puzzles/cube3/algs.ts`.
- **2x2**: método Ortega, face amarela (7) e PBL (6) — `src/puzzles/cube2/algs.ts`.
- **Pyraminx**: última camada, as 3 arestas de cima (5 casos, algoritmos achados por busca dos mais
  curtos com R, L e U) — `src/puzzles/pyraminx/algs.ts`.

O desenho de cada caso **não é feito à mão**: é o algoritmo aplicado ao contrário no puzzle resolvido
(`src/puzzles/algkit.ts`). `tests/algs.test.ts` e `tests/algs-others.test.ts` conferem que cada
algoritmo mexe só no que deve, que os casos são todos diferentes (os 57 da OLL cobrem todos os casos
que existem), que o formato combina com o grupo/nome (tipo de troca da PLL e da PBL, cantos da face
amarela, sentido dos ciclos do Pyraminx), que o algoritmo alternativo resolve o mesmo caso e que os
pares a/b são espelhos. Para trocar ou adicionar um algoritmo, edite a lista e rode `npm test`. Os casos marcados como "Aprendido" ficam no aparelho (`cubo:algs:learned`).
A notação aceita rotações do cubo inteiro (`x`, `y`, `z`), além de `M`, `E`, `S` e camadas largas.

## Cronômetro: recordes, gráfico e exportar

- **Recorde**: ao parar, compara com os tempos anteriores (`newRecords` em `src/core/timerstats.ts`) e
  comemora o melhor tempo, a melhor média de 5 e a de 12. O primeiro tempo não conta como recorde.
- **Gráfico** (`src/ui/timechart.ts`, SVG): cada resolução é um ponto, a média de 5 é a linha.
  Cores validadas para daltonismo no fundo escuro. A lista de tempos é a "tabela" do gráfico.
- **Exportar/importar** (`src/core/timerio.ts`): um `.json` com os tempos de todos os puzzles.
  A importação também aceita o arquivo de exportação do **csTimer** (o tipo de embaralho de cada
  sessão decide o puzzle) e junta sem repetir tempos.

## Prévia dos links (WhatsApp, redes sociais)

WhatsApp e redes sociais não rodam o JavaScript da página, e o site é um `index.html` só. Por isso
`functions/_middleware.ts` (Cloudflare Pages Functions, grátis) chama `server/page-preview.ts`, que
põe no HTML o título, a descrição e o idioma de cada página (os mesmos de `src/core/meta.ts`, que o
site também usa) e, no link de desafio, "Ana te desafiou: 12.34 no 3x3" com a imagem do duelo.
Os arquivos (js, css, imagens) não passam pela função (`public/_routes.json`). Testar localmente:
`npx wrangler pages dev dist` (já roda as funções).

Imagens da prévia (`public/og.png` e `public/og-desafio.png`, sem texto em nenhum idioma):
geradas por `node tools/og-images.mjs` com o site rodando no wrangler.

## Aplicativo e uso sem internet

- `pwa/sw.js` é o service worker; no build, `vite.config.ts` gera o `dist/sw.js` com a
  lista de todos os arquivos do site e uma versão (hash). Na primeira visita tudo fica
  guardado no aparelho, e o site abre sem internet (inclusive tutoriais e cronômetro).
- Versão nova publicada: aparece "Há uma nova versão — Atualizar" (nunca recarrega
  sozinho). Só funciona no build (`npm run build`), não no `npm run dev`.
- "Instalar app" no menu: no Android/computador usa o pedido do navegador; no iPhone
  mostra as instruções (Compartilhar → Adicionar à Tela de Início).
- `public/_headers`: arquivos de `/assets/` (nome versionado) ficam no cache do navegador
  por 1 ano; o `sw.js` sempre é conferido.
- Testar localmente como no Cloudflare: `npm run build` e `npx wrangler pages dev dist`.

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
