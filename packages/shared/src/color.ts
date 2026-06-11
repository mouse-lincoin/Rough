import type { RGBA } from '@rough/schema';

export function rgbaToCss(color: RGBA): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

export const DEFAULT_STROKE: RGBA = { r: 26, g: 26, b: 26, a: 1 };
export const DEFAULT_FILL: RGBA = { r: 255, g: 255, b: 255, a: 1 };
export const CANVAS_BACKGROUND: RGBA = { r: 248, g: 248, b: 244, a: 1 };
