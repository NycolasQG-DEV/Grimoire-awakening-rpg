import Phaser from 'phaser';
import { BIOMES } from '../config/biomes';
import { FLOOR_SOURCE_TILES, FLOOR_VARIANT_COUNT, LAND_BIOME_ORDER, TILESET_TILE_SIZE } from '../config/tileset-map';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('water-tiles', '/assets/tilesets/Water_tiles.png');
    this.load.image('floor-tiles', '/assets/tilesets/Floors_Tiles.png');

    this.load.image('tree-shadow', '/assets/props/tree_shadow.png');
    this.load.image('shadow-bush', '/assets/props/shadow_bush.png');
    this.load.image('shadow-rock', '/assets/props/shadow_rock.png');

    // Sprites legados seguros. Os PNGs tree_giant_* não são carregados:
    // eles incluem duas árvores empilhadas no mesmo arquivo.
    this.load.image('tree-green', '/assets/generated/trees/tree-green.png');
    this.load.image('tree-yellow', '/assets/generated/trees/tree-yellow.png');
    this.load.image('tree-orange', '/assets/generated/trees/tree-orange.png');
    this.load.image('tree-dark', '/assets/props/tree_dark.png');
    this.load.image('tree-pine', '/assets/generated/trees/tree-pine.png');
    this.load.image('tree-frost-pine', '/assets/generated/trees/tree-frost-pine.png');
    this.load.image('tree-brown-pine', '/assets/generated/trees/tree-brown-pine.png');
    this.load.image('tree-red-pine', '/assets/generated/trees/tree-red-pine.png');
    this.load.image('tree-dry', '/assets/generated/trees/tree-dry.png');
    this.load.image('tree-sapling', '/assets/generated/trees/tree-sapling.png');

    this.load.image('rock', '/assets/props/rock.png');
    this.load.image('rock-gray', '/assets/props/rock_gray.png');
    this.load.image('rock-small', '/assets/props/rock_small.png');
    this.load.image('bush', '/assets/props/bush.png');
    this.load.image('bush-dry', '/assets/props/vegetation2.png');

    this.load.spritesheet('player', '/assets/character/player.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.image('player-shadow', '/assets/props/shadow_rock.png');
  }

  create(): void {
    this.createBiomeFloorAtlas();
    this.scene.start('TerrainScene');
  }

  /**
   * Constrói o atlas com os tiles de piso autênticos de Floors_Tiles.png,
   * preservando fielmente a paleta de cores original da pixel art.
   */
  private createBiomeFloorAtlas(): void {
    const tileSize = TILESET_TILE_SIZE;
    const source = this.textures.get('floor-tiles').getSourceImage() as HTMLImageElement;
    const textureKey = 'biome-floors';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);

    const atlasWidth = tileSize * LAND_BIOME_ORDER.length * FLOOR_VARIANT_COUNT;
    const texture = this.textures.createCanvas(textureKey, atlasWidth, tileSize);
    if (!texture) return;

    const context = texture.getContext();
    const scratch = document.createElement('canvas');
    scratch.width = tileSize;
    scratch.height = tileSize;
    const scratchContext = scratch.getContext('2d', { willReadFrequently: true });

    LAND_BIOME_ORDER.forEach((biomeId, biomeIndex) => {
      const biome = BIOMES[biomeId];
      const material = biome.floorMaterial;
      if (!material) return;
      const sources = FLOOR_SOURCE_TILES[material];

      for (let variant = 0; variant < FLOOR_VARIANT_COUNT; variant++) {
        const destinationTile = biomeIndex * FLOOR_VARIANT_COUNT + variant;

        if (material === 'stone' && scratchContext) {
          // O usuário solicitou: "esse tile escuro de tijolos não deve ser um tile usado como terra, use o tile da areia e troque de cor para isso."
          // Usamos a textura orgânica da areia recolorida para tons rochosos/ardósia, eliminando os tijolos artificiais.
          const [sandCol, sandRow] = FLOOR_SOURCE_TILES['sand'][variant];
          scratchContext.clearRect(0, 0, tileSize, tileSize);
          scratchContext.drawImage(
            source,
            sandCol * tileSize, sandRow * tileSize, tileSize, tileSize,
            0, 0, tileSize, tileSize,
          );
          const imgData = scratchContext.getImageData(0, 0, tileSize, tileSize);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const diff = (lum - 215) * 1.6;
            d[i] = Math.max(0, Math.min(255, Math.round(116 + diff)));
            d[i + 1] = Math.max(0, Math.min(255, Math.round(116 + diff)));
            d[i + 2] = Math.max(0, Math.min(255, Math.round(114 + diff)));
          }
          scratchContext.putImageData(imgData, 0, 0);
          context.drawImage(scratch, destinationTile * tileSize, 0);
        } else {
          const [sourceColumn, sourceRow] = sources[variant];
          context.drawImage(
            source,
            sourceColumn * tileSize, sourceRow * tileSize, tileSize, tileSize,
            destinationTile * tileSize, 0, tileSize, tileSize,
          );
        }
      }
    });

    texture.refresh();
  }
}
