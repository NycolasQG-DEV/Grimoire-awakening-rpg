import { BIOME_ORDER, BIOMES } from './biomes.ts';
import type { BiomeId, FloorMaterial } from './biomes.ts';

export const TILESET_TILE_SIZE = 16;
export const FLOOR_GID_BASE = 2000;
export const FLOOR_VARIANT_COUNT = 6;
export const FLOORS_SHEET_COLS = 25;
export const WATER_SHEET_COLS = 25;
export const WATER_GID_BASE = 1;
export const FLOORS_TILESET_GID_BASE = 1000;

/** Coordenadas (coluna, linha) do Floors_Tiles.png, em células de 16×16. */
export const FLOOR_SOURCE_TILES: Record<FloorMaterial, readonly (readonly [number, number])[]> = {
  grass: [[1, 10], [2, 10], [3, 10], [1, 11], [2, 11], [3, 11]],
  gravel: [[6, 10], [7, 10], [8, 10], [6, 11], [7, 11], [8, 11]],
  earth: [[11, 10], [12, 10], [13, 10], [11, 11], [12, 11], [13, 11]],
  stone: [[16, 0], [17, 0], [18, 0], [16, 1], [17, 1], [18, 1]],
  sand: [[5, 22], [6, 22], [7, 22], [8, 22], [5, 23], [6, 23]],
  snow: [[0, 22], [1, 22], [2, 22], [3, 22], [0, 24], [1, 24]],
};

export const LAND_BIOME_ORDER = BIOME_ORDER.filter((biomeId) => BIOMES[biomeId].floorMaterial !== null);

export function floorAtlasTileIndex(biomeId: BiomeId, variant: number): number {
  const biomeIndex = LAND_BIOME_ORDER.indexOf(biomeId);
  if (biomeIndex < 0) return -1;
  const safeVariant = Math.max(0, Math.min(FLOOR_VARIANT_COUNT - 1, Math.floor(variant)));
  return biomeIndex * FLOOR_VARIANT_COUNT + safeVariant;
}

/** Calcula o GID direto para um tile na folha Floors_Tiles.png. */
export function floorSheetGid(col: number, row: number): number {
  return FLOORS_TILESET_GID_BASE + row * FLOORS_SHEET_COLS + col;
}

/** Calcula o GID direto para um tile na folha Water_tiles.png. */
export function waterSheetGid(col: number, row: number): number {
  return WATER_GID_BASE + row * WATER_SHEET_COLS + col;
}
