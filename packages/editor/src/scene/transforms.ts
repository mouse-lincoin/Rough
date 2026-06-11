import type { Vec2 } from '@rough/schema';

/** Affine matrix [a, b, c, d, e, f] for | a c e | / | b d f | / | 0 0 1 | */
export type Mat2D = [number, number, number, number, number, number];

export function matIdentity(): Mat2D {
  return [1, 0, 0, 1, 0, 0];
}

export function matMultiply(a: Mat2D, b: Mat2D): Mat2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function matTranslate(x: number, y: number): Mat2D {
  return [1, 0, 0, 1, x, y];
}

export function matRotate(angle: number, cx = 0, cy = 0): Mat2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (cx === 0 && cy === 0) {
    return [cos, sin, -sin, cos, 0, 0];
  }
  return matMultiply(matTranslate(cx, cy), matMultiply([cos, sin, -sin, cos, 0, 0], matTranslate(-cx, -cy)));
}

export function matApply(m: Mat2D, p: Vec2): Vec2 {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

export function matInvert(m: Mat2D): Mat2D | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-10) return null;
  const invDet = 1 / det;
  const a = m[0];
  const b = m[1];
  const c = m[2];
  const d = m[3];
  const e = m[4];
  const f = m[5];
  return [
    d * invDet,
    -b * invDet,
    -c * invDet,
    a * invDet,
    (c * f - d * e) * invDet,
    (b * e - a * f) * invDet,
  ];
}

export function elementLocalMatrix(x: number, y: number, w: number, h: number, rotation: number): Mat2D {
  const cx = w / 2;
  const cy = h / 2;
  return matMultiply(matTranslate(x, y), matMultiply(matTranslate(cx, cy), matMultiply(matRotate(rotation), matTranslate(-cx, -cy))));
}

export function getElementCorners(x: number, y: number, w: number, h: number, rotation: number): Vec2[] {
  const m = elementLocalMatrix(x, y, w, h, rotation);
  return [
    matApply(m, { x: 0, y: 0 }),
    matApply(m, { x: w, y: 0 }),
    matApply(m, { x: w, y: h }),
    matApply(m, { x: 0, y: h }),
  ];
}
