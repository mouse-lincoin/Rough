import type { RectangleElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { getOrCreateDrawable, getRoughGenerator } from '../roughCache.js';
import { drawRoughDrawable } from './roughDraw.js';
import { applyOpacity, setLineDash } from './utils.js';

export function renderRectangle(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as RectangleElement;
  const w = el.width;
  const h = el.height;
  const opacity = el.opacity;
  const roughness = forceClean ? 0 : el.roughness;

  if (roughness === 0) {
    const radius = Array.isArray(el.cornerRadius) ? el.cornerRadius[0] : el.cornerRadius;
    ctx.beginPath();
    if (radius > 0) {
      ctx.roundRect(0, 0, w, h, radius);
    } else {
      ctx.rect(0, 0, w, h);
    }
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
      fillStyle: el.fills[0]?.type === 'hachure' ? 'hachure' : 'solid',
    };
    return gen.rectangle(0, 0, w, h, options);
  });
  drawRoughDrawable(ctx, drawable);
}
