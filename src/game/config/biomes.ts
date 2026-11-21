export type BiomeId =
  | 'ocean-deep'
  | 'shallow-water'
  | 'beach'
  | 'plains'
  | 'temperate-forest'
  | 'autumn-woodland'
  | 'taiga'
  | 'ancestral-forest'
  | 'swamp'
  | 'drylands'
  | 'rocky-mountain'
  | 'tundra';

export type FloorMaterial = 'grass' | 'gravel' | 'earth' | 'sand' | 'snow' | 'stone';

export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  ground: readonly [number, number, number];
  groundShadow: readonly [number, number, number];
  groundHighlight: readonly [number, number, number];
  foliage: number;
  bush: number;
  leaves: readonly number[];
  minimap: readonly [number, number, number];
  floorMaterial: FloorMaterial | null;
  isWater?: boolean;
}

export const BIOME_ORDER: readonly BiomeId[] = [
  'ocean-deep', 'shallow-water', 'beach', 'plains', 'temperate-forest',
  'autumn-woodland', 'taiga', 'ancestral-forest', 'swamp', 'drylands',
  'rocky-mountain', 'tundra',
];

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  'ocean-deep': {
    id: 'ocean-deep', name: 'Oceano profundo', ground: [25, 57, 91], groundShadow: [17, 43, 72], groundHighlight: [39, 79, 111],
    foliage: 0x315a74, bush: 0x315a74, leaves: [0x315a74], minimap: [25, 57, 91], floorMaterial: null, isWater: true,
  },
  'shallow-water': {
    id: 'shallow-water', name: 'Água rasa', ground: [67, 133, 151], groundShadow: [48, 105, 127], groundHighlight: [105, 166, 174],
    foliage: 0x4f8790, bush: 0x4f8790, leaves: [0x4f8790], minimap: [67, 133, 151], floorMaterial: null, isWater: true,
  },
  beach: {
    id: 'beach', name: 'Praia', ground: [221, 185, 119], groundShadow: [185, 145, 88], groundHighlight: [244, 215, 157],
    foliage: 0x9c9b54, bush: 0xa4a05e, leaves: [0xc5a95f, 0xd8bd76], minimap: [221, 185, 119], floorMaterial: 'sand',
  },
  plains: {
    id: 'plains', name: 'Planície', ground: [164, 184, 91], groundShadow: [126, 153, 71], groundHighlight: [190, 204, 121],
    foliage: 0x7e9c43, bush: 0x83a24c, leaves: [0x9caf53, 0xb5c66d], minimap: [164, 184, 91], floorMaterial: 'grass',
  },
  'temperate-forest': {
    id: 'temperate-forest', name: 'Floresta temperada', ground: [86, 139, 75], groundShadow: [57, 105, 56], groundHighlight: [116, 163, 93],
    foliage: 0x367d36, bush: 0x438344, leaves: [0x4f9842, 0x6bad4c, 0x347637], minimap: [86, 139, 75], floorMaterial: 'grass',
  },
  'autumn-woodland': {
    id: 'autumn-woodland', name: 'Bosque outonal', ground: [153, 139, 76], groundShadow: [111, 105, 57], groundHighlight: [190, 170, 93],
    foliage: 0xa97831, bush: 0xb58b42, leaves: [0xc18a35, 0xd2a347, 0x98552b], minimap: [153, 139, 76], floorMaterial: 'grass',
  },
  taiga: {
    id: 'taiga', name: 'Taiga', ground: [75, 121, 116], groundShadow: [48, 86, 88], groundHighlight: [101, 150, 138],
    foliage: 0x286d69, bush: 0x367b73, leaves: [0x367b73, 0x568f87], minimap: [75, 121, 116], floorMaterial: 'grass',
  },
  'ancestral-forest': {
    id: 'ancestral-forest', name: 'Floresta ancestral', ground: [48, 93, 63], groundShadow: [29, 65, 45], groundHighlight: [73, 119, 78],
    foliage: 0x245b39, bush: 0x2e6940, leaves: [0x2d7044, 0x458052, 0x1e4c32], minimap: [48, 93, 63], floorMaterial: 'grass',
  },
  swamp: {
    id: 'swamp', name: 'Pântano', ground: [91, 111, 66], groundShadow: [62, 81, 48], groundHighlight: [119, 137, 83],
    foliage: 0x596a3d, bush: 0x687749, leaves: [0x78814b, 0x8d9456], minimap: [91, 111, 66], floorMaterial: 'earth',
  },
  drylands: {
    id: 'drylands', name: 'Terras secas', ground: [190, 157, 94], groundShadow: [150, 120, 69], groundHighlight: [220, 190, 125],
    foliage: 0x957a40, bush: 0x9f8749, leaves: [0xa68a4b, 0xc1a25a], minimap: [190, 157, 94], floorMaterial: 'sand',
  },
  'rocky-mountain': {
    id: 'rocky-mountain', name: 'Montanha rochosa', ground: [119, 119, 116], groundShadow: [82, 85, 87], groundHighlight: [153, 153, 147],
    foliage: 0x65734e, bush: 0x6e7958, leaves: [0x777e5d], minimap: [119, 119, 116], floorMaterial: 'stone',
  },
  tundra: {
    id: 'tundra', name: 'Tundra e neve', ground: [206, 221, 224], groundShadow: [151, 181, 190], groundHighlight: [239, 245, 240],
    foliage: 0x799da4, bush: 0x88a9ad, leaves: [0xb6cbd0, 0xdce7e6], minimap: [206, 221, 224], floorMaterial: 'snow',
  },
};

export function biomeIndex(id: BiomeId): number {
  return BIOME_ORDER.indexOf(id);
}
