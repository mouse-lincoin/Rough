import type { Vec2 } from '@rough/schema';

const STUB = 16;

export function buildArrowPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  routing: 'straight' | 'orthogonal' | 'curved',
): { x: number; y: number; width: number; height: number; points: Vec2[] } {
  const worldPoints =
    routing === 'orthogonal' ? buildOrthogonalWorldPoints(x1, y1, x2, y2) : [{ x: x1, y: y1 }, { x: x2, y: y2 }];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of worldPoints) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const points = worldPoints.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  return { x: minX, y: minY, width, height, points };
}

function buildOrthogonalWorldPoints(x1: number, y1: number, x2: number, y2: number): Vec2[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  const sx = dx >= 0 ? STUB : -STUB;
  const sy = dy >= 0 ? STUB : -STUB;

  if (Math.abs(dx) < STUB * 2 || Math.abs(dy) < STUB * 2) {
    const mid = { x: x1 + sx, y: y2 };
    return [{ x: x1, y: y1 }, mid, { x: x2, y: y2 }];
  }

  const p1 = { x: x1 + sx, y: y1 };
  const p2 = { x: x1 + sx, y: y2 - sy };
  const p3 = { x: x2, y: y2 - sy };
  return [{ x: x1, y: y1 }, p1, p2, p3, { x: x2, y: y2 }];
}
