// ============================================================
//  Motor de Autotiling 2D — Transições Suaves e Conexões de Bioma
// ============================================================

export interface TileCoord {
  tileX: number;
  tileY: number;
}

export type CoastType = 'grass' | 'sand' | 'ice';

/**
 * Autotile para costa / margem d'água (Water_tiles.png, bloco 5×5):
 * Transição suave com espuma da terra/grama, da areia ou do gelo para o leito d'água.
 *
 * Para grama/terra: baseRow = 0
 * Para areia pura de praia: baseRow = 15
 * Para gelo/tundra ártica: baseRow = 20
 *
 *   [1,0]  [2,0]  [3,0]   <- cantos externos NW, borda N, canto NE
 *   [0,2]  [2,2]  [4,2]   <- borda W, centro terra/areia/gelo sólido, borda E
 *   [1,4]  [2,4]  [3,4]   <- cantos externos SW, borda S, canto SE
 *   [1,1]  [3,1]  [1,3]  [3,3] <- cantos côncavos internos
 */
export function getWaterCoastAutotile(
  n: boolean, s: boolean, w: boolean, e: boolean,
  nw: boolean, ne: boolean, sw: boolean, se: boolean,
  coast: CoastType | boolean = 'grass'
): TileCoord {
  const type: CoastType = typeof coast === 'boolean' ? (coast ? 'sand' : 'grass') : coast;
  const baseRow = type === 'sand' ? 15 : (type === 'ice' ? 20 : 0);

  // Cantos externos convexos
  if (!n && !w) return { tileX: 1, tileY: baseRow + 0 };
  if (!n && !e) return { tileX: 3, tileY: baseRow + 0 };
  if (!s && !w) return { tileX: 1, tileY: baseRow + 4 };
  if (!s && !e) return { tileX: 3, tileY: baseRow + 4 };

  // Bordas retas
  if (!n) return { tileX: 2, tileY: baseRow + 0 };
  if (!s) return { tileX: 2, tileY: baseRow + 4 };
  if (!w) return { tileX: 0, tileY: baseRow + 2 };
  if (!e) return { tileX: 4, tileY: baseRow + 2 };

  // Cantos côncavos internos
  if (!nw) return { tileX: 1, tileY: baseRow + 1 };
  if (!ne) return { tileX: 3, tileY: baseRow + 1 };
  if (!sw) return { tileX: 1, tileY: baseRow + 3 };
  if (!se) return { tileX: 3, tileY: baseRow + 3 };

  // Centro sólido
  return { tileX: 2, tileY: baseRow + 2 };
}

/**
 * Autotile genérico para blocos de transição tipo "ilha/mancha" de 5×5 em Floors_Tiles.png
 * (ex: Areia [cols 5–9, rows 12–16] e Neve [cols 0–4, rows 12–16]).
 *
 * Possui centro sólido e bordas recortadas com dentes que se sobrepõem suavemente
 * ao chão abaixo (grama, pedra, etc.) sem cortes secos de 16px.
 */
export function getIslandTransitionAutotile(
  baseCol: number, baseRow: number,
  n: boolean, s: boolean, w: boolean, e: boolean,
  nw: boolean, ne: boolean, sw: boolean, se: boolean
): TileCoord {
  // Cantos externos convexos
  if (!n && !w) return { tileX: baseCol + 1, tileY: baseRow + 0 };
  if (!n && !e) return { tileX: baseCol + 3, tileY: baseRow + 0 };
  if (!s && !w) return { tileX: baseCol + 1, tileY: baseRow + 4 };
  if (!s && !e) return { tileX: baseCol + 3, tileY: baseRow + 4 };

  // Bordas retas
  if (!n) return { tileX: baseCol + 2, tileY: baseRow + 0 };
  if (!s) return { tileX: baseCol + 2, tileY: baseRow + 4 };
  if (!w) return { tileX: baseCol + 0, tileY: baseRow + 2 };
  if (!e) return { tileX: baseCol + 4, tileY: baseRow + 2 };

  // Cantos côncavos internos
  if (!nw) return { tileX: baseCol + 1, tileY: baseRow + 1 };
  if (!ne) return { tileX: baseCol + 3, tileY: baseRow + 1 };
  if (!sw) return { tileX: baseCol + 1, tileY: baseRow + 3 };
  if (!se) return { tileX: baseCol + 3, tileY: baseRow + 3 };

  // Centro sólido
  return { tileX: baseCol + 2, tileY: baseRow + 2 };
}

/**
 * Transição suave de Areia sobre grama ou outro terreno (Floors_Tiles.png, cols 5–9, rows 12–16).
 */
export function getSandTransitionAutotile(
  nSand: boolean, sSand: boolean, wSand: boolean, eSand: boolean,
  nwSand: boolean, neSand: boolean, swSand: boolean, seSand: boolean
): TileCoord {
  return getIslandTransitionAutotile(5, 12, nSand, sSand, wSand, eSand, nwSand, neSand, swSand, seSand);
}

/**
 * Transição suave de Neve sobre grama, terra ou rocha (Floors_Tiles.png, cols 0–4, rows 12–16).
 */
export function getSnowTransitionAutotile(
  nSnow: boolean, sSnow: boolean, wSnow: boolean, eSnow: boolean,
  nwSnow: boolean, neSnow: boolean, swSnow: boolean, seSnow: boolean
): TileCoord {
  return getIslandTransitionAutotile(0, 12, nSnow, sSnow, wSnow, eSnow, nwSnow, neSnow, swSnow, seSnow);
}

/**
 * Transição suave de Pedra/Rocha sobre grama ou outro terreno (Floors_Tiles.png, cols 15–19, rows 12–16).
 */
export function getStoneTransitionAutotile(
  nStone: boolean, sStone: boolean, wStone: boolean, eStone: boolean,
  nwStone: boolean, neStone: boolean, swStone: boolean, seStone: boolean
): TileCoord {
  return getIslandTransitionAutotile(15, 12, nStone, sStone, wStone, eStone, nwStone, neStone, swStone, seStone);
}

/**
 * Autotile para transição plana de Grama sobre Caminhos de Terra / Pântano
 * (Floors_Tiles.png, padrão 1: cols 0–4, rows 0–4).
 *
 * O centro [2,2] é 100% transparente (recorte) e as bordas possuem
 * tufos de grama verde idênticos à grama do terreno, criando uma
 * transição suave e plana sobre a terra batida / lama.
 *
 * Retorna null se for o miolo do caminho/terra (onde só aparece o piso base).
 */
export function getGrassDirtOverlayAutotile(
  nGrass: boolean, sGrass: boolean, wGrass: boolean, eGrass: boolean,
  nwGrass: boolean, neGrass: boolean, swGrass: boolean, seGrass: boolean
): TileCoord | null {
  // Cantos externos: grama em dois lados ortogonais
  if (nGrass && wGrass) return { tileX: 1, tileY: 0 };
  if (nGrass && eGrass) return { tileX: 3, tileY: 0 };
  if (sGrass && wGrass) return { tileX: 1, tileY: 4 };
  if (sGrass && eGrass) return { tileX: 3, tileY: 4 };

  // Bordas retas de grama sobre a trilha/lama
  if (nGrass) return { tileX: 2, tileY: 0 };
  if (sGrass) return { tileX: 2, tileY: 4 };
  if (wGrass) return { tileX: 0, tileY: 2 };
  if (eGrass) return { tileX: 4, tileY: 2 };

  // Cantos côncavos diagonais
  if (nwGrass) return { tileX: 1, tileY: 1 };
  if (neGrass) return { tileX: 3, tileY: 1 };
  if (swGrass) return { tileX: 1, tileY: 3 };
  if (seGrass) return { tileX: 3, tileY: 3 };

  // Centro do caminho de terra — sem overlay
  return null;
}
