import type { PropType } from '../../types/game';
import type { BiomeId } from './biomes';

export interface TreeSpeciesWeight {
  type: PropType;
  weight: number;
}

/** Espécies compatíveis com o clima e o piso de cada bioma. */
export const treeSpeciesByBiome: Record<BiomeId, readonly TreeSpeciesWeight[]> = {
  'ocean-deep': [],
  'shallow-water': [],
  beach: [{ type: 'tree-sapling', weight: 1 }],
  plains: [
    { type: 'tree-green', weight: 88 },
    { type: 'tree-sapling', weight: 12 },
  ],
  'temperate-forest': [
    { type: 'tree-green', weight: 72 },
    { type: 'tree-pine', weight: 28 },
  ],
  'autumn-woodland': [
    { type: 'tree-yellow', weight: 48 },
    { type: 'tree-orange', weight: 30 },
    { type: 'tree-brown-pine', weight: 12 },
    { type: 'tree-red-pine', weight: 10 },
  ],
  taiga: [
    { type: 'tree-frost-pine', weight: 66 },
    { type: 'tree-pine', weight: 34 },
  ],
  'ancestral-forest': [
    { type: 'tree-green', weight: 72 },
    { type: 'tree-pine', weight: 28 },
  ],
  swamp: [
    { type: 'tree-dry', weight: 68 },
    { type: 'tree-sapling', weight: 20 },
    { type: 'tree-green', weight: 12 },
  ],
  drylands: [
    { type: 'tree-dry', weight: 62 },
    { type: 'tree-brown-pine', weight: 20 },
    { type: 'tree-pine', weight: 18 },
  ],
  'rocky-mountain': [
    { type: 'tree-pine', weight: 72 },
    { type: 'tree-brown-pine', weight: 18 },
    { type: 'tree-dry', weight: 10 },
  ],
  tundra: [
    { type: 'tree-dark', weight: 62 },
    { type: 'tree-frost-pine', weight: 38 },
  ],
};

export function chooseTreeSpeciesFromWeights(
  biomeWeights: Partial<Record<BiomeId, number>>,
  roll: number,
): PropType | null {
  const combined = new Map<PropType, number>();
  for (const [biomeId, biomeWeight] of Object.entries(biomeWeights) as [BiomeId, number][]) {
    if (biomeWeight <= 0) continue;
    for (const option of treeSpeciesByBiome[biomeId]) {
      combined.set(option.type, (combined.get(option.type) ?? 0) + biomeWeight * option.weight);
    }
  }
  const options = [...combined.entries()];
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const [type, weight] of options) {
    cursor -= weight;
    if (cursor < 0) return type;
  }
  return options[options.length - 1][0];
}

export function chooseTreeSpecies(biome: BiomeId, roll: number): PropType | null {
  return chooseTreeSpeciesFromWeights({ [biome]: 1 }, roll);
}
