/**
 * Amostra cinco seeds do TerrainGenerator usando as mesmas escalas e limiares
 * do WorldSampler. Executar com: node --experimental-strip-types scripts/biome-histogram.ts
 * A cópia local das fórmulas de ruído mantém este utilitário executável sem bundler.
 * Ao alterar isLand/sampleWorld em terrainGenerator.ts, atualizar também este arquivo.
 */


class PerlinNoise2D {
  private p = new Uint8Array(512);
  constructor(seed: number) { this.reseed(seed); }
  reseed(seed: number): void {
    let state = seed | 0;
    const random = () => {
      let t = (state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }
  private fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
  private grad(h: number, x: number, y: number): number {
    const d = 0.70710678118;
    switch (h & 7) {
      case 0: return x; case 1: return -x; case 2: return y; case 3: return -y;
      case 4: return (x + y) * d; case 5: return (x - y) * d;
      case 6: return (-x + y) * d; default: return (-x - y) * d;
    }
  }
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x); const yf = y - Math.floor(y);
    const u = this.fade(xf); const v = this.fade(yf); const p = this.p;
    const aa = p[p[X] + Y]; const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y]; const bb = p[p[X + 1] + Y + 1];
    const lerp = (t: number, a: number, b: number) => a + t * (b - a);
    const x1 = lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));
    return (lerp(v, x1, x2) + 1) * 0.5;
  }
  fbm(x: number, y: number, octaves = 6, persistence = 0.5, lacunarity = 2): number {
    let total = 0; let frequency = 1; let amplitude = 1; let max = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      max += amplitude; amplitude *= persistence; frequency *= lacunarity;
    }
    return total / max;
  }
  warpedFbm(x: number, y: number, octaves = 6, persistence = 0.5, lacunarity = 2, strength = 0.4): number {
    const wx = this.fbm(x + 5.2, y + 1.3, 4, 0.5, 2);
    const wy = this.fbm(x + 9.1, y + 2.8, 4, 0.5, 2);
    return this.fbm(x + wx * strength, y + wy * strength, octaves, persistence, lacunarity);
  }
}

class Sampler {
  private n: Record<string, PerlinNoise2D>;
  private seed: number;
  private elevationQuantiles: number[] = [];
  private moistureQuantiles: number[] = [];
  private temperatureQuantiles: number[] = [];
  constructor(seed: number) {
    this.seed = seed;
    this.n = {
      continent: new PerlinNoise2D(seed), lake: new PerlinNoise2D(seed + 1111),
      pond: new PerlinNoise2D(seed + 1555), pondMask: new PerlinNoise2D(seed + 1777),
      pondEdge: new PerlinNoise2D(seed + 1888), river: new PerlinNoise2D(seed + 2048),
      riverMask: new PerlinNoise2D(seed + 3072), stream: new PerlinNoise2D(seed + 3333),
      streamMask: new PerlinNoise2D(seed + 3555), biome: new PerlinNoise2D(seed + 4096),
      moisture: new PerlinNoise2D(seed + 4608), temperature: new PerlinNoise2D(seed + 4864),
    };
    this.calibrateQuantiles();
  }
  private calibrateQuantiles(): void {
    let state = this.seed >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const elevation: number[] = []; const moisture: number[] = []; const temperature: number[] = [];
    for (let i = 0; i < 20000; i++) {
      const x = random() * 5000; const y = random() * 5000;
      elevation.push(this.n.continent.fbm(x * 0.0012, y * 0.0012, 3));
      moisture.push(this.n.moisture.fbm(x * 0.0017, y * 0.0017, 4, 0.52, 2));
      const latitude = Math.abs(y / 5000 - 0.5) * 2;
      temperature.push(0.78 - latitude * 0.64 + (this.n.temperature.fbm(x * 0.0008, y * 0.0008, 3) - 0.5) * 0.18);
    }
    this.elevationQuantiles = elevation.sort((a, b) => a - b);
    this.moistureQuantiles = moisture.sort((a, b) => a - b);
    this.temperatureQuantiles = temperature.sort((a, b) => a - b);
  }
  private quantile(sorted: number[], value: number): number {
    let lo = 0; let hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] < value) lo = mid + 1; else hi = mid; }
    return Math.max(0, Math.min(1, lo / Math.max(1, sorted.length - 1)));
  }
  private hash(cx: number, cy: number, salt = 0): number {
    let h = (cx * 374761393 + cy * 668265263) ^ (this.seed + salt);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  isLand(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= 5000 || y >= 5000) return false;
    if (this.n.continent.warpedFbm(x * 0.0012, y * 0.0012, 4, 0.5, 2, 0.35) < 0.22) return false;
    if (this.n.lake.warpedFbm(x * 0.0016, y * 0.0016, 3, 0.5, 2, 0.35) < 0.49) return false;
    if (this.n.pondMask.noise(x * 0.0012, y * 0.0012) > 0.62 &&
        this.n.pond.warpedFbm(x * 0.0045, y * 0.0045, 2, 0.5, 2, 0.3) < 0.34) return false;
    const cell = 90; const cx = Math.floor(x / cell); const cy = Math.floor(y / cell);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx; const gy = cy + dy; const h = this.hash(gx, gy, 98765);
      if ((h & 15) > 3) continue;
      const px = gx * cell + 20 + ((h >> 4) % (cell - 40));
      const py = gy * cell + 20 + ((h >> 10) % (cell - 40));
      const rx = 4.5 + ((h >> 16) % 5); const ry = 3.5 + ((h >> 20) % 4);
      const ddx = (x - px) / rx; const ddy = (y - py) / ry;
      const wobble = (this.n.pondEdge.noise(x * 0.22, y * 0.22) - 0.5) * 0.55;
      if (ddx * ddx + ddy * ddy + wobble <= 1) return false;
    }
    if (this.n.riverMask.fbm(x * 0.0006, y * 0.0006, 2) > 0.67 &&
        Math.abs(this.n.river.warpedFbm(x * 0.0014, y * 0.0014, 3, 0.5, 2, 0.35) - 0.5) < 0.008) return false;
    if (this.n.streamMask.fbm(x * 0.0009, y * 0.0009, 2) > 0.72 &&
        Math.abs(this.n.stream.warpedFbm(x * 0.0026, y * 0.0026, 2, 0.5, 2, 0.25) - 0.5) < 0.005) return false;
    return true;
  }
  biome(x: number, y: number): string {
    const land = this.isLand(x, y);
    const shoreRadius = 2 + Math.floor(this.n.pondEdge.noise(x * 0.08, y * 0.08) * 4);
    let nearWater = false;
    for (let dy = -shoreRadius; dy <= shoreRadius && !nearWater; dy++) {
      for (let dx = -shoreRadius; dx <= shoreRadius; dx++) {
        if (!this.isLand(x + dx, y + dy)) { nearWater = true; break; }
      }
    }
    nearWater = land && nearWater;
    const rawElevation = this.n.continent.fbm(x * 0.0012, y * 0.0012, 3);
    const rawMoisture = this.n.moisture.fbm(x * 0.0017, y * 0.0017, 4, 0.52, 2);
    const latitude = Math.abs(y / 5000 - 0.5) * 2;
    const rawTemperature = 0.78 - latitude * 0.64 + (this.n.temperature.fbm(x * 0.0008, y * 0.0008, 3) - 0.5) * 0.18;
    const elevation = this.quantile(this.elevationQuantiles, rawElevation);
    const moisture = this.quantile(this.moistureQuantiles, rawMoisture + (nearWater ? 0.08 : 0));
    const temperature = this.quantile(this.temperatureQuantiles, rawTemperature);
    if (!land) return 'água';
    if (nearWater && elevation < 0.96) return 'praia';
    if (elevation >= 0.94 || temperature < 0.10) return 'tundra';
    if (elevation >= 0.82) return 'montanha rochosa';
    if (moisture >= 0.94 && elevation < 0.82) return 'pântano';
    if (temperature >= 0.75 && moisture < 0.25) return 'terras secas';
    if (moisture >= 0.82) return 'floresta ancestral';
    if (temperature < 0.28) return 'taiga';
    if (temperature < 0.58 && moisture < 0.67) return 'bosque outonal';
    if (moisture >= 0.48) return 'floresta temperada';
    return 'planície';
  }

}

const seeds = [42891, 83472, 19453, 76109, 37291];
const samples = Number(process.argv.find((arg) => arg.startsWith('--samples='))?.split('=')[1] ?? 20000);
const names = ['praia', 'planície', 'floresta temperada', 'bosque outonal', 'taiga', 'floresta ancestral', 'pântano', 'terras secas', 'montanha rochosa', 'tundra'];
for (const seed of seeds) {
  const sampler = new Sampler(seed);
  const counts = new Map<string, number>();
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < samples; i++) {
    const x = Math.floor(random() * 5000);
    const y = Math.floor(random() * 5000);
    const name = sampler.biome(x, y);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const landSamples = samples - (counts.get('água') ?? 0);
  console.log(`\nSeed ${seed} — ${samples.toLocaleString('pt-BR')} pontos; terra: ${landSamples.toLocaleString('pt-BR')}`);
  for (const name of names) {
    const count = counts.get(name) ?? 0;
    const pct = landSamples ? (count / landSamples) * 100 : 0;
    console.log(`${name.padEnd(24)} ${String(count).padStart(6)}  ${pct.toFixed(2).padStart(6)}% da terra`);
  }
}
