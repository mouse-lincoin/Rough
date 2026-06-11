import type { EllipseElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { getOrCreateDrawable, getRoughGenerator } from '../roughCache.js';
import { applyOpacity, setLineDash } from './utils.js';
import { drawRoughDrawable } from './roughDraw.js';

export function renderEllipse(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as EllipseElement;
  const w = el.width;
  const h = el.height;
  const opacity = el.opacity;
  const roughness = forceClean ? 0 : el.roughness;
  const cx = w / 2;
  const cy = h / 2;

  if (roughness === 0) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    for (const fill of el.fills) {
      if (fill.type === 'solid') {
        ctx.fillStyle = applyOpacity(fill.color, opacity);
        ctx.fill();
      }
    }
    for (const stroke of el.strokes) {
      ctx.strokeStyle = applyOpacity(stroke.color, opacity);
      ctx.lineWidth = stroke.width;
      setLineDash(ctx, stroke);
      ctx.stroke();
    }
    return;
  }

  const gen = getRoughGenerator();
  const drawable = getOrCreateDrawable(el, w, h, () => {
    const options = {
      roughness,
      seed: el.roughSeed,
      strokeWidth: el.strokes[0]?.width ?? 2,
      stroke: el.strokes[0] ? applyOpacity(el.strokes[0].color, opacity) : undefined,
      fill: el.fills[0]?.type === 'solid' ? applyOpacity(el.fills[0].color, opacity) : undefined,
    };
    return gen.ellipse(cx, cy, w, h, options);
  });
  drawRoughDrawable(ctx, drawable);
}
