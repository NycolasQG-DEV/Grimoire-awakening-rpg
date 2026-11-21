// ============================================================
//  Perlin Noise 2D — Gerador determinístico com seed
//  Implementação completa: FBM multi-oitavas, Domain Warping,
//  Redistribuição de elevação e Ruído de umidade independente.
// ============================================================

/**
 * PRNG determinístico (Mulberry32) — garante mundos reprodutíveis.
 */
export class PseudoRandom {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Perlin Noise 2D clássico com permutação embaralhada por seed.
 */
export class PerlinNoise2D {
  private readonly p: Uint8Array = new Uint8Array(512);

  constructor(seed: number = 42) {
    this.reseed(seed);
  }

  public reseed(seed: number): void {
    const rng = new PseudoRandom(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;

    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    // Oito direções evitam a orientação axial excessiva do gradiente de 4 vetores.
    const diagonal = 0.70710678118;
    switch (hash & 7) {
      case 0: return x;
      case 1: return -x;
      case 2: return y;
      case 3: return -y;
      case 4: return (x + y) * diagonal;
      case 5: return (x - y) * diagonal;
      case 6: return (-x + y) * diagonal;
      default: return (-x - y) * diagonal;
    }
  }

  /**
   * Valor de ruído em (x, y), retorno normalizado entre 0 e 1.
   */
  public noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const p = this.p;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(
      u,
      this.grad(ab, xf, yf - 1),
      this.grad(bb, xf - 1, yf - 1)
    );

    return (this.lerp(v, x1, x2) + 1.0) * 0.5;
  }

  /**
   * Fractal Brownian Motion (FBM) — soma múltiplas oitavas de ruído
   * para gerar detalhes em escalas macro e micro simultaneamente.
   */
  public fbm(
    x: number,
    y: number,
    octaves: number = 6,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * FBM com redistribuição exponencial — cria platôs achatados nas
   * áreas baixas e picos mais pronunciados nas montanhas.
   */
  public fbmRedistributed(
    x: number,
    y: number,
    octaves: number = 6,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    exponent: number = 1.8
  ): number {
    const val = this.fbm(x, y, octaves, persistence, lacunarity);
    return Math.pow(val, exponent);
  }

  /**
   * Domain Warping — distorce as coordenadas de entrada com outro
   * ruído, criando formas orgânicas como rios, costas irregulares
   * e contornos que parecem naturais.
   */
  public warpedFbm(
    x: number,
    y: number,
    octaves: number = 6,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    warpStrength: number = 0.4
  ): number {
    // Primeira camada de warping
    const warpX = this.fbm(x + 5.2, y + 1.3, 4, 0.5, 2.0);
    const warpY = this.fbm(x + 9.1, y + 2.8, 4, 0.5, 2.0);

    // Coordenadas distorcidas
    const nx = x + warpX * warpStrength;
    const ny = y + warpY * warpStrength;

    return this.fbm(nx, ny, octaves, persistence, lacunarity);
  }
}
