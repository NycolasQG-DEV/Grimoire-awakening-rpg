import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public/assets/props/trees');
const OUTPUT = path.join(ROOT, 'public/assets/generated/trees');

/**
 * Configurações exatas de grade para cada modelo e tamanho.
 * Cada spritesheet possui largura de coluna e altura de linha bem definidas.
 * Elementos adicionais nas bordas (como mudas na lateral de Model_01) são excluídos da grade principal.
 */
const MODEL_CONFIGS = {
  Model_01: {
    Size_02: {
      colWidth: 64,
      cols: 4,
      rowHeight: 64,
      rows: 2,
      variants: [
        ['verde', 'amarelo', 'seca', 'nevada'],
        ['laranja', 'ambar', 'seca', 'nevada'],
      ],
      // Sapling fica no primeiro bloco em x: 16..31, y: 32..63
      sapling: { x: 16, y: 32, w: 16, h: 32 },
    },
    Size_03: {
      colWidth: 48,
      cols: 4,
      rowHeight: 96,
      rows: 2,
      // Total 192 px de árvores (4 × 48). x: 192..208 são mudas laterais.
      variants: [
        ['verde', 'amarelo', 'seca', 'nevada'],
        ['laranja', 'ambar', 'seca', 'nevada'],
      ],
    },
    Size_04: {
      colWidth: 80,
      cols: 4,
      rowHeight: 128,
      rows: 2,
      // Total 320 px de árvores (4 × 80). x: 320..368 são tocos/mudas laterais.
      variants: [
        ['verde', 'amarelo', 'seca', 'nevada'],
        ['laranja', 'ambar', 'seca', 'nevada'],
      ],
    },
    Size_05: {
      colWidth: 112,
      cols: 4,
      rowHeight: 160,
      rows: 2,
      stumpBand: 48, // y: 320..368
      variants: [
        ['verde', 'amarelo', 'seca', 'nevada'],
        ['laranja', 'ambar', 'seca', 'nevada'],
      ],
    },
  },
  Model_02: {
    Size_02: {
      colWidth: 64,
      cols: 2,
      rowHeight: 48,
      rows: 2,
      variants: [
        ['azul-esverdeado-1', 'azul-esverdeado-2'],
        ['verde-1', 'verde-2'],
      ],
    },
    Size_03: {
      colWidth: 48,
      cols: 3,
      rowHeight: 80,
      rows: 2,
      variants: [
        ['azul-esverdeado-1', 'azul-esverdeado-2', 'seca'],
        ['verde-1', 'verde-2', 'toco'],
      ],
    },
    Size_04: {
      colWidth: 64,
      cols: 3,
      rowHeight: 112,
      rows: 2,
      variants: [
        ['azul-esverdeado-1', 'azul-esverdeado-2', 'seca'],
        ['verde-1', 'verde-2', 'toco'],
      ],
    },
    Size_05: {
      colWidth: 96,
      cols: 3,
      rowHeight: 160,
      rows: 2,
      variants: [
        ['azul-esverdeado-1', 'azul-esverdeado-2', 'seca'],
        ['verde-1', 'verde-2', 'toco'],
      ],
    },
  },
  Model_03: {
    Size_02: {
      colWidth: 64,
      cols: 2,
      rowHeight: 80,
      rows: 2,
      // Cada célula tem árvore principal na esquerda (0..30), toco e muda à direita.
      variants: [
        ['verde-oliva', 'amarelo-oliva'],
        ['ambar', 'vermelho'],
      ],
    },
    Size_03: {
      colWidth: 64,
      cols: 3,
      rowHeight: 144,
      rows: 2,
      variants: [
        ['verde-oliva', 'amarelo-oliva', 'seca'],
        ['ambar', 'vermelho', 'toco'],
      ],
    },
    Size_04: {
      colWidth: 96,
      cols: 3,
      rowHeight: 208,
      rows: 2,
      file: 'Size_04-export.png', // 288×416 exato (3 × 96 px)
      fallbackFile: 'Size_04.png',
      variants: [
        ['verde-oliva', 'amarelo-oliva', 'seca'],
        ['ambar', 'vermelho', 'toco'],
      ],
    },
    Size_05: {
      colWidth: 128,
      cols: 3,
      rowHeight: 256,
      rows: 2,
      variants: [
        ['verde-oliva', 'amarelo-oliva', 'seca'],
        ['ambar', 'vermelho', 'toco'],
      ],
    },
  },
};

const intToRgba = (color) => Jimp.intToRGBA(color);

/**
 * Encontra todos os componentes conexos de pixels opacos na imagem da célula.
 * Retorna os dados do maior componente (para árvores) ou o desejado.
 * Também isola os pixels: somente os pixels do componente são mantidos,
 * garantindo zero contaminação de tocos, folhas caídas ou mudas vizinhas.
 */
function extractLargestComponent(cell) {
  const width = cell.bitmap.width;
  const height = cell.bitmap.height;
  const visited = new Uint8Array(width * height);
  let best = null;

  for (let startY = 0; startY < height; startY++) {
    for (let startX = 0; startX < width; startX++) {
      const startIndex = startY * width + startX;
      if (visited[startIndex] || cell.bitmap.data[startIndex * 4 + 3] <= 10) continue;

      const queue = [startIndex];
      visited[startIndex] = 1;
      let head = 0;
      let count = 0;
      let minX = startX, maxX = startX, minY = startY, maxY = startY;

      while (head < queue.length) {
        const index = queue[head++];
        const cx = index % width;
        const cy = Math.floor(index / width);
        count++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (!visited[ni] && cell.bitmap.data[ni * 4 + 3] > 10) {
              visited[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }

      if (!best || count > best.count) {
        best = { count, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, pixelIndices: queue };
      }
    }
  }

  if (!best || best.w < 3 || best.h < 5) return null;

  // Cria a imagem isolada contendo APENAS os pixels do componente conexo
  const sprite = new Jimp(best.w, best.h, 0x00000000);
  for (const idx of best.pixelIndices) {
    const cx = idx % width;
    const cy = Math.floor(idx / width);
    const px = cx - best.minX;
    const py = cy - best.minY;
    const color = cell.getPixelColor(cx, cy);
    sprite.setPixelColor(color, px, py);
  }

  return { sprite, bounds: best };
}

function makeOpacityMask(image, cellSize = 4) {
  const columns = Math.ceil(image.bitmap.width / cellSize);
  const rows = Math.ceil(image.bitmap.height / cellSize);
  const bits = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < columns; gx++) {
      let opaque = false;
      for (let y = gy * cellSize; y < Math.min(image.bitmap.height, (gy + 1) * cellSize) && !opaque; y++) {
        for (let x = gx * cellSize; x < Math.min(image.bitmap.width, (gx + 1) * cellSize); x++) {
          if (intToRgba(image.getPixelColor(x, y)).a > 24) { opaque = true; break; }
        }
      }
      bits.push(opaque ? '1' : '0');
    }
  }
  return { cellSize, columns, rows, bits: bits.join('') };
}

function estimateTrunkWidth(image) {
  const yStart = Math.floor(image.bitmap.height * 0.78);
  const widths = [];
  for (let y = yStart; y < image.bitmap.height; y++) {
    let count = 0;
    for (let x = 0; x < image.bitmap.width; x++) {
      if (intToRgba(image.getPixelColor(x, y)).a > 24) count++;
    }
    if (count > 0) widths.push(count);
  }
  if (!widths.length) return Math.max(1, Math.round(image.bitmap.width * 0.12));
  widths.sort((a, b) => a - b);
  return Math.max(1, widths[Math.floor(widths.length / 2)]);
}

function estimateCrownBottom(image, trunkWidth) {
  const threshold = Math.max(2, trunkWidth * 1.8);
  for (let y = 0; y < image.bitmap.height; y++) {
    let count = 0;
    for (let x = 0; x < image.bitmap.width; x++) {
      if (intToRgba(image.getPixelColor(x, y)).a > 24) count++;
    }
    if (count > 0 && count <= threshold) return y;
  }
  return Math.round(image.bitmap.height * 0.68);
}

async function main() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const atlas = [];
  const contactItems = [];

  for (const [model, sizes] of Object.entries(MODEL_CONFIGS)) {
    const modelPath = path.join(SOURCE, model);

    for (const [sizeKey, conf] of Object.entries(sizes)) {
      const sizeNum = Number(sizeKey.match(/Size_(\d+)/i)?.[1] ?? 0);
      let filename = conf.file ?? `${sizeKey}.png`;
      let filePath = path.join(modelPath, filename);

      try {
        await fs.access(filePath);
      } catch {
        if (conf.fallbackFile) {
          filename = conf.fallbackFile;
          filePath = path.join(modelPath, filename);
        }
      }

      const source = await Jimp.read(filePath);

      for (let row = 0; row < conf.rows; row++) {
        for (let col = 0; col < conf.cols; col++) {
          const variant = conf.variants[row][col] ?? 'variante';
          const cellX = col * conf.colWidth;
          const cellY = row * conf.rowHeight;

          const cell = source.clone().crop(cellX, cellY, conf.colWidth, conf.rowHeight);
          const extracted = extractLargestComponent(cell);
          if (!extracted) continue;

          const { sprite, bounds } = extracted;
          const id = `${model.toLowerCase()}-size-${String(sizeNum).padStart(2, '0')}-r${row + 1}-c${col + 1}-${variant}`;
          const outName = `${id}.png`;
          await sprite.writeAsync(path.join(OUTPUT, outName));

          const trunkWidth = estimateTrunkWidth(sprite);
          const crownBottomY = estimateCrownBottom(sprite, trunkWidth);

          atlas.push({
            id,
            model,
            size: sizeNum,
            variant,
            file: outName,
            source: {
              file: `${model}/${filename}`,
              x: cellX + bounds.minX,
              y: cellY + bounds.minY,
              width: bounds.w,
              height: bounds.h,
            },
            width: sprite.bitmap.width,
            height: sprite.bitmap.height,
            baseX: Math.round(sprite.bitmap.width / 2),
            baseY: sprite.bitmap.height - 1,
            trunkWidth,
            crownBottomY,
            opacityMask4x4: makeOpacityMask(sprite),
          });

          contactItems.push({ image: sprite, id });
        }
      }

      // Se possui faixa de tocos na base (ex: Model_01 Size_05)
      if (conf.stumpBand) {
        const stumpY = conf.rows * conf.rowHeight;
        for (let col = 0; col < conf.cols; col++) {
          const cellX = col * conf.colWidth;
          const cell = source.clone().crop(cellX, stumpY, conf.colWidth, conf.stumpBand);
          const extracted = extractLargestComponent(cell);
          if (!extracted) continue;

          const { sprite, bounds } = extracted;
          const id = `${model.toLowerCase()}-size-${String(sizeNum).padStart(2, '0')}-stump-${col + 1}`;
          const outName = `${id}.png`;
          await sprite.writeAsync(path.join(OUTPUT, outName));

          atlas.push({
            id,
            model,
            size: sizeNum,
            variant: 'toco',
            file: outName,
            source: {
              file: `${model}/${filename}`,
              x: cellX + bounds.minX,
              y: stumpY + bounds.minY,
              width: bounds.w,
              height: bounds.h,
            },
            width: sprite.bitmap.width,
            height: sprite.bitmap.height,
            baseX: Math.round(sprite.bitmap.width / 2),
            baseY: sprite.bitmap.height - 1,
            trunkWidth: estimateTrunkWidth(sprite),
            crownBottomY: 0,
            opacityMask4x4: makeOpacityMask(sprite),
          });

          contactItems.push({ image: sprite, id });
        }
      }
    }
  }

  // Aliases de runtime para as árvores carregadas diretamente pelo jogo
  // Cada alias usa as coordenadas exatas da célula de onde deve ser extraído.
  const runtimeAliases = [
    {
      model: 'Model_01',
      file: 'Size_03.png',
      colWidth: 48,
      rowHeight: 96,
      row: 0,
      col: 0,
      output: 'tree-green.png',
    },
    {
      model: 'Model_01',
      file: 'Size_03.png',
      colWidth: 48,
      rowHeight: 96,
      row: 0,
      col: 1,
      output: 'tree-yellow.png',
    },
    {
      model: 'Model_01',
      file: 'Size_03.png',
      colWidth: 48,
      rowHeight: 96,
      row: 1,
      col: 0,
      output: 'tree-orange.png',
    },
    {
      model: 'Model_01',
      file: 'Size_03.png',
      colWidth: 48,
      rowHeight: 96,
      row: 0,
      col: 2,
      output: 'tree-dry.png',
    },
    {
      model: 'Model_02',
      file: 'Size_03.png',
      colWidth: 48,
      rowHeight: 80,
      row: 0,
      col: 0,
      output: 'tree-frost-pine.png',
    },
    {
      model: 'Model_02',
      file: 'Size_03.png',
      colWidth: 48,
      rowHeight: 80,
      row: 1,
      col: 0,
      output: 'tree-pine.png',
    },
    {
      model: 'Model_03',
      file: 'Size_02.png',
      colWidth: 64,
      rowHeight: 80,
      row: 1,
      col: 0,
      output: 'tree-brown-pine.png',
    },
    {
      model: 'Model_03',
      file: 'Size_02.png',
      colWidth: 64,
      rowHeight: 80,
      row: 1,
      col: 1,
      output: 'tree-red-pine.png',
    },
  ];

  for (const alias of runtimeAliases) {
    const source = await Jimp.read(path.join(SOURCE, alias.model, alias.file));
    const cell = source.clone().crop(
      alias.col * alias.colWidth,
      alias.row * alias.rowHeight,
      alias.colWidth,
      alias.rowHeight
    );
    const extracted = extractLargestComponent(cell);
    if (!extracted) {
      throw new Error(`Falha ao recortar alias ${alias.output} de ${alias.model}/${alias.file}`);
    }
    await extracted.sprite.writeAsync(path.join(OUTPUT, alias.output));
  }

  // Muda de árvore recortada limpamente (Model_01 Size_02 em x: 16..31, y: 32..63)
  const saplingSource = await Jimp.read(path.join(SOURCE, 'Model_01', 'Size_02.png'));
  const saplingCell = saplingSource.clone().crop(16, 32, 16, 32);
  const saplingExtracted = extractLargestComponent(saplingCell);
  if (saplingExtracted) {
    await saplingExtracted.sprite.writeAsync(path.join(OUTPUT, 'tree-sapling.png'));
  }

  // Grava atlas JSON
  await fs.writeFile(
    path.join(OUTPUT, 'tree-atlas.json'),
    JSON.stringify({ version: 2, maskCellSize: 4, totalEntries: atlas.length, entries: atlas }, null, 2)
  );

  // Folha de contato para inspeção visual
  const cellW = 144;
  const cellH = 192;
  const columns = 6;
  const rows = Math.ceil(contactItems.length / columns);
  const contact = new Jimp(columns * cellW, rows * cellH, 0x1e1e1eff);

  for (let i = 0; i < contactItems.length; i++) {
    const { image } = contactItems[i];
    const scale = Math.min((cellW - 16) / image.bitmap.width, (cellH - 16) / image.bitmap.height, 1);
    const resized = image.clone().resize(
      Math.max(1, Math.round(image.bitmap.width * scale)),
      Math.max(1, Math.round(image.bitmap.height * scale)),
      Jimp.RESIZE_NEAREST_NEIGHBOR
    );
    const x = (i % columns) * cellW + Math.floor((cellW - resized.bitmap.width) / 2);
    const y = Math.floor(i / columns) * cellH + Math.floor((cellH - resized.bitmap.height) / 2);
    contact.composite(resized, x, y);
  }
  await contact.writeAsync(path.join(OUTPUT, 'tree-contact-sheet.png'));

  console.log(`Atlas criado: ${atlas.length} árvores e tocos recortados com precisão em ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
