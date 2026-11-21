import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOORS_FILE = path.join(ROOT, 'public/assets/tilesets/Floors_Tiles.png');
const WATER_FILE = path.join(ROOT, 'public/assets/tilesets/Water_tiles.png');
const TILE = 16;

async function main() {
  const floorSheet = await Jimp.read(FLOORS_FILE);
  if (floorSheet.bitmap.width < 25 * TILE || floorSheet.bitmap.height < 26 * TILE) {
    throw new Error(`Floors_Tiles.png não possui a grade esperada de 25×26 tiles de 16 px: ${floorSheet.bitmap.width}×${floorSheet.bitmap.height}`);
  }

  const waterSheet = await Jimp.read(WATER_FILE);
  if (waterSheet.bitmap.width < 25 * TILE || waterSheet.bitmap.height < 25 * TILE) {
    throw new Error(`Water_tiles.png não possui a grade esperada de 25×25 tiles de 16 px: ${waterSheet.bitmap.width}×${waterSheet.bitmap.height}`);
  }

  // 1. Gera bloco de transição suave de pedra/rocha (cols 15..19, rows 12..16 em Floors_Tiles.png)
  // a partir do bloco de transição de areia (cols 5..9, rows 12..16), recolorindo para o tom de pedra natural.
  for (let br = 0; br < 5; br++) {
    for (let bc = 0; bc < 5; bc++) {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const col = Jimp.intToRGBA(floorSheet.getPixelColor((5 + bc) * TILE + x, (12 + br) * TILE + y));
          if (col.a > 10) {
            const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
            const diff = (lum - 215) * 1.6;
            const sr = Math.max(0, Math.min(255, Math.round(116 + diff)));
            const sg = Math.max(0, Math.min(255, Math.round(116 + diff)));
            const sb = Math.max(0, Math.min(255, Math.round(114 + diff)));
            floorSheet.setPixelColor(Jimp.rgbaToInt(sr, sg, sb, col.a), (15 + bc) * TILE + x, (12 + br) * TILE + y);
          } else {
            floorSheet.setPixelColor(0, (15 + bc) * TILE + x, (12 + br) * TILE + y);
          }
        }
      }
    }
  }
  await floorSheet.writeAsync(FLOORS_FILE);

  // 2. Gera costa de água com areia pura (cols 0..4, rows 15..19 em Water_tiles.png)
  for (let br = 0; br < 5; br++) {
    for (let bc = 0; bc < 5; bc++) {
      const srcSandTile = floorSheet.clone().crop((5 + bc) * TILE, (22 + (br % 2)) * TILE, TILE, TILE);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const origCol = Jimp.intToRGBA(waterSheet.getPixelColor(bc * TILE + x, br * TILE + y));
          const isGrass = origCol.g > origCol.r * 1.12 && origCol.g > origCol.b && origCol.g > 55;
          if (isGrass) {
            const sandCol = Jimp.intToRGBA(srcSandTile.getPixelColor(x, y));
            waterSheet.setPixelColor(Jimp.rgbaToInt(sandCol.r, sandCol.g, sandCol.b, 255), bc * TILE + x, (15 + br) * TILE + y);
          } else {
            waterSheet.setPixelColor(Jimp.rgbaToInt(origCol.r, origCol.g, origCol.b, origCol.a), bc * TILE + x, (15 + br) * TILE + y);
          }
        }
      }
    }
  }

  // 3. Gera costa de água com gelo/neve (cols 0..4, rows 20..24 em Water_tiles.png)
  for (let br = 0; br < 5; br++) {
    for (let bc = 0; bc < 5; bc++) {
      const srcIceTile = floorSheet.clone().crop(bc * TILE, (24 + (br % 2)) * TILE, TILE, TILE);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const origCol = Jimp.intToRGBA(waterSheet.getPixelColor(bc * TILE + x, br * TILE + y));
          const isGrass = origCol.g > origCol.r * 1.12 && origCol.g > origCol.b && origCol.g > 55;
          if (isGrass) {
            const iceCol = Jimp.intToRGBA(srcIceTile.getPixelColor(x, y));
            waterSheet.setPixelColor(Jimp.rgbaToInt(iceCol.r, iceCol.g, iceCol.b, 255), bc * TILE + x, (20 + br) * TILE + y);
          } else {
            waterSheet.setPixelColor(Jimp.rgbaToInt(origCol.r, origCol.g, origCol.b, origCol.a), bc * TILE + x, (20 + br) * TILE + y);
          }
        }
      }
    }
  }

  await waterSheet.writeAsync(WATER_FILE);
  console.log('Tilesets validados e atualizados: Blocos de Pedra, Água com Areia e Água com Gelo criados com sucesso.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
