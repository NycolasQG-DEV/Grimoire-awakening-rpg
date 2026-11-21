// ============================================================
//  Gerador de Terreno Procedural — Biomas, Lagos, Lagoas, Rios e Riachos
// ============================================================

import { PerlinNoise2D } from './noise';
import { TILE_SIZE, CHUNK_SIZE, WORLD_SIZE } from '../types/game';
import type { TerrainConfig, ChunkData, PropData, PropType } from '../types/game';
import { BIOMES, type BiomeId, type FloorMaterial } from './config/biomes';
import {
  FLOOR_GID_BASE,
  floorAtlasTileIndex,
  floorSheetGid,
  waterSheetGid,
} from './config/tileset-map';
import {
  getGrassDirtOverlayAutotile,
  getSandTransitionAutotile,
  getSnowTransitionAutotile,
  getStoneTransitionAutotile,
  getWaterCoastAutotile,
  type CoastType,
} from './autotile';
import { chooseTreeSpeciesFromWeights } from './config/treeSpeciesByBiome';

export interface WorldSample {
  elevation: number;
  moisture: number;
  temperature: number;
  biome: BiomeId;
  waterDepth: number;
  isRiver: boolean;
  biomeWeights: Partial<Record<BiomeId, number>>;
}

export class TerrainGenerator {
  private continentNoise: PerlinNoise2D;
  private lakeNoise: PerlinNoise2D;
  private pondNoise: PerlinNoise2D;
  private pondMaskNoise: PerlinNoise2D;
  private pondEdgeNoise: PerlinNoise2D;
  private riverNoise: PerlinNoise2D;
  private riverMask: PerlinNoise2D;
  private streamNoise: PerlinNoise2D;
  private streamMask: PerlinNoise2D;
  private biomeNoise: PerlinNoise2D;
  private moistureNoise: PerlinNoise2D;
  private temperatureNoise: PerlinNoise2D;
  private elevationQuantiles: number[] = [];
  private moistureQuantiles: number[] = [];
  private temperatureQuantiles: number[] = [];
  private forestNoise: PerlinNoise2D;
  private clearingNoise: PerlinNoise2D;
  private propNoise: PerlinNoise2D;
  private config: TerrainConfig;

  constructor(config: TerrainConfig) {
    this.config = config;
    this.continentNoise = new PerlinNoise2D(config.seed);
    this.lakeNoise = new PerlinNoise2D(config.seed + 1111);
    this.pondNoise = new PerlinNoise2D(config.seed + 1555);
    this.pondMaskNoise = new PerlinNoise2D(config.seed + 1777);
    this.pondEdgeNoise = new PerlinNoise2D(config.seed + 1888);
    this.riverNoise = new PerlinNoise2D(config.seed + 2048);
    this.riverMask = new PerlinNoise2D(config.seed + 3072);
    this.streamNoise = new PerlinNoise2D(config.seed + 3333);
    this.streamMask = new PerlinNoise2D(config.seed + 3555);
    this.biomeNoise = new PerlinNoise2D(config.seed + 4096);
    this.moistureNoise = new PerlinNoise2D(config.seed + 4608);
    this.temperatureNoise = new PerlinNoise2D(config.seed + 4864);
    this.forestNoise = new PerlinNoise2D(config.seed + 5120);
    this.clearingNoise = new PerlinNoise2D(config.seed + 6144);
    this.propNoise = new PerlinNoise2D(config.seed + 8192);
    this.calibrateQuantiles();
  }

  public reseed(seed: number): void {
    this.config.seed = seed;
    this.continentNoise.reseed(seed);
    this.lakeNoise.reseed(seed + 1111);
    this.pondNoise.reseed(seed + 1555);
    this.pondMaskNoise.reseed(seed + 1777);
    this.pondEdgeNoise.reseed(seed + 1888);
    this.riverNoise.reseed(seed + 2048);
    this.riverMask.reseed(seed + 3072);
    this.streamNoise.reseed(seed + 3333);
    this.streamMask.reseed(seed + 3555);
    this.biomeNoise.reseed(seed + 4096);
    this.moistureNoise.reseed(seed + 4608);
    this.temperatureNoise.reseed(seed + 4864);
    this.forestNoise.reseed(seed + 5120);
    this.clearingNoise.reseed(seed + 6144);
    this.propNoise.reseed(seed + 8192);
    this.calibrateQuantiles();
  }

  /** Distribuições de referência para remapear os três campos climáticos por quantil. */
  private calibrateQuantiles(): void {
    const elevation: number[] = [];
    const moisture: number[] = [];
    const temperature: number[] = [];
    let state = this.config.seed >>> 0;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };

    for (let i = 0; i < 20000; i++) {
      const x = random() * WORLD_SIZE;
      const y = random() * WORLD_SIZE;
      elevation.push(this.continentNoise.fbm(x * this.config.continentScale, y * this.config.continentScale, 3, 0.5, 2));
      moisture.push(this.moistureNoise.fbm(x * 0.0017, y * 0.0017, 4, 0.52, 2));
      const latitude = Math.abs((y / WORLD_SIZE) - 0.5) * 2;
      temperature.push(0.78 - latitude * 0.64 + (this.temperatureNoise.fbm(x * 0.0008, y * 0.0008, 3) - 0.5) * 0.18);
    }

    this.elevationQuantiles = elevation.sort((a, b) => a - b);
    this.moistureQuantiles = moisture.sort((a, b) => a - b);
    this.temperatureQuantiles = temperature.sort((a, b) => a - b);
  }

  private quantileOf(sorted: number[], value: number): number {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (sorted[middle] < value) low = middle + 1;
      else high = middle;
    }
    return sorted.length <= 1 ? 0.5 : Math.max(0, Math.min(1, low / (sorted.length - 1)));
  }

  private isNearWater(wx: number, wy: number): boolean {
    const shoreRadius = 2 + Math.floor(this.pondEdgeNoise.noise(wx * 0.08, wy * 0.08) * 4);
    for (let dy = -shoreRadius; dy <= shoreRadius; dy++) {
      for (let dx = -shoreRadius; dx <= shoreRadius; dx++) {
        if (!this.isLand(wx + dx, wy + dy)) return true;
      }
    }
    return false;
  }

  private isNearLand(wx: number, wy: number): boolean {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (this.isLand(wx + dx, wy + dy)) return true;
      }
    }
    return false;
  }

  // Centro do patch de terra do spawn (definido externamente pela cena)
  private spawnTileX: number = -1;
  private spawnTileY: number = -1;

  public setSpawnPoint(tx: number, ty: number): void {
    this.spawnTileX = tx;
    this.spawnTileY = ty;
  }

  /** O spawn agora usa uma clareira natural; não existe mais elipse de terra artificial. */
  public isSpawnDirt(_wx: number, _wy: number): boolean {
    return false;
  }

  /**
   * Lagoas pequenas celulares e orgânicas (8-18 tiles de diâmetro).
   * Usa células determinísticas para garantir consistência entre chunks.
   */
  private isSmallPond(wx: number, wy: number): boolean {
    const POND_CELL = 90;
    const cx = Math.floor(wx / POND_CELL);
    const cy = Math.floor(wy / POND_CELL);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gcx = cx + dx;
        const gcy = cy + dy;
        const h = this.cellHash(gcx, gcy, 98765);
        if ((h & 15) > 3) continue;

        const px = gcx * POND_CELL + 20 + ((h >> 4) % (POND_CELL - 40));
        const py = gcy * POND_CELL + 20 + ((h >> 10) % (POND_CELL - 40));

        const rx = 4.5 + ((h >> 16) % 5);
        const ry = 3.5 + ((h >> 20) % 4);

        const ddx = (wx - px) / rx;
        const ddy = (wy - py) / ry;

        const wobble = (this.pondEdgeNoise.noise(wx * 0.22, wy * 0.22) - 0.5) * 0.55;
        if (ddx * ddx + ddy * ddy + wobble <= 1.0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Determina se (wx, wy) é terra firme ou água.
   * 5 camadas de água: Grande Lago, Lago Médio, Pequena Lagoa, Rio, Riacho.
   */
  public isLand(wx: number, wy: number): boolean {
    if (wx < 0 || wy < 0 || wx >= WORLD_SIZE || wy >= WORLD_SIZE) {
      return false;
    }

    // 1. Elevação Continental
    const elevation = this.continentNoise.warpedFbm(
      wx * this.config.continentScale,
      wy * this.config.continentScale,
      4, 0.5, 2.0, 0.35
    );
    if (elevation < 0.22) return false;

    // Regiões áridas / deserto (alta temperatura e baixa umidade):
    // Não permite corpos d'água interiores (lagos, lagoas, rios, riachos).
    const rawMoisture = this.moistureNoise.fbm(wx * 0.0017, wy * 0.0017, 4, 0.52, 2.0);
    const latitude = Math.abs((wy / WORLD_SIZE) - 0.5) * 2;
    const rawTemperature = 0.78 - latitude * 0.64 + (this.temperatureNoise.fbm(wx * 0.0008, wy * 0.0008, 3) - 0.5) * 0.18;
    if (rawTemperature >= 0.55 && rawMoisture < 0.32) {
      return true; // Deserto contínuo sem lagos ou rios
    }

    // 2. Grandes Lagos (40-90 tiles de largura)
    const lakeVal = this.lakeNoise.warpedFbm(
      wx * this.config.lakeScale,
      wy * this.config.lakeScale,
      3, 0.5, 2.0, 0.35
    );
    if (lakeVal < 0.49) return false;

    // 3. Lagos Médios (12-30 tiles) — distribuídos por máscara de Perlin
    const pondMask = this.pondMaskNoise.noise(wx * 0.0012, wy * 0.0012);
    if (pondMask > 0.62) {
      const pondVal = this.pondNoise.warpedFbm(
        wx * 0.0045, wy * 0.0045,
        2, 0.5, 2.0, 0.30
      );
      if (pondVal < 0.34) return false;
    }

    // 4. Lagoas Pequenas (8-18 tiles) — forma elíptica orgânica por célula
    if (this.isSmallPond(wx, wy)) return false;

    // 5. Rio Principal (4-5 tiles de largura)
    const riverMaskVal = this.riverMask.fbm(wx * 0.0006, wy * 0.0006, 2, 0.5, 2.0);
    if (riverMaskVal > 0.67) {
      const riverRaw = Math.abs(
        this.riverNoise.warpedFbm(wx * 0.0014, wy * 0.0014, 3, 0.5, 2.0, 0.35) - 0.5
      );
      if (riverRaw < 0.008) return false;
    }

    // 6. Riacho / Córrego Menor (2-3 tiles)
    const streamMaskVal = this.streamMask.fbm(wx * 0.0009, wy * 0.0009, 2, 0.5, 2.0);
    if (streamMaskVal > 0.72) {
      const streamRaw = Math.abs(
        this.streamNoise.warpedFbm(wx * 0.0026, wy * 0.0026, 2, 0.5, 2.0, 0.25) - 0.5
      );
      if (streamRaw < 0.005) return false;
    }

    return true;
  }

  public isClearing(wx: number, wy: number): boolean {
    const clearingVal = this.clearingNoise.fbm(wx * 0.003, wy * 0.003, 2, 0.5, 2.0);
    return clearingVal > 0.52;
  }

  private cellHash(cx: number, cy: number, salt = 0): number {
    let h = (cx * 374761393 + cy * 668265263) ^ (this.config.seed + salt);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  public getBiomeVal(wx: number, wy: number): number {
    return this.biomeNoise.fbm(wx * this.config.biomeScale, wy * this.config.biomeScale, 3, 0.5, 2.0);
  }

  /** Amostrador único: os campos climáticos são remapeados por quantis medidos na seed. */
  public sampleWorld(wx: number, wy: number, landOverride?: boolean, nearWater?: boolean): WorldSample {
    const inBounds = wx >= 0 && wy >= 0 && wx < WORLD_SIZE && wy < WORLD_SIZE;
    const land = inBounds && (landOverride ?? this.isLand(wx, wy));
    const rawElevation = this.continentNoise.fbm(
      wx * this.config.continentScale,
      wy * this.config.continentScale,
      3, 0.5, 2.0,
    );
    const rawMoisture = this.moistureNoise.fbm(wx * 0.0017, wy * 0.0017, 4, 0.52, 2.0);
    const latitude = Math.abs((wy / WORLD_SIZE) - 0.5) * 2;
    const rawTemperature = 0.78 - latitude * 0.64 + (this.temperatureNoise.fbm(wx * 0.0008, wy * 0.0008, 3) - 0.5) * 0.18;
    const shore = nearWater ?? (land ? this.isNearWater(wx, wy) : this.isNearLand(wx, wy));
    const elevation = this.quantileOf(this.elevationQuantiles, rawElevation);
    const moisture = this.quantileOf(this.moistureQuantiles, rawMoisture + (shore ? 0.08 : 0));
    const temperature = this.quantileOf(this.temperatureQuantiles, rawTemperature);

    const riverSignal = Math.abs(this.riverNoise.noise(wx * 0.0014, wy * 0.0014) - 0.5);
    const isRiver = !land && riverSignal < 0.012;
    let biome: BiomeId;
    let waterDepth = 0;

    if (!land) {
      waterDepth = shore ? 1 : 2;
      biome = shore ? 'shallow-water' : 'ocean-deep';
    } else if (shore && elevation < 0.96) {
      biome = 'beach';
    } else if (elevation >= 0.94 || temperature < 0.10) {
      biome = 'tundra';
    } else if (elevation >= 0.82) {
      biome = 'rocky-mountain';
    } else if (moisture >= 0.94 && elevation < 0.82) {
      biome = 'swamp';
    } else if (temperature >= 0.75 && moisture < 0.25) {
      biome = 'drylands';
    } else if (moisture >= 0.82) {
      biome = 'ancestral-forest';
    } else if (temperature < 0.28) {
      biome = 'taiga';
    } else if (temperature < 0.58 && moisture < 0.67) {
      biome = 'autumn-woodland';
    } else if (moisture >= 0.48) {
      biome = 'temperate-forest';
    } else {
      biome = 'plains';
    }

    // Mistura apenas na vizinhança de uma fronteira climática, não em todo o mapa.
    const boundaryDistance = Math.min(
      Math.abs(moisture - 0.34), Math.abs(moisture - 0.52), Math.abs(moisture - 0.75),
      Math.abs(temperature - 0.38), Math.abs(temperature - 0.61), Math.abs(temperature - 0.68),
      Math.abs(elevation - 0.69), Math.abs(elevation - 0.84),
    );
    const transition = Math.max(0, Math.min(1, 1 - boundaryDistance / 0.08));
    const biomeWeights: Partial<Record<BiomeId, number>> = { [biome]: 1 - transition * 0.35 };
    if (transition > 0) {
      const adjacent: BiomeId = biome === 'tundra' ? 'rocky-mountain'
        : biome === 'rocky-mountain' ? 'taiga'
        : biome === 'swamp' ? 'ancestral-forest'
        : biome === 'drylands' ? 'plains'
        : biome === 'autumn-woodland' ? 'temperate-forest'
        : moisture > 0.66 ? 'ancestral-forest'
        : temperature < 0.42 ? 'taiga' : 'temperate-forest';
      if (adjacent !== biome) biomeWeights[adjacent] = transition * 0.35;
    }

    return { elevation, moisture, temperature, biome, waterDepth, isRiver, biomeWeights };
  }

  public getBiomeName(wx: number, wy: number): string {
    return BIOMES[this.sampleWorld(wx, wy).biome].name;
  }

  public getSpawnTile(): { x: number; y: number } {
    return { x: this.spawnTileX, y: this.spawnTileY };
  }


  /**
   * Candidato global Poisson-Disc para árvores.
   * Usa jitter maior e multi-escala para aspecto orgânico, não em grade.
   */
  private getTreeCandidate(gx: number, gy: number, S_TREE: number) {
    const h = this.cellHash(gx, gy, 55555);
    const h2 = this.cellHash(gx, gy, 11111); // segundo hash para mais aleatoriedade
    const priority = this.cellHash(gx, gy, 77777);

    // Jitter generoso: ocupa 80% da célula com deslocamento adicional tipo "ruído duplo"
    const baseX = (h >>> 0) % (S_TREE - 20);
    const baseY = (h >>> 10) % (S_TREE - 20);
    const extraX = ((h2 >>> 0) % 25) - 12;  // ±12px extra orgânico
    const extraY = ((h2 >>> 8) % 25) - 12;

    const jx = 10 + baseX + extraX;
    const jy = 10 + baseY + extraY;

    const px = gx * S_TREE + jx;
    const py = gy * S_TREE + jy;

    const wx = Math.floor(px / TILE_SIZE);
    const wy = Math.floor(py / TILE_SIZE);

    const spawnRoll = ((h >>> 18) % 1000) / 1000;

    return { gx, gy, px, py, wx, wy, priority, spawnRoll, h };
  }

  /**
   * Valida ecologicamente o candidato de árvore.
   * Thresholds ajustados: mais floresta visível, planícies amplas sem árvores.
   */
  private isTreeCandidateEcologicallyValid(c: { wx: number; wy: number; spawnRoll: number }): boolean {
    const { wx, wy, spawnRoll } = c;

    if (wx < 1 || wy < 1 || wx >= WORLD_SIZE - 1 || wy >= WORLD_SIZE - 1) return false;
    if (!this.isLand(wx, wy)) return false;
    if (this.isSpawnDirt(wx, wy)) return false;
    if (Math.abs(wx - this.spawnTileX) <= 8 && Math.abs(wy - this.spawnTileY) <= 8) return false;

    if (
      !this.isLand(wx - 1, wy) || !this.isLand(wx + 1, wy) ||
      !this.isLand(wx, wy - 1) || !this.isLand(wx, wy + 1) ||
      !this.isLand(wx - 1, wy - 1) || !this.isLand(wx + 1, wy - 1) ||
      !this.isLand(wx - 1, wy + 1) || !this.isLand(wx + 1, wy + 1)
    ) {
      return false;
    }

    // Clareiras amplas: sempre 100% livres de árvores (checar ANTES do spawnRoll)
    if (this.isClearing(wx, wy)) return false;

    const fDensity = this.forestNoise.fbm(
      wx * this.config.forestScale,
      wy * this.config.forestScale,
      2, 0.5, 2.0
    );

    // Thresholds recalibrados para forestScale=0.003:
    // fDensity distribui ~uniformemente [0,1] com fbm
    // < 0.44 → planície aberta: quase zero árvores
    // 0.44–0.52 → borda suave: algumas árvores esparsas
    // > 0.52 → floresta: densa e variada
    let spawnChance: number;
    if (fDensity < 0.44) {
      spawnChance = 0.0;   // Planícies puras: zero árvores
    } else if (fDensity < 0.52) {
      spawnChance = 0.18;  // Borda de bosque: esparsas e orgânicas
    } else {
      spawnChance = 0.70;  // Floresta densa
    }

    return spawnRoll < spawnChance;
  }

  /**
   * Gera um chunk completo com solo com transição suave de cor, árvores orgânicas e props harmonizados.
   */
  public generateChunk(cx: number, cy: number): ChunkData {
    const groundTiles: number[][] = [];
    const waterTiles: number[][] = [];
    const dirtTiles: number[][] = [];
    const props: PropData[] = [];

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    // Margem de 5 tiles para costas variáveis e continuidade entre chunks.
    const CACHE_MARGIN = 5;
    const landCache: boolean[][] = [];
    const materialCache: (FloorMaterial | null)[][] = [];
    const biomeCache: BiomeId[][] = [];

    for (let ly = -CACHE_MARGIN; ly < CHUNK_SIZE + CACHE_MARGIN; ly++) {
      const cy = ly + CACHE_MARGIN;
      landCache[cy] = [];
      materialCache[cy] = [];
      biomeCache[cy] = [];
      for (let lx = -CACHE_MARGIN; lx < CHUNK_SIZE + CACHE_MARGIN; lx++) {
        const cx = lx + CACHE_MARGIN;
        const wx = startX + lx;
        const wy = startY + ly;
        const land = this.isLand(wx, wy);
        landCache[cy][cx] = land;
        if (land) {
          const sample = this.sampleWorld(wx, wy, true);
          const mat = this.isSpawnDirt(wx, wy) ? 'earth' : (BIOMES[sample.biome].floorMaterial ?? 'grass');
          materialCache[cy][cx] = mat;
          biomeCache[cy][cx] = sample.biome;
        } else {
          materialCache[cy][cx] = null;
          biomeCache[cy][cx] = 'ocean-deep';
        }
      }
    }

    // ─── 1. PISO POR BIOMA, TRANSIÇÕES SUAVES E ÁGUA COM PROFUNDIDADE ────────
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      groundTiles[ly] = [];
      waterTiles[ly] = [];
      dirtTiles[ly] = [];

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const cacheX = lx + CACHE_MARGIN;
        const cacheY = ly + CACHE_MARGIN;
        const land = landCache[cacheY][cacheX];
        const wx = startX + lx;
        const wy = startY + ly;

        const nLand = landCache[cacheY - 1][cacheX];
        const sLand = landCache[cacheY + 1][cacheX];
        const wLand = landCache[cacheY][cacheX - 1];
        const eLand = landCache[cacheY][cacheX + 1];
        const nwLand = landCache[cacheY - 1][cacheX - 1];
        const neLand = landCache[cacheY - 1][cacheX + 1];
        const swLand = landCache[cacheY + 1][cacheX - 1];
        const seLand = landCache[cacheY + 1][cacheX + 1];

        const latitude = Math.abs((wy / WORLD_SIZE) - 0.5) * 2;
        const rawTemperature = 0.78 - latitude * 0.64 + (this.temperatureNoise.fbm(wx * 0.0008, wy * 0.0008, 3) - 0.5) * 0.18;
        const isFrozenWater = rawTemperature < 0.22;

        if (!land) {
          if (isFrozenWater) {
            // Água congelada em regiões frias/tundra: leito de gelo cristalino (Floors_Tiles linha 24)
            groundTiles[ly][lx] = floorSheetGid(Math.abs(Math.floor(wx * 3 + wy)) % 5, 24);
            waterTiles[ly][lx] = -1;
            dirtTiles[ly][lx] = -1;
          } else {
            let nearWater = false;
            for (let oy = -3; oy <= 3 && !nearWater; oy++) {
              for (let ox = -3; ox <= 3; ox++) {
                if (landCache[cacheY + oy]?.[cacheX + ox]) { nearWater = true; break; }
              }
            }
            groundTiles[ly][lx] = -1;
            dirtTiles[ly][lx] = -1;
            waterTiles[ly][lx] = nearWater ? waterSheetGid(2, 12) : waterSheetGid(2, 10);
          }
        } else {
          const mat = materialCache[cacheY][cacheX] ?? 'grass';
          const biome = biomeCache[cacheY][cacheX];

          // ─── Ponto 1: Chão homogêneo e suave (sem degraus de 16px ou escadinha na grama) ───
          let tileVariant = 0;
          if (mat === 'grass') {
            // Usa as variantes limpas da linha 10 (verde vibrante rico e homogêneo)
            tileVariant = Math.abs(Math.floor(wx * 2 + wy)) % 3;
          } else if (mat === 'snow') {
            // Usa as variantes limpas de neve da linha 22
            tileVariant = Math.abs(Math.floor(wx * 2 + wy)) % 4;
          } else if (mat === 'sand' || mat === 'stone') {
            tileVariant = Math.abs(Math.floor(wx * 2 + wy)) % 4;
          } else {
            tileVariant = Math.abs(Math.floor(wx + wy)) % 3;
          }

          const isCoast = !nLand || !sLand || !wLand || !eLand || !nwLand || !neLand || !swLand || !seLand;

          if (isCoast) {
            if (isFrozenWater) {
              // Na calota polar, a água vizinha congelou: sem água líquida azul!
              // A neve sobrepõe suavemente o gelo através do autotile de neve
              waterTiles[ly][lx] = -1;
              const floorTile = floorAtlasTileIndex(biome, tileVariant);
              groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
              const coord = getSnowTransitionAutotile(
                nLand, sLand, wLand, eLand,
                nwLand, neLand, swLand, seLand
              );
              dirtTiles[ly][lx] = floorSheetGid(coord.tileX, coord.tileY);
            } else {
              // Costa com água líquida (mar/lago temperado):
              const coastType: CoastType = mat === 'sand' ? 'sand' : (mat === 'snow' ? 'ice' : 'grass');
              const coastCoord = getWaterCoastAutotile(
                nLand, sLand, wLand, eLand,
                nwLand, neLand, swLand, seLand,
                coastType
              );
              waterTiles[ly][lx] = waterSheetGid(coastCoord.tileX, coastCoord.tileY);
              const floorTile = floorAtlasTileIndex(biome, tileVariant);
              groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
              dirtTiles[ly][lx] = -1;
            }
          } else {
            waterTiles[ly][lx] = -1;

            const nMat = materialCache[cacheY - 1][cacheX];
            const sMat = materialCache[cacheY + 1][cacheX];
            const wMat = materialCache[cacheY][cacheX - 1];
            const eMat = materialCache[cacheY][cacheX + 1];
            const nwMat = materialCache[cacheY - 1][cacheX - 1];
            const neMat = materialCache[cacheY - 1][cacheX + 1];
            const swMat = materialCache[cacheY + 1][cacheX - 1];
            const seMat = materialCache[cacheY + 1][cacheX + 1];

            const neighbors = [nMat, sMat, wMat, eMat, nwMat, neMat, swMat, seMat];

            if (mat === 'sand') {
              const isSand = (m: FloorMaterial | null): boolean => m === 'sand';
              const allSand = isSand(nMat) && isSand(sMat) && isSand(wMat) && isSand(eMat) &&
                              isSand(nwMat) && isSand(neMat) && isSand(swMat) && isSand(seMat);
              if (allSand) {
                const floorTile = floorAtlasTileIndex(biome, tileVariant);
                groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
                dirtTiles[ly][lx] = -1;
              } else {
                // Fundo dinâmico: se a areia toca pedra, o fundo é pedra; se toca grama, é grama; etc.
                const neighborMat = neighbors.find((m) => m !== null && m !== 'sand') ?? 'grass';
                const bgBiome: BiomeId = neighborMat === 'stone' ? 'rocky-mountain' : (neighborMat === 'snow' ? 'tundra' : (neighborMat === 'earth' ? 'swamp' : 'plains'));
                const bgTile = floorAtlasTileIndex(bgBiome, tileVariant);
                groundTiles[ly][lx] = bgTile >= 0 ? FLOOR_GID_BASE + bgTile : -1;
                const coord = getSandTransitionAutotile(
                  isSand(nMat), isSand(sMat), isSand(wMat), isSand(eMat),
                  isSand(nwMat), isSand(neMat), isSand(swMat), isSand(seMat)
                );
                dirtTiles[ly][lx] = floorSheetGid(coord.tileX, coord.tileY);
              }
            } else if (mat === 'stone') {
              // ─── Transição suave de Pedra/Rocha com Grama, Areia e outros biomas ───
              const isStone = (m: FloorMaterial | null): boolean => m === 'stone';
              const allStone = isStone(nMat) && isStone(sMat) && isStone(wMat) && isStone(eMat) &&
                              isStone(nwMat) && isStone(neMat) && isStone(swMat) && isStone(seMat);
              if (allStone) {
                const floorTile = floorAtlasTileIndex(biome, tileVariant);
                groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
                dirtTiles[ly][lx] = -1;
              } else {
                const neighborMat = neighbors.find((m) => m !== null && m !== 'stone') ?? 'grass';
                const bgBiome: BiomeId = neighborMat === 'sand' ? 'drylands' : (neighborMat === 'snow' ? 'tundra' : (neighborMat === 'earth' ? 'swamp' : 'plains'));
                const bgTile = floorAtlasTileIndex(bgBiome, tileVariant);
                groundTiles[ly][lx] = bgTile >= 0 ? FLOOR_GID_BASE + bgTile : -1;
                const coord = getStoneTransitionAutotile(
                  isStone(nMat), isStone(sMat), isStone(wMat), isStone(eMat),
                  isStone(nwMat), isStone(neMat), isStone(swMat), isStone(seMat)
                );
                dirtTiles[ly][lx] = floorSheetGid(coord.tileX, coord.tileY);
              }
            } else if (mat === 'snow') {
              const isSnow = (m: FloorMaterial | null): boolean => m === 'snow';
              const allSnow = isSnow(nMat) && isSnow(sMat) && isSnow(wMat) && isSnow(eMat) &&
                              isSnow(nwMat) && isSnow(neMat) && isSnow(swMat) && isSnow(seMat);
              if (allSnow) {
                const floorTile = floorAtlasTileIndex(biome, tileVariant);
                groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
                dirtTiles[ly][lx] = -1;
              } else {
                const neighborMat = neighbors.find((m) => m !== null && m !== 'snow') ?? 'grass';
                const bgBiome: BiomeId = neighborMat === 'stone' ? 'rocky-mountain' : (neighborMat === 'sand' ? 'drylands' : (neighborMat === 'earth' ? 'swamp' : 'plains'));
                const bgTile = floorAtlasTileIndex(bgBiome, tileVariant);
                groundTiles[ly][lx] = bgTile >= 0 ? FLOOR_GID_BASE + bgTile : -1;
                const coord = getSnowTransitionAutotile(
                  isSnow(nMat), isSnow(sMat), isSnow(wMat), isSnow(eMat),
                  isSnow(nwMat), isSnow(neMat), isSnow(swMat), isSnow(seMat)
                );
                dirtTiles[ly][lx] = floorSheetGid(coord.tileX, coord.tileY);
              }
            } else if (mat === 'earth') {
              // Chão de terra batida / lama no pântano ou spawn
              const floorTile = floorAtlasTileIndex(biome, tileVariant);
              groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
              const isGrass = (m: FloorMaterial | null): boolean => m === 'grass';
              const coord = getGrassDirtOverlayAutotile(
                isGrass(nMat), isGrass(sMat), isGrass(wMat), isGrass(eMat),
                isGrass(nwMat), isGrass(neMat), isGrass(swMat), isGrass(seMat)
              );
              dirtTiles[ly][lx] = coord ? floorSheetGid(coord.tileX, coord.tileY) : -1;
            } else {
              // Grama sólida
              const floorTile = floorAtlasTileIndex(biome, tileVariant);
              groundTiles[ly][lx] = floorTile >= 0 ? FLOOR_GID_BASE + floorTile : -1;
              dirtTiles[ly][lx] = -1;
            }
          }
        }
      }
    }

    // ─── 2. ÁRVORES POISSON-DISC GLOBAL ───────────────────────────────────────
    // S_TREE maior = células mais largas = jitter mais orgânico e espaçamento variado
    // MIN_TREE_DIST menor que S_TREE permite variação real de densidade
    const S_TREE = 112;
    const MIN_TREE_DIST = 78;

    const minWorldPxX = startX * TILE_SIZE;
    const maxWorldPxX = (startX + CHUNK_SIZE) * TILE_SIZE;
    const minWorldPxY = startY * TILE_SIZE;
    const maxWorldPxY = (startY + CHUNK_SIZE) * TILE_SIZE;

    const minGx = Math.floor((minWorldPxX - S_TREE * 1.5) / S_TREE);
    const maxGx = Math.floor((maxWorldPxX + S_TREE * 1.5) / S_TREE);
    const minGy = Math.floor((minWorldPxY - S_TREE * 1.5) / S_TREE);
    const maxGy = Math.floor((maxWorldPxY + S_TREE * 1.5) / S_TREE);

    const survivingTrees: { x: number; y: number }[] = [];

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const c = this.getTreeCandidate(gx, gy, S_TREE);
        if (!this.isTreeCandidateEcologicallyValid(c)) continue;

        let inhibited = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const n = this.getTreeCandidate(gx + dx, gy + dy, S_TREE);
            if (!this.isTreeCandidateEcologicallyValid(n)) continue;
            const ddx = c.px - n.px;
            const ddy = c.py - n.py;
            if (ddx * ddx + ddy * ddy < MIN_TREE_DIST * MIN_TREE_DIST) {
              if (n.priority > c.priority) {
                inhibited = true;
                break;
              }
            }
          }
          if (inhibited) break;
        }

        if (inhibited) continue;

        survivingTrees.push({ x: c.px, y: c.py });

        if (c.px >= minWorldPxX && c.px < maxWorldPxX && c.py >= minWorldPxY && c.py < maxWorldPxY) {
          const sample = this.sampleWorld(c.wx, c.wy, true);
          const roll = ((c.h >>> 20) >>> 0) / 0xffffffff;
          const treeType = chooseTreeSpeciesFromWeights(sample.biomeWeights, roll);
          if (treeType) props.push({ x: c.px, y: c.py, type: treeType });
        }
      }
    }

    // ─── 3. ARBUSTOS E PEDRAS: QUANTIDADE CALIBRADA POR BIOMA E CLAREIRAS ──────
    // S_PROP menor = células mais densas = mais chances de prop aparecer.
    // 72px ≈ 50 células por chunk → com 4–15% de chance, dá 2–8 props por chunk em floresta.
    const S_PROP = 72;
    const numPropCellsX = Math.ceil((CHUNK_SIZE * TILE_SIZE) / S_PROP);
    const numPropCellsY = Math.ceil((CHUNK_SIZE * TILE_SIZE) / S_PROP);

    const placedProps: { x: number; y: number }[] = [];

    for (let cj = 0; cj < numPropCellsY; cj++) {
      for (let ci = 0; ci < numPropCellsX; ci++) {
        const cellGlobalX = Math.floor(minWorldPxX / S_PROP) + ci;
        const cellGlobalY = Math.floor(minWorldPxY / S_PROP) + cj;
        const h = this.cellHash(cellGlobalX, cellGlobalY, 88888);

        const jitterX = 14 + ((h >>> 0) % (S_PROP - 28)) + ((h >>> 4) % 9 - 4);
        const jitterY = 14 + ((h >>> 8) % (S_PROP - 28)) + ((h >>> 12) % 9 - 4);

        const px = cellGlobalX * S_PROP + jitterX;
        const py = cellGlobalY * S_PROP + jitterY;

        if (px < minWorldPxX || px >= maxWorldPxX || py < minWorldPxY || py >= maxWorldPxY) continue;

        const wx = Math.floor(px / TILE_SIZE);
        const wy = Math.floor(py / TILE_SIZE);

        const lx = wx - startX;
        const ly = wy - startY;

        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE) continue;
        if (!landCache[ly + CACHE_MARGIN][lx + CACHE_MARGIN]) continue;
        if (this.isSpawnDirt(wx, wy)) continue;

        let tooCloseToTree = false;
        for (const t of survivingTrees) {
          const dx = px - t.x;
          const dy = py - t.y;
          if (dx * dx + dy * dy < 44 * 44) { tooCloseToTree = true; break; }
        }
        if (tooCloseToTree) continue;

        let tooCloseToProp = false;
        for (const op of placedProps) {
          const dx = px - op.x;
          const dy = py - op.y;
          if (dx * dx + dy * dy < 54 * 54) { tooCloseToProp = true; break; }
        }
        if (tooCloseToProp) continue;

        const cachePropX = lx + CACHE_MARGIN;
        const cachePropY = ly + CACHE_MARGIN;
        const nearWater =
          !landCache[cachePropY - 1][cachePropX] || !landCache[cachePropY + 1][cachePropX] ||
          !landCache[cachePropY][cachePropX - 1] || !landCache[cachePropY][cachePropX + 1] ||
          !landCache[cachePropY - 1][cachePropX - 1] || !landCache[cachePropY - 1][cachePropX + 1] ||
          !landCache[cachePropY + 1][cachePropX - 1] || !landCache[cachePropY + 1][cachePropX + 1];

        const fDensity = this.forestNoise.fbm(wx * this.config.forestScale, wy * this.config.forestScale, 2, 0.5, 2.0);
        const inClearing = this.isClearing(wx, wy);
        const biome = this.sampleWorld(wx, wy, true, nearWater).biome;
        const colors = { groundTint: 0xffffff, bushTint: BIOMES[biome].bush };
        const roll = ((h >>> 16) % 1000) / 1000;

        // ── 1. MARGENS DE ÁGUA (Praias limpas com raras pedras) ──
        if (nearWater) {
          if (roll < 0.035) {
            let rType: PropType;
            const subRoll = (h >>> 20) % 10;
            if (subRoll < 6) rType = 'rock-small';       // 60% pedregulho de praia
            else if (subRoll < 8) rType = 'rock';        // 20% pedra média
            else rType = 'bush';                        // 20% arbusto raro costeiro

            placedProps.push({ x: px, y: py });
            props.push({ x: px, y: py, type: rType, tint: rType === 'bush' ? colors.bushTint : undefined });
          }
        }
        // ── 2. CLAREIRAS (Campos abertos e limpos: praticamente zero adereços) ──
        else if (inClearing) {
          if (roll < 0.004) { // Apenas 0.4%: clareira ampla com raro arbusto ou pedra
            const pType: PropType = (((h >>> 20) % 3) === 0) ? 'rock-small' : 'bush';
            placedProps.push({ x: px, y: py });
            props.push({ x: px, y: py, type: pType, tint: pType === 'bush' ? colors.bushTint : undefined });
          }
        }
        // ── 3. VASTAS PLANÍCIES E CAMPOS ABERTOS (fDensity < 0.44) ──
        else if (fDensity < 0.44) {
          if (roll < 0.040) { // 4%: planícia com arbusto ou pedra ocasional (1 a cada ~25 células)
            let pType: PropType;
            const subRoll = (h >>> 20) % 10;
            if (subRoll < 5) pType = 'bush';
            else if (subRoll < 8) pType = 'rock-small';
            else pType = 'rock';
            placedProps.push({ x: px, y: py });
            props.push({ x: px, y: py, type: pType, tint: pType === 'bush' ? colors.bushTint : undefined });
          }
        }
        // ── 4. BORDA DE BOSQUE (fDensity 0.44–0.52) ──
        else if (fDensity < 0.52) {
          if (roll < 0.09) { // 9%: borda com arbustos e pedras moderados
            let pType: PropType;
            const subRoll = (h >>> 20) % 10;
            if (subRoll < 6) pType = 'bush';
            else if (subRoll < 8) pType = 'rock-small';
            else pType = 'rock';
            placedProps.push({ x: px, y: py });
            props.push({ x: px, y: py, type: pType, tint: pType === 'bush' ? colors.bushTint : undefined });
          }
        }
        // ── 5. FLORESTAS E BOSQUES (fDensity > 0.52) ──
        else {
          let forestBushChance: number;
          if (biome === 'temperate-forest' || biome === 'ancestral-forest') {
            forestBushChance = 0.14;
          } else if (biome === 'autumn-woodland') {
            forestBushChance = 0.11;
          } else if (biome === 'taiga') {
            forestBushChance = 0.09;
          } else {
            forestBushChance = 0.12;
          }

          if (roll < forestBushChance) {
            let pType: PropType;
            const subRoll = (h >>> 20) % 10;
            if (biome === 'taiga' || biome === 'rocky-mountain') {
              if (subRoll < 4) pType = 'bush';
              else if (subRoll < 8) pType = 'rock-small';
              else pType = 'rock-gray';
            } else {
              if (subRoll < 6) pType = 'bush';
              else if (subRoll < 9) pType = 'rock-small';
              else pType = 'rock';
            }

            placedProps.push({ x: px, y: py });
            const finalType: PropType = pType === 'bush' && biome === 'drylands' ? 'bush-dry' : pType;
            props.push({ x: px, y: py, type: finalType, tint: finalType === 'bush' ? colors.bushTint : undefined });
          }
        }
      }
    }

    return { cx, cy, groundTiles, waterTiles, dirtTiles, props };
  }
}
