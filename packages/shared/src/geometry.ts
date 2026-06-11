import type { Vec2 } from '@rough/schema';

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function snapAngle(dx: number, dy: number, step = Math.PI / 4): Vec2 {
  const angle = Math.atan2(dy, dx);
  const dist = Math.hypot(dx, dy);
  const snapped = Math.round(angle / step) * step;
  return { x: Math.cos(snapped) * dist, y: Math.sin(snapped) * dist };
}

/** Ramer-Douglas-Peucker path simplification */
export function simplifyPath(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  const start = points[0];
  const finish = points[end];

  for (let i = 1; i < end; i++) {
    const d = distanceToSegment(points[i], start, finish);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, finish];
}
