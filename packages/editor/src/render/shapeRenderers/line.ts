import type { LineElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { getOrCreateDrawable, getRoughGenerator } from '../roughCache.js';
import { applyOpacity, setLineDash } from './utils.js';
import { drawRoughDrawable } from './roughDraw.js';

export function renderLine(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as LineElement;
  const [p0, p1] = el.points;
  const opacity = el.opacity;
  const roughness = forceClean ? 0 : el.roughness;

  if (roughness === 0) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    for (const stroke of el.strokes) {
      ctx.strokeStyle = applyOpacity(stroke.color, opacity);
      ctx.lineWidth = stroke.width;
      setLineDash(ctx, stroke);
      ctx.stroke();
    }
    return;
  }

  const gen = getRoughGenerator();
  const w = el.width;
  const h = el.height;
  const drawable = getOrCreateDrawable(el, w, h, () => {
    const options = {
      roughness,
      seed: el.roughSeed,
      strokeWidth: el.strokes[0]?.width ?? 2,
      stroke: el.strokes[0] ? applyOpacity(el.strokes[0].color, opacity) : undefined,
    };
    return gen.line(p0.x, p0.y, p1.x, p1.y, options);
  });
  drawRoughDrawable(ctx, drawable);
}
