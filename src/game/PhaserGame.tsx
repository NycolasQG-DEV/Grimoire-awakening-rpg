import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TerrainScene } from './scenes/TerrainScene';

export const PhaserGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: '100%',
      height: '100%',
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#0a0e17',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootScene, TerrainScene],
    };

    gameRef.current = new Phaser.Game(config);
    (window as any).__PHASER_GAME__ = gameRef.current;

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'hidden',
        imageRendering: 'pixelated',
      }}
    />
  );
};
