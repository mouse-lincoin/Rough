import type { Effect } from '@rough/schema';
import { rgbaToCss } from '@rough/shared';

export function applyCanvasEffects(ctx: CanvasRenderingContext2D, effects: Effect[]): void {
  const shadow = effects.find((e) => e.type === 'drop-shadow');
  const blur = effects.find((e) => e.type === 'layer-blur');
  if (shadow) {
    ctx.shadowColor = rgbaToCss(shadow.color);
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.offset.x;
    ctx.shadowOffsetY = shadow.offset.y;
  }
  if (blur) {
    ctx.filter = `blur(${blur.radius}px)`;
  }
}

export function clearCanvasEffects(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.filter = 'none';
}
