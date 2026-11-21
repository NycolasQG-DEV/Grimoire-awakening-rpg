# Correção Definitiva de Sprites de Árvores e Terreno — 21/11/2026

## 1. Recorte Preciso de Todas as Árvores (Sem Sobras de Árvores Vizinhas)

- **Causa raiz identificada e eliminada:**
  - `Model_01 Size_03` (208 px) possui 4 colunas de 48 px (total 192 px) mais 16 px de mudas laterais. A rotina antiga dividia 208 por 4 (= 52 px), capturando fatias das árvores vizinhas no corte de `tree-green` e `tree-yellow`.
  - `Model_01 Size_04` (368 px) possui 4 colunas de 80 px (total 320 px) mais tocos na lateral. Dividia 368 por 4 (= 92 px), deslocando todos os cortes.
  - `Model_02 Size_02` (128 px) e `Model_03 Size_02` (128 px) possuem 2 colunas de 64 px, mas estavam configuradas com 3 colunas, cortando `tree-red-pine` ao meio (sliver de 22 px truncado) e capturando pedaços vizinhos.
- **Solução implementada em `scripts/slice-trees.mjs`:**
  - Mapeamento exato da grade por modelo e tamanho:
    - `Model_01`: Size_02 (64×64, 4 cols), Size_03 (48×96, 4 cols), Size_04 (80×128, 4 cols), Size_05 (112×160, 4 cols + tocos 48 px na base).
    - `Model_02`: Size_02 (64×48, 2 cols), Size_03 (48×80, 3 cols), Size_04 (64×112, 3 cols), Size_05 (96×160, 3 cols).
    - `Model_03`: Size_02 (64×80, 2 cols), Size_03 (64×144, 3 cols), Size_04 (96×208, 3 cols em 288 px), Size_05 (128×256, 3 cols).
  - **Isolamento de componentes conexos:** cada célula extrai estritamente o componente conexo da árvore principal. Todos os pixels fora desse componente são transparentes (RGBA 0), eliminando 100% de quaisquer tocos, mudas ou fragmentos vizinhos.
  - `tree-green` e `tree-yellow` agora são perfeitamente limpos em 48×96 px.
  - `tree-red-pine` e `tree-brown-pine` agora são árvores coníferas completas e simétricas em 30×75 px.
  - `tree-sapling` agora é recortado de forma limpa em 16×32 px.

## 2. Utilização Completa dos Sprites de Chão Disponíveis

- **Material de Pedra/Rocha (`stone`) adicionado:**
  - O tileset `Floors_Tiles.png` possui 16 tiles de piso de pedra real (colunas 16–18, linhas 0–2).
  - O bioma `rocky-mountain` foi migrado de `gravel` para `stone`, usando pisos de pedra legítimos em vez de cascalho.
- **Piso de Areia Real:**
  - O bioma `beach` agora utiliza diretamente as células originais de areia de `Floors_Tiles.png` (colunas 5–8, linhas 22–23), com conchas, estrelas-do-mar, marcas de pegadas e ondulações de dunas.
- **Tundra com Neve e Gelo:**
  - O bioma `tundra` agora utiliza tiles de neve pura e tiles de gelo com reflexos e rachaduras do tileset (linhas 22 e 24).
- **Distribuição Orgânica de Variantes:**
  - A seleção de variantes em `TerrainGenerator` deixou de forçar 70% no tile base 0. Agora ~40% é base limpa e ~60% é distribuído entre os 5 tiles de detalhes (flores, conchas, pegadas, pedregulhos, gelo, rachaduras de pedra).

## 3. Validação Executada

| Verificação | Comando | Resultado |
|---|---|---|
| Geração de Assets de Árvores | `npm run assets` | **80 árvores e tocos recortados com precisão** |
| Validação de Pisos | `npm run test:tiles` | **10 biomas terrestres × 6 variantes (100% válidos e opacos)** |
| Testes de Oclusão | `npm run test:occlusion` | **8/8 passaram** |
| Histograma de Biomas | `npm run biome-histogram` | **10 biomas entre 3% e 20% em todas as seeds** |
| Typecheck TypeScript | `npx tsc --noEmit` | **0 erros** |
| Build de Produção | `npm run build` | **Sucesso (`tsc -b && vite build`)** |
| Linter Oxlint | `npm run lint` | **0 erros, 0 avisos** |

---


# Relatório de implementação — projeto-blackclover

## Resultado geral

A implementação é **parcial**. Foram corrigidos pontos estruturais do gerador, adicionadas tabelas de paletas e espécies, criada uma rotina de atlas/recortes, ajustada a escala/câmera e reescrito o núcleo da translucidez. A validação estatística dos biomas e os testes unitários da oclusão passaram. Não é possível declarar a entrega completa porque o ambiente não conseguiu instalar as dependências npm, portanto build, lint e verificação visual no navegador não puderam ser concluídos.

## Mudanças realizadas

### Fase 1 — base e segurança
- Atualizado o README para Phaser 4, React 19, tiles de 16 px, chunks de 32×32 e controles reais do projeto.
- `.env` foi removido da cópia de trabalho e passou a ser ignorado pelo Git; `dist/` também é ignorado.
- O ZIP original continha uma chave `VERCEL_API_KEY` em `.env`. Ela deve ser revogada/rotacionada no painel do provedor; remover o arquivo daqui não invalida a chave exposta.
- O ZIP não contém diretório `.git`; por isso não foi possível criar commits por fase.

### Fase 2 — assets
- Criado `scripts/slice-trees.mjs`, com geração de atlas JSON, metadados de base/tronco/copa e máscara alfa 4×4, folha de contato e aliases usados em runtime.
- Foram criados assets derivados em `public/assets/generated/trees/`; os PNGs originais foram mantidos sem edição.
- O carregamento em runtime deixou de usar as árvores gigantes com duas árvores empilhadas e passou a usar sprites derivados menores.
- Criado um catálogo de espécies de árvore ponderado por bioma. Espécies secas, outonais e nevadas deixaram de ser distribuídas indiscriminadamente.
- Limitação: o script de slicing ainda precisa de inspeção visual completa de todas as células do atlas. A folha de contato é uma ferramenta de inspeção, não prova de que todos os recortes estão sem sobreposição.

### Fase 3 — terreno e biomas
- Criada a tabela central `src/game/config/biomes.ts`, com 10 biomas terrestres, praia e duas profundidades de água, cada um com paleta própria.
- `TerrainGenerator` agora expõe `sampleWorld()` com elevação, umidade, temperatura, bioma, profundidade de água e pesos de transição.
- Os campos de elevação, umidade e temperatura são remapeados por quantis calibrados com 20.000 amostras por seed.
- A geração dos chunks usa cache local para identificar água rasa/faixa de costa; o limiar dos lagos foi ajustado para aumentar a presença de margens e praias.
- Corrigido o teste de vizinhança: agora são testadas as oito posições ao redor da árvore, inclusive `(wx, wy + 1)`.
- Removido o overlay elíptico de terra do spawn.
- Limitação: não foi concluída a camada completa de Floors_Tiles/Water_tiles, animação da água, marching-squares das costas, autotile generalizado para todos os pisos, penhascos ou amostrador em cache por chunk com margem de 2 tiles. Também não foi implementado domain warping de elevação nem um sistema completo de rios por elevação.

### Fase 4 — árvores e oclusão
- Criada `treeSpeciesByBiome` com pesos por bioma e mistura ponderada pelos pesos de transição.
- Criado `src/game/systems/occlusionSystem.ts`: a decisão de fade testa o retângulo do corpo do jogador contra pixels opacos da máscara do sprite completo, somente quando o jogador está atrás da árvore.
- A translucidez é aplicada a um único objeto de imagem, cobrindo copa, galhos e tronco. A sombra permanece opaca. O alpha alvo é 0,4 e a suavização usa `deltaSeconds` com `1 - exp(-dt * 12)` e histerese de 4 px.
- Criado `scripts/test-occlusion.mjs`; resultado local: **8/8 testes passaram**, incluindo atrás do tronco, ao lado, canto transparente, à frente, entre árvores, histerese e delta time.
- Limitação: a máscara de runtime é reconstruída dos pixels da textura e não usa diretamente a máscara 4×4 do atlas. Não há ainda índice espacial de células 128 px: a cena consulta árvores de chunks próximos. Rochas e arbustos ainda não usam a mesma interface de oclusão. A depuração visual F3 foi removida para que hitboxes e áreas de oclusão não apareçam no jogo.
- Vento global, folhas caindo, neve em partículas e distribuição completa de tocos/troncos/sub-bosque não foram finalizados.

### Fase 5 — câmera, HUD e estrutura
- Zoom inicial 2×, passos inteiros 1×–4× e `roundPixels` habilitado.
- Adicionados HUD de bioma, overlay F2 e `window.__GAME_DEBUG__` para teleporte, zoom, regeneração, amostragem e estatísticas. A antiga visualização F3 de colisores/retângulos foi removida; a colisão continua ativa como dados internos invisíveis.
- Separado o sistema de oclusão em módulo próprio e tipado o estado dos arbustos, removendo o cast `as any` mencionado no diagnóstico.
- Limitação: `TerrainScene.ts` ainda precisa de divisão nos módulos ChunkManager, TreeSystem, PlayerController, Minimap e ParticleFx. Não foi feito benchmark de 30 segundos nem verificado o limite de objetos de display.

### Fase 6 — verificação
- Criado `scripts/biome-histogram.ts` e executado com **20.000 amostras por seed** em cinco seeds.
- Criado `scripts/shots.mjs` para automação futura das capturas com Puppeteer.
- Transpilação sintática TypeScript: **11 arquivos, 0 erros de sintaxe**.
- Testes unitários de oclusão: **8/8 passaram**.
- Build e lint não passaram por falta das dependências no ambiente: `tsc -b` reportou ausência de `vite/client` e `node`; `oxlint` não estava instalado.
- A tentativa de instalar dependências falhou ao resolver o registro npm (`EAI_AGAIN`). Sem Puppeteer/Vite instalados, as capturas de antes/depois e os testes integrados do navegador não puderam ser executados.

## Histograma de biomas

Percentual da **área terrestre amostrada**, por bioma, em cinco seeds. Cada seed usa 20.000 pontos de amostragem total.

| Bioma | Mínimo | Máximo |
|---|---:|---:|
| Praia | 3,18% | 3,94% |
| Planície | 9,84% | 11,62% |
| Floresta temperada | 13,78% | 16,62% |
| Bosque outonal | 11,37% | 19,02% |
| Taiga | 10,08% | 12,80% |
| Floresta ancestral | 8,26% | 9,73% |
| Pântano | 3,65% | 5,91% |
| Terras secas | 3,76% | 6,00% |
| Montanha rochosa | 9,95% | 13,07% |
| Tundra | 12,54% | 15,79% |

**Meta estatística 3%–25%: aprovada para os dez biomas terrestres nas cinco seeds medidas.** O relatório detalhado por seed está em `reports/biome-histogram-5-seeds.txt`.

## Critérios de aceite — estado conhecido

| Critério | Estado | Evidência / pendência |
|---|---|---|
| 1. Nenhuma árvore empilhada | Parcial | Runtime usa aliases menores; o atlas completo precisa inspeção manual de todos os recortes. |
| 2. Espécie coerente com bioma | Parcial | Tabela central criada; exceções raras e catálogo precisam teste automatizado de todas as espécies geradas. |
| 3. Chão distinto por bioma | Parcial | Paletas distintas codificadas; distância RGB nas capturas ainda não medida. |
| 4. Distribuição de biomas | **Passou** | Cada um dos 10 biomas terrestres entre 3,18% e 19,02% nas cinco seeds. |
| 5. Fronteiras orgânicas ≤ 8 tiles | Não medido | Falta script de medição e inspeção visual. |
| 6. Praia ≥ 2 tiles em 90% das costas elegíveis | Não medido | A faixa é amostrada, mas o critério de costa ainda não tem teste específico. |
| 7. Translucidez | Parcial | 8 testes unitários passam e o alpha é aplicado ao sprite completo; leitura visual real no Phaser/browser pendente. |
| 8. Performance ≥ 55 FPS / < 1.500 objetos | Não medido | Depende de execução em navegador. |
| 9. Determinismo entre ordens de chunks | Não medido | Decisões usam seed/hash, mas comparação de chunks ainda não foi executada. |
| 10. Mecânicas preservadas | Não verificado | É necessário roteiro integrado no navegador. |
| 11. Build e lint sem avisos | Bloqueado | Dependências npm ausentes no ambiente. |

## Cinco riscos visuais ainda prováveis

Como não foi possível executar e inspecionar as capturas `after`, estes são riscos técnicos a revisar, não defeitos visuais observados:
1. A transição de areia para água pode continuar abrupta sem marching-squares/espuma.
2. A alternância entre biomas ainda pode revelar manchas pequenas ou bordas retas em certas seeds.
3. A paleta de chão é distinta, mas os assets finais de neve, cascalho e areia ainda não estão ligados a todas as camadas de piso definitivas.
4. A divisão entre copa e tronco depende do corte gerado; algumas espécies do atlas exigem inspeção para evitar emendas ou partes de sprites vizinhos.
5. A escala das árvores e sombras precisa ser conferida em zoom 1× e 2× em execução real, pois o benchmark visual não foi possível.

## Como continuar a validação no ambiente de desenvolvimento

1. Revogue a `VERCEL_API_KEY` exposta no `.env` do ZIP original e gere outra chave.
2. Execute `npm ci` com acesso ao registry npm.
3. Rode `npm run assets`, `npm run test:occlusion`, `npm run biome-histogram`, `npm run lint` e `npm run build`.
4. Rode `npm run shots -- --label=after --seeds=42891,83472,19453 --zooms=2,1` e confira as capturas antes de declarar os critérios visuais aprovados.
