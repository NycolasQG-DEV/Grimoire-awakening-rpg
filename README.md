# projeto-blackclover

Jogo 2D de exploração procedural feito com **Phaser 4.2**, **React 19**, **TypeScript** e **Vite**. O mundo usa tiles de **16 × 16 px**, chunks de **32 × 32 tiles** e uma extensão lógica de **5.000 × 5.000 tiles**.

## Requisitos

- Node.js 22 ou compatível com Vite 8 e o modo `--experimental-strip-types` do script de histogramas.
- Dependências instaladas com `npm ci`.

## Desenvolvimento

```bash
npm run dev
```

## Scripts

```bash
npm run build            # typecheck e build de produção
npm run lint             # Oxlint
npm run assets            # deriva sprites e atlas a partir dos sheets originais
npm run biome-histogram   # amostra cinco seeds e imprime o histograma dos biomas
npm run test:occlusion    # testa máscara, ordenação, histerese e suavização
npm run shots             # captura os biomas no navegador (Puppeteer + Chromium)
```

O gerador de assets grava em `public/assets/generated/trees/`; os PNGs originais em `public/assets/props/trees/` não são modificados. O atlas gerado contém metadados de origem, base do tronco, largura estimada do tronco, limite copa/tronco e máscara de opacidade em células de 4 px. Execute `npm run assets` depois de alterar os sheets.

O script de capturas grava em `shots/after/`. Pode-se escolher o rótulo, seeds, zooms e lista de biomas:

```bash
npm run shots -- --label=after --seeds=42891,83472,19453 --zooms=2,1
```

Para capturas de referência anteriores a uma mudança, faça checkout da versão anterior e execute `npm run shots -- --label=before`. O script não fabrica uma linha de base retroativamente.

## Estrutura principal

- `src/game/terrainGenerator.ts`: amostragem de mundo, lagos/rios, seleção de bioma e colocação determinística de props.
- `src/game/config/biomes.ts`: paletas centrais e identificação dos biomas.
- `src/game/config/treeSpeciesByBiome.ts`: pesos de espécies por bioma.
- `src/game/systems/occlusionSystem.ts`: teste puro de oclusão pela máscara alfa e interpolação temporal.
- `src/game/scenes/BootScene.ts`: carregamento de assets e criação do atlas de chão colorido.
- `src/game/scenes/TerrainScene.ts`: chunks, câmera, player, minimapa, HUD e renderização dos props.

## Materiais de chão e biomas

O atlas de chão é montado a partir de `public/assets/tilesets/Floors_Tiles.png`, sem gerar blocos de cor artificiais. Os dez biomas terrestres usam apenas os materiais que existem no tileset: grama (com recoloração HSL para os biomas verdes), cascalho, terra, areia e neve. Praia e Terras Secas usam areia; Montanha Rochosa usa cascalho; Pântano usa terra; Tundra usa neve; os biomas florestais e planícies usam grama. Cada bioma tem seis variantes de tile, escolhidas deterministicamente por posição e seed.

O script `npm run assets` também acrescenta ao `Floors_Tiles.png` um bloco 5×4 de areia lisa no espaço vazio do atlas, copiando as variações de areia já existentes para o novo conjunto dedicado.

## Controles

- WASD ou setas: movimento.
- Shift: correr.
- M: abrir/fechar minimapa.
- R ou Espaço: gerar outro mundo.
- Roda do mouse: zoom inteiro entre 1× e 4×.
- F2: mostrar/ocultar informação do bioma.

No modo de desenvolvimento, `window.__GAME_DEBUG__` disponibiliza `teleportToBiome(nome)`, `teleport(x, y)`, `setZoom(n)`, `biomeAt(x, y)`, `regenerate(seed)` e `stats()` para testes automatizados.

## Segurança e arquivos gerados

Não coloque `.env`, chaves de API ou outros segredos no repositório. Use variáveis de ambiente locais e mantenha `.env` ignorado pelo Git. `dist/`, `node_modules/` e capturas de teste também não devem ser versionados.
