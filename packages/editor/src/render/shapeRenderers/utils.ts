import type { RGBA, Stroke } from '@rough/schema';
import { rgbaToCss } from '@rough/shared';

export function applyOpacity(color: RGBA, opacity: number): string {
  return rgbaToCss({ ...color, a: color.a * opacity });
}

export function setLineDash(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.style === 'dashed') {
    ctx.setLineDash([stroke.width * 3, stroke.width * 2]);
  } else if (stroke.style === 'dotted') {
    ctx.setLineDash([stroke.width, stroke.width * 1.5]);
  } else {
    ctx.setLineDash([]);
  }
}
