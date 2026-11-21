import React from 'react';
import { PhaserGame } from './game/PhaserGame';

export const App: React.FC = () => {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PhaserGame />

      {/* Dica de atalhos discreta e não-intrusiva */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '6px 12px',
          background: 'rgba(10, 14, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#94a3b8',
          fontFamily: 'monospace',
          fontSize: 11,
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'flex',
          gap: 12,
          zIndex: 10,
        }}
      >
        <span><strong style={{ color: '#e2e8f0' }}>WASD / Setas:</strong> Mover Personagem</span>
        <span><strong style={{ color: '#e2e8f0' }}>Shift:</strong> Correr</span>
        <span><strong style={{ color: '#e2e8f0' }}>Scroll:</strong> Zoom</span>
        <span><strong style={{ color: '#38bdf8' }}>[R] ou [Espaço]:</strong> Novo Terreno</span>
      </div>
    </div>
  );
};

export default App;
