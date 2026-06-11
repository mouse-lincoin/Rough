import type { ImageElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import type { ImageCache } from '../imageCache.js';
import { applyOpacity } from './utils.js';

export function renderImage(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  imageCache: ImageCache,
): void {
  const el = node.element as ImageElement;
  const bitmap = imageCache.get(el.assetId);

  ctx.globalAlpha *= el.opacity;

  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, el.width, el.height);
    return;
  }

  void imageCache.load(el.assetId);

  ctx.strokeStyle = applyOpacity({ r: 150, g: 150, b: 150, a: 1 }, el.opacity);
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, el.width, el.height);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(el.width, el.height);
  ctx.moveTo(el.width, 0);
  ctx.lineTo(0, el.height);
  ctx.stroke();
}
