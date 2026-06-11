import type { RGBA, Stroke, TextStyle } from '@rough/schema';

export const ACCENT: RGBA = { r: 105, g: 101, b: 219, a: 1 };
export const INK: RGBA = { r: 26, g: 26, b: 26, a: 1 };
export const MUTED: RGBA = { r: 156, g: 163, b: 175, a: 1 };
export const SURFACE: RGBA = { r: 255, g: 255, b: 255, a: 1 };
export const BORDER: RGBA = { r: 229, g: 229, b: 229, a: 1 };
export const FILL_LIGHT: RGBA = { r: 245, g: 245, b: 245, a: 1 };

export const STROKE: Stroke = { color: INK, width: 2, style: 'solid' };
export const STROKE_MUTED: Stroke = { color: MUTED, width: 1, style: 'solid' };

export const TEXT_BODY: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.4,
  textAlign: 'left',
  verticalAlign: 'middle',
  color: INK,
};

export const TEXT_HEADING: TextStyle = {
  ...TEXT_BODY,
  fontSize: 16,
  fontWeight: 700,
};

export const TEXT_SMALL: TextStyle = {
  ...TEXT_BODY,
  fontSize: 12,
};
