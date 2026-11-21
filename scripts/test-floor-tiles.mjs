import assert from 'node:assert/strict';
import { BIOME_ORDER, BIOMES } from '../src/game/config/biomes.ts';
import { FLOOR_SOURCE_TILES, FLOOR_VARIANT_COUNT, LAND_BIOME_ORDER, floorAtlasTileIndex } from '../src/game/config/tileset-map.ts';

assert.equal(LAND_BIOME_ORDER.length, BIOME_ORDER.length - 2, 'todos os biomas terrestres devem possuir material de chão');
for (const biomeId of BIOME_ORDER) {
  const biome = BIOMES[biomeId];
  if (biome.isWater) {
    assert.equal(floorAtlasTileIndex(biomeId, 0), -1, `${biomeId} não deve receber tile terrestre`);
    continue;
  }
  assert.ok(biome.floorMaterial, `${biomeId} precisa usar um material presente no tileset`);
  assert.equal(FLOOR_SOURCE_TILES[biome.floorMaterial].length, FLOOR_VARIANT_COUNT);
  const indexes = Array.from({ length: FLOOR_VARIANT_COUNT }, (_, variant) => floorAtlasTileIndex(biomeId, variant));
  assert.deepEqual(indexes, Array.from({ length: FLOOR_VARIANT_COUNT }, (_, i) => indexes[0] + i));
  assert.ok(indexes.every((index) => index >= 0 && index < LAND_BIOME_ORDER.length * FLOOR_VARIANT_COUNT));
}

console.log(`Floor tile mapping: ${LAND_BIOME_ORDER.length} biomas terrestres × ${FLOOR_VARIANT_COUNT} variantes; 2 biomas aquáticos sem piso terrestre.`);
