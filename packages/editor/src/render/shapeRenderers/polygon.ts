import type { PolygonElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { getOrCreateDrawable, getRoughGenerator } from '../roughCache.js';
import { drawRoughDrawable } from './roughDraw.js';
import { applyOpacity, setLineDash } from './utils.js';

function getVertices(el: PolygonElement): { x: number; y: number }[] {
  const cx = el.width / 2;
  const cy = el.height / 2;
  const rx = el.width / 2;
  const ry = el.height / 2;
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < el.sides; i++) {
    const angle = (2 * Math.PI * i) / el.sides - Math.PI / 2;
    verts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return verts;
}

export function renderPolygon(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
): void {
  const el = node.element as PolygonElement;
  const verts = getVertices(el);
  const opacity = el.opacity;
  const roughness = forceClean ? 0 : el.roughness;

  if (roughness === 0) {
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
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
  const drawable = getOrCreateDrawable(el, el.width, el.height, () => {
    const options = {
      roughness,
      seed: el.roughSeed,
      strokeWidth: el.strokes[0]?.width ?? 2,
      stroke: el.strokes[0] ? applyOpacity(el.strokes[0].color, opacity) : undefined,
      fill: el.fills[0]?.type === 'solid' ? applyOpacity(el.fills[0].color, opacity) : undefined,
      fillStyle: el.fills[0]?.type === 'hachure' ? 'hachure' : 'solid',
    };
    return gen.polygon(
      verts.map((v) => [v.x, v.y] as [number, number]),
      options,
    );
  });
  drawRoughDrawable(ctx, drawable);
}
