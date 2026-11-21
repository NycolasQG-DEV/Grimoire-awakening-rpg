import assert from 'node:assert/strict';
import { shouldFade, smoothAlpha } from '../src/game/systems/occlusionSystem.ts';

const width = 80;
const height = 60;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const isEmptyCrownCorner = x < 24 && y < 24;
    data[(y * width + x) * 4 + 3] = isEmptyCrownCorner ? 0 : 255;
  }
}

const tree = (x, wasFaded = false) => ({
  x,
  baseY: 100,
  spriteTop: 20,
  spriteBottom: 80,
  spriteWidth: 80,
  mask: { width, height, data },
  wasFaded,
});
const playerBehindTrunk = { left: 94, right: 106, top: 50, bottom: 78 };

assert.equal(shouldFade(playerBehindTrunk, tree(100)), true, 'copa deve desbotar quando o jogador está atrás do tronco');
assert.equal(shouldFade({ left: 143, right: 155, top: 50, bottom: 78 }, tree(100)), false, 'não deve desbotar ao lado do tronco');
assert.equal(shouldFade({ left: 61, right: 72, top: 21, bottom: 33 }, tree(100)), false, 'canto transparente da copa não deve desbotar');
assert.equal(shouldFade({ left: 94, right: 106, top: 75, bottom: 103 }, tree(100)), false, 'jogador na frente da árvore não deve desbotar');
assert.equal(shouldFade(playerBehindTrunk, tree(50)), false, 'árvore à esquerda não deve desbotar quando o jogador está entre duas árvores');
assert.equal(shouldFade(playerBehindTrunk, tree(150)), false, 'árvore à direita não deve desbotar quando o jogador está entre duas árvores');
assert.equal(shouldFade({ left: 138, right: 144, top: 50, bottom: 78 }, tree(100, true)), true, 'histerese mantém fade por 4 px na borda');

const smoothed = smoothAlpha(0, 1, 1 / 12);
assert.ok(Math.abs(smoothed - (1 - Math.exp(-1))) < 1e-9, 'alpha deve ser suavizado pelo delta time');

console.log('Occlusion tests: 8/8 passed');
