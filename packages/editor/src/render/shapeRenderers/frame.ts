import type { FrameElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { rgbaToCss } from '@rough/shared';
import { applyOpacity } from './utils.js';

export function renderFrameBackground(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
): void {
  const el = node.element as FrameElement;
  if (!el.background) return;
  ctx.fillStyle = applyOpacity(el.background, el.opacity);
  ctx.fillRect(0, 0, el.width, el.height);
}

export function renderFrameBorder(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as FrameElement;
  if (forceClean || el.roughness === 0) {
    for (const stroke of el.strokes) {
      ctx.strokeStyle = applyOpacity(stroke.color, el.opacity);
      ctx.lineWidth = stroke.width;
      ctx.strokeRect(0, 0, el.width, el.height);
    }
    return;
  }
  // Frame border uses clean rect in rough mode for stability
  for (const stroke of el.strokes) {
    ctx.strokeStyle = applyOpacity(stroke.color, el.opacity);
    ctx.lineWidth = stroke.width;
    ctx.strokeRect(0, 0, el.width, el.height);
  }
}

export function renderFrameLabel(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  zoom: number,
): void {
  if (zoom < 0.3) return;
  const el = node.element as FrameElement;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const m = node.worldMatrix;
  const labelX = m[4];
  const labelY = m[5] - 14 / zoom;
  ctx.translate(labelX * zoom, labelY * zoom);
  ctx.scale(zoom, zoom);
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = rgbaToCss({ r: 100, g: 100, b: 100, a: 1 });
  ctx.fillText(el.name, 0, 0);
  ctx.restore();
}
