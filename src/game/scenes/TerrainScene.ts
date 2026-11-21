import Phaser from 'phaser';
import { TerrainGenerator } from '../terrainGenerator';
import { EventBus } from '../EventBus';
import {
  TILE_SIZE,
  CHUNK_SIZE,
  CHUNK_PIXELS,
  WORLD_SIZE,
  WORLD_PIXELS,
  DEFAULT_TERRAIN_CONFIG,
  getRandomSeed,
} from '../../types/game';
import type { TerrainConfig } from '../../types/game';
import { BIOMES } from '../config/biomes';
import { FLOOR_GID_BASE, FLOORS_TILESET_GID_BASE } from '../config/tileset-map';
import { shouldFade, smoothAlpha } from '../systems/occlusionSystem';
import type { AlphaMask, TreeOccluder } from '../systems/occlusionSystem';

interface TreeObstacle {
  x: number;
  y: number;
  r: number;
}

interface ActiveTree extends TreeOccluder {
  image: Phaser.GameObjects.Image;
  alpha: number;
}

interface ActiveBush {
  image: Phaser.GameObjects.Image;
  wasInRange: boolean;
}

interface ActiveChunk {
  cx: number;
  cy: number;
  tilemap: Phaser.Tilemaps.Tilemap;
  groundLayer: Phaser.Tilemaps.TilemapLayer;
  transitionLayer: Phaser.Tilemaps.TilemapLayer;
  waterLayer: Phaser.Tilemaps.TilemapLayer;
  props: Phaser.GameObjects.Image[];
  bushes: ActiveBush[];
  trees: ActiveTree[];
  obstacles: TreeObstacle[];
}

export class TerrainScene extends Phaser.Scene {
  private generator!: TerrainGenerator;
  private config: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG, seed: getRandomSeed() };

  // Chunks ativos na memória
  private loadedChunks = new Map<string, ActiveChunk>();

  // Personagem Jogável
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private playerFacing: 'down' | 'up' | 'left' | 'right' = 'down';
  private playerRadius = 7;

  // Controles
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;

  private lastChunkCheckX = -99999;
  private lastChunkCheckY = -99999;
  private lastZoom = -1;
  private treeMaskCache = new Map<string, AlphaMask>();
  private keyF2!: Phaser.Input.Keyboard.Key;
  private biomeHud!: Phaser.GameObjects.Text;
  private biomeHudVisible = false;
  private lastBiomeTileX = -1;
  private lastBiomeTileY = -1;
  private currentBiomeName = ''; 

  // Minimapa Mundial
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapImage!: Phaser.GameObjects.Image;
  private minimapPlayerDot!: Phaser.GameObjects.Arc;
  private minimapPlayerRing!: Phaser.GameObjects.Arc;
  private minimapSpawnDot!: Phaser.GameObjects.Arc;
  private minimapCoordsText!: Phaser.GameObjects.Text;
  private minimapVisible = false;
  private keyM!: Phaser.Input.Keyboard.Key;
  private readonly MINIMAP_DISP_SIZE = 280;

  // Spawn point (em tiles)
  private spawnTileX = 0;
  private spawnTileY = 0;

  constructor() {
    super('TerrainScene');
  }

  init(): void {
    this.config.seed = getRandomSeed();
  }

  create(): void {
    this.generator = new TerrainGenerator(this.config);

    this.createPlayerAnimations();

    // Encontra ponto de spawn e registra patch de terra no generator
    const spawnTile = this.findScenicSpawnPoint(
      Math.floor(WORLD_SIZE / 2),
      Math.floor(WORLD_SIZE / 2)
    );
    this.spawnTileX = spawnTile.x;
    this.spawnTileY = spawnTile.y;
    this.generator.setSpawnPoint(this.spawnTileX, this.spawnTileY);

    const spawnPxX = spawnTile.x * TILE_SIZE + 8;
    const spawnPxY = spawnTile.y * TILE_SIZE + 8;

    // Cria sombra suave sob os pés do personagem
    this.playerShadow = this.add.image(spawnPxX, spawnPxY, 'player-shadow');
    this.playerShadow.setOrigin(0.5, 0.5);
    this.playerShadow.setAlpha(0.40);

    // Cria o personagem jogável estilo Black Clover
    this.player = this.add.sprite(spawnPxX, spawnPxY, 'player', 0);
    this.player.setOrigin(0.5, 0.90);
    this.player.setDepth(spawnPxY);

    // Câmera principal segue o personagem
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_PIXELS, WORLD_PIXELS);
    cam.setZoom(2);
    cam.roundPixels = true;
    cam.centerOn(spawnPxX, spawnPxY);
    cam.startFollow(this.player, true, 1, 1);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      this.updateVisibleChunks(true);
      this.repositionMinimap();
    });

    this.updateVisibleChunks(true);
    this.setupInputs();
    this.setupMinimap();
    this.biomeHud = this.add.text(12, 12, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#17221dcc', padding: { x: 6, y: 4 } });
    this.biomeHud.setScrollFactor(0).setDepth(1000000).setVisible(false);
    this.exposeDebugApi();

    EventBus.emit('terrain-ready', {
      seed: this.config.seed,
      width: WORLD_SIZE,
      height: WORLD_SIZE,
    });
  }

  private exposeDebugApi(): void {
    if (!import.meta.env.DEV) return;
    const debugApi = {
      teleportToBiome: (name: string): boolean => {
        const query = name.toLocaleLowerCase('pt-BR');
        for (let y = 64; y < WORLD_SIZE; y += 64) {
          for (let x = 64; x < WORLD_SIZE; x += 64) {
            const sample = this.generator.sampleWorld(x, y);
            const label = BIOMES[sample.biome].name.toLocaleLowerCase('pt-BR');
            if (sample.biome === query || label.includes(query)) {
              this.teleportToTile(x, y);
              return true;
            }
          }
        }
        return false;
      },
      teleport: (x: number, y: number): void => this.teleportToTile(x, y),
      setZoom: (zoom: number): void => {
        this.cameras.main.setZoom(Phaser.Math.Clamp(Math.round(zoom), 1, 4));
        this.updateVisibleChunks(true);
      },
      biomeAt: (x: number, y: number): string => this.generator.getBiomeName(Math.floor(x), Math.floor(y)),
      regenerate: (seed?: number): void => this.regenerate(seed),
      stats: (): { fps: number; chunks: number; displayObjects: number; trees: number; props: number } => {
        let trees = 0;
        let props = 0;
        for (const chunk of this.loadedChunks.values()) {
          trees += chunk.trees.length;
          props += chunk.props.length;
        }
        return {
          fps: this.game.loop.actualFps,
          chunks: this.loadedChunks.size,
          displayObjects: this.children.length,
          trees,
          props,
        };
      },
    };
    (window as Window & { __GAME_DEBUG__?: typeof debugApi }).__GAME_DEBUG__ = debugApi;
  }

  private teleportToTile(tileX: number, tileY: number): void {
    const x = Phaser.Math.Clamp(tileX, 0, WORLD_SIZE - 1) * TILE_SIZE + 8;
    const y = Phaser.Math.Clamp(tileY, 0, WORLD_SIZE - 1) * TILE_SIZE + 8;
    this.player.setPosition(x, y);
    this.playerShadow.setPosition(x, y);
    this.cameras.main.centerOn(x, y);
    this.updateVisibleChunks(true);
  }


  private createPlayerAnimations(): void {
    if (this.anims.exists('walk-down')) return;

    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 3] }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('player', { frames: [4, 5, 6, 7] }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('player', { frames: [8, 9, 10, 11] }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('player', { frames: [12, 13, 14, 15] }),
      frameRate: 8,
      repeat: -1,
    });
  }

  private findScenicSpawnPoint(startX: number, startY: number): { x: number; y: number } {
    for (let r = 5; r < 400; r += 4) {
      for (const [dx, dy] of [
        [r, 0], [-r, 0], [0, r], [0, -r],
        [Math.floor(r * 0.7), Math.floor(r * 0.7)],
        [-Math.floor(r * 0.7), Math.floor(r * 0.7)],
        [Math.floor(r * 0.7), -Math.floor(r * 0.7)],
        [-Math.floor(r * 0.7), -Math.floor(r * 0.7)],
      ]) {
        const tx = startX + dx;
        const ty = startY + dy;
        if (this.generator.isLand(tx, ty)) {
          let hasNearbyLake = false;
          for (let step = 12; step <= 24; step += 4) {
            if (
              !this.generator.isLand(tx + step, ty) ||
              !this.generator.isLand(tx - step, ty) ||
              !this.generator.isLand(tx, ty + step) ||
              !this.generator.isLand(tx, ty - step)
            ) {
              hasNearbyLake = true;
              break;
            }
          }
          if (hasNearbyLake) {
            return { x: tx, y: ty };
          }
        }
      }
    }

    return this.findLandSpawnPoint(startX, startY);
  }

  private findLandSpawnPoint(startX: number, startY: number): { x: number; y: number } {
    if (this.generator.isLand(startX, startY)) {
      return { x: startX, y: startY };
    }

    for (let r = 1; r < 500; r += 5) {
      for (let dx = -r; dx <= r; dx += 5) {
        if (this.generator.isLand(startX + dx, startY + r)) return { x: startX + dx, y: startY + r };
        if (this.generator.isLand(startX + dx, startY - r)) return { x: startX + dx, y: startY - r };
      }
      for (let dy = -r; dy <= r; dy += 5) {
        if (this.generator.isLand(startX + r, startY + dy)) return { x: startX + r, y: startY + dy };
        if (this.generator.isLand(startX - r, startY + dy)) return { x: startX - r, y: startY + dy };
      }
    }

    return { x: startX, y: startY };
  }

  private updateVisibleChunks(force = false): void {
    const cam = this.cameras.main;

    if (!force) {
      const dx = Math.abs(cam.scrollX - this.lastChunkCheckX);
      const dy = Math.abs(cam.scrollY - this.lastChunkCheckY);
      const dz = Math.abs(cam.zoom - this.lastZoom);
      if (dx < 16 && dy < 16 && dz < 0.01) return;
    }

    this.lastChunkCheckX = cam.scrollX;
    this.lastChunkCheckY = cam.scrollY;
    this.lastZoom = cam.zoom;

    const maxChunksX = Math.ceil(WORLD_SIZE / CHUNK_SIZE);
    const maxChunksY = Math.ceil(WORLD_SIZE / CHUNK_SIZE);

    const halfW = (cam.width / 2) / cam.zoom;
    const halfH = (cam.height / 2) / cam.zoom;
    const midX = cam.scrollX + cam.width / 2;
    const midY = cam.scrollY + cam.height / 2;
    const viewLeft   = midX - halfW;
    const viewRight  = midX + halfW;
    const viewTop    = midY - halfH;
    const viewBottom = midY + halfH;

    // Pré-renderização: exatamente a área da tela + raio de 10 tiles além dela
    const BUFFER_TILES = 10;
    const BUFFER_PX = BUFFER_TILES * TILE_SIZE; // 160 pixels
    const renderLeft   = Math.max(0, viewLeft - BUFFER_PX);
    const renderRight  = Math.min(WORLD_PIXELS - 1, viewRight + BUFFER_PX);
    const renderTop    = Math.max(0, viewTop - BUFFER_PX);
    const renderBottom = Math.min(WORLD_PIXELS - 1, viewBottom + BUFFER_PX);

    const minCx = Math.floor(renderLeft / CHUNK_PIXELS);
    const maxCx = Math.min(maxChunksX - 1, Math.floor(renderRight / CHUNK_PIXELS));
    const minCy = Math.floor(renderTop / CHUNK_PIXELS);
    const maxCy = Math.min(maxChunksY - 1, Math.floor(renderBottom / CHUNK_PIXELS));

    const neededKeys = new Set<string>();

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx},${cy}`;
        neededKeys.add(key);

        if (!this.loadedChunks.has(key)) {
          this.loadChunk(cx, cy);
        }
      }
    }

    // Apaga imediatamente qualquer chunk fora da tela e do raio de 10 tiles
    for (const [key, chunk] of this.loadedChunks.entries()) {
      if (!neededKeys.has(key)) {
        this.unloadChunk(key, chunk);
      }
    }
  }

  private getTreeParams(type: string): { colRadius: number; colOffsetY: number } {
    if (type === 'tree-frost-pine') return { colRadius: 8, colOffsetY: -4 };
    if (type === 'tree-sapling') return { colRadius: 3, colOffsetY: -1 };
    if (type === 'tree-dry') return { colRadius: 6, colOffsetY: -3 };
    if (type === 'tree-pine' || type === 'tree-brown-pine' || type === 'tree-red-pine') {
      return { colRadius: 8, colOffsetY: -4 };
    }
    return { colRadius: 9, colOffsetY: -5 };
  }

  /** Máscara alfa do sprite completo: a translucidez inclui copa, galhos e tronco. */
  private getTreeMask(type: string): AlphaMask {
    const cached = this.treeMaskCache.get(type);
    if (cached) return cached;

    const source = this.textures.get(type).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(`Não foi possível criar a máscara alfa de ${type}`);
    context.drawImage(source, 0, 0);
    const mask: AlphaMask = {
      width: source.width,
      height: source.height,
      data: context.getImageData(0, 0, source.width, source.height).data,
    };
    this.treeMaskCache.set(type, mask);
    return mask;
  }

  private loadChunk(cx: number, cy: number): void {
    const chunkData = this.generator.generateChunk(cx, cy);
    const chunkWorldX = cx * CHUNK_PIXELS;
    const chunkWorldY = cy * CHUNK_PIXELS;

    const map = this.make.tilemap({ tileWidth: TILE_SIZE, tileHeight: TILE_SIZE, width: CHUNK_SIZE, height: CHUNK_SIZE });
    const waterTileset = map.addTilesetImage('water-tiles', 'water-tiles', TILE_SIZE, TILE_SIZE, 0, 0, 1)!;
    const biomeTileset = map.addTilesetImage('biome-floors', 'biome-floors', TILE_SIZE, TILE_SIZE, 0, 0, FLOOR_GID_BASE)!;
    const floorTileset = map.addTilesetImage('floor-tiles', 'floor-tiles', TILE_SIZE, TILE_SIZE, 0, 0, FLOORS_TILESET_GID_BASE)!;

    const groundLayer = map.createBlankLayer('ground', [biomeTileset, floorTileset], chunkWorldX, chunkWorldY)!;
    const transitionLayer = map.createBlankLayer('transition', [biomeTileset, floorTileset], chunkWorldX, chunkWorldY)!;
    const waterLayer = map.createBlankLayer('water', waterTileset, chunkWorldX, chunkWorldY)!;
    groundLayer.setDepth(0);
    transitionLayer.setDepth(1);
    waterLayer.setDepth(2);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const groundTile = chunkData.groundTiles[ly][lx];
        if (groundTile !== -1) groundLayer.putTileAt(groundTile, lx, ly);
        const dirtTile = chunkData.dirtTiles[ly][lx];
        if (dirtTile !== -1) transitionLayer.putTileAt(dirtTile, lx, ly);
        const waterTile = chunkData.waterTiles[ly][lx];
        if (waterTile !== -1) waterLayer.putTileAt(waterTile, lx, ly);
      }
    }

    const props: Phaser.GameObjects.Image[] = [];
    const bushes: ActiveBush[] = [];
    const trees: ActiveTree[] = [];
    const obstacles: TreeObstacle[] = [];

    for (const prop of chunkData.props) {
      if (prop.type.startsWith('tree')) {
        const params = this.getTreeParams(prop.type);
        const mask = this.getTreeMask(prop.type);
        const topY = prop.y - mask.height;

        const shadow = this.add.image(prop.x, prop.y, 'tree-shadow');
        shadow.setOrigin(0.5, 0.5).setAlpha(0.30).setDepth(prop.y - 1);
        props.push(shadow);

        // Um único sprite evita emendas no recorte e permite desbotar a árvore inteira.
        const image = this.add.image(prop.x, prop.y, prop.type);
        image.setOrigin(0.5, 1).setDepth(prop.y + 0.01);
        props.push(image);

        trees.push({
          image, x: prop.x, baseY: prop.y,
          spriteTop: topY, spriteBottom: prop.y,
          spriteWidth: mask.width, mask, wasFaded: false, alpha: 1,
        });
        obstacles.push({ x: prop.x, y: prop.y + params.colOffsetY, r: params.colRadius });
      } else if (prop.type === 'bush' || prop.type === 'bush-dry') {
        const bushKey = prop.type === 'bush-dry' ? 'bush-dry' : 'bush';
        const bushShadow = this.add.image(prop.x, prop.y + 2, 'shadow-bush');
        bushShadow.setOrigin(0.5, 0.5).setAlpha(0.32).setDepth(prop.y - 1);
        props.push(bushShadow);

        const bush = this.add.image(prop.x, prop.y, bushKey);
        bush.setOrigin(0.5, 0.85).setDepth(prop.y);
        if (prop.scale) bush.setScale(prop.scale);
        if (prop.tint) bush.setTint(prop.tint);
        props.push(bush);
        bushes.push({ image: bush, wasInRange: false });
      } else if (prop.type === 'rock' || prop.type === 'rock-gray') {
        const rockShadow = this.add.image(prop.x, prop.y + 1, 'shadow-rock');
        rockShadow.setOrigin(0.5, 0.5).setAlpha(0.32).setDepth(prop.y - 1);
        props.push(rockShadow);

        const rock = this.add.image(prop.x, prop.y, prop.type);
        rock.setOrigin(0.5, 0.92).setDepth(prop.y);
        if (prop.scale) rock.setScale(prop.scale);
        props.push(rock);
        obstacles.push({ x: prop.x, y: prop.y - 4, r: 9 });
      } else if (prop.type === 'rock-small') {
        const rockShadow = this.add.image(prop.x, prop.y + 1, 'shadow-rock');
        rockShadow.setOrigin(0.5, 0.5).setAlpha(0.28).setDepth(prop.y - 1);
        props.push(rockShadow);

        const rock = this.add.image(prop.x, prop.y, prop.type);
        rock.setOrigin(0.5, 0.8).setDepth(prop.y);
        if (prop.scale) rock.setScale(prop.scale);
        props.push(rock);
      }
    }

    this.loadedChunks.set(`${cx},${cy}`, {
      cx, cy, tilemap: map, groundLayer, transitionLayer, waterLayer, props, bushes, trees, obstacles,
    });
  }


  private unloadChunk(key: string, chunk: ActiveChunk): void {
    for (const bush of chunk.bushes) {
      this.tweens.killTweensOf(bush.image);
    }
    for (const prop of chunk.props) {
      this.tweens.killTweensOf(prop);
      prop.destroy();
    }
    chunk.groundLayer.destroy();
    chunk.transitionLayer.destroy();
    chunk.waterLayer.destroy();
    chunk.tilemap.destroy();
    this.loadedChunks.delete(key);
  }

  public regenerate(newSeed?: number): void {
    this.config.seed = newSeed ?? (Math.floor(Math.random() * 900000) + 100000);
    this.generator.reseed(this.config.seed);
    this.lastBiomeTileX = -1;
    this.lastBiomeTileY = -1;

    for (const [key, chunk] of this.loadedChunks.entries()) {
      this.unloadChunk(key, chunk);
    }
    this.loadedChunks.clear();
    this.treeMaskCache.clear();

    const spawnTile = this.findScenicSpawnPoint(
      Math.floor(WORLD_SIZE / 2),
      Math.floor(WORLD_SIZE / 2)
    );
    this.spawnTileX = spawnTile.x;
    this.spawnTileY = spawnTile.y;
    this.generator.setSpawnPoint(this.spawnTileX, this.spawnTileY);

    const spawnPxX = spawnTile.x * TILE_SIZE + 8;
    const spawnPxY = spawnTile.y * TILE_SIZE + 8;

    this.player.setPosition(spawnPxX, spawnPxY);
    this.player.setDepth(spawnPxY);
    this.playerShadow.setPosition(spawnPxX, spawnPxY);
    this.playerShadow.setDepth(spawnPxY - 1);

    this.cameras.main.centerOn(spawnPxX, spawnPxY);

    this.updateVisibleChunks(true);
    this.generateMinimapTexture();
    this.updateMinimapSpawn();
    EventBus.emit('terrain-regenerated', this.config.seed);
  }

  private setupInputs(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.regenerate());
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.regenerate());
      this.keyM = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      this.keyM.on('down', () => this.toggleMinimap());
      this.keyF2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
      this.keyF2.on('down', () => { this.biomeHudVisible = !this.biomeHudVisible; this.biomeHud.setVisible(this.biomeHudVisible); });
    }

    // Zoom com a roda do mouse mantido para visualização agradável
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown[], _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const targetZoom = Phaser.Math.Clamp(Math.round(cam.zoom) + (dy > 0 ? -1 : 1), 1, 4);
      cam.setZoom(targetZoom);
      this.updateVisibleChunks(true);
    });

    EventBus.on('regenerate-world', (seed?: number) => {
      this.regenerate(seed);
    });
  }

  /**
   * Verifica colisão do círculo do jogador com troncos de árvores e rochas ativas nos chunks vizinhos.
   */
  private checkObstacleCollision(targetX: number, targetY: number): boolean {
    const pRadius = this.playerRadius;
    const playerCx = Math.floor(targetX / CHUNK_PIXELS);
    const playerCy = Math.floor(targetY / CHUNK_PIXELS);

    for (let dcy = -1; dcy <= 1; dcy++) {
      for (let dcx = -1; dcx <= 1; dcx++) {
        const chunk = this.loadedChunks.get(`${playerCx + dcx},${playerCy + dcy}`);
        if (!chunk) continue;

        for (const obs of chunk.obstacles) {
          const dx = targetX - obs.x;
          const dy = targetY - obs.y;
          const minDist = pRadius + obs.r;
          if (dx * dx + dy * dy < minDist * minDist) {
            return true; // Colidiu com tronco ou rocha
          }
        }
      }
    }

    return false;
  }

  /**
   * Verifica se a posição do jogador está em terra firme (impede entrar na água profunda).
   * Verifica múltiplos pontos ao redor do pé do jogador (raio ~6px).
   */
  private isWalkable(targetX: number, targetY: number): boolean {
    // Verifica múltiplos pontos ao redor do pé do jogador (raio ~6px)
    const r = this.playerRadius - 1;
    const checks = [
      [targetX, targetY],
      [targetX - r, targetY],
      [targetX + r, targetY],
      [targetX, targetY - r * 0.5],
      [targetX, targetY + r * 0.5],
    ];
    for (const [cx, cy] of checks) {
      const tileX = Math.floor(cx / TILE_SIZE);
      const tileY = Math.floor(cy / TILE_SIZE);
      if (!this.generator.isLand(tileX, tileY)) return false;
    }
    return true;
  }

  private generateMinimapTexture(): void {
    const size = 200;
    let canvasTex: Phaser.Textures.CanvasTexture;
    if (this.textures.exists('world-minimap-tex')) {
      canvasTex = this.textures.get('world-minimap-tex') as Phaser.Textures.CanvasTexture;
    } else {
      canvasTex = this.textures.createCanvas('world-minimap-tex', size, size)!;
    }
    const ctx = canvasTex.getContext();
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const step = WORLD_SIZE / size;
    const landGrid: boolean[][] = [];

    for (let py = 0; py < size; py++) {
      landGrid[py] = [];
      for (let px = 0; px < size; px++) {
        landGrid[py][px] = this.generator.isLand(Math.floor(px * step), Math.floor(py * step));
      }
    }

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const wx = Math.floor(px * step);
        const wy = Math.floor(py * step);
        const land = landGrid[py][px];
        let nearShore = false;
        for (let oy = -1; oy <= 1 && !nearShore; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = px + ox;
            const ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            if (land ? !landGrid[ny][nx] : landGrid[ny][nx]) { nearShore = true; break; }
          }
        }
        const sample = this.generator.sampleWorld(wx, wy, land, nearShore);
        const color = BIOMES[sample.biome].minimap;
        const idx = (py * size + px) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    canvasTex.refresh();
  }

  private setupMinimap(): void {
    this.generateMinimapTexture();

    const W = this.scale.width;
    const H = this.scale.height;
    const centerX = W / 2;
    const centerY = H / 2;
    const boxW = 340;
    const boxH = 410;

    this.minimapContainer = this.add.container(centerX, centerY);
    this.minimapContainer.setDepth(999999);
    this.minimapContainer.setScrollFactor(0);
    this.minimapContainer.setVisible(false);

    // Fundo escuro com estilo RPG
    const bg = this.add.rectangle(0, 0, boxW, boxH, 0x0c1322, 0.94);
    const border = this.add.rectangle(0, 0, boxW + 2, boxH + 2);
    border.setStrokeStyle(2, 0x5a9a6b, 1);

    // Cabeçalho
    const title = this.add.text(0, -180, '🗺️ MAPA MUNDIAL', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const subtitle = this.add.text(0, -162, 'Extensão Total: 5.000 × 5.000 Tiles', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#94a3b8',
    }).setOrigin(0.5, 0.5);

    // Imagem do minimapa
    this.minimapImage = this.add.image(0, -10, 'world-minimap-tex');
    this.minimapImage.setDisplaySize(this.MINIMAP_DISP_SIZE, this.MINIMAP_DISP_SIZE);

    // Moldura interna do mapa
    const mapFrame = this.add.rectangle(0, -10, this.MINIMAP_DISP_SIZE + 2, this.MINIMAP_DISP_SIZE + 2);
    mapFrame.setStrokeStyle(1, 0x223344, 1);

    // Marcador de Spawn
    const sx = (this.spawnTileX * TILE_SIZE) / WORLD_PIXELS;
    const sy = (this.spawnTileY * TILE_SIZE) / WORLD_PIXELS;
    const mapLeft = -this.MINIMAP_DISP_SIZE / 2;
    const mapTop = -10 - this.MINIMAP_DISP_SIZE / 2;

    this.minimapSpawnDot = this.add.circle(mapLeft + sx * this.MINIMAP_DISP_SIZE, mapTop + sy * this.MINIMAP_DISP_SIZE, 4, 0x00e5ff);
    this.minimapSpawnDot.setStrokeStyle(1, 0xffffff);

    // Marcador do Jogador (ponto dourado + anel pulsante)
    this.minimapPlayerRing = this.add.circle(0, 0, 7, 0xffea75, 0.35);
    this.minimapPlayerRing.setStrokeStyle(1.5, 0xffea75);

    this.minimapPlayerDot = this.add.circle(0, 0, 4, 0xffdd00);
    this.minimapPlayerDot.setStrokeStyle(1, 0x000000);

    // Texto de coordenadas e bioma
    this.minimapCoordsText = this.add.text(0, 145, 'Carregando coordenadas...', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // Dicas de atalho
    const footerText = this.add.text(0, 172, '[M] Fechar Mapa   •   [R] Novo Mundo', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#ffd166',
    }).setOrigin(0.5, 0.5);

    this.minimapContainer.add([
      border, bg, title, subtitle,
      this.minimapImage, mapFrame,
      this.minimapSpawnDot,
      this.minimapPlayerRing, this.minimapPlayerDot,
      this.minimapCoordsText, footerText
    ]);
  }

  private repositionMinimap(): void {
    if (!this.minimapContainer) return;
    this.minimapContainer.setPosition(this.scale.width / 2, this.scale.height / 2);
  }

  private updateMinimapSpawn(): void {
    if (!this.minimapSpawnDot) return;
    const sx = (this.spawnTileX * TILE_SIZE) / WORLD_PIXELS;
    const sy = (this.spawnTileY * TILE_SIZE) / WORLD_PIXELS;
    const mapLeft = -this.MINIMAP_DISP_SIZE / 2;
    const mapTop = -10 - this.MINIMAP_DISP_SIZE / 2;
    this.minimapSpawnDot.setPosition(mapLeft + sx * this.MINIMAP_DISP_SIZE, mapTop + sy * this.MINIMAP_DISP_SIZE);
  }

  private toggleMinimap(): void {
    this.minimapVisible = !this.minimapVisible;
    this.minimapContainer.setVisible(this.minimapVisible);
  }

  private updateMinimap(time: number): void {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    if (tx !== this.lastBiomeTileX || ty !== this.lastBiomeTileY) {
      this.lastBiomeTileX = tx;
      this.lastBiomeTileY = ty;
      this.currentBiomeName = this.generator.getBiomeName(tx, ty);
    }
    const biome = this.currentBiomeName;
    if (this.biomeHudVisible && this.biomeHud) this.biomeHud.setText(`${biome}  (${tx}, ${ty})`);
    if (!this.minimapVisible) return;

    const nx = Phaser.Math.Clamp(this.player.x / WORLD_PIXELS, 0, 1);
    const ny = Phaser.Math.Clamp(this.player.y / WORLD_PIXELS, 0, 1);
    const mapLeft = -this.MINIMAP_DISP_SIZE / 2;
    const mapTop = -10 - this.MINIMAP_DISP_SIZE / 2;

    const dotX = mapLeft + nx * this.MINIMAP_DISP_SIZE;
    const dotY = mapTop + ny * this.MINIMAP_DISP_SIZE;

    this.minimapPlayerDot.setPosition(dotX, dotY);
    this.minimapPlayerRing.setPosition(dotX, dotY);

    const pulse = 1.0 + Math.sin(time * 0.007) * 0.35;
    this.minimapPlayerRing.setScale(pulse);
    this.minimapPlayerRing.setAlpha(0.65 - Math.sin(time * 0.007) * 0.25);

    this.minimapCoordsText.setText(`Pos: ${tx}, ${ty}  •  ${biome}`);
  }

  private spawnLeafParticles(x: number, y: number, dirX: number, dirY: number, count = 5): void {
    const leafColors = [0x3e7a32, 0x529e42, 0x6ab854, 0x2d5a24, 0x488a38];
    for (let i = 0; i < count; i++) {
      // Posição inicial no topo da folhagem do arbusto
      const px = x + (Math.random() - 0.5) * 14;
      const py = (y - 4) + (Math.random() - 0.5) * 6;
      const col = leafColors[Math.floor(Math.random() * leafColors.length)];

      // Partícula pixel art: pequenos quadrados nítidos de 1x1 ou 2x2 pixels
      const pSize = Math.random() < 0.4 ? 1 : 2;
      const pixel = this.add.rectangle(Math.round(px), Math.round(py), pSize, pSize, col);
      pixel.setDepth(y + 20);
      pixel.setAlpha(1.0);

      // Deslocamento horizontal e vertical sutis (arraste do vento/passo)
      const hDrift = (dirX !== 0 ? dirX * (4 + Math.random() * 6) : (Math.random() - 0.5) * 8);
      const vDrift = (dirY !== 0 ? dirY * (2 + Math.random() * 4) : 0);
      const targetX = Math.round(px + hDrift + (Math.random() - 0.5) * 4);

      // Nível do chão onde o pixel vai pousar
      const groundY = Math.round(y + 8 + vDrift + Math.random() * 5);
      const hopHeight = 3 + Math.random() * 5;

      // 1. Pequeno salto/descolamento inicial da folha para cima
      this.tweens.add({
        targets: pixel,
        x: Math.round(px + hDrift * 0.3),
        y: Math.round(py - hopHeight),
        duration: 90 + Math.random() * 40,
        ease: 'Quad.easeOut',
        onComplete: () => {
          // 2. Queda com aceleração de gravidade em direção ao chão
          const fallDuration = 280 + Math.random() * 120;
          this.tweens.add({
            targets: pixel,
            x: targetX,
            y: groundY,
            duration: fallDuration,
            ease: 'Quad.easeIn',
            onComplete: () => {
              // 3. Fica um instante parada no chão e então some suavemente
              this.tweens.add({
                targets: pixel,
                alpha: 0,
                duration: 350,
                delay: 250 + Math.random() * 200,
                ease: 'Linear',
                onComplete: () => {
                  pixel.destroy();
                }
              });
            }
          });
        }
      });
    }
  }

  private rustleBush(bush: Phaser.GameObjects.Image, moveX: number, moveY: number, isEntry: boolean): void {
    this.tweens.killTweensOf(bush);

    const dir = moveX !== 0 ? (moveX > 0 ? 1 : -1) : (moveY > 0 ? 1 : -1);
    const maxAngle = isEntry ? (8 * dir) : (-5 * dir);

    this.tweens.add({
      targets: bush,
      angle: maxAngle,
      duration: 80,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: bush,
          angle: 0,
          duration: 320,
          ease: 'Elastic.easeOut',
          easeParams: [1.1, 0.45],
          onComplete: () => {
            bush.angle = 0;
          }
        });
      }
    });

    this.spawnLeafParticles(bush.x, bush.y - 6, moveX, moveY, isEntry ? 5 : 3);
  }

  override update(time: number, delta: number): void {
    if (!this.player) return;

    const dt = delta / 1000;
    const isRunning = this.keyShift?.isDown;
    const baseSpeed = isRunning ? 230 : 145; // Pixels por segundo

    // ── 1. LEITURA DOS COMANDOS DE DIREÇÃO ──────────────────────────────────
    let moveX = 0;
    let moveY = 0;

    if (this.cursors?.left?.isDown  || this.keyA?.isDown) moveX -= 1;
    if (this.cursors?.right?.isDown || this.keyD?.isDown) moveX += 1;
    if (this.cursors?.up?.isDown    || this.keyW?.isDown) moveY -= 1;
    if (this.cursors?.down?.isDown  || this.keyS?.isDown) moveY += 1;

    const isMoving = moveX !== 0 || moveY !== 0;

    // ── 2. MOVIMENTAÇÃO COM COLISÃO SUAVE E DESLIZAMENTO (SLIDE COLLISION) ──
    if (isMoving) {
      if (moveX !== 0 && moveY !== 0) {
        // Normaliza vetor diagonal
        moveX *= 0.7071;
        moveY *= 0.7071;
      }

      const dx = moveX * baseSpeed * dt;
      const dy = moveY * baseSpeed * dt;

      // Pé do personagem (ponto de contato com chão)
      const footX = this.player.x;
      const footY = this.player.y - 2;

      // Movimento no eixo X
      const tryX = footX + dx;
      if (this.isWalkable(tryX, footY) && !this.checkObstacleCollision(tryX, footY)) {
        this.player.x = tryX;
      }

      // Movimento no eixo Y
      const newFootX = this.player.x;
      const tryFootY = footY + dy;
      if (this.isWalkable(newFootX, tryFootY) && !this.checkObstacleCollision(newFootX, tryFootY)) {
        this.player.y = tryFootY + 2;
      }

      // Atualiza direção do sprite
      if (Math.abs(moveX) > Math.abs(moveY)) {
        this.playerFacing = moveX > 0 ? 'right' : 'left';
      } else {
        this.playerFacing = moveY > 0 ? 'down' : 'up';
      }

      const animKey = `walk-${this.playerFacing}`;
      if (this.player.anims.currentAnim?.key !== animKey) {
        this.player.play(animKey);
      }
    } else {
      // Parado: exibe frame estático da última direção virada
      this.player.stop();
      if (this.playerFacing === 'down')  this.player.setFrame(0);
      else if (this.playerFacing === 'up')    this.player.setFrame(4);
      else if (this.playerFacing === 'left')  this.player.setFrame(8);
      else if (this.playerFacing === 'right') this.player.setFrame(12);
    }

    // Sincroniza sombra dos pés do personagem
    this.playerShadow.setPosition(this.player.x, this.player.y);

    // ── 3. SISTEMA DE PROFUNDIDADE (Y-SORTING) ──────────────────────────────
    // Quanto maior o Y, mais à frente na tela o elemento é desenhado
    this.player.setDepth(this.player.y);
    this.playerShadow.setDepth(this.player.y - 1);

    // ── 4. ARBUSTOS INTERATIVOS: MEXER APENAS AO ENTRAR/SAIR + PARTÍCULAS ───
    const playerFeetX = this.player.x;
    const playerFeetY = this.player.y - 2;
    const playerCx = Math.floor(playerFeetX / CHUNK_PIXELS);
    const playerCy = Math.floor(playerFeetY / CHUNK_PIXELS);
    const BUSH_RADIUS = 18;

    for (let dcy = -1; dcy <= 1; dcy++) {
      for (let dcx = -1; dcx <= 1; dcx++) {
        const chunk = this.loadedChunks.get(`${playerCx + dcx},${playerCy + dcy}`);
        if (!chunk) continue;

        for (const bushState of chunk.bushes) {
          const bush = bushState.image;
          const bdx = bush.x - playerFeetX;
          const bdy = (bush.y - 8) - playerFeetY;
          const distSq = bdx * bdx + bdy * bdy;
          const inRange = distSq < BUSH_RADIUS * BUSH_RADIUS;
          const wasInRange = bushState.wasInRange;

          // Detecta ENTRADA (estava fora, agora dentro e se movendo)
          if (inRange && !wasInRange && isMoving) {
            this.rustleBush(bush, moveX, moveY, true);
          }
          // Detecta SAÍDA (estava dentro, agora fora)
          else if (!inRange && wasInRange) {
            this.rustleBush(bush, moveX, moveY, false);
          }

          bushState.wasInRange = inRange;
        }

        // O sprite completo da árvore desbota; a sombra permanece opaca.
        const playerRect = {
          left: playerFeetX - 6,
          right: playerFeetX + 6,
          top: playerFeetY - 28,
          bottom: playerFeetY,
        };
        for (const tree of chunk.trees) {
          if (Math.abs(tree.x - playerFeetX) > 200 || Math.abs(tree.baseY - playerFeetY) > 240) {
            tree.wasFaded = false;
            tree.alpha = smoothAlpha(tree.alpha, 1, dt);
            tree.image.setAlpha(tree.alpha);
            continue;
          }
          const targetFaded = shouldFade(playerRect, tree);
          tree.wasFaded = targetFaded;
          const targetAlpha = targetFaded ? 0.4 : 1;
          tree.alpha = smoothAlpha(tree.alpha, targetAlpha, dt);
          tree.image.setAlpha(tree.alpha);
        }
      }
    }

    // ── 5. CARREGAMENTO CONTÍNUO DE CHUNKS AO REDOR DO JOGADOR ──────────────
    this.updateVisibleChunks();

    // ── 6. ATUALIZAÇÃO DO MINIMAPA ──────────────────────────────────────────
    this.updateMinimap(time);
  }
}
