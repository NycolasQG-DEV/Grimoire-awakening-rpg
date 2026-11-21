// ============================================================
//  Tipos e Constantes Globais — Mundo 5k x 5k por Chunks
// ============================================================

export const TILE_SIZE = 16;         // Pixels por tile
export const CHUNK_SIZE = 32;        // 32x32 tiles por chunk
export const CHUNK_PIXELS = 512;     // 512x512 pixels por chunk (32 * 16)
export const WORLD_SIZE = 5000;      // 5.000 x 5.000 tiles
export const WORLD_PIXELS = 80000;   // 80.000 x 80.000 pixels

export type PropType =
  | 'tree-green'
  | 'tree-yellow'
  | 'tree-orange'
  | 'tree-dark'
  | 'tree-pine'
  | 'tree-frost-pine'
  | 'tree-brown-pine'
  | 'tree-red-pine'
  | 'tree-dry'
  | 'tree-sapling'
  | 'rock'
  | 'rock-gray'
  | 'rock-small'
  | 'bush'
  | 'bush-dry';

export interface PropData {
  x: number;      // Posição absoluta em pixels no mundo (sub-tile para organicidade)
  y: number;
  type: PropType;
  scale?: number;
  tint?: number;  // Tonalidade de cor harmonizada ao bioma
}

export interface ChunkData {
  cx: number;
  cy: number;
  groundTiles: number[][];
  waterTiles: number[][];
  dirtTiles: number[][];
  props: PropData[];
}

export interface TerrainConfig {
  seed: number;
  continentScale: number;
  lakeScale: number;
  biomeScale: number;
  forestScale: number;
}

export function getRandomSeed(): number {
  return Math.floor(Math.random() * 900000) + 100000;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: getRandomSeed(),
  continentScale: 0.0012,  // Continentes vastos
  lakeScale: 0.0016,       // Grandes lagos majestosos bem espaçados
  biomeScale: 0.0025,      // Biomas regionais harmoniosos
  forestScale: 0.0030,     // Macro-regiões equilibradas: planícies amplas + bosques densos
};
