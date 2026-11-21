export interface PlayerRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AlphaMask {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface TreeOccluder {
  x: number;
  baseY: number;
  spriteTop: number;
  spriteBottom: number;
  spriteWidth: number;
  mask: AlphaMask;
  wasFaded: boolean;
}

function intersectsOpaqueMask(player: PlayerRect, tree: TreeOccluder): boolean {
  const left = Math.max(player.left, tree.x - tree.spriteWidth / 2);
  const right = Math.min(player.right, tree.x + tree.spriteWidth / 2);
  const top = Math.max(player.top, tree.spriteTop);
  const bottom = Math.min(player.bottom, tree.spriteBottom);
  if (left > right || top > bottom) return false;

  const startX = Math.max(0, Math.floor(left - (tree.x - tree.spriteWidth / 2)));
  const endX = Math.min(tree.mask.width - 1, Math.ceil(right - (tree.x - tree.spriteWidth / 2)));
  const startY = Math.max(0, Math.floor(top - tree.spriteTop));
  const endY = Math.min(tree.mask.height - 1, Math.ceil(bottom - tree.spriteTop));

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (tree.mask.data[(y * tree.mask.width + x) * 4 + 3] > 24) return true;
    }
  }
  return false;
}

/** Decide somente pelo corpo do jogador, pela máscara alfa do sprite completo e pelo Y-sort. */
export function shouldFade(player: PlayerRect, tree: TreeOccluder): boolean {
  // O jogador está atrás da árvore somente quando os pés estão acima da base.
  if (player.bottom >= tree.baseY - 1) return false;

  // Histerese: mantém a árvore em fade até o corpo sair 4 px da máscara.
  const margin = tree.wasFaded ? 4 : 0;
  const adjusted = {
    left: player.left - margin,
    right: player.right + margin,
    top: player.top - margin,
    bottom: player.bottom + margin,
  };
  return intersectsOpaqueMask(adjusted, tree);
}

export function smoothAlpha(current: number, target: number, deltaSeconds: number, speed = 12): number {
  const amount = 1 - Math.exp(-Math.max(0, deltaSeconds) * speed);
  const next = current + (target - current) * amount;
  return Math.abs(next - target) < 0.005 ? target : next;
}
