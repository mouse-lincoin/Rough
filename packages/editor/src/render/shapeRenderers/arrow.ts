import type { ArrowElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { getOrCreateDrawable, getRoughGenerator } from '../roughCache.js';
import { drawRoughDrawable } from './roughDraw.js';
import { applyOpacity, setLineDash } from './utils.js';

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  head: 'none' | 'arrow' | 'dot',
  color: string,
  width: number,
): void {
  if (head === 'none') return;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = Math.max(8, width * 3);

  if (head === 'dot') {
    ctx.beginPath();
    ctx.arc(to.x, to.y, size / 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function renderArrow(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as ArrowElement;
  const points = el.points;
  if (points.length < 2) return;

  const opacity = el.opacity;
  const roughness = forceClean ? 0 : el.roughness;
  const strokeColor = el.strokes[0]
    ? applyOpacity(el.strokes[0].color, opacity)
    : '#1a1a1a';
  const strokeWidth = el.strokes[0]?.width ?? 2;

  if (roughness === 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    if (el.strokes[0]) setLineDash(ctx, el.strokes[0]);
    ctx.stroke();

    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    drawArrowHead(ctx, prev, last, el.endHead, strokeColor, strokeWidth);
    if (el.startHead !== 'none') {
      drawArrowHead(ctx, points[1], points[0], el.startHead, strokeColor, strokeWidth);
    }
    return;
  }

  const gen = getRoughGenerator();
  const drawable = getOrCreateDrawable(el, el.width, el.height, () => {
    const tuples = points.map((p) => [p.x, p.y] as [number, number]);
    return gen.linearPath(tuples, {
      roughness,
      seed: el.roughSeed,
      strokeWidth,
      stroke: strokeColor,
    });
  });
  drawRoughDrawable(ctx, drawable);

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  drawArrowHead(ctx, prev, last, el.endHead, strokeColor, strokeWidth);
}
