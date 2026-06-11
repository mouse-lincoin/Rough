import type { PathElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { getOrCreateDrawable, getRoughGenerator } from '../roughCache.js';
import { applyOpacity, setLineDash } from './utils.js';
import { drawRoughDrawable } from './roughDraw.js';

export function renderPath(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as PathElement;
  if (el.points.length < 2) return;

  const opacity = el.opacity;
  const roughness = forceClean ? 0 : el.roughness;

  if (roughness === 0) {
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
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
  const w = el.width;
  const h = el.height;
  const drawable = getOrCreateDrawable(el, w, h, () => {
    const options = {
      roughness,
      seed: el.roughSeed,
      strokeWidth: el.strokes[0]?.width ?? 2,
      stroke: el.strokes[0] ? applyOpacity(el.strokes[0].color, opacity) : undefined,
    };
    return gen.linearPath(
      el.points.map((p) => [p.x, p.y]),
      options,
    );
  });
  drawRoughDrawable(ctx, drawable);
}
